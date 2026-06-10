/**
 * lib/skills/customer-support-triage/escalation.test.ts
 *
 * Unit-pins the deterministic escalate-first classifier — the LLM-free
 * safety net the degraded path leans on. False negatives (a sensitive
 * message slipping to auto-answer) are the failure we refuse; these tests
 * lock the trigger boundaries.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { classifyEscalation, largestDollarAmount } from './escalation';
import type { SupportMessageSnapshot } from './types';

function msg(body: string, subject = 'help'): SupportMessageSnapshot {
  return {
    id: 'x',
    workspaceId: 'ws',
    workspaceName: 'WS',
    verticalSlug: null,
    fromEmail: 'a@b.c',
    fromName: null,
    subject,
    body,
    partnerName: 'Plaino',
    receivedAt: new Date(),
  };
}

describe('largestDollarAmount', () => {
  it('parses $-prefixed, comma, and trailing-unit amounts', () => {
    assert.equal(largestDollarAmount('charged $1,234.56 plus $50'), 1234.56);
    assert.equal(largestDollarAmount('about 1200 dollars'), 1200);
    assert.equal(largestDollarAmount('300 usd refund'), 300);
    assert.equal(largestDollarAmount('no amount here'), null);
  });
});

describe('classifyEscalation', () => {
  it('returns null for a routine question', () => {
    assert.equal(
      classifyEscalation({
        message: msg('How do I connect Gmail?'),
        billingDisputeThresholdUsd: 200,
      }),
      null,
    );
  });

  it('billing dispute only escalates AT or ABOVE the threshold', () => {
    const under = classifyEscalation({
      message: msg('I want a refund of $50'),
      billingDisputeThresholdUsd: 200,
    });
    assert.equal(under, null);
    const over = classifyEscalation({
      message: msg('I want a refund of $250'),
      billingDisputeThresholdUsd: 200,
    });
    assert.equal(over?.trigger, 'billing-dispute-over-threshold');
  });

  it('a dispute with NO dollar amount does not escalate as a big dispute', () => {
    const r = classifyEscalation({
      message: msg('I want a refund please'),
      billingDisputeThresholdUsd: 200,
    });
    assert.equal(r, null);
  });

  it('distress beats every other trigger (priority order)', () => {
    const r = classifyEscalation({
      message: msg('I want to die and also my lawyer wants to sue you for $9999'),
      billingDisputeThresholdUsd: 200,
    });
    assert.equal(r?.trigger, 'mental-health-distress');
  });

  it('explicit human ask escalates', () => {
    const r = classifyEscalation({
      message: msg('can I talk to a real person'),
      billingDisputeThresholdUsd: 200,
    });
    assert.equal(r?.trigger, 'explicit-human-request');
  });

  it('data-deletion escalates', () => {
    const r = classifyEscalation({
      message: msg('please delete my account'),
      billingDisputeThresholdUsd: 200,
    });
    assert.equal(r?.trigger, 'data-deletion-request');
  });
});
