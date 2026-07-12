/**
 * Inngest cron: weekly-customer-report sweep.
 *
 * Every Friday at 8am ET, each active workspace's broker-owner gets a real
 * "here's what Plaino did for you this week" email — the previous Mon–Sun
 * week's drafts, approvals, hours/dollars, per-vertical outcomes, and a
 * look-ahead. A retention + ROI-proof surface.
 *
 * Schedule: `0 12 * * 5` = Fridays 12:00 UTC. That is 8:00am ET while the US
 * is on Eastern Daylight Time (the bulk of the year) and 7:00am ET on
 * Standard Time. The cron expression is UTC, so the fall/spring DST flip
 * shifts the fire by an hour — acceptable for a weekly read, and the exact
 * trade-off the existing `analytics-weekly-pulse` sweep already documents.
 *
 * The per-workspace gates (opt-out, billing-pause, already-sent idempotency)
 * all live in `sendWeeklyReportForWorkspace` — this sweep just enumerates
 * candidates and calls it, tolerating per-workspace failures so one bad row
 * never aborts the run.
 *
 * Per `project_no_outbound_architecture.md`: a product-side report to the
 * customer's OWN inbox is in scope. Per `feedback_cold_start_safe_agents.md`
 * the sweep holds no in-memory state. Per `feedback_runner_portability.md`
 * the candidate lister + per-workspace runner are injectable for tests.
 */

import { withSystemContext } from '@/lib/db/rls';
import {
  sendWeeklyReportForWorkspace,
  type SendWeeklyReportResult,
} from '@/lib/reports/weekly-report';
import { inngest } from '../client';
import { runWithDisableGate } from '../run-with-disable-gate';
import {
  reportInngestItemFailure,
  withInngestErrorReporting,
} from '../with-error-reporting';
import { getLogger, withCronMonitor } from '@/lib/observability';

export const WEEKLY_REPORT_SWEEP_FUNCTION_ID =
  'agentplain-weekly-customer-report-sweep';
/** Fridays at 12:00 UTC ≈ 8am ET (EDT) / 7am ET (EST). Weekly cadence. */
export const WEEKLY_REPORT_SWEEP_CRON = '0 12 * * 5';
export const WEEKLY_REPORT_SWEEP_TRIGGER_EVENT =
  'agentplain/weekly-customer-report-sweep.requested';

export interface WeeklyReportSweepResult {
  workspacesConsidered: number;
  emailsSent: number;
  skippedOptedOut: number;
  skippedBillingPaused: number;
  skippedNoRecipient: number;
  skippedAlreadySent: number;
  /** Workspaces in their first partial week with firstReportMode='delay'. */
  skippedFirstWeekPending: number;
  emptyWeekEmails: number;
  /** First-week notes sent in place of a report (firstReportMode='note'). */
  firstWeekNotesSent: number;
  failures: Array<{ workspaceId: string; reason: string }>;
}

export interface RunWeeklyReportSweepArgs {
  /** Override the workspace lister. Tests pass a deterministic list. */
  listCandidates?: () => Promise<string[]>;
  /** Override the per-workspace runner. Tests inject. */
  sendForWorkspace?: (
    workspaceId: string,
    now: Date | undefined,
  ) => Promise<SendWeeklyReportResult>;
  /** Fixed clock for tests. */
  now?: Date;
}

export async function runWeeklyReportSweep(
  args: RunWeeklyReportSweepArgs = {},
): Promise<WeeklyReportSweepResult> {
  const listCandidates = args.listCandidates ?? defaultListCandidates;
  const send =
    args.sendForWorkspace ??
    ((workspaceId: string, now: Date | undefined) =>
      sendWeeklyReportForWorkspace({ workspaceId, now }));
  const candidates = await listCandidates();

  const result: WeeklyReportSweepResult = {
    workspacesConsidered: candidates.length,
    emailsSent: 0,
    skippedOptedOut: 0,
    skippedBillingPaused: 0,
    skippedNoRecipient: 0,
    skippedAlreadySent: 0,
    skippedFirstWeekPending: 0,
    emptyWeekEmails: 0,
    firstWeekNotesSent: 0,
    failures: [],
  };

  for (const workspaceId of candidates) {
    try {
      const res = await send(workspaceId, args.now);
      if (res.sent) {
        result.emailsSent += 1;
        if (res.wasEmpty) result.emptyWeekEmails += 1;
        if (res.firstWeekNote) result.firstWeekNotesSent += 1;
        continue;
      }
      switch (res.skipped) {
        case 'opted_out':
          result.skippedOptedOut += 1;
          break;
        case 'billing_paused':
          result.skippedBillingPaused += 1;
          break;
        case 'no_recipient':
          result.skippedNoRecipient += 1;
          break;
        case 'already_sent':
          result.skippedAlreadySent += 1;
          break;
        case 'first_week_pending':
          result.skippedFirstWeekPending += 1;
          break;
        default:
          break;
      }
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      reportInngestItemFailure(err, {
        functionId: WEEKLY_REPORT_SWEEP_FUNCTION_ID,
        extraTags: { workspace_id: workspaceId, phase: 'send-report' },
      });
      result.failures.push({ workspaceId, reason });
    }
  }

  return result;
}

async function defaultListCandidates(): Promise<string[]> {
  return withSystemContext(async (tx) => {
    const workspaces = await tx.workspace.findMany({
      where: {
        memberships: { some: { status: 'ACTIVE' } },
        closureStatus: 'ACTIVE',
      },
      select: { id: true },
      orderBy: { createdAt: 'asc' },
    });
    return workspaces.map((ws) => ws.id);
  });
}

export const weeklyCustomerReportSweepFn = inngest.createFunction(
  {
    id: WEEKLY_REPORT_SWEEP_FUNCTION_ID,
    name: 'agentplain weekly customer report sweep',
    triggers: [
      { cron: WEEKLY_REPORT_SWEEP_CRON },
      { event: WEEKLY_REPORT_SWEEP_TRIGGER_EVENT },
    ],
  },
  async () =>
    runWithDisableGate(WEEKLY_REPORT_SWEEP_FUNCTION_ID, () =>
      withCronMonitor(
        {
          slug: WEEKLY_REPORT_SWEEP_FUNCTION_ID,
          schedule: WEEKLY_REPORT_SWEEP_CRON,
          checkinMargin: 10,
          maxRuntime: 30,
        },
        () =>
          withInngestErrorReporting(
            { functionId: WEEKLY_REPORT_SWEEP_FUNCTION_ID },
            async () => {
              const logger = getLogger().child({
                boundary: 'inngest',
                function_id: WEEKLY_REPORT_SWEEP_FUNCTION_ID,
              });
              logger.info('weekly-customer-report sweep started');
              const out = await runWeeklyReportSweep();
              logger.info('weekly-customer-report sweep finished', {
                considered: out.workspacesConsidered,
                emails_sent: out.emailsSent,
                empty_week_emails: out.emptyWeekEmails,
                first_week_notes_sent: out.firstWeekNotesSent,
                skipped_first_week_pending: out.skippedFirstWeekPending,
                skipped_opted_out: out.skippedOptedOut,
                skipped_billing_paused: out.skippedBillingPaused,
                skipped_no_recipient: out.skippedNoRecipient,
                skipped_already_sent: out.skippedAlreadySent,
                failed: out.failures.length,
              });
              return out;
            },
          ),
      ),
    ),
);
