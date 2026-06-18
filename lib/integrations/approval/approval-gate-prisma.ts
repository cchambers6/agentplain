/**
 * lib/integrations/approval/approval-gate-prisma.ts
 *
 * Production `ConnectorApprovalGate` — backs the gate with the real
 * `WorkApprovalQueueItem` queue the operator reviews on /approvals. This is
 * the customer-facing side of the no-outbound contract for connector writes:
 * when an agent attempts a write it does not yet have approval for, this gate
 * persists a PENDING row (kind `CONNECTOR_WRITE_ACTION`) and returns
 * APPROVAL_REQUIRED. The operator approves on /approvals (flipping the row to
 * APPROVED via the existing `decideApprovalAction`); the next attempt —
 * carrying that approval's id — passes the gate and the SDK call runs.
 *
 * One generic kind (not one-per-action) keeps the enum and the approvals UI
 * stable as connectors gain actions; the specific connector + action + payload
 * live in the (encrypted) payload, and `refId` carries the fingerprint so the
 * grant binds to the exact action. The grant expires
 * `CONNECTOR_APPROVAL_TTL_MS` after the decision, so a stale or substituted
 * action cannot ride an old approval.
 *
 * Connector writes are NEVER auto-approved regardless of any
 * `WorkThresholdConfig` — every one demands a human. Rows are written PENDING
 * directly (not via `applyApprovalThreshold`), exactly as DocuSign does.
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
  type ConnectorApprovalGate,
  type ConnectorApprovalGrant,
  type GatedAction,
} from './with-approval';

/** A connector-write approval is honored for 24h after the operator decides. */
export const CONNECTOR_APPROVAL_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * The single generic kind for every connector write action. Cast as
 * `WorkApprovalKind` so this compiles against a generated client that may lag
 * the schema migration (`20260618000000_add_connector_write_action_kind`),
 * exactly as the DocuSign gate casts its kinds.
 */
const CONNECTOR_WRITE_ACTION_KIND = 'CONNECTOR_WRITE_ACTION' as WorkApprovalKind;
const REF_TABLE = 'ConnectorWriteAction';
const DEFAULT_DISCIPLINE = 'operations';

interface ConnectorActionPayload {
  connector: string;
  action: string;
  fingerprint: string;
  detail: Record<string, unknown>;
}

function buildPayload(action: GatedAction, fingerprint: string): ConnectorActionPayload {
  return {
    connector: action.connector,
    action: action.action,
    fingerprint,
    detail: action.detail,
  };
}

function fingerprintFromPayload(payload: Prisma.JsonValue): string | null {
  const decrypted = decryptPayloadForRead(payload);
  if (!decrypted || typeof decrypted !== 'object' || Array.isArray(decrypted)) return null;
  const fp = (decrypted as Record<string, unknown>).fingerprint;
  return typeof fp === 'string' ? fp : null;
}

export interface PrismaConnectorApprovalGateOptions {
  now?: () => number;
}

export class PrismaConnectorApprovalGate implements ConnectorApprovalGate {
  private readonly now: () => number;

  constructor(options: PrismaConnectorApprovalGateOptions = {}) {
    this.now = options.now ?? Date.now;
  }

  async check(args: {
    workspaceId: string;
    action: GatedAction;
  }): Promise<McpResult<ConnectorApprovalGrant>> {
    const { workspaceId, action } = args;
    const kind = CONNECTOR_WRITE_ACTION_KIND;
    const fingerprint = fingerprintAction(action);
    const label = `${action.connector}.${action.action}`;

    return withSystemContext(async (tx) => {
      // 1. A token was presented — try to honor an existing approval.
      if (action.pendingApprovalId) {
        const row = await tx.workApprovalQueueItem.findFirst({
          where: { id: action.pendingApprovalId, workspaceId, kind },
        });
        if (row && row.status === 'APPROVED') {
          if (fingerprintFromPayload(row.payload) !== fingerprint) {
            return approvalRequired(
              `${label} approval ${row.id} was granted for a different payload — re-request approval.`,
              row.id,
            );
          }
          const decidedMs = row.decidedAt ? row.decidedAt.getTime() : null;
          const expiresMs = decidedMs !== null ? decidedMs + CONNECTOR_APPROVAL_TTL_MS : null;
          if (expiresMs !== null && this.now() > expiresMs) {
            await tx.workApprovalQueueItem.update({
              where: { id: row.id },
              data: { status: 'EXPIRED' },
            });
            return approvalRequired(
              `${label} approval ${row.id} expired — re-request approval.`,
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
            `${label} approval ${row.id} is still awaiting your decision.`,
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
        return approvalRequired(`${label} requires your approval before it can run.`, existing.id);
      }
      const created = await tx.workApprovalQueueItem.create({
        data: {
          workspaceId,
          agentSlug: `${action.connector}-write-action`,
          kind,
          refTable: REF_TABLE,
          refId: fingerprint,
          discipline: action.discipline ?? DEFAULT_DISCIPLINE,
          status: 'PENDING',
          payload: encryptPayloadForWrite(buildPayload(action, fingerprint)) as Prisma.InputJsonValue,
        },
        select: { id: true },
      });
      return approvalRequired(`${label} requires your approval before it can run.`, created.id);
    });
  }
}
