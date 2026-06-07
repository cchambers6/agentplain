/**
 * Inngest cron: media — weekly creative review.
 *
 * Standing work for the Creative discipline (see `lib/fleet/roster.ts`). Owned
 * by the Creative Director, who heads Creative as a peer to the Head of Media.
 * Thursdays 14:00 UTC. (The function id keeps its legacy `media-` prefix for
 * Inngest registration stability — the cadence itself is Creative's.)
 *
 * Honest stub (mirrors `b2b-ceo-daily.ts`): the real body drives the
 * creative-director SKILL over the week's in-flight assets and drafts a
 * creative-review queue. That runner depends on the CronDefinition runner port
 * (the same `scripts/cron-skills/*.md` + memory-tree port `b2b-ceo-daily` is
 * waiting on) plus a media-fleet activity table that does not exist yet. Until
 * then this function registers cleanly with Inngest, runs through the same
 * disable-gate + observability stack as every other agentplain cron, emits a
 * structured log, and does NOT call Anthropic — zero API cost.
 *
 * Per `project_no_outbound_architecture`: when the runner lands, this drafts a
 * review queue for the operator. Nothing publishes; no media is bought.
 *
 * Disable flag: INNGEST_FN_DISABLE_MEDIA_WEEKLY_CREATIVE_REVIEW. Default OFF.
 */

import { inngest } from '../client';
import { runWithDisableGate } from '../run-with-disable-gate';
import { withInngestErrorReporting } from '../with-error-reporting';
import { getLogger, withCronMonitor } from '@/lib/observability';

export const MEDIA_WEEKLY_CREATIVE_REVIEW_FUNCTION_ID =
  'media-weekly-creative-review';
export const MEDIA_WEEKLY_CREATIVE_REVIEW_CRON = '0 14 * * THU';

export interface MediaWeeklyCreativeReviewResult {
  status: 'pending-runner-port';
  ownerSlug: 'creative-director';
  reason: string;
}

export async function runMediaWeeklyCreativeReview(): Promise<MediaWeeklyCreativeReviewResult> {
  return {
    status: 'pending-runner-port',
    ownerSlug: 'creative-director',
    reason:
      'media-weekly-creative-review seam registered 2026-06-06. Real body (drive ' +
      'creative-director over in-flight assets → draft a creative-review queue) ' +
      'is gated on the CronDefinition runner port + a fleet activity table. ' +
      'Disable flag remains the control surface once the runner lands.',
  };
}

export const mediaWeeklyCreativeReviewFn = inngest.createFunction(
  {
    id: MEDIA_WEEKLY_CREATIVE_REVIEW_FUNCTION_ID,
    name: 'Media — weekly creative review (stub, awaiting runner port)',
    triggers: [{ cron: MEDIA_WEEKLY_CREATIVE_REVIEW_CRON }],
  },
  async () =>
    runWithDisableGate(MEDIA_WEEKLY_CREATIVE_REVIEW_FUNCTION_ID, () =>
      withCronMonitor(
        {
          slug: MEDIA_WEEKLY_CREATIVE_REVIEW_FUNCTION_ID,
          schedule: MEDIA_WEEKLY_CREATIVE_REVIEW_CRON,
          checkinMargin: 15,
          maxRuntime: 15,
        },
        () =>
          withInngestErrorReporting(
            { functionId: MEDIA_WEEKLY_CREATIVE_REVIEW_FUNCTION_ID },
            async () => {
              const logger = getLogger().child({
                boundary: 'inngest',
                function_id: MEDIA_WEEKLY_CREATIVE_REVIEW_FUNCTION_ID,
              });
              const out = await runMediaWeeklyCreativeReview();
              logger.info('media-weekly-creative-review stub fired', {
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
