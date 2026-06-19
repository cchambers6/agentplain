/**
 * lib/integrations/approval/with-approval.ts
 *
 * The connector-agnostic approval gate — the generalization of the DocuSign
 * gate (`lib/integrations/docusign-mcp/with-approval.ts`, PR #280) to EVERY
 * mutating connector action. Where DocuSign hand-wrote a gate for its two
 * write methods, this module gives every connector (HubSpot, Salesforce,
 * Notion, Follow Up Boss, Sierra, Buildium, QuickBooks, Gmail, Calendar) one
 * shared seam so that NO write action — create a deal, charge a late fee,
 * compose an email, book a meeting — can reach an external API without an
 * explicit, recorded human approval first.
 *
 * Why this exists (`project_no_outbound_architecture.md`): agents draft and
 * propose; the customer's own system, via an operator's approval, executes.
 * A write action mutates a real downstream system of record — a missed gate
 * is the worst failure mode we have. This module makes the gate impossible to
 * forget: a connector's mutating method calls `gateAndRun`, and the underlying
 * SDK call is simply never reached unless the gate returns a grant.
 *
 * Shape (mirrors DocuSign exactly, just parameterized by connector + action):
 *   - `GatedAction`           — the action presented to the gate, fingerprinted.
 *   - `ConnectorApprovalGate` — the persistence port (memory + Prisma impls,
 *                               per `feedback_runner_portability.md`).
 *   - `ConnectorActionAuditSink` — every executed write is audit-logged.
 *   - `gateAndRun`            — the single helper a decorator method uses:
 *                               check → (on grant) run the SDK call → audit.
 *
 * This file imports no gate/audit implementation and no vendor SDK — it only
 * knows the ports.
 */

import { createHash } from 'node:crypto';
import { mcpError, type McpResult } from '@/lib/integrations/mcp-core';

// ── The action under approval ──────────────────────────────────────────────

/**
 * A mutating connector action presented to the gate.
 *
 * `connector`/`action` name the operation (e.g. `hubspot`/`create_deal`).
 * `detail` is the canonical, human-meaningful description of exactly what will
 * happen — it is BOTH fingerprinted (so an approval can't be replayed onto a
 * different payload) AND shown on the operator's approval card. Keep it free
 * of secrets and large blobs; it is persisted (encrypted) and rendered.
 *
 * `pendingApprovalId` is the approval token the caller carries forward once an
 * operator has approved (the `WorkApprovalQueueItem.id` for the Prisma gate).
 * Absent on the first attempt — the gate then opens a request and returns
 * APPROVAL_REQUIRED naming it.
 *
 * `discipline` routes the approval card to the right queue lane (e.g. `sales`
 * for CRM writes, `finance` for billing, `operations` for property ops). It is
 * metadata only — it never affects the fingerprint.
 */
export interface GatedAction {
  connector: string;
  action: string;
  pendingApprovalId?: string;
  detail: Record<string, unknown>;
  discipline?: string;
}

/** A validated, operator-approved, unexpired grant returned by the gate. */
export interface ConnectorApprovalGrant {
  pendingApprovalId: string;
  approvedByUserId: string | null;
  approvedAt: string | null;
  expiresAt: string | null;
}

/**
 * The persistence port. `check` returns `ok(grant)` ONLY when an approved,
 * unexpired grant whose fingerprint matches THIS exact action exists. Any
 * other state (no token, wrong workspace/action, action changed since
 * approval, still pending, rejected, expired) returns an APPROVAL_REQUIRED
 * error whose `reference` is the pendingApprovalId the operator must act on
 * (when the store can name one).
 */
export interface ConnectorApprovalGate {
  check(args: {
    workspaceId: string;
    action: GatedAction;
  }): Promise<McpResult<ConnectorApprovalGrant>>;
}

// ── Audit sink ───────────────────────────────────────────────────────────────

/** One executed (post-approval) connector write, for the audit trail. */
export interface ConnectorActionAuditEntry {
  workspaceId: string;
  connector: string;
  action: string;
  /** The approval token that authorized this write. */
  pendingApprovalId: string;
  approvedByUserId: string | null;
  /** Fingerprint of the action that ran (binds audit row ↔ approval). */
  fingerprint: string;
  detail: Record<string, unknown>;
  /** Whether the underlying SDK call ultimately succeeded. */
  outcome: 'ok' | 'error';
  /** Error code when outcome is 'error'. */
  errorCode?: string;
}

/**
 * Every executed write — success OR failure — is recorded. Two impls
 * (`feedback_runner_portability.md`): Prisma writes an `AuditLog` row; the
 * in-memory sink backs the smoke tests.
 */
export interface ConnectorActionAuditSink {
  record(entry: ConnectorActionAuditEntry): Promise<void>;
}

// ── Fingerprinting ───────────────────────────────────────────────────────────

/**
 * A stable hash binding a grant to the exact action approved. Recomputed at
 * execution time and compared to the stored fingerprint so an approval for
 * "create a $40k deal named Acme" can never be replayed to create a different
 * deal. `discipline`/`pendingApprovalId` are NOT part of the fingerprint —
 * only connector + action + the canonicalized detail.
 */
export function fingerprintAction(action: GatedAction): string {
  const canonical = {
    connector: action.connector,
    action: action.action,
    detail: canonicalize(action.detail),
  };
  return createHash('sha256').update(JSON.stringify(canonical)).digest('hex');
}

/** Deterministic deep-sort of object keys (arrays keep order) for hashing. */
function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      out[key] = canonicalize((value as Record<string, unknown>)[key]);
    }
    return out;
  }
  return value;
}

// ── The gate + audit helper every connector method uses ──────────────────────

/**
 * Check the gate for `action`; only if a valid grant exists, run `execute`
 * (the actual SDK call) and audit-log the outcome. On a missing/invalid grant
 * this returns APPROVAL_REQUIRED and `execute` is NEVER called — the external
 * API is untouched.
 *
 * This is the single line a connector's mutating method delegates to. It is
 * deliberately the only path that both gates and audits, so the two can never
 * drift apart per action.
 */
export async function gateAndRun<T>(args: {
  gate: ConnectorApprovalGate;
  audit: ConnectorActionAuditSink;
  workspaceId: string;
  action: GatedAction;
  execute: () => Promise<McpResult<T>>;
}): Promise<McpResult<T>> {
  const { gate, audit, workspaceId, action, execute } = args;

  const gateResult = await gate.check({ workspaceId, action });
  if (!gateResult.ok) return gateResult; // APPROVAL_REQUIRED — SDK never called.

  const grant = gateResult.value;
  const result = await execute();

  await audit.record({
    workspaceId,
    connector: action.connector,
    action: action.action,
    pendingApprovalId: grant.pendingApprovalId,
    approvedByUserId: grant.approvedByUserId,
    fingerprint: fingerprintAction(action),
    detail: action.detail,
    outcome: result.ok ? 'ok' : 'error',
    errorCode: result.ok ? undefined : result.error.code,
  });

  return result;
}

// ── Shared error constructor ─────────────────────────────────────────────────

/**
 * Build the structured `APPROVAL_REQUIRED` result both gates return.
 * `reference` carries the pendingApprovalId so the caller (and the /approvals
 * surface) know exactly which request needs a human decision.
 */
export function approvalRequired(
  message: string,
  pendingApprovalId?: string,
): McpResult<never> {
  return mcpError('APPROVAL_REQUIRED', message, { reference: pendingApprovalId });
}
