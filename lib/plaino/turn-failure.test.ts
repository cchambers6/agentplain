/**
 * lib/plaino/turn-failure.test.ts
 *
 * Pins the triage policy for a failed Plaino turn: honest customer copy,
 * the page decision (credential failures page; transient/parse do not),
 * severity, and the stable category tag. This is the policy that turns the
 * old opaque "had trouble drafting a reply" into a signal — both for the
 * customer and for fleet ops.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { triagePlainoTurnFailure } from './turn-failure';
import type { SkillError } from '../skills/types';

function llmFailure(reference: string): SkillError {
  return {
    code: 'UPSTREAM_LLM_ERROR',
    message: `plaino dispatcher LLM call failed: ${reference}; persisted placeholder reply abc`,
    reference,
  };
}

describe('triagePlainoTurnFailure', () => {
  it('PAUSED → credential, pages, critical, honest "briefly offline" copy', () => {
    const t = triagePlainoTurnFailure(llmFailure('PAUSED'));
    assert.equal(t.category, 'credential');
    assert.equal(t.shouldPage, true);
    assert.equal(t.severity, 'critical');
    assert.match(t.customerNotice, /briefly offline/);
    // Honesty: never claims the reply is on its way.
    assert.doesNotMatch(t.customerNotice, /on (its|the) way|drafting now/i);
  });

  it('AUTHENTICATION → credential, pages critical', () => {
    const t = triagePlainoTurnFailure(llmFailure('AUTHENTICATION'));
    assert.equal(t.category, 'credential');
    assert.equal(t.shouldPage, true);
    assert.equal(t.severity, 'critical');
  });

  it('NOT_CONFIGURED → credential, pages critical', () => {
    const t = triagePlainoTurnFailure(llmFailure('NOT_CONFIGURED'));
    assert.equal(t.category, 'credential');
    assert.equal(t.shouldPage, true);
  });

  it('OVER_BUDGET → budget, does NOT page, distinct customer copy', () => {
    const t = triagePlainoTurnFailure(llmFailure('OVER_BUDGET'));
    assert.equal(t.category, 'budget');
    assert.equal(t.shouldPage, false);
    assert.match(t.customerNotice, /usage limit/);
  });

  it('RATE_LIMITED → transient, does NOT page, "try again" copy', () => {
    const t = triagePlainoTurnFailure(llmFailure('RATE_LIMITED'));
    assert.equal(t.category, 'transient');
    assert.equal(t.shouldPage, false);
    assert.equal(t.severity, 'warn');
    assert.match(t.customerNotice, /try again/);
  });

  it('NETWORK and UPSTREAM_ERROR → transient, no page', () => {
    for (const ref of ['NETWORK', 'UPSTREAM_ERROR']) {
      const t = triagePlainoTurnFailure(llmFailure(ref));
      assert.equal(t.category, 'transient', ref);
      assert.equal(t.shouldPage, false, ref);
    }
  });

  it('INVALID_ARGUMENT → defect, PAGES at warn (likely stale model id)', () => {
    const t = triagePlainoTurnFailure(llmFailure('INVALID_ARGUMENT'));
    assert.equal(t.category, 'defect');
    assert.equal(t.shouldPage, true);
    assert.equal(t.severity, 'warn');
    assert.match(t.opsSummary, /model/i);
  });

  it('dispatcher PARSE_ERROR (no reference) → defect, no page', () => {
    const t = triagePlainoTurnFailure({
      code: 'PARSE_ERROR',
      message: 'classifier output malformed; persisted placeholder reply abc',
    });
    assert.equal(t.category, 'defect');
    assert.equal(t.shouldPage, false);
    assert.match(t.customerNotice, /had trouble drafting/);
  });

  it('unknown skill error code → unknown, no page, generic copy', () => {
    const t = triagePlainoTurnFailure({
      code: 'UNKNOWN',
      message: 'something unexpected',
    });
    assert.equal(t.category, 'unknown');
    assert.equal(t.shouldPage, false);
    assert.match(t.customerNotice, /had trouble drafting/);
    assert.match(t.opsSummary, /UNKNOWN/);
  });

  it('every triage result carries a non-empty customer notice + ops summary', () => {
    const refs = [
      'PAUSED',
      'AUTHENTICATION',
      'NOT_CONFIGURED',
      'OVER_BUDGET',
      'RATE_LIMITED',
      'NETWORK',
      'UPSTREAM_ERROR',
      'INVALID_ARGUMENT',
      'MALFORMED_RESPONSE',
      'CONTENT_FILTERED',
    ];
    for (const ref of refs) {
      const t = triagePlainoTurnFailure(llmFailure(ref));
      assert.ok(t.customerNotice.length > 0, `${ref} customerNotice`);
      assert.ok(t.opsSummary.length > 0, `${ref} opsSummary`);
    }
  });
});
