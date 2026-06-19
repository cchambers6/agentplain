/**
 * lib/integrations/approval/audit.ts
 *
 * Audit sinks for executed connector writes. Per the mission's "audit-log
 * every fire" requirement, `gateAndRun` records every post-approval write —
 * success or failure — through a `ConnectorActionAuditSink`.
 *
 * Production writes an `AuditLog` row (the same table the /approvals decision
 * flow and impersonation writes use). The audit payload is deliberately
 * MINIMAL — connector, action, outcome, the authorizing approval id, and the
 * fingerprint — and never the raw action detail, which may carry recipient
 * emails or dollar amounts. The full (encrypted) detail already lives on the
 * `WorkApprovalQueueItem` row this audit row points at via `fingerprint`.
 *
 * The in-memory sink (for tests) lives in `approval-gate-memory.ts` and is
 * re-exported here so callers have one import site.
 */

import type { Prisma } from '@prisma/client';
import { withSystemContext } from '@/lib/db/rls';
import type {
  ConnectorActionAuditEntry,
  ConnectorActionAuditSink,
} from './with-approval';

export { InMemoryConnectorActionAuditSink } from './approval-gate-memory';

/** Production sink — one `AuditLog` row per executed connector write. */
export class PrismaConnectorActionAuditSink implements ConnectorActionAuditSink {
  async record(entry: ConnectorActionAuditEntry): Promise<void> {
    await withSystemContext(async (tx) => {
      await tx.auditLog.create({
        data: {
          actorUserId: entry.approvedByUserId,
          workspaceId: entry.workspaceId,
          action: `connector_write.${entry.connector}.${entry.action}.${entry.outcome}`,
          targetTable: 'ConnectorWriteAction',
          targetId: entry.fingerprint,
          payload: {
            connector: entry.connector,
            action: entry.action,
            outcome: entry.outcome,
            errorCode: entry.errorCode ?? null,
            pendingApprovalId: entry.pendingApprovalId,
            fingerprint: entry.fingerprint,
          } satisfies Prisma.InputJsonObject,
        },
      });
    });
  }
}

/** A sink that records nothing — for paths that opt out of auditing (none ship). */
export class NoopConnectorActionAuditSink implements ConnectorActionAuditSink {
  async record(): Promise<void> {
    /* intentionally empty */
  }
}
