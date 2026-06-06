/**
 * Inngest cron: media — monthly media plan.
 *
 * Standing work for the internal media fleet (see `lib/fleet/roster.ts`). Owned
 * by the Media Director; the Head of Media co-signs before it reaches Conner.
 * 1st of each month, 13:00 UTC.
 *
 * Honest stub (mirrors `b2b-ceo-daily.ts`): the real body drafts the month's
 * media plan — channel mix, proposed budget split, and the earned-media
 * calendar — by driving the media-director SKILL over last month's digest. That
 * depends on the CronDefinition runner port + the platform-performance history
 * the digest cron will accumulate. Until then this registers cleanly, runs
 * through the disable-gate + observability stack, logs, and does NOT call
 * Anthropic — zero API cost.
 *
 * Per `project_no_outbound_architecture`: the plan is a proposal, not a spend.
 * Conner approves the budget; no agent here buys media.
 *
 * Disable flag: INNGEST_FN_DISABLE_MEDIA_MONTHLY_MEDIA_PLAN. Default OFF.
 */

import { inngest } from '../client';
import { runWithDisableGate } from '../run-with-disable-gate';
import { withInngestErrorReporting } from '../with-error-reporting';
import { getLogger, withCronMonitor } from '@/lib/observability';

export const MEDIA_MONTHLY_MEDIA_PLAN_FUNCTION_ID = 'media-monthly-media-plan';
export const MEDIA_MONTHLY_MEDIA_PLAN_CRON = '0 13 1 * *';

export interface MediaMonthlyMediaPlanResult {
  status: 'pending-runner-port';
  ownerSlug: 'media-director';
  reason: string;
}

export async function runMediaMonthlyMediaPlan(): Promise<MediaMonthlyMediaPlanResult> {
  return {
    status: 'pending-runner-port',
    ownerSlug: 'media-director',
    reason:
      'media-monthly-media-plan seam registered 2026-06-06. Real body (draft the ' +
      "month's channel mix + budget split + earned-media calendar from last month's " +
      'digest) is gated on the CronDefinition runner port + the digest cron history. ' +
      'Disable flag remains the control surface once the runner lands.',
  };
}

export const mediaMonthlyMediaPlanFn = inngest.createFunction(
  {
    id: MEDIA_MONTHLY_MEDIA_PLAN_FUNCTION_ID,
    name: 'Media — monthly media plan (stub, awaiting runner port)',
    triggers: [{ cron: MEDIA_MONTHLY_MEDIA_PLAN_CRON }],
  },
  async () =>
    runWithDisableGate(MEDIA_MONTHLY_MEDIA_PLAN_FUNCTION_ID, () =>
      withCronMonitor(
        {
          slug: MEDIA_MONTHLY_MEDIA_PLAN_FUNCTION_ID,
          schedule: MEDIA_MONTHLY_MEDIA_PLAN_CRON,
          checkinMargin: 15,
          maxRuntime: 15,
        },
        () =>
          withInngestErrorReporting(
            { functionId: MEDIA_MONTHLY_MEDIA_PLAN_FUNCTION_ID },
            async () => {
              const logger = getLogger().child({
                boundary: 'inngest',
                function_id: MEDIA_MONTHLY_MEDIA_PLAN_FUNCTION_ID,
              });
              const out = await runMediaMonthlyMediaPlan();
              logger.info('media-monthly-media-plan stub fired', {
                status: out.status,
                owner: out.ownerSlug,
                reason: out.reason,
              });
              return out;
            },
          ),
      ),
    ),
);
