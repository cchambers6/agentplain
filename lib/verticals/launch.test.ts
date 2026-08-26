/**
 * lib/verticals/launch.test.ts
 *
 * The launch window may only ever SHRINK the readiness answer. These are the
 * assertions that make that structural rather than aspirational.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  LAUNCH_VERTICAL_SLUGS,
  LAUNCH_ON_RAMP_SLUGS,
  ON_SALE_SLUGS,
  isVerticalOnSale,
  launchHoldReason,
} from './launch';
import {
  resolveVerticalReadiness,
  SIGNUP_ON_RAMP_ALLOWLIST,
} from './readiness';
import { VERTICAL_SLUGS, ON_RAMP_SLUGS } from './index';

describe('launch window', () => {
  it('never sells a vertical readiness says we cannot serve', () => {
    for (const slug of LAUNCH_VERTICAL_SLUGS) {
      const verdict = resolveVerticalReadiness(slug);
      assert.equal(
        verdict.supported,
        true,
        `${slug} is on sale but readiness says ${verdict.reason}`,
      );
    }
  });

  it('every launch vertical is one of the locked ten', () => {
    for (const slug of LAUNCH_VERTICAL_SLUGS) {
      assert.ok(
        VERTICAL_SLUGS.includes(slug),
        `${slug} is on sale but is not a published vertical`,
      );
    }
  });

  it('the on-ramp half of the window matches the readiness hatch exactly', () => {
    assert.deepEqual(
      [...LAUNCH_ON_RAMP_SLUGS].sort(),
      [...SIGNUP_ON_RAMP_ALLOWLIST].sort(),
    );
    for (const slug of LAUNCH_ON_RAMP_SLUGS) {
      assert.ok(
        ON_RAMP_SLUGS.includes(slug),
        `${slug} is on sale as an on-ramp but is not a published on-ramp surface`,
      );
    }
  });

  it('holds every published slug that is not in the window', () => {
    const published = [...VERTICAL_SLUGS, ...ON_RAMP_SLUGS];
    const held = published.filter((s) => !ON_SALE_SLUGS.includes(s));
    assert.ok(held.length > 0, 'the window is not narrowing anything');
    for (const slug of held) {
      assert.equal(isVerticalOnSale(slug), false);
      assert.equal(launchHoldReason(slug), 'outside-launch-window');
    }
  });

  it('is total and fails closed on junk input', () => {
    assert.equal(isVerticalOnSale('quantum-widgets'), false);
    assert.equal(isVerticalOnSale(''), false);
    assert.equal(isVerticalOnSale(undefined as unknown as string), false);
    assert.equal(isVerticalOnSale('  LAW '), true);
    assert.equal(launchHoldReason('law'), null);
  });
});
