/**
 * lib/guarantee/saved-time.ts
 *
 * The append-only time-savings ledger: one TimeSavingsEntry row per
 * completed action the fleet performed, valued in minutes via the
 * calibration table. This is the data layer behind:
 *
 *   - the live workspace counter ("Plaino saved you 47 min this week"),
 *   - the Day-7 guarantee evaluation (sum vs the bar),
 *   - the walk-away receipt (what we did before you walked).
 *
 * Per feedback_cold_start_safe_agents: the ledger is durable Postgres
 * state. Nothing here caches; every read re-derives from rows. The write
 * is IDEMPOTENT — re-running the same workflow step (a webhook re-fire,
 * a cron retry) is a no-op via the (workspace, source, action) unique
 * constraint, so the counter never double-counts.
 *
 * Per project_no_outbound_architecture: recording saved time is a pure
 * internal side effect — it sends nothing.
 */

import type { Prisma } from '@prisma/client';
import { withSystemContext as defaultWithSystemContext } from '../db';
import type { SystemContextRunner } from '../billing/provisioning';
import type { SkillRunOutcome } from '../skills/types';
import {
  type GuaranteeActionType,
  minutesSavedFor,
} from './savings-calibration';

export interface SavedTimeSource {
  /** The table the action originated from (e.g. 'WebhookEvent'). Together
   *  with `id` this is the idempotency key — the same source can only
   *  ever contribute one entry per action type. */
  table: string;
  id: string;
}

export interface RecordSavedTimeArgs {
  workspaceId: string;
  actionType: GuaranteeActionType;
  /** Vertical slug — selects the per-vertical calibration. */
  verticalSlug: string;
  /** Dedupe source so a re-run can't double-count. */
  source: SavedTimeSource;
  /** Pre-built transaction client. When omitted, opens a
   *  `withSystemContext` write (operator RLS) of its own. The runtime
   *  passes its post-commit context; tests pass a fake client. */
  client?: Prisma.TransactionClient;
  systemContext?: SystemContextRunner;
  now?: Date;
}

export interface RecordSavedTimeResult {
  /** True when a NEW row was written; false when the dedupe key already
   *  existed (idempotent no-op). */
  recorded: boolean;
  minutesSaved: number;
}

/**
 * Record one completed action's saved time. Idempotent: a duplicate
 * (workspace, source.table, source.id, actionType) is skipped, so the
 * counter is safe to drive from an at-least-once runtime.
 */
export async function recordSavedTime(
  args: RecordSavedTimeArgs,
): Promise<RecordSavedTimeResult> {
  const minutesSaved = minutesSavedFor(args.actionType, args.verticalSlug);
  const occurredAt = args.now ?? new Date();
  const data = {
    workspaceId: args.workspaceId,
    actionType: args.actionType,
    verticalSlug: args.verticalSlug,
    minutesSaved,
    sourceTable: args.source.table,
    sourceId: args.source.id,
    occurredAt,
  } satisfies Prisma.TimeSavingsEntryUncheckedCreateInput;

  const write = async (tx: Prisma.TransactionClient): Promise<boolean> => {
    const result = await tx.timeSavingsEntry.createMany({
      data: [data],
      skipDuplicates: true,
    });
    return result.count > 0;
  };

  const recorded = args.client
    ? await write(args.client)
    : await (args.systemContext ?? defaultWithSystemContext)((tx) => write(tx));

  return { recorded, minutesSaved };
}

// ── Aggregation (the counter + the Day-7 evaluation read this) ──────────

export interface SavedTimeByAction {
  actionType: string;
  minutes: number;
  count: number;
}

export interface SavedTimeSummary {
  /** All-time minutes saved for the workspace. */
  totalMinutes: number;
  /** Minutes saved in the trailing 7 days (the "this week" figure). */
  weekMinutes: number;
  /** All-time count of actions. */
  totalActions: number;
  /** Per-action breakdown, all-time, sorted by minutes desc. */
  byAction: SavedTimeByAction[];
}

export const EMPTY_SAVED_TIME_SUMMARY: SavedTimeSummary = {
  totalMinutes: 0,
  weekMinutes: 0,
  totalActions: 0,
  byAction: [],
};

/**
 * Summarize a workspace's saved time off a transaction client. Takes the
 * client (rather than opening its own) so the caller controls the RLS
 * context: the workspace overview reads under the broker-owner's
 * `withRls`; the Day-7 cron reads under `withSystemContext`.
 */
export async function readSavedTimeSummary(
  client: Prisma.TransactionClient,
  workspaceId: string,
  now: Date = new Date(),
): Promise<SavedTimeSummary> {
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [totalAgg, weekAgg, grouped] = await Promise.all([
    client.timeSavingsEntry.aggregate({
      where: { workspaceId },
      _sum: { minutesSaved: true },
      _count: { _all: true },
    }),
    client.timeSavingsEntry.aggregate({
      where: { workspaceId, occurredAt: { gte: weekAgo } },
      _sum: { minutesSaved: true },
    }),
    client.timeSavingsEntry.groupBy({
      by: ['actionType'],
      where: { workspaceId },
      _sum: { minutesSaved: true },
      _count: { _all: true },
    }),
  ]);

  const byAction: SavedTimeByAction[] = grouped
    .map((g) => ({
      actionType: g.actionType,
      minutes: g._sum.minutesSaved ?? 0,
      count: g._count._all,
    }))
    .sort((a, b) => b.minutes - a.minutes);

  return {
    totalMinutes: totalAgg._sum.minutesSaved ?? 0,
    weekMinutes: weekAgg._sum.minutesSaved ?? 0,
    totalActions: totalAgg._count._all,
    byAction,
  };
}

// ── Runtime attribution ─────────────────────────────────────────────────

/**
 * Map a completed skill-chain run to the saved-time action it earned, or
 * null when the run produced nothing that saved the owner time (noise,
 * vendor mail, a transactional notice). This is the bridge the runtime
 * seam (persist-artifacts) calls so the counter ticks in real time.
 *
 * Only the actions the main value loop actually produces are mapped here:
 *   - a scheduling proposal → meeting-scheduled
 *   - a reply draft        → drafted-email
 *   - an office-admin item  → admin-task-handled
 *
 * The other calibrated actions (invoice-sent, document-chased,
 * tenant-notice-posted, lead-enrichment) come from the vertical-specific
 * sweeps; those call `recordSavedTime` directly as they wire in. Keeping
 * this mapping honest about what the chain emits TODAY beats inventing
 * attribution the runtime can't back.
 */
export function guaranteeActionForOutcome(
  outcome: SkillRunOutcome,
): GuaranteeActionType | null {
  if (outcome.officeAdminPayload) return 'admin-task-handled';
  if (outcome.scheduledProposal || outcome.category === 'scheduling-needed') {
    return 'meeting-scheduled';
  }
  if (outcome.draft) return 'drafted-email';
  return null;
}
