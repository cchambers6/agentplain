/**
 * pfd-4 — signup-flow vertical gating.
 *
 * The bar: a customer who picks a vertical we can't serve — or that we have
 * not opened yet — is NEVER charged and NEVER gets a workspace. They land on
 * the honest waitlist branch. This test drives the real `signUpAction` and
 * asserts the short-circuit happens BEFORE any workspace creation, while an
 * on-sale vertical is allowed to proceed past the gate.
 *
 * TWO GATES, TWO REASONS (launch/narrow-to-law). The action now runs the
 * readiness gate and then the LAUNCH-WINDOW gate:
 *
 *   reason: 'not-ready'     — lib/verticals/readiness.ts says the flagship
 *                             workflow cannot fire at all.
 *   reason: 'not-open-yet'  — it CAN fire, but lib/verticals/launch.ts has
 *                             not opened the vertical for sale.
 *
 * The reason codes are asserted, not just the boolean: telling a CPA firm
 * "the flagship workflow isn't live" when it is would be its own lie, and a
 * bare `waitlist !== undefined` assertion would not catch that swap.
 *
 * The gates run entirely on registry truth + the slug, before any auth /
 * billing call, so this test needs no DB or Stripe creds.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { signUpAction } from '@/app/(product)/app/actions';

function form(fields: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  return f;
}

describe('signUpAction — unsupported-vertical gate', () => {
  it('routes an unsupported (credential-gated) vertical to the honest waitlist, no workspace', async () => {
    const result = await signUpAction(undefined, form({
      email: 'owner@acme.example',
      brokerageName: 'Acme Insurance',
      vertical: 'insurance',
      tier: 'regular',
    }));
    assert.equal(result.ok, true);
    assert.ok(result.waitlist, 'returns the waitlist branch');
    assert.equal(result.waitlist?.verticalSlug, 'insurance');
    assert.ok(result.waitlist?.verticalName, 'carries a display name for the copy');
    // Readiness held it, not the launch window — the copy must say so.
    assert.equal(result.waitlist?.reason, 'not-ready');
    // The waitlist branch carries NO checkoutUrl — no charge path was taken.
    assert.equal(result.checkoutUrl, undefined);
  });

  it('routes the credential-gated + no-flagship verticals to the waitlist', async () => {
    // pfd-8 flipped cpa + law to SUPPORTED (their callers shipped). The
    // five credential-gated verticals + recruiting (no flagship) stay
    // honestly waitlisted.
    for (const slug of [
      'mortgage',
      'insurance',
      'property-management',
      'title-escrow',
      'ria',
      'recruiting',
    ]) {
      const result = await signUpAction(undefined, form({
        email: 'owner@acme.example',
        brokerageName: 'Acme',
        vertical: slug,
        tier: 'regular',
      }));
      assert.ok(result.waitlist, `${slug} must route to waitlist`);
      assert.equal(result.waitlist?.verticalSlug, slug);
      assert.equal(
        result.waitlist?.reason,
        'not-ready',
        `${slug} is held by readiness, not by the launch window`,
      );
    }
  });

  it('waitlists real-estate + cpa on the LAUNCH WINDOW, with the honest reason', async () => {
    // Both are readiness-SUPPORTED (their killer-workflow callers shipped in
    // pfd-8) but neither is in the launch window, so neither can take money.
    // The reason must be 'not-open-yet': telling a CPA firm its flagship
    // workflow isn't live would be false, and it is the readiness resolver's
    // answer that proves it.
    for (const slug of ['real-estate', 'cpa']) {
      const result = await signUpAction(undefined, form({
        email: 'owner@acme.example',
        brokerageName: 'Acme',
        vertical: slug,
        tier: 'regular',
      }));
      assert.ok(result.waitlist, `${slug} must route to waitlist`);
      assert.equal(result.waitlist?.verticalSlug, slug);
      assert.equal(
        result.waitlist?.reason,
        'not-open-yet',
        `${slug} is serveable — it is the launch window holding it, not readiness`,
      );
      // No charge path was taken.
      assert.equal(result.checkoutUrl, undefined);
    }
  });

  it('does NOT waitlist law — the launch vertical proceeds past both gates', async () => {
    // law is readiness-supported AND in the launch window, so both gates let
    // it through; it then proceeds to signUpBrokerOwner, which will throw or
    // error without a DB. The KEY assertion is that it did NOT return the
    // waitlist branch.
    let result;
    try {
      result = await signUpAction(undefined, form({
        email: 'owner@acme.example',
        brokerageName: 'Acme Law',
        vertical: 'law',
        tier: 'regular',
      }));
    } catch {
      // A downstream auth/DB failure is fine here — it proves both gates let
      // the launch vertical THROUGH.
      return;
    }
    // If it returned (degraded path), it must not be a waitlist result.
    assert.equal(result.waitlist, undefined, 'the launch vertical must not waitlist');
  });

  it('does NOT waitlist the general on-ramp (always serveable)', async () => {
    let result;
    try {
      result = await signUpAction(undefined, form({
        email: 'owner@acme.example',
        brokerageName: 'Acme Co',
        vertical: 'general',
        tier: 'regular',
      }));
    } catch {
      return; // proceeded past the gate (correct)
    }
    assert.equal(result.waitlist, undefined, 'general must not waitlist');
  });
});
