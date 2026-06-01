/**
 * Inngest event handler: agentplain/onboarding.first-fire.requested.
 *
 * Fired by the wave-9 self-serve onboarding wizard the moment the
 * customer submits the "set your voice" step (step 4 of 5). Reads the
 * `OnboardingState.pickedSkillSlugs` JSON column, then runs each picked
 * skill once for THIS workspace via the skill's run-for-workspace
 * production entry. The skill itself writes its own SkillRun row + its
 * own WorkApprovalQueueItem rows; this function only orchestrates the
 * fan-out.
 *
 * Why an event-driven function and not just inline server-action work:
 * the wizard's `/onboarding/first_fire_watch` step renders immediately,
 * so the customer sees the polling watch panel within a few hundred
 * milliseconds. Spinning up the LLM calls on the server-action thread
 * would block the redirect for 10-30s and visibly stall the wizard.
 * Inngest gives us bounded concurrency, retries, and a separate worker
 * — the wizard returns instantly and the watch panel polls SkillRun
 * for the results.
 *
 * Per `project_no_outbound_architecture.md`: every run-for-workspace
 * function this handler invokes writes to the approval queue + SkillRun
 * only. Nothing leaves the workspace.
 *
 * Per `feedback_cold_start_safe_agents.md`: the handler is stateless.
 * Each fire reads OnboardingState fresh from the DB.
 *
 * Per `feedback_no_silent_vendor_lock.md`: the slug → runner map below
 * is the single seam for "what does first fire run." Adding a new
 * pickable skill = append the runner here.
 */

import { inngest } from '../client';
import { runWithDisableGate } from '../run-with-disable-gate';
import {
  reportInngestItemFailure,
  withInngestErrorReporting,
} from '../with-error-reporting';
import { getLogger } from '@/lib/observability';
import { withSystemContext } from '@/lib/db/rls';
import { readPickedSlugs } from '@/lib/onboarding/picked-skills';
import { runAnalyticsPulseForWorkspace } from '@/lib/skills/analytics-weekly-pulse-general';
import { runCalendarDrafterForWorkspace } from '@/lib/skills/content-calendar-drafter-general';
import { runFinancePulseForWorkspace } from '@/lib/skills/finance-pulse-general';
import { runComplianceWatchForWorkspace } from '@/lib/skills/compliance-watch-general';
import { runChiefOfStaffForWorkspace } from '@/lib/skills/chief-of-staff-scheduler';
import { runFollowUpChaserForWorkspace } from '@/lib/skills/follow-up-chaser-general/run-for-workspace';
import { runProcessDocDrafterForWorkspace } from '@/lib/skills/process-doc-drafter-general/run-for-workspace';

export const ONBOARDING_FIRST_FIRE_FUNCTION_ID =
  'agentplain-onboarding-first-fire';

export const ONBOARDING_FIRST_FIRE_EVENT =
  'agentplain/onboarding.first-fire.requested';

/** Shape of the event the wizard emits. */
export interface OnboardingFirstFireEventData {
  workspaceId: string;
}

interface SkillRunner {
  slug: string;
  /** Calls the skill's production run-for-workspace entry. Returns true
   *  on success regardless of whether the skill actually wrote an
   *  approval row — `outcome=SUCCEEDED_NO_DRAFT` and
   *  `outcome=SKIPPED_*` both count as "ran cleanly" for the wizard.
   *  Only thrown errors / explicit failure results count as failures. */
  run: (workspaceId: string) => Promise<{ ok: boolean; reason?: string }>;
}

/** The single seam mapping a pickable-skill slug to its production
 *  run-for-workspace function. Skills the wizard never offers (e.g.
 *  inbox-triage-general is webhook-driven, not first-fire-friendly)
 *  are deliberately absent — a picked slug without a runner is a no-op
 *  with a logged warning. */
const RUNNERS: SkillRunner[] = [
  {
    slug: 'analytics-weekly-pulse-general',
    run: async (workspaceId) => {
      const res = await runAnalyticsPulseForWorkspace({ workspaceId });
      if (!res.ok) {
        return { ok: false, reason: `${res.error.code}: ${res.error.message}` };
      }
      return { ok: true };
    },
  },
  {
    slug: 'content-calendar-drafter-general',
    run: async (workspaceId) => {
      const res = await runCalendarDrafterForWorkspace({ workspaceId });
      if (!res.ok) {
        return { ok: false, reason: `${res.error.code}: ${res.error.message}` };
      }
      return { ok: true };
    },
  },
  {
    slug: 'finance-pulse-general',
    run: async (workspaceId) => {
      const res = await runFinancePulseForWorkspace({ workspaceId });
      if (!res.ok) {
        return { ok: false, reason: `${res.error.code}: ${res.error.message}` };
      }
      return { ok: true };
    },
  },
  {
    slug: 'compliance-watch-general',
    run: async (workspaceId) => {
      const res = await runComplianceWatchForWorkspace({ workspaceId });
      if (!res.ok) {
        return { ok: false, reason: `${res.error.code}: ${res.error.message}` };
      }
      return { ok: true };
    },
  },
  {
    slug: 'chief-of-staff-scheduler',
    run: async (workspaceId) => {
      try {
        const res = await runChiefOfStaffForWorkspace({ workspaceId });
        if (!res.ok) {
          return {
            ok: false,
            reason: `${res.error.code}: ${res.error.message}`,
          };
        }
        return { ok: true };
      } catch (err) {
        return {
          ok: false,
          reason: err instanceof Error ? err.message : String(err),
        };
      }
    },
  },
  {
    slug: 'follow-up-chaser-general',
    run: async (workspaceId) => {
      try {
        const res = await runFollowUpChaserForWorkspace({ workspaceId });
        if (!res.ok) {
          return {
            ok: false,
            reason: `${res.error.code}: ${res.error.message}`,
          };
        }
        return { ok: true };
      } catch (err) {
        return {
          ok: false,
          reason: err instanceof Error ? err.message : String(err),
        };
      }
    },
  },
  {
    slug: 'process-doc-drafter-general',
    run: async (workspaceId) => {
      try {
        const res = await runProcessDocDrafterForWorkspace({ workspaceId });
        if (!res.ok) {
          return {
            ok: false,
            reason: `${res.error.code}: ${res.error.message}`,
          };
        }
        return { ok: true };
      } catch (err) {
        return {
          ok: false,
          reason: err instanceof Error ? err.message : String(err),
        };
      }
    },
  },
];

const RUNNER_BY_SLUG = new Map(RUNNERS.map((r) => [r.slug, r] as const));

export interface OnboardingFirstFireResult {
  workspaceId: string;
  pickedSlugs: string[];
  ran: Array<{ slug: string; ok: boolean; reason?: string }>;
  skippedNoRunner: string[];
  /** True when at least one runner succeeded. The watch panel still
   *  reads SkillRun rows directly, so this is a coarse log signal —
   *  not the authoritative source of "did anything land." */
  anySucceeded: boolean;
}

export async function runOnboardingFirstFire(
  workspaceId: string,
): Promise<OnboardingFirstFireResult> {
  // Fresh read of OnboardingState — the wizard wrote pickedSkillSlugs
  // before dispatching the event, so this is the source of truth.
  const state = await withSystemContext((tx) =>
    tx.onboardingState.findUnique({
      where: { workspaceId },
      select: { pickedSkillSlugs: true, firstFireRequestedAt: true },
    }),
  );

  const pickedSlugs = readPickedSlugs(state?.pickedSkillSlugs ?? []);
  const skippedNoRunner: string[] = [];
  const runnable: SkillRunner[] = [];
  for (const slug of pickedSlugs) {
    const runner = RUNNER_BY_SLUG.get(slug);
    if (runner) runnable.push(runner);
    else skippedNoRunner.push(slug);
  }

  const ran: Array<{ slug: string; ok: boolean; reason?: string }> = [];
  let anySucceeded = false;
  for (const runner of runnable) {
    try {
      const out = await runner.run(workspaceId);
      ran.push({ slug: runner.slug, ok: out.ok, reason: out.reason });
      if (out.ok) anySucceeded = true;
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      ran.push({ slug: runner.slug, ok: false, reason });
      reportInngestItemFailure(err, {
        functionId: ONBOARDING_FIRST_FIRE_FUNCTION_ID,
        extraTags: {
          workspace_id: workspaceId,
          phase: 'run-skill',
          skill_slug: runner.slug,
        },
      });
    }
  }

  // Stamp completion best-effort. The watch panel reads SkillRun rows
  // directly so this column is observability, not control flow.
  try {
    await withSystemContext((tx) =>
      tx.onboardingState.update({
        where: { workspaceId },
        data: { firstFireCompletedAt: new Date() },
      }),
    );
  } catch {
    // Non-fatal — the watch panel works without this column.
  }

  return {
    workspaceId,
    pickedSlugs,
    ran,
    skippedNoRunner,
    anySucceeded,
  };
}

export const onboardingFirstFireFn = inngest.createFunction(
  {
    id: ONBOARDING_FIRST_FIRE_FUNCTION_ID,
    name: 'agentplain onboarding first-fire trigger',
    concurrency: { limit: 5 },
    retries: 2,
    triggers: [{ event: ONBOARDING_FIRST_FIRE_EVENT }],
  },
  async ({ event }) =>
    runWithDisableGate(ONBOARDING_FIRST_FIRE_FUNCTION_ID, () =>
      withInngestErrorReporting(
        { functionId: ONBOARDING_FIRST_FIRE_FUNCTION_ID },
        async () => {
          const logger = getLogger().child({
            boundary: 'inngest',
            function_id: ONBOARDING_FIRST_FIRE_FUNCTION_ID,
          });
          const data = parseEventData(event?.data);
          if (!data) {
            logger.info('first-fire event missing workspaceId — skipping');
            return { skipped: true, reason: 'malformed-event' as const };
          }
          logger.info('onboarding first-fire started', {
            workspace_id: data.workspaceId,
          });
          const out = await runOnboardingFirstFire(data.workspaceId);
          logger.info('onboarding first-fire finished', {
            workspace_id: data.workspaceId,
            picked_count: out.pickedSlugs.length,
            ran_count: out.ran.length,
            succeeded_count: out.ran.filter((r) => r.ok).length,
            failed_count: out.ran.filter((r) => !r.ok).length,
            skipped_no_runner: out.skippedNoRunner.length,
            any_succeeded: out.anySucceeded,
          });
          return out;
        },
      ),
    ),
);

function parseEventData(raw: unknown): OnboardingFirstFireEventData | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.workspaceId !== 'string') return null;
  return { workspaceId: r.workspaceId };
}
