/**
 * Tests for the per-vertical outcome mapper. Pure + DB-free.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { WorkApprovalKind } from '@prisma/client';
import { buildVerticalOutcomes, type KindAggregate } from './vertical-outcomes';

function agg(
  entries: Array<[WorkApprovalKind, number, number?]>,
): Map<WorkApprovalKind, KindAggregate> {
  const m = new Map<WorkApprovalKind, KindAggregate>();
  for (const [kind, drafted, dollars] of entries) {
    m.set(kind, { kind, drafted, realDollarsSum: dollars ?? 0 });
  }
  return m;
}

describe('buildVerticalOutcomes', () => {
  it('property management surfaces real rent dollars when the payload carried them', () => {
    const out = buildVerticalOutcomes(
      'PROPERTY_MANAGEMENT',
      agg([['FOLLOW_UP_NUDGE', 3, 4200]]),
    );
    assert.equal(out.length, 1);
    assert.match(out[0].label, /\$4,200 in outstanding rent chased/);
    assert.match(out[0].detail ?? '', /3 reminders/);
  });

  it('property management falls back to a count when no real dollars present', () => {
    const out = buildVerticalOutcomes(
      'PROPERTY_MANAGEMENT',
      agg([['FOLLOW_UP_NUDGE', 1, 0]]),
    );
    assert.equal(out.length, 1);
    assert.match(out[0].label, /1 rent reminder drafted/);
  });

  it('real estate maps lead triage + buyer inquiries to trade language', () => {
    const out = buildVerticalOutcomes(
      'REAL_ESTATE',
      agg([
        ['LEAD_TRIAGE', 5],
        ['BUYER_INQUIRY_REPLY_DRAFT', 2],
      ]),
    );
    const labels = out.map((o) => o.label).join(' | ');
    assert.match(labels, /5 new leads triaged/);
    assert.match(labels, /2 buyer inquiries answered/);
  });

  it('cpa maps receivables + finance pulse', () => {
    const out = buildVerticalOutcomes(
      'CPA',
      agg([
        ['FOLLOW_UP_NUDGE', 4, 9800],
        ['FINANCE_PULSE', 1],
      ]),
    );
    const labels = out.map((o) => o.label).join(' | ');
    assert.match(labels, /\$9,800 in receivables chased/);
    assert.match(labels, /1 finance pulse prepared/);
  });

  it('generic pass covers kinds the vertical builder did not claim', () => {
    // CPA does not own INBOX_TRIAGE → the generic phrase should appear.
    const out = buildVerticalOutcomes(
      'CPA',
      agg([
        ['FOLLOW_UP_NUDGE', 1, 100],
        ['INBOX_TRIAGE', 7],
      ]),
    );
    const labels = out.map((o) => o.label).join(' | ');
    assert.match(labels, /7 inbox messages triaged/);
  });

  it('does NOT double-count a kind the vertical builder owns', () => {
    // PROPERTY_MANAGEMENT owns FOLLOW_UP_NUDGE → it must not also appear via
    // a generic phrase (there is none for it, but the guard is the point).
    const out = buildVerticalOutcomes(
      'PROPERTY_MANAGEMENT',
      agg([['FOLLOW_UP_NUDGE', 2, 500]]),
    );
    assert.equal(out.length, 1);
  });

  it('returns nothing for a quiet week', () => {
    assert.deepEqual(buildVerticalOutcomes('REAL_ESTATE', new Map()), []);
  });

  it('a vertical with no specific builder still gets generic outcomes', () => {
    const out = buildVerticalOutcomes(
      'RECRUITING',
      agg([['INBOX_TRIAGE', 3]]),
    );
    assert.equal(out.length, 1);
    assert.match(out[0].label, /3 inbox messages triaged/);
  });
});
