/**
 * Contract tests for the three media-fleet standing crons.
 *
 * These ship as honest stubs (mirroring b2b-ceo-daily): they register with
 * Inngest and run through the disable-gate + observability stack but do NOT call
 * Anthropic. The tests pin the stub contract so the runner-port change is
 * unmistakable in review — `status` flips from 'pending-runner-port' to a real
 * outcome, and the owner slug stays stable. The function id + cron strings are
 * part of the Inngest contract: changing them silently re-schedules the work.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  runMediaWeeklyCreativeReview,
  MEDIA_WEEKLY_CREATIVE_REVIEW_FUNCTION_ID,
  MEDIA_WEEKLY_CREATIVE_REVIEW_CRON,
} from '../media-weekly-creative-review';
import {
  runMediaPlatformPerformanceDigest,
  MEDIA_PLATFORM_PERFORMANCE_DIGEST_FUNCTION_ID,
  MEDIA_PLATFORM_PERFORMANCE_DIGEST_CRON,
} from '../media-platform-performance-digest';
import {
  runMediaMonthlyMediaPlan,
  MEDIA_MONTHLY_MEDIA_PLAN_FUNCTION_ID,
  MEDIA_MONTHLY_MEDIA_PLAN_CRON,
} from '../media-monthly-media-plan';
import { listMediaCrons, getMediaAgent } from '@/lib/fleet/roster';

describe('media standing crons — stub contract', () => {
  it('weekly creative review returns the pending-runner-port stub owned by the creative director', async () => {
    const out = await runMediaWeeklyCreativeReview();
    assert.equal(out.status, 'pending-runner-port');
    assert.equal(out.ownerSlug, 'media-creative-director');
    assert.match(out.reason, /runner port/i);
  });

  it('platform performance digest returns the stub owned by the media director', async () => {
    const out = await runMediaPlatformPerformanceDigest();
    assert.equal(out.status, 'pending-runner-port');
    assert.equal(out.ownerSlug, 'media-director');
  });

  it('monthly media plan returns the stub owned by the media director', async () => {
    const out = await runMediaMonthlyMediaPlan();
    assert.equal(out.status, 'pending-runner-port');
    assert.equal(out.ownerSlug, 'media-director');
  });

  it('function ids + cron schedules are stable strings', () => {
    assert.equal(
      MEDIA_WEEKLY_CREATIVE_REVIEW_FUNCTION_ID,
      'media-weekly-creative-review',
    );
    assert.equal(MEDIA_WEEKLY_CREATIVE_REVIEW_CRON, '0 14 * * THU');
    assert.equal(
      MEDIA_PLATFORM_PERFORMANCE_DIGEST_FUNCTION_ID,
      'media-platform-performance-digest',
    );
    assert.equal(MEDIA_PLATFORM_PERFORMANCE_DIGEST_CRON, '0 15 * * MON');
    assert.equal(
      MEDIA_MONTHLY_MEDIA_PLAN_FUNCTION_ID,
      'media-monthly-media-plan',
    );
    assert.equal(MEDIA_MONTHLY_MEDIA_PLAN_CRON, '0 13 1 * *');
  });

  it('every roster cron resolves to a registered function id + a real owner', () => {
    // The roster and the cron modules must not drift: each MediaCron.functionId
    // matches a *_FUNCTION_ID export, and each owner/contributor is a real agent.
    const registeredIds = new Set([
      MEDIA_WEEKLY_CREATIVE_REVIEW_FUNCTION_ID,
      MEDIA_PLATFORM_PERFORMANCE_DIGEST_FUNCTION_ID,
      MEDIA_MONTHLY_MEDIA_PLAN_FUNCTION_ID,
    ]);
    const crons = listMediaCrons();
    assert.equal(crons.length, 3);
    for (const c of crons) {
      assert.ok(
        registeredIds.has(c.functionId),
        `cron ${c.functionId} is not a registered function id`,
      );
      assert.ok(
        getMediaAgent(c.ownerSlug),
        `cron ${c.functionId} owner ${c.ownerSlug} is not a roster agent`,
      );
      for (const contributor of c.contributorSlugs) {
        assert.ok(
          getMediaAgent(contributor),
          `cron ${c.functionId} contributor ${contributor} is not a roster agent`,
        );
      }
    }
  });
});
