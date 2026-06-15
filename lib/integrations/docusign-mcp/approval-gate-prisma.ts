/**
 * lib/integrations/docusign-mcp/approval-gate-prisma.ts
 *
 * Production `DocuSignApprovalGate` — backs the gate with the real
 * `WorkApprovalQueueItem` queue the operator reviews on /approvals. This is
 * the customer-facing side of the no-outbound contract: when an agent attempts
 * a DocuSign send/void it does not yet have approval for, this gate persists a
 * PENDING row (kind `DOCUSIGN_SEND_ENVELOPE` / `DOCUSIGN_VOID_ENVELOPE`) and
 * returns APPROVAL_REQUIRED. The operator approves on /approvals (flipping the
 * row to APPROVED via the existing `decideApprovalAction`); the next attempt —
 * carrying that approval's id — passes the gate and the DocuSign call runs.
 *
 * The grant is bound to the exact action by a fingerprint stored in the
 * (encrypted) payload, and expires `DOCUSIGN_APPROVAL_TTL_MS` after the
 * decision, so a stale or substituted action cannot ride an old approval.
 *
 * DocuSign actions are NEVER auto-approved regardless of any
 * `WorkThresholdConfig` — a legal document send/void always demands a human.
 * Rows are written PENDING directly (not via `applyApprovalThreshold`).
 */

import type { Prisma, WorkApprovalKind } from '@prisma/client';
import { mcpOk, type McpResult } from '@/lib/integrations/mcp-core';
import { withSystemContext } from '@/lib/db/rls';
import {
  decryptPayloadForRead,
  encryptPayloadForWrite,
} from '@/lib/security/payload-crypto';
import {
  approvalRequired,
  fingerprintAction,
  type DocuSignApprovalGate,
  type DocuSignApprovalGrant,
  type DocuSignGatedAction,
} from './with-approval';

/** A DocuSign approval is honored for 24h after the operator decides. */
export const DOCUSIGN_APPROVAL_TTL_MS = 24 * 60 * 60 * 1000;

const AGENT_SLUG = 'docusign-approval-gate';
const REF_TABLE = 'DocuSignEnvelope';
/** DocuSign send/void are legal-document actions — legal discipline. */
const DISCIPLINE = 'legal';

function kindFor(action: DocuSignGatedAction): WorkApprovalKind {
  return action.type === 'send'
    ? ('DOCUSIGN_SEND_ENVELOPE' as WorkApprovalKind)
    : ('DOCUSIGN_VOID_ENVELOPE' as WorkApprovalKind);
}

function buildPayload(action: DocuSignGatedAction, fingerprint: string): unknown {
  if (action.type === 'send') {
    return {
      type: 'send',
      fingerprint,
      emailSubject: action.detail.emailSubject,
      recipientEmails: action.detail.recipientEmails,
      source: action.detail.source,
      templateId: action.detail.templateId ?? null,
      documentNames: action.detail.documentNames,
    };
  }
  return {
    type: 'void',
    fingerprint,
    envelopeId: action.detail.envelopeId,
    voidedReason: action.detail.voidedReason,
  };
}

function fingerprintFromPayload(payload: Prisma.JsonValue): string | null {
  const decrypted = decryptPayloadForRead(payload);
  if (!decrypted || typeof decrypted !== 'object' || Array.isArray(decrypted)) return null;
  const fp = (decrypted as Record<string, unknown>).fingerprint;
  return typeof fp === 'string' ? fp : null;
}

export interface PrismaDocuSignApprovalGateOptions {
  now?: () => number;
}

export class PrismaDocuSignApprovalGate implements DocuSignApprovalGate {
  private readonly now: () => number;

  constructor(options: PrismaDocuSignApprovalGateOptions = {}) {
    this.now = options.now ?? Date.now;
  }

  async check(args: {
    workspaceId: string;
    action: DocuSignGatedAction;
  }): Promise<McpResult<DocuSignApprovalGrant>> {
    const { workspaceId, action } = args;
    const kind = kindFor(action);
    const fingerprint = fingerprintAction(action);
    const verb = action.type;

    return withSystemContext(async (tx) => {
      // 1. A token was presented — try to honor an existing approval.
      if (action.pendingApprovalId) {
        const row = await tx.workApprovalQueueItem.findFirst({
          where: { id: action.pendingApprovalId, workspaceId, kind },
        });
        if (row && row.status === 'APPROVED') {
          if (fingerprintFromPayload(row.payload) !== fingerprint) {
            return approvalRequired(
              `DocuSign ${verb} approval ${row.id} was granted for a different envelope — re-request approval.`,
              row.id,
            );
          }
          const decidedMs = row.decidedAt ? row.decidedAt.getTime() : null;
          const expiresMs = decidedMs !== null ? decidedMs + DOCUSIGN_APPROVAL_TTL_MS : null;
          if (expiresMs !== null && this.now() > expiresMs) {
            await tx.workApprovalQueueItem.update({
              where: { id: row.id },
              data: { status: 'EXPIRED' },
            });
            return approvalRequired(
              `DocuSign ${verb} approval ${row.id} expired — re-request approval.`,
              row.id,
            );
          }
          return mcpOk({
            pendingApprovalId: row.id,
            approvedByUserId: row.decidedByUserId,
            approvedAt: row.decidedAt ? row.decidedAt.toISOString() : null,
            expiresAt: expiresMs !== null ? new Date(expiresMs).toISOString() : null,
          });
        }
        if (row && row.status === 'PENDING') {
          return approvalRequired(
            `DocuSign ${verb} approval ${row.id} is still awaiting your decision.`,
            row.id,
          );
        }
        // Found-but-rejected/expired, or not found — fall through and (re)open
        // a fresh request below.
      }

      // 2. No valid grant — find-or-create the PENDING request for THIS action
      //    (deduped by fingerprint so repeated attempts don't pile up rows).
      const existing = await tx.workApprovalQueueItem.findFirst({
        where: { workspaceId, kind, refId: fingerprint, status: 'PENDING' },
      });
      if (existing) {
        return approvalRequired(
          `DocuSign ${verb} requires your approval before it can run.`,
          existing.id,
        );
      }
      const created = await tx.workApprovalQueueItem.create({
        data: {
          workspaceId,
          agentSlug: AGENT_SLUG,
          kind,
          refTable: REF_TABLE,
          refId: fingerprint,
          discipline: DISCIPLINE,
          status: 'PENDING',
          payload: encryptPayloadForWrite(buildPayload(action, fingerprint)),
        },
        select: { id: true },
      });
      return approvalRequired(
        `DocuSign ${verb} requires your approval before it can run.`,
        created.id,
      );
    });
  }
}
