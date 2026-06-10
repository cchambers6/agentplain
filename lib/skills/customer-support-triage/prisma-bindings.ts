/**
 * lib/skills/customer-support-triage/prisma-bindings.ts
 *
 * Production implementations of the triage ports (the metrics sink + the
 * escalation marker). Kept out of triage.ts so the decision core stays
 * Prisma-free + offline-testable (feedback_runner_portability.md two-
 * implementation rule — the test file carries the recording twins).
 *
 * Per feedback_no_silent_vendor_lock.md: the only Prisma surface here is
 * the AuditLog/SupportRequest write through the RLS system context.
 */

import { withSystemContext } from '../../db';
import type {
  EscalationTrigger,
  IEscalationMarker,
  ITriageMetricsSink,
  TriageMetricsRow,
} from './types';

/** The AuditLog action every triage metrics row carries. The Pillar-6
 *  fleet-health cron filters on this to compute backlog age + deflection
 *  rate. Stable string — do not rename without updating that reader. */
export const TRIAGE_METRIC_ACTION = 'support_triage.decision';

/** AuditLog action the escalation marker writes (in addition to flipping
 *  the SupportRequest status). */
export const TRIAGE_ESCALATED_ACTION = 'support_triage.escalated';

/**
 * Metrics sink that writes one queryable AuditLog row per triage decision.
 * Reusing AuditLog (vs. a new table) keeps zero new migrations and lands
 * the rows in the same immutable, operator-readable feed the rest of the
 * fleet writes to. The Pillar-6 cron queries
 * `action = 'support_triage.decision'` and reads `payload.decision`,
 * `payload.confidence`, `payload.degraded`.
 */
export class PrismaTriageMetricsSink implements ITriageMetricsSink {
  readonly name = 'prisma-triage-metrics';

  async record(row: TriageMetricsRow): Promise<void> {
    try {
      await withSystemContext((tx) =>
        tx.auditLog.create({
          data: {
            workspaceId: row.workspaceId,
            action: TRIAGE_METRIC_ACTION,
            targetTable: 'SupportRequest',
            targetId: row.supportMessageId,
            payload: {
              decision: row.decision,
              confidence: row.confidence,
              escalationTrigger: row.escalationTrigger,
              boundedAction: row.boundedAction,
              degraded: row.degraded,
            },
          },
        }),
      );
    } catch {
      // Best-effort — the triage decision already executed; a metrics
      // write failure must never swallow the customer outcome. The
      // Pillar-6 cron tolerates gaps (it measures rate, not completeness).
    }
  }
}

/**
 * Escalation marker that (1) advances the SupportRequest to IN_REVIEW so
 * the operator queue shows "a human owns this", and (2) writes an audit
 * row capturing the trigger. Advancing to IN_REVIEW (not a new ESCALATED
 * status — none exists in the enum) is the existing convention; the audit
 * row carries the escalation semantics. Only NEW rows move, so an operator
 * who already touched it keeps their state.
 *
 * The mark is what stops Plaino from auto-replying on the thread: the
 * support-handler-on-create path skips a draft when the request is no
 * longer NEW, and the triage interception returns 'escalated' so no
 * auto-answer is sent.
 */
export class PrismaEscalationMarker implements IEscalationMarker {
  readonly name = 'prisma-escalation-marker';

  async markEscalated(args: {
    workspaceId: string;
    supportMessageId: string;
    trigger: EscalationTrigger;
  }): Promise<void> {
    await withSystemContext(async (tx) => {
      await tx.supportRequest.updateMany({
        where: { id: args.supportMessageId, status: 'NEW' },
        data: { status: 'IN_REVIEW' },
      });
      await tx.auditLog.create({
        data: {
          workspaceId: args.workspaceId,
          action: TRIAGE_ESCALATED_ACTION,
          targetTable: 'SupportRequest',
          targetId: args.supportMessageId,
          payload: { trigger: args.trigger },
        },
      });
    });
  }
}
