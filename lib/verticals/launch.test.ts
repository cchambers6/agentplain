/**
 * lib/verticals/launch.test.ts
 *
 * THE INVARIANT: the launch window may only ever SHRINK the set of slugs
 * that can take money. It can close a door; it can never open one.
 *
 * `lib/verticals/launch.ts` makes that structural (ON_SALE_SLUGS is an
 * intersection, not a list). These assertions make it LOUD — a slug the
 * launch constant asked for and the money gate dropped must never be a
 * silent drop.
 *
 * Read `moneyBlockerFor` before adding a case here: the money gate has THREE
 * legs (published / readiness-or-hatch / Prisma enum). #440's version had
 * two, and the missing third leg is why `general` reads as sellable and is
 * not.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  LAUNCH_VERTICAL_SLUG,
  LAUNCH_INTENT,
  LAUNCH_VERTICAL_SLUGS,
  LAUNCH_ON_RAMP_SLUGS,
  ON_SALE_SLUGS,
  isVerticalOnSale,
  launchHoldReason,
  launchVerticalSlug,
  launchVerticalName,
  launchIntentDiagnostics,
  moneyBlockerFor,
  canTakeMoney,
} from './launch';
import {
  resolveVerticalReadiness,
  SIGNUP_ON_RAMP_ALLOWLIST,
} from './readiness';
import { verticalEnumFromSlug } from '@/lib/auth/vertical-enum';
import { VERTICAL_SLUGS, ON_RAMP_SLUGS } from './index';

describe('launch window — the subset property', () => {
  it('MONOTONIC: the on-sale set is a subset of what the launch constant asked for', () => {
    // The window can only ever remove. If this fails, the derivation in
    // launch.ts has started ADDING slugs, which is the one thing it exists
    // to make impossible.
    for (const slug of ON_SALE_SLUGS) {
      assert.ok(
        LAUNCH_INTENT.includes(slug),
        `${slug} is on sale but the launch constant never asked for it — ` +
          `the window opened a door`,
      );
    }
  });

  it('SUBSET: every on-sale slug clears the money gate (readiness OR the on-ramp hatch)', () => {
    for (const slug of ON_SALE_SLUGS) {
      const verdict = resolveVerticalReadiness(slug);
      const hatched = SIGNUP_ON_RAMP_ALLOWLIST.includes(slug);
      assert.ok(
        verdict.supported || hatched,
        `${slug} is on sale but readiness says "${verdict.reason}" and it is ` +
          `not on SIGNUP_ON_RAMP_ALLOWLIST — we would be taking money for a ` +
          `vertical whose killer workflow cannot fire`,
      );
    }
  });

  it('PERSISTABLE: every on-sale slug has a Prisma Vertical enum', () => {
    // The leg #440 did not have. app/(product)/app/actions.ts:75 rejects a
    // slug with no enum BEFORE it reaches the on-ramp allowlist at :99, so a
    // slug can be allowlisted and still be unbuyable. Selling a page whose
    // signup action returns "Pick a vertical to continue" is the launch
    // defect in its purest form.
    for (const slug of ON_SALE_SLUGS) {
      assert.notEqual(
        verticalEnumFromSlug(slug),
        null,
        `${slug} is on sale but has no Prisma Vertical enum — signUpAction ` +
          `rejects it at actions.ts:75 with "Pick a vertical to continue"`,
      );
    }
  });

  it('every on-sale slug is published (locked ten or on-ramp), never invented', () => {
    const published = [...VERTICAL_SLUGS, ...ON_RAMP_SLUGS];
    for (const slug of ON_SALE_SLUGS) {
      assert.ok(
        published.includes(slug),
        `${slug} is on sale but is not a published surface`,
      );
    }
    assert.deepEqual(
      [...LAUNCH_VERTICAL_SLUGS, ...LAUNCH_ON_RAMP_SLUGS].sort(),
      [...ON_SALE_SLUGS].sort(),
      'the locked-ten / on-ramp split must partition the on-sale set exactly',
    );
  });

  it('NO SILENT DROP: everything the launch constant asked for is actually on sale', () => {
    // The loud half. The structural half already guarantees safety (a
    // dropped slug simply is not sold). This turns a safe silence into an
    // actionable failure that names the blocker.
    const dropped = launchIntentDiagnostics();
    assert.deepEqual(
      dropped,
      [],
      `LAUNCH_VERTICAL_SLUG = ${JSON.stringify(LAUNCH_VERTICAL_SLUG)} but the ` +
        `money gate dropped: ${JSON.stringify(dropped)}. ` +
        `Fix the blocker or change the launch constant.`,
    );
  });

  it('NON-EMPTY: something is actually on sale', () => {
    // A launch window that sells nothing is not a narrow launch, it is a
    // closed shop. This must be asserted separately from the subset
    // property: an empty set is trivially a subset of everything, so every
    // other assertion above passes vacuously when nothing is on sale.
    assert.ok(
      ON_SALE_SLUGS.length > 0,
      `nothing is on sale. LAUNCH_VERTICAL_SLUG = ` +
        `${JSON.stringify(LAUNCH_VERTICAL_SLUG)}, blockers = ` +
        `${JSON.stringify(launchIntentDiagnostics())}`,
    );
    assert.notEqual(launchVerticalSlug(), null);
    assert.notEqual(launchVerticalName(), null);
  });

  it('NARROWING: at least one published slug is actually held back', () => {
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
    assert.equal(moneyBlockerFor('quantum-widgets'), 'not-published');
    assert.equal(canTakeMoney('quantum-widgets'), false);
    // Case/whitespace tolerance must not become a way in for an off-sale slug.
    for (const slug of ON_SALE_SLUGS) {
      assert.equal(isVerticalOnSale(`  ${slug.toUpperCase()} `), true);
    }
  });

  it('the money gate reports the RIGHT blocker for each published slug', () => {
    // Documents the current shape of the world, so a change to any leg shows
    // up here as an intentional edit rather than a silent shift.
    for (const slug of [...VERTICAL_SLUGS, ...ON_RAMP_SLUGS]) {
      const blocker = moneyBlockerFor(slug);
      const verdict = resolveVerticalReadiness(slug);
      const hatched = SIGNUP_ON_RAMP_ALLOWLIST.includes(slug);
      if (!verdict.supported && !hatched) {
        assert.equal(
          blocker,
          'readiness-unsupported',
          `${slug}: readiness says ${verdict.reason}`,
        );
      } else if (verticalEnumFromSlug(slug) === null) {
        assert.equal(blocker, 'no-prisma-enum', `${slug}`);
      } else {
        assert.equal(blocker, null, `${slug}`);
      }
    }
  });
});
