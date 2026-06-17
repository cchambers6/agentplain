/**
 * lib/integrations/recommendations.test.ts
 *
 * Pins vertical-aware connector recommendations: the lead recommendation is
 * the connector that unlocks the vertical's killer workflow, the shortlist
 * is honest about each connector's status, and the wiring chain
 * (vertical pick → recommendation → killer-workflow connect target) holds.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { recommendedConnectorsFor } from './recommendations';
import { killerWorkflowFor } from '@/lib/plaino/killer-workflow';
import { getMarketplaceEntry } from './marketplace';

describe('vertical connector recommendations', () => {
  it("leads with the connector that unlocks each vertical's killer workflow", () => {
    const cases: Array<[Parameters<typeof recommendedConnectorsFor>[0], string]> = [
      ['REAL_ESTATE', 'follow-up-boss'],
      ['CPA', 'taxdome'],
      ['LAW', 'onedrive'],
      ['PROPERTY_MANAGEMENT', 'quickbooks'],
    ];
    for (const [vertical, expectedPrimary] of cases) {
      const recs = recommendedConnectorsFor(vertical);
      assert.ok(recs.primary, `${vertical} should have a primary rec`);
      assert.equal(recs.primary!.id, expectedPrimary);
      assert.equal(recs.primary!.unlocksKillerWorkflow, true);
      // The primary's headline must be the killer-workflow promise.
      assert.equal(
        recs.killerWorkflowHeadline,
        killerWorkflowFor(vertical).headline,
      );
    }
  });

  it('surfaces the vertical-specific connectors in the shortlist', () => {
    const cpa = recommendedConnectorsFor('CPA');
    const cpaIds = [cpa.primary?.id, ...cpa.others.map((o) => o.id)];
    assert.ok(cpaIds.includes('karbon'), 'CPA shortlist should include Karbon');

    const re = recommendedConnectorsFor('REAL_ESTATE');
    const reIds = re.others.map((o) => o.id);
    assert.ok(reIds.includes('sierra'), 'realty shortlist should include Sierra');

    // Law's practice-management tiles are coming-soon but still recommended,
    // honestly flagged.
    const law = recommendedConnectorsFor('LAW');
    const clio = law.others.find((o) => o.id === 'clio');
    assert.ok(clio, 'law shortlist should include Clio');
    assert.equal(clio!.status, 'coming-soon');
  });

  it('never dresses up a coming-soon connector as connectable', () => {
    for (const v of ['LAW', 'REAL_ESTATE', 'CPA', 'PROPERTY_MANAGEMENT'] as const) {
      const recs = recommendedConnectorsFor(v);
      for (const rec of [recs.primary, ...recs.others].filter(Boolean)) {
        const entry = getMarketplaceEntry(rec!.id);
        assert.ok(entry, `${rec!.id} must be a real catalog entry`);
        assert.equal(rec!.status, entry!.status, 'status must be the real one');
      }
    }
  });

  it('gives a brand-new (no vertical) workspace a confident general shortlist', () => {
    const recs = recommendedConnectorsFor(null);
    assert.ok(recs.primary, 'general workspace still gets a primary rec');
    assert.equal(recs.primary!.id, killerWorkflowFor(null).connectIntegrationId);
    assert.ok(recs.others.length > 0);
  });
});
