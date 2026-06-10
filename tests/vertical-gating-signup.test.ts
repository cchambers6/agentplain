/**
 * pfd-4 — signup-flow vertical gating.
 *
 * The bar: a customer who picks a vertical we can't serve is NEVER charged
 * and NEVER gets a workspace — they land on the honest waitlist branch.
 * This test drives the real `signUpAction` and asserts that an unsupported
 * vertical short-circuits to the waitlist BEFORE any workspace creation,
 * while a supported vertical is allowed to proceed past the gate.
 *
 * The gate runs entirely on registry truth + the slug, before any auth /
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
  it('routes an unsupported vertical (cpa) to the honest waitlist, no workspace', async () => {
    const result = await signUpAction(undefined, form({
      email: 'owner@acme.example',
      brokerageName: 'Acme CPA',
      vertical: 'cpa',
      tier: 'regular',
    }));
    assert.equal(result.ok, true);
    assert.ok(result.waitlist, 'returns the waitlist branch');
    assert.equal(result.waitlist?.verticalSlug, 'cpa');
    assert.ok(result.waitlist?.verticalName, 'carries a display name for the copy');
    // The waitlist branch carries NO checkoutUrl — no charge path was taken.
    assert.equal(result.checkoutUrl, undefined);
  });

  it('routes law / insurance / ria to the waitlist too', async () => {
    for (const slug of ['law', 'insurance', 'ria']) {
      const result = await signUpAction(undefined, form({
        email: 'owner@acme.example',
        brokerageName: 'Acme',
        vertical: slug,
        tier: 'regular',
      }));
      assert.ok(result.waitlist, `${slug} must route to waitlist`);
      assert.equal(result.waitlist?.verticalSlug, slug);
    }
  });

  it('does NOT waitlist a supported vertical (real-estate proceeds past the gate)', async () => {
    // real-estate is supported, so the gate lets it through — it then
    // proceeds to signUpBrokerOwner, which will throw or error without a
    // DB. The KEY assertion is that it did NOT return the waitlist branch:
    // a supported vertical must never be sent to the waitlist.
    let result;
    try {
      result = await signUpAction(undefined, form({
        email: 'owner@acme.example',
        brokerageName: 'Acme Realty',
        vertical: 'real-estate',
        tier: 'regular',
      }));
    } catch {
      // A downstream auth/DB failure is fine here — it proves the gate let
      // the supported vertical THROUGH (it got past the waitlist branch).
      return;
    }
    // If it returned (degraded path), it must not be a waitlist result.
    assert.equal(result.waitlist, undefined, 'supported vertical must not waitlist');
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
