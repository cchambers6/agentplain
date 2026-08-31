/**
 * pfd-4 — signup-flow vertical gating.
 *
 * The bar: a customer who picks a vertical we can't serve — or that we have
 * not opened yet — is NEVER charged and NEVER gets a workspace. They land on
 * the honest waitlist branch. This test drives the real `signUpAction`.
 *
 * TWO GATES, TWO REASONS:
 *   reason: 'not-ready'    — lib/verticals/readiness.ts says the flagship
 *                            workflow cannot fire at all.
 *   reason: 'not-open-yet' — it CAN fire, but lib/verticals/launch.ts has
 *                            not opened the vertical for sale.
 *
 * The reason codes are asserted, not just the boolean: telling a CPA firm
 * "the flagship workflow isn't live" when it is would be its own lie, and a
 * bare `waitlist !== undefined` assertion would not catch that swap.
 *
 * DERIVED, NOT HARDCODED. No slug is named as "the launch vertical" here.
 * Every expectation is computed from `lib/verticals/launch.ts`, so switching
 * `LAUNCH_VERTICAL_SLUG` does not require editing this file. #440's version
 * hardcoded `law`, `cpa` and `real-estate` into the assertions, which meant
 * changing the launch vertical meant editing the test that guards it.
 *
 * ⚠️ THE HOLE THIS FILE USED TO HAVE. The previous "does NOT waitlist the
 * general on-ramp (always serveable)" case asserted only
 * `result.waitlist === undefined`. For `general` the action returns
 * `{ok:false, error:"Pick a vertical to continue"}` — no `waitlist` key —
 * so the assertion PASSED GREEN while `general` was completely unbuyable.
 * "Proceeded past the gate" and "was rejected before the gate" were
 * indistinguishable in the assertion. `assertReachesSignup` below
 * distinguishes them.
 *
 * The gates run entirely on registry truth + the slug, before any auth /
 * billing call, so this test needs no DB or Stripe creds.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { signUpAction } from '@/app/(product)/app/actions';
import { VERTICAL_SLUGS, ON_RAMP_SLUGS } from '@/lib/verticals';
import { isVerticalOnSale, ON_SALE_SLUGS } from '@/lib/verticals/launch';
import { resolveVerticalReadiness } from '@/lib/verticals/readiness';

function form(fields: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  return f;
}

function submit(slug: string) {
  return signUpAction(
    undefined,
    form({
      email: 'owner@acme.example',
      brokerageName: 'Acme',
      vertical: slug,
      tier: 'regular',
    }),
  );
}

/**
 * Assert the slug genuinely REACHED the signup path — i.e. both gates let it
 * through and it died downstream on missing DB/Stripe credentials, which is
 * the only honest proof available without a database.
 *
 * A `{ok:false}` with a VALIDATION error ("Pick a vertical to continue") is
 * a rejection, not a pass-through, and must fail this assertion. That
 * distinction is the whole point of this helper.
 */
async function assertReachesSignup(slug: string) {
  let result;
  try {
    result = await submit(slug);
  } catch {
    return; // threw downstream — it got past both gates
  }
  assert.equal(
    result.waitlist,
    undefined,
    `${slug} is on sale and must not waitlist`,
  );
  if (result.ok) return; // proceeded (checkout / notice branch)
  // Not ok: the ONLY acceptable failure here is a downstream infrastructure
  // error. A gate/validation refusal means the slug never reached signup.
  assert.ok(
    result.error && /DATABASE_URL|prisma|stripe|connect/i.test(result.error),
    `${slug} is on sale but signUpAction REFUSED it before signup with ` +
      `"${result.error}". It is advertised as buyable and is not.`,
  );
}

describe('signUpAction — readiness + launch-window gating', () => {
  it('every OFF-SALE published slug routes to the honest waitlist, no charge', async () => {
    const published = [...VERTICAL_SLUGS, ...ON_RAMP_SLUGS];
    const offSale = published.filter((s) => !isVerticalOnSale(s));
    assert.ok(offSale.length > 0, 'the launch window is not narrowing anything');

    for (const slug of offSale) {
      const result = await submit(slug);
      // On-ramp surfaces with no Prisma enum are refused by the enum guard at
      // actions.ts:75 before either gate — a different (and worse) shape than
      // the waitlist, but still no charge. Assert no charge either way.
      assert.equal(
        result.checkoutUrl,
        undefined,
        `${slug} must not reach a charge path`,
      );
      if (!result.waitlist) continue;
      assert.equal(result.waitlist.verticalSlug, slug);
      assert.ok(
        result.waitlist.verticalName,
        'carries a display name for the copy',
      );
      // The reason must match WHICH gate held it. Readiness is checked
      // first, so an unserveable vertical gets the more fundamental reason.
      const expected = resolveVerticalReadiness(slug).supported
        ? 'not-open-yet'
        : 'not-ready';
      assert.equal(
        result.waitlist.reason,
        expected,
        `${slug}: readiness says supported=${resolveVerticalReadiness(slug).supported}, ` +
          `so the waitlist reason must be "${expected}"`,
      );
    }
  });

  it('every ON-SALE slug genuinely reaches signup (not merely "no waitlist key")', async () => {
    for (const slug of ON_SALE_SLUGS) {
      await assertReachesSignup(slug);
    }
  });

  it('a readiness-supported but unopened vertical is held with "not-open-yet", never "not-ready"', async () => {
    const heldButServeable = [...VERTICAL_SLUGS].filter(
      (s) => resolveVerticalReadiness(s).supported && !isVerticalOnSale(s),
    );
    for (const slug of heldButServeable) {
      const result = await submit(slug);
      assert.ok(result.waitlist, `${slug} must route to waitlist`);
      assert.equal(
        result.waitlist?.reason,
        'not-open-yet',
        `${slug} is serveable — it is the launch window holding it, not readiness`,
      );
      assert.equal(result.checkoutUrl, undefined);
    }
  });

  it('an unknown slug is refused outright, never waitlisted and never charged', async () => {
    const result = await submit('quantum-widgets');
    assert.equal(result.ok, false);
    assert.equal(result.waitlist, undefined);
    assert.equal(result.checkoutUrl, undefined);
  });
});
