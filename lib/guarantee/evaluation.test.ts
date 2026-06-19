/**
 * Tests for the Day-7 guarantee evaluation (pure decision + formatting).
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  barHoursToMinutes,
  evaluateGuarantee,
  formatMinutes,
} from './evaluation';

describe('barHoursToMinutes', () => {
  it('converts hours to whole minutes', () => {
    assert.equal(barHoursToMinutes(5), 300);
    assert.equal(barHoursToMinutes(2.5), 150);
    assert.equal(barHoursToMinutes(0), 0);
  });
});

describe('evaluateGuarantee', () => {
  const bar = barHoursToMinutes(5); // 300

  it('is not due before the evaluation day', () => {
    const e = evaluateGuarantee({
      totalMinutesSaved: 0,
      barMinutes: bar,
      ageDays: 6,
      evaluationDays: 7,
    });
    assert.equal(e.isDue, false);
    assert.equal(e.walkAwayEligible, false);
  });

  it('clears the bar → no walk-away', () => {
    const e = evaluateGuarantee({
      totalMinutesSaved: 360,
      barMinutes: bar,
      ageDays: 7,
      evaluationDays: 7,
    });
    assert.equal(e.isDue, true);
    assert.equal(e.meetsBar, true);
    assert.equal(e.deficitMinutes, 0);
    assert.equal(e.walkAwayEligible, false);
  });

  it('under the bar at the evaluation day → walk-away eligible', () => {
    const e = evaluateGuarantee({
      totalMinutesSaved: 90,
      barMinutes: bar,
      ageDays: 8,
      evaluationDays: 7,
    });
    assert.equal(e.meetsBar, false);
    assert.equal(e.deficitMinutes, 210);
    assert.equal(e.walkAwayEligible, true);
  });

  it('exactly at the bar counts as met', () => {
    const e = evaluateGuarantee({
      totalMinutesSaved: 300,
      barMinutes: bar,
      ageDays: 7,
      evaluationDays: 7,
    });
    assert.equal(e.meetsBar, true);
    assert.equal(e.walkAwayEligible, false);
  });
});

describe('formatMinutes', () => {
  it('renders minutes under an hour', () => {
    assert.equal(formatMinutes(47), '47 min');
    assert.equal(formatMinutes(0), '0 min');
  });
  it('renders hours with a single decimal, dropping .0', () => {
    assert.equal(formatMinutes(210), '3.5 hrs');
    assert.equal(formatMinutes(300), '5 hrs');
    assert.equal(formatMinutes(60), '1 hr');
  });
});
