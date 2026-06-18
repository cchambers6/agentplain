/**
 * lib/voice/recording.ts
 *
 * Call-recording consent + retention, gated through the SAME approval-queue
 * seam every mutating connector uses: a `WorkApprovalQueueItem` the owner
 * approves on /approvals, and an `APPROVAL_REQUIRED` McpResult (the shape
 * `lib/integrations/mcp-core` maps to HTTP 409) when no grant exists yet.
 * Recording a phone call is a high-stakes, jurisdiction-sensitive
 * act — in two-party-consent states recording without the caller's consent is
 * unlawful — so it is NEVER on by default. A workspace owner must opt in, and
 * that opt-in is a `WorkApprovalQueueItem` (kind `VOICE_RECORDING_CONSENT`) the
 * owner approves on /approvals.
 *
 * The grant is fingerprint-bound to the workspace's recording POLICY (retention
 * window + two-party-prompt flag), so changing the policy invalidates the old
 * consent and forces a fresh decision. It expires `RECORDING_CONSENT_TTL_MS`
 * after approval (an annual re-consent for compliance hygiene).
 *
 * The incoming-call route asks `evaluateRecordingConsent` BEFORE it emits a
 * `<Start><Recording>` verb. No approved, unexpired grant → the call still
 * proceeds, just un-recorded. Recording is additive; it never blocks the call.
 */

import { createHash } from 'node:crypto';
import type { Prisma, WorkApprovalKind } from '@prisma/client';
import { mcpOk, mcpError, type McpResult } from '@/lib/integrations/mcp-core';
import { withSystemContext } from '@/lib/db/rls';

/**
 * An `APPROVAL_REQUIRED` result carrying the pending queue-item id as
 * `reference`. The MCP route layer maps this code to HTTP 409; the incoming
 * call route reads `reference` to surface the pending opt-in. Mirrors the
 * mutating-connector approval seam without depending on a specific connector.
 */
function approvalRequired(message: string, reference: string) {
  return mcpError('APPROVAL_REQUIRED', message, { reference });
}
import {
  decryptPayloadForRead,
  encryptPayloadForWrite,
} from '@/lib/security/payload-crypto';

/** Recording consent is re-confirmed annually. */
export const RECORDING_CONSENT_TTL_MS = 365 * 24 * 60 * 60 * 1000;
/** Default media retention if the owner doesn't pick one. */
export const DEFAULT_RECORDING_RETENTION_DAYS = 90;

const AGENT_SLUG = 'voice-recording-consent';
const REF_TABLE = 'VoiceCallRecording';
const DISCIPLINE = 'operations';
const KIND = 'VOICE_RECORDING_CONSENT' as WorkApprovalKind;

/**
 * US states requiring ALL parties to consent to recording. When the caller's
 * OR the called number's state is in this set, the playbook must speak a
 * recording disclosure and the policy's `requireTwoPartyConsentPrompt` is on.
 * (Authoritative list as of 2026; counsel should confirm before launch.)
 */
export const TWO_PARTY_CONSENT_STATES: ReadonlySet<string> = new Set([
  'CA',
  'DE',
  'FL',
  'IL',
  'MD',
  'MA',
  'MI',
  'MT',
  'NV',
  'NH',
  'PA',
  'WA',
  'CT',
  'OR',
]);

export interface RecordingRetentionPolicy {
  /** Days to retain call media before purge. */
  retentionDays: number;
  /** Whether the playbook must speak a recording disclosure to the caller. */
  requireTwoPartyConsentPrompt: boolean;
}

export function defaultRecordingPolicy(): RecordingRetentionPolicy {
  return {
    retentionDays: DEFAULT_RECORDING_RETENTION_DAYS,
    requireTwoPartyConsentPrompt: true,
  };
}

/** Whether a two-party disclosure is required given caller/called states. */
export function requiresTwoPartyPrompt(
  callerState?: string | null,
  calledState?: string | null,
): boolean {
  const a = callerState?.toUpperCase();
  const b = calledState?.toUpperCase();
  return Boolean((a && TWO_PARTY_CONSENT_STATES.has(a)) || (b && TWO_PARTY_CONSENT_STATES.has(b)));
}

/** Retention expiry for a recording captured at `recordedAtMs`. */
export function recordingExpiresAt(recordedAtMs: number, policy: RecordingRetentionPolicy): Date {
  return new Date(recordedAtMs + policy.retentionDays * 24 * 60 * 60 * 1000);
}

/** A stable hash binding a consent grant to the exact recording policy. */
export function recordingConsentFingerprint(
  workspaceId: string,
  policy: RecordingRetentionPolicy,
): string {
  const canonical = {
    workspaceId,
    retentionDays: policy.retentionDays,
    requireTwoPartyConsentPrompt: policy.requireTwoPartyConsentPrompt,
  };
  return createHash('sha256').update(JSON.stringify(canonical)).digest('hex');
}

export interface RecordingConsentGrant {
  pendingApprovalId: string;
  approvedByUserId: string | null;
  approvedAt: string | null;
  expiresAt: string | null;
  policy: RecordingRetentionPolicy;
}

/** The persistence port — two implementations (Prisma + in-memory test). */
export interface VoiceRecordingConsentGate {
  check(args: {
    workspaceId: string;
    policy: RecordingRetentionPolicy;
  }): Promise<McpResult<RecordingConsentGrant>>;
}

function fingerprintFromPayload(payload: Prisma.JsonValue): string | null {
  const decrypted = decryptPayloadForRead(payload);
  if (!decrypted || typeof decrypted !== 'object' || Array.isArray(decrypted)) return null;
  const fp = (decrypted as Record<string, unknown>).fingerprint;
  return typeof fp === 'string' ? fp : null;
}

function buildPayload(
  workspaceId: string,
  policy: RecordingRetentionPolicy,
  fingerprint: string,
): unknown {
  return {
    type: 'recording-consent',
    fingerprint,
    workspaceId,
    retentionDays: policy.retentionDays,
    requireTwoPartyConsentPrompt: policy.requireTwoPartyConsentPrompt,
  };
}

export interface PrismaVoiceRecordingConsentGateOptions {
  now?: () => number;
}

/**
 * Production gate. Mirrors `PrismaDocuSignApprovalGate` exactly: honor an
 * approved, unexpired, fingerprint-matched grant; otherwise find-or-create a
 * PENDING opt-in and return APPROVAL_REQUIRED.
 */
export class PrismaVoiceRecordingConsentGate implements VoiceRecordingConsentGate {
  private readonly now: () => number;

  constructor(options: PrismaVoiceRecordingConsentGateOptions = {}) {
    this.now = options.now ?? Date.now;
  }

  async check(args: {
    workspaceId: string;
    policy: RecordingRetentionPolicy;
  }): Promise<McpResult<RecordingConsentGrant>> {
    const { workspaceId, policy } = args;
    const fingerprint = recordingConsentFingerprint(workspaceId, policy);

    return withSystemContext(async (tx) => {
      // Honor the most recent APPROVED grant for this exact policy.
      const approved = await tx.workApprovalQueueItem.findFirst({
        where: { workspaceId, kind: KIND, status: 'APPROVED' },
        orderBy: { decidedAt: 'desc' },
      });
      if (approved && fingerprintFromPayload(approved.payload) === fingerprint) {
        const decidedMs = approved.decidedAt ? approved.decidedAt.getTime() : null;
        const expiresMs = decidedMs !== null ? decidedMs + RECORDING_CONSENT_TTL_MS : null;
        if (expiresMs === null || this.now() <= expiresMs) {
          return mcpOk({
            pendingApprovalId: approved.id,
            approvedByUserId: approved.decidedByUserId,
            approvedAt: approved.decidedAt ? approved.decidedAt.toISOString() : null,
            expiresAt: expiresMs !== null ? new Date(expiresMs).toISOString() : null,
            policy,
          });
        }
        await tx.workApprovalQueueItem.update({
          where: { id: approved.id },
          data: { status: 'EXPIRED' },
        });
        // fall through to re-request
      }

      // No valid grant — find-or-create a PENDING opt-in (deduped by fingerprint).
      const existing = await tx.workApprovalQueueItem.findFirst({
        where: { workspaceId, kind: KIND, refId: fingerprint, status: 'PENDING' },
      });
      if (existing) {
        return approvalRequired(
          'Call recording is off until you approve recording + retention for this workspace.',
          existing.id,
        );
      }
      const created = await tx.workApprovalQueueItem.create({
        data: {
          workspaceId,
          agentSlug: AGENT_SLUG,
          kind: KIND,
          refTable: REF_TABLE,
          refId: fingerprint,
          discipline: DISCIPLINE,
          status: 'PENDING',
          payload: encryptPayloadForWrite(buildPayload(workspaceId, policy, fingerprint)),
        },
        select: { id: true },
      });
      return approvalRequired(
        'Call recording is off until you approve recording + retention for this workspace.',
        created.id,
      );
    });
  }
}

/**
 * Convenience the incoming-call route uses: returns whether to record. Never
 * throws — a gate error degrades to "do not record" (fail-safe: when in doubt,
 * don't record).
 */
export async function evaluateRecordingConsent(args: {
  workspaceId: string;
  policy: RecordingRetentionPolicy;
  gate: VoiceRecordingConsentGate;
}): Promise<{ record: boolean; pendingApprovalId?: string; expiresAt?: string | null }> {
  try {
    const result = await args.gate.check({ workspaceId: args.workspaceId, policy: args.policy });
    if (result.ok) {
      return { record: true, pendingApprovalId: result.value.pendingApprovalId, expiresAt: result.value.expiresAt };
    }
    return { record: false, pendingApprovalId: result.error.reference };
  } catch {
    return { record: false };
  }
}
