/**
 * Inngest cron: media — platform performance digest.
 *
 * Standing work for the internal media fleet (see `lib/fleet/roster.ts`). Owned
 * by the Media Director; fed by Analytics + attribution and every platform
 * specialist. Mondays 15:00 UTC (15:00, deliberately AFTER the 13:00 customer
 * content-calendar sweep so the two never contend for the same window).
 *
 * Honest stub (mirrors `b2b-ceo-daily.ts`): the real body reads each connected
 * platform's reporting surface, computes per-channel deltas, and drafts a
 * cross-channel digest with a proposed reallocation. That depends on the
 * CronDefinition runner port + live platform read connectors. Until then this
 * registers cleanly, runs through the disable-gate + observability stack, logs,
 * and does NOT call Anthropic — zero API cost.
 *
 * Per `project_no_outbound_architecture`: the digest is a draft proposal. No
 * budget is moved; Conner approves any spend reallocation.
 *
 * Disable flag: INNGEST_FN_DISABLE_MEDIA_PLATFORM_PERFORMANCE_DIGEST. Default OFF.
 */

import { inngest } from '../client';
import { runWithDisableGate } from '../run-with-disable-gate';
import { withInngestErrorReporting } from '../with-error-reporting';
import { getLogger, withCronMonitor } from '@/lib/observability';

export const MEDIA_PLATFORM_PERFORMANCE_DIGEST_FUNCTION_ID =
  'media-platform-performance-digest';
export const MEDIA_PLATFORM_PERFORMANCE_DIGEST_CRON = '0 15 * * MON';

export interface MediaPlatformPerformanceDigestResult {
  status: 'pending-runner-port';
  ownerSlug: 'media-director';
  reason: string;
}

export async function runMediaPlatformPerformanceDigest(): Promise<MediaPlatformPerformanceDigestResult> {
  return {
    status: 'pending-runner-port',
    ownerSlug: 'media-director',
    reason:
      'media-platform-performance-digest seam registered 2026-06-06. Real body ' +
      '(read each platform report → per-channel deltas → draft a reallocation proposal) ' +
      'is gated on the CronDefinition runner port + live platform read connectors. ' +
      'Disable flag remains the control surface once the runner lands.',
  };
}

export const mediaPlatformPerformanceDigestFn = inngest.createFunction(
  {
    id: MEDIA_PLATFORM_PERFORMANCE_DIGEST_FUNCTION_ID,
    name: 'Media — platform performance digest (stub, awaiting runner port)',
    triggers: [{ cron: MEDIA_PLATFORM_PERFORMANCE_DIGEST_CRON }],
  },
  async () =>
    runWithDisableGate(MEDIA_PLATFORM_PERFORMANCE_DIGEST_FUNCTION_ID, () =>
      withCronMonitor(
        {
          slug: MEDIA_PLATFORM_PERFORMANCE_DIGEST_FUNCTION_ID,
          schedule: MEDIA_PLATFORM_PERFORMANCE_DIGEST_CRON,
          checkinMargin: 15,
          maxRuntime: 15,
        },
        () =>
          withInngestErrorReporting(
            { functionId: MEDIA_PLATFORM_PERFORMANCE_DIGEST_FUNCTION_ID },
            async () => {
              const logger = getLogger().child({
                boundary: 'inngest',
                function_id: MEDIA_PLATFORM_PERFORMANCE_DIGEST_FUNCTION_ID,
              });
              const out = await runMediaPlatformPerformanceDigest();
              logger.info('media-platform-performance-digest stub fired', {
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
