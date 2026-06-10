/**
 * lib/measurement/value-impact-close.test.ts
 *
 * Unit test for `computeCloseValueImpact` — the per-assembled-close
 * hours-saved row. Pure function, no DB. Asserts the modeled number and
 * that every assumption is surfaced (no hidden guess).
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  computeCloseValueImpact,
  CLOSE_CHASE_DRAFT_MINUTES,
  CLOSE_OUTSTANDING_ITEM_MINUTES,
  CLOSE_UNCATEGORIZED_RECEIPT_MINUTES,
  CLOSE_STATUS_UPDATE_MINUTES,
  CLOSE_LABOR_RATE_USD_PER_HOUR,
} from './value-impact';

describe('computeCloseValueImpact', () => {
  it('models hours saved from chase drafts + outstanding items + triage + status', () => {
    const impact = computeCloseValueImpact({
      items: [
        { required: true, status: 'received' },
        { required: true, status: 'pending' },
        { required: true, status: 'late' },
        { required: false, status: 'pending' }, // optional → not counted
      ],
      chaseEmails: [{}], // one batched chase
      uncategorizedReceipts: [{}, {}], // two loose receipts
    });

    // 2 outstanding REQUIRED items (pending + late); optional excluded.
    assert.equal(impact.outstandingRequiredItems, 2);
    assert.equal(impact.chaseDrafts, 1);
    assert.equal(impact.uncategorizedReceipts, 2);

    const expectedMinutes =
      1 * CLOSE_CHASE_DRAFT_MINUTES +
      2 * CLOSE_OUTSTANDING_ITEM_MINUTES +
      2 * CLOSE_UNCATEGORIZED_RECEIPT_MINUTES +
      CLOSE_STATUS_UPDATE_MINUTES;
    assert.equal(impact.hoursSaved, Math.round((expectedMinutes / 60) * 100) / 100);
    assert.equal(
      impact.dollarsInfluenced,
      Math.round((expectedMinutes / 60) * CLOSE_LABOR_RATE_USD_PER_HOUR * 100) / 100,
    );
  });

  it('surfaces every constant + the formula (no hidden guess)', () => {
    const impact = computeCloseValueImpact({
      items: [],
      chaseEmails: [],
      uncategorizedReceipts: [],
    });
    assert.equal(impact.assumptions.chaseDraftMinutes, CLOSE_CHASE_DRAFT_MINUTES);
    assert.equal(impact.assumptions.laborRateUsdPerHour, CLOSE_LABOR_RATE_USD_PER_HOUR);
    assert.match(impact.assumptions.formula, /chaseDrafts/);
    // Even an all-clear close credits the status-update authoring.
    assert.equal(impact.statusUpdateDrafted, true);
    assert.ok(impact.hoursSaved > 0);
  });
});
