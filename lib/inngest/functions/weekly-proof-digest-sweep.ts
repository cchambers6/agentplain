/**
 * Inngest cron: weekly proof-of-value digest sweep.
 *
 * Runs `0 12 * * 1` (Monday 12:00 UTC ≈ 08:00 ET — early Monday morning,
 * the moment the owner opens the week). For each ACTIVE workspace whose
 * briefings aren't muted and that isn't paused for billing:
 *
 *   1. Generate the prior completed Mon–Sun week's proof-of-value digest
 *      via `lib/measurement/weekly-digest#generateWeeklyDigestForWorkspace`.
 *      It persists ONE `WorkspaceBriefing` row (Sunday-anchored `forDate`,
 *      WEEKLY_* status) — the same surface the daily briefing uses, so the
 *      web + mobile briefings views render it with no new UI.
 *   2. If the row was newly inserted, send a lightweight product-side
 *      notification email with the headline numbers + a deep link.
 *
 * This is the renewal surface: every Monday the owner sees hours saved,
 * dollars influenced (real AR where a payload carried it), and what the
 * fleet auto-executed vs staged — so paying $99–199/mo is never a leap of
 * faith. Deterministic render (no LLM in the hot path).
 *
 * Mirrors the daily briefings-generator-sweep gate stack exactly:
 *   - `runWithDisableGate` (ops kill-switch),
 *   - `withCronMonitor` (heartbeat / runtime ceiling),
 *   - `withInngestErrorReporting` (Sentry boundary),
 *   - per-item `isWorkspacePaused` (billing) + mute gates,
 *   - `reportInngestItemFailure` so one workspace failure doesn't abort.
 *
 * Per `feedback_cold_start_safe_agents.md`: every fire reads durable state.
 * Per `project_no_outbound_architecture.md`: the notification is product-
 * side transactional (agentplain → broker-owner), same scope as the daily
 * briefing notice — never outbound on a customer's behalf.
 * Per `feedback_runner_portability.md`: lister + generator + notifier are
 * injectable so the sweep tests need no Postgres / Anthropic / Resend.
 */

import { withSystemContext } from '@/lib/db/rls';
import { env } from '@/lib/env';
import { isWorkspacePaused } from '@/lib/billing/workspace-paused-gate';
import {
  generateWeeklyDigestForWorkspace,
  type GenerateWeeklyDigestResult,
} from '@/lib/measurement/weekly-digest';
import {
  notifyWeeklyDigestReady,
  type NotifyWeeklyDigestReadyResult,
} from '@/lib/measurement/weekly-digest-email';
import { inngest } from '../client';
import { runWithDisableGate } from '../run-with-disable-gate';
import {
  reportInngestItemFailure,
  withInngestErrorReporting,
} from '../with-error-reporting';
import { getLogger, withCronMonitor } from '@/lib/observability';

export const WEEKLY_PROOF_DIGEST_SWEEP_FUNCTION_ID =
  'agentplain-weekly-proof-digest-sweep';
/** Monday 12:00 UTC (≈ 08:00 ET; we accept DST drift between 07:00 EST and
 *  08:00 EDT — the cadence is "early Monday morning", not a hard SLA). */
export const WEEKLY_PROOF_DIGEST_SWEEP_CRON = '0 12 * * 1';
/** On-demand trigger for dev-console smoke-testing. */
export const WEEKLY_PROOF_DIGEST_SWEEP_TRIGGER_EVENT =
  'agentplain/weekly-proof-digest-sweep.requested';

export interface WeeklyDigestSweepResult {
  workspacesConsidered: number;
  digestsWritten: number;
  digestsAlreadyExisted: number;
  workspacesMuted: number;
  notificationsSent: number;
  failures: Array<{ workspaceId: string; reason: string }>;
}

interface SweepWorkspaceCandidate {
  id: string;
  name: string;
  brokerOwnerEmail: string | null;
  briefingsMutedAt: Date | null;
}

export interface RunWeeklyDigestSweepArgs {
  listCandidates?: () => Promise<SweepWorkspaceCandidate[]>;
  generate?: typeof generateWeeklyDigestForWorkspace;
  notify?: typeof notifyWeeklyDigestReady;
  /** Billing-pause check; injectable so tests don't touch Stripe. */
  isPaused?: (workspaceId: string) => Promise<boolean>;
  now?: Date;
  appOrigin?: string;
}

export async function runWeeklyDigestSweep(
  args: RunWeeklyDigestSweepArgs = {},
): Promise<WeeklyDigestSweepResult> {
  const list = args.listCandidates ?? defaultListCandidates;
  const generate = args.generate ?? generateWeeklyDigestForWorkspace;
  const notify = args.notify ?? notifyWeeklyDigestReady;
  const isPaused =
    args.isPaused ??
    (async (workspaceId: string) => {
      const pause = await isWorkspacePaused({ workspaceId }).catch(() => ({
        isPaused: false,
      }));
      return pause.isPaused;
    });
  const now = args.now ?? new Date();
  const appOrigin = args.appOrigin ?? env.appPublicOrigin();

  const candidates = await list();
  const result: WeeklyDigestSweepResult = {
    workspacesConsidered: candidates.length,
    digestsWritten: 0,
    digestsAlreadyExisted: 0,
    workspacesMuted: 0,
    notificationsSent: 0,
    failures: [],
  };

  for (const ws of candidates) {
    // Reuse the briefings mute as the digest mute — the owner who muted
    // their daily morning summary doesn't want a weekly one either, and
    // there's one customer-facing "briefings" concept, not two.
    if (ws.briefingsMutedAt) {
      result.workspacesMuted += 1;
      continue;
    }
    if (await isPaused(ws.id)) {
      result.workspacesMuted += 1;
      continue;
    }

    let outcome: GenerateWeeklyDigestResult;
    try {
      outcome = await generate({ workspaceId: ws.id, now });
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      reportInngestItemFailure(err, {
        functionId: WEEKLY_PROOF_DIGEST_SWEEP_FUNCTION_ID,
        extraTags: { workspace_id: ws.id, phase: 'generate' },
      });
      result.failures.push({ workspaceId: ws.id, reason });
      continue;
    }

    if (!outcome.inserted) {
      result.digestsAlreadyExisted += 1;
      continue;
    }
    result.digestsWritten += 1;

    if (!ws.brokerOwnerEmail || !outcome.briefingId) {
      continue;
    }

    try {
      const sent: NotifyWeeklyDigestReadyResult = await notify({
        brokerOwnerEmail: ws.brokerOwnerEmail,
        workspaceName: ws.name,
        workspaceId: ws.id,
        data: outcome.data,
        appOrigin,
      });
      await withSystemContext(async (tx) => {
        await tx.workspaceBriefing.update({
          where: { id: outcome.briefingId! },
          data: { emailedAt: now },
        });
      });
      if (sent.messageId) result.notificationsSent += 1;
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      reportInngestItemFailure(err, {
        functionId: WEEKLY_PROOF_DIGEST_SWEEP_FUNCTION_ID,
        extraTags: { workspace_id: ws.id, phase: 'notify' },
      });
      result.failures.push({ workspaceId: ws.id, reason });
    }
  }
  return result;
}

async function defaultListCandidates(): Promise<SweepWorkspaceCandidate[]> {
  return withSystemContext(async (tx) => {
    const workspaces = await tx.workspace.findMany({
      where: {
        closureStatus: 'ACTIVE',
        memberships: { some: { status: 'ACTIVE', role: 'BROKER_OWNER' } },
      },
      select: {
        id: true,
        name: true,
        preference: { select: { briefingsMutedAt: true } },
        memberships: {
          where: { status: 'ACTIVE', role: 'BROKER_OWNER' },
          orderBy: { createdAt: 'asc' },
          take: 1,
          select: { user: { select: { email: true } } },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
    return workspaces.map((ws) => ({
      id: ws.id,
      name: ws.name,
      brokerOwnerEmail: ws.memberships[0]?.user.email ?? null,
      briefingsMutedAt: ws.preference?.briefingsMutedAt ?? null,
    }));
  });
}

export const weeklyProofDigestSweepFn = inngest.createFunction(
  {
    id: WEEKLY_PROOF_DIGEST_SWEEP_FUNCTION_ID,
    name: 'agentplain weekly proof-of-value digest (Mon ~08:00 ET)',
    triggers: [
      { cron: WEEKLY_PROOF_DIGEST_SWEEP_CRON },
      { event: WEEKLY_PROOF_DIGEST_SWEEP_TRIGGER_EVENT },
    ],
  },
  async () =>
    runWithDisableGate(WEEKLY_PROOF_DIGEST_SWEEP_FUNCTION_ID, () =>
      withCronMonitor(
        {
          slug: WEEKLY_PROOF_DIGEST_SWEEP_FUNCTION_ID,
          schedule: WEEKLY_PROOF_DIGEST_SWEEP_CRON,
          // Weekly cadence — generous margin so a slow workspace fan-out
          // doesn't trip false positives.
          checkinMargin: 20,
          maxRuntime: 20,
        },
        () =>
          withInngestErrorReporting(
            { functionId: WEEKLY_PROOF_DIGEST_SWEEP_FUNCTION_ID },
            async () => {
              const logger = getLogger().child({
                boundary: 'inngest',
                function_id: WEEKLY_PROOF_DIGEST_SWEEP_FUNCTION_ID,
              });
              logger.info('weekly proof digest sweep started');
              const out = await runWeeklyDigestSweep();
              logger.info('weekly proof digest sweep finished', {
                considered: out.workspacesConsidered,
                digests_written: out.digestsWritten,
                already_existed: out.digestsAlreadyExisted,
                muted: out.workspacesMuted,
                notifications_sent: out.notificationsSent,
                failed: out.failures.length,
              });
              return out;
            },
          ),
      ),
    ),
);
