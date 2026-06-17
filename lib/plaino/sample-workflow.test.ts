/**
 * lib/plaino/sample-workflow.test.ts
 *
 * Pins the "try with sample data" demo dataset: every vertical resolves to a
 * 3-row demo whose headline + connect target match the canonical
 * killer-workflow registry (so the demo and the connect CTA never drift).
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { sampleWorkflowFor } from './sample-workflow';
import { killerWorkflowFor } from './killer-workflow';

const VERTICALS = [
  'REAL_ESTATE',
  'CPA',
  'LAW',
  'PROPERTY_MANAGEMENT',
  'MORTGAGE',
] as const;

describe('plaino sample workflow', () => {
  it('mirrors the killer-workflow headline + connect target for every vertical', () => {
    for (const v of VERTICALS) {
      const demo = sampleWorkflowFor(v);
      const spec = killerWorkflowFor(v);
      assert.equal(demo.headline, spec.headline, `${v} headline must match`);
      assert.equal(
        demo.connectIntegrationId,
        spec.connectIntegrationId,
        `${v} connect target must match`,
      );
      assert.equal(demo.connectLabel, spec.connectLabel);
    }
  });

  it('always returns exactly three concrete sample rows', () => {
    for (const v of VERTICALS) {
      const demo = sampleWorkflowFor(v);
      assert.equal(demo.rows.length, 3, `${v} should have 3 rows`);
      for (const row of demo.rows) {
        assert.ok(row.trigger.length > 0);
        assert.ok(row.drafted.length > 0);
        assert.ok(row.detail.length > 0);
      }
    }
  });

  it('falls back to the general (invoice-chase) sample for unmapped verticals', () => {
    const general = sampleWorkflowFor(null);
    assert.match(general.sourceLabel, /QuickBooks/);
    // RECRUITING has no bespoke demo → general rows, but its OWN killer
    // headline/connect target from the registry.
    const recruiting = sampleWorkflowFor('RECRUITING');
    assert.equal(recruiting.sourceLabel, general.sourceLabel);
    assert.equal(recruiting.headline, killerWorkflowFor('RECRUITING').headline);
  });

  it('keeps the sample copy on-brand (no exclamation, no vendor names)', () => {
    for (const v of VERTICALS) {
      const demo = sampleWorkflowFor(v);
      const blob = [
        demo.scenario,
        demo.sourceLabel,
        ...demo.rows.flatMap((r) => [r.trigger, r.drafted, r.detail]),
      ].join(' ');
      assert.doesNotMatch(blob, /!/);
      assert.doesNotMatch(blob, /claude|anthropic/i);
    }
  });
});
