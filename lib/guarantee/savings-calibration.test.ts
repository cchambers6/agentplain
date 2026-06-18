/**
 * Tests for the time-savings calibration table.
 *
 * The bar: these are customer-visible numbers. The tests pin the contract
 * (every action resolves to minutes, overrides apply, nothing is wildly
 * inflated) so a careless edit that doubles a figure trips a test before
 * it ships a number a customer would dispute.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  GUARANTEE_ACTION_TYPES,
  actionLabel,
  isGuaranteeActionType,
  minutesSavedFor,
} from './savings-calibration';

describe('savings calibration', () => {
  it('resolves a base estimate for every action type', () => {
    for (const action of GUARANTEE_ACTION_TYPES) {
      const minutes = minutesSavedFor(action, 'real-estate');
      assert.ok(minutes > 0, `${action} should be > 0`);
      assert.ok(Number.isInteger(minutes), `${action} should be whole minutes`);
    }
  });

  it('matches the ratified base figures', () => {
    // Pin the published numbers — changing one is a deliberate, reviewed act.
    assert.equal(minutesSavedFor('drafted-email', 'general'), 10);
    assert.equal(minutesSavedFor('lead-enrichment', 'general'), 5);
    assert.equal(minutesSavedFor('document-chased', 'general'), 3);
    assert.equal(minutesSavedFor('meeting-scheduled', 'general'), 8);
    assert.equal(minutesSavedFor('invoice-sent', 'general'), 6);
    assert.equal(minutesSavedFor('tenant-notice-posted', 'general'), 12);
    assert.equal(minutesSavedFor('admin-task-handled', 'general'), 4);
  });

  it('applies per-vertical overrides where defined', () => {
    // CPA + law chase documents that take longer than the cross-vertical base.
    assert.equal(minutesSavedFor('document-chased', 'cpa'), 4);
    assert.equal(minutesSavedFor('document-chased', 'law'), 5);
    // Unmentioned vertical falls through to the base.
    assert.equal(minutesSavedFor('document-chased', 'home-services'), 3);
  });

  it('keeps estimates conservative (no figure exceeds 20 minutes)', () => {
    // A trust guard: a single mundane action crediting more than 20 minutes
    // would not survive a customer doing the math. Catches an inflated edit.
    for (const action of GUARANTEE_ACTION_TYPES) {
      for (const vertical of ['general', 'cpa', 'law', 'property-management']) {
        assert.ok(
          minutesSavedFor(action, vertical) <= 20,
          `${action}/${vertical} should stay conservative`,
        );
      }
    }
  });

  it('labels every action and narrows strings safely', () => {
    for (const action of GUARANTEE_ACTION_TYPES) {
      assert.ok(actionLabel(action).length > 0);
      assert.ok(isGuaranteeActionType(action));
    }
    assert.equal(isGuaranteeActionType('not-a-real-action'), false);
  });
});
