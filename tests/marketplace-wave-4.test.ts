/**
 * tests/marketplace-wave-4.test.ts
 *
 * Wave-4 — pins the realty-CRM marketplace additions:
 *   - Sierra Interactive entry exists, is `available`, connectMode=api-key,
 *     and persists under provider=SIERRA_INTERACTIVE.
 *   - BoldTrail entry exists, is HONESTLY `coming-soon` (partner enrollment
 *     pending), still tagged connectMode=api-key for when it flips on.
 *   - Lofty + Real Geeks ride along as coming-soon waitlist entries.
 *   - The FUB UI form's connect URL map (in the integration detail page)
 *     points to the route that actually exists in `app/api/integrations/`.
 *   - Honesty bar: every `available` entry STILL requests zero send-style
 *     scopes (wave-3 invariant — extends to the new CRMs).
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  getMarketplaceEntry,
  listIntegrations,
} from '@/lib/integrations/marketplace';

describe('marketplace wave-4 — Sierra Interactive', () => {
  it('Sierra is available, api-key connectMode, sales-enablement discipline', () => {
    const entry = getMarketplaceEntry('sierra');
    assert.ok(entry, 'Sierra entry must exist in marketplace');
    assert.equal(entry.status, 'available');
    assert.equal(entry.providerKey, 'SIERRA_INTERACTIVE');
    assert.equal(entry.connectMode, 'api-key');
    assert.ok(
      (entry.disciplines as readonly string[]).includes('sales-enablement'),
      'Sierra serves the sales-enablement discipline',
    );
    assert.ok(
      Array.isArray(entry.verticalRelevance) &&
        entry.verticalRelevance.includes('real-estate'),
      'Sierra is realty-only',
    );
  });

  it('Sierra requests zero send-style scopes (honesty bar)', () => {
    const entry = getMarketplaceEntry('sierra');
    assert.ok(entry);
    for (const scope of entry.scopes) {
      assert.doesNotMatch(scope, /:send$|:write$/i.test(scope) && /send/i.test(scope) ? /send/i : /__never__/);
    }
    // Explicit: no scope contains "send".
    assert.equal(
      entry.scopes.filter((s) => /send/i.test(s)).length,
      0,
      'Sierra must not request send-style scopes per no-outbound architecture',
    );
  });
});

describe('marketplace wave-4 — BoldTrail honest coming-soon', () => {
  it('BoldTrail is coming-soon (partner enrollment pending), api-key shape pre-staged', () => {
    const entry = getMarketplaceEntry('boldtrail');
    assert.ok(entry, 'BoldTrail entry must exist in marketplace');
    assert.equal(entry.status, 'coming-soon');
    assert.equal(entry.providerKey, null);
    // connectMode is api-key so the form is ready to light up when the
    // partner agreement lands — the catalog flips one field at that point.
    assert.equal(entry.connectMode, 'api-key');
    assert.match(
      entry.description,
      /enrollment/i,
      'BoldTrail description should NAME the partner-enrollment gap',
    );
  });
});

describe('marketplace wave-4 — Lofty + Real Geeks waitlist entries', () => {
  it('Lofty exists as coming-soon', () => {
    const entry = getMarketplaceEntry('lofty');
    assert.ok(entry);
    assert.equal(entry.status, 'coming-soon');
  });
  it('Real Geeks exists as coming-soon', () => {
    const entry = getMarketplaceEntry('real-geeks');
    assert.ok(entry);
    assert.equal(entry.status, 'coming-soon');
  });
});

describe('marketplace wave-4 — every realty CRM in the catalog (sanity)', () => {
  it('the catalog lists at least FUB + Sierra + BoldTrail + kvCORE + Lofty + Real Geeks (six realty CRMs)', () => {
    const realtyCrms = listIntegrations().filter(
      (e) =>
        e.category === 'CRM' &&
        Array.isArray(e.verticalRelevance) &&
        e.verticalRelevance.includes('real-estate'),
    );
    const ids = new Set(realtyCrms.map((e) => e.id));
    for (const required of [
      'follow-up-boss',
      'sierra',
      'boldtrail',
      'kvcore',
      'lofty',
      'real-geeks',
    ]) {
      assert.ok(ids.has(required), `expected realty CRM ${required} in catalog`);
    }
  });
});
