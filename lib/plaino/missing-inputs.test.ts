/**
 * lib/plaino/missing-inputs.test.ts
 *
 * The no-jargon snapshot for the refusal seam, mirroring
 * `tests/plaino-degraded-copy.test.ts`. A refusal is the moment a customer
 * is MOST likely to be told something machine-shaped ("missing required
 * context: workspace_id"), so the banned-word list is pinned here too, and
 * over every arity of the label join — a two-gap notice and a four-gap
 * notice are different strings.
 *
 * Also pins the audience split: the end-client's portal notice must NOT
 * name the gaps (they can't fix them and it isn't their business), while
 * the business owner's support notice MUST.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildMissingInputsReport,
  missingInputKeys,
  MISSING_INPUTS_CUSTOMER_STRINGS,
  MISSING_CAPABILITY_SNAPSHOT,
  MISSING_CASE_STATUS,
  MISSING_CASE_TITLE,
  MISSING_CUSTOMER_CONTEXT,
  MISSING_DRAFT_PREFERENCES,
  MISSING_KNOWLEDGE,
  MISSING_SCHEDULE,
  MISSING_THREAD_SUMMARY,
  MISSING_WORKSPACE,
} from './missing-inputs';

// Same list tests/plaino-degraded-copy.test.ts pins. Substring match, so
// "line" also catches "offline"/"deadline" — that strictness is the point.
const BANNED = [
  'line',
  'reaching',
  'endpoint',
  'api',
  'stack',
  'http',
  '500',
  'request',
  'fetch',
  'server',
  'token',
  'anthropic',
];

function assertNoJargon(text: string) {
  const lower = text.toLowerCase();
  for (const term of BANNED) {
    assert.ok(
      !lower.includes(term),
      `refusal copy leaked dev jargon "${term}": ${text}`,
    );
  }
}

describe('missing-inputs copy — no dev jargon', () => {
  for (const text of MISSING_INPUTS_CUSTOMER_STRINGS) {
    it(`contains no engineering-internal phrasing: "${text.slice(0, 40)}…"`, () => {
      assertNoJargon(text);
    });

    it(`stays in voice (no exclamation, no emoji): "${text.slice(0, 40)}…"`, () => {
      assert.ok(!text.includes('!'), `refusal copy raised its voice: ${text}`);
      assert.ok(
        !/\p{Extended_Pictographic}/u.test(text),
        `refusal copy used an emoji: ${text}`,
      );
    });
  }

  it('covers all three surfaces', () => {
    for (const surface of ['PORTAL_CHAT', 'SUPPORT_CHAT', 'REPLY_DRAFT'] as const) {
      const report = buildMissingInputsReport(surface, [MISSING_WORKSPACE]);
      assert.equal(report.kind, 'MISSING_INPUTS');
      assert.equal(report.surface, surface);
      assertNoJargon(report.customerNotice);
    }
  });
});

describe('missing-inputs report shape', () => {
  it('names every key in the operator note', () => {
    const report = buildMissingInputsReport('REPLY_DRAFT', [
      MISSING_CUSTOMER_CONTEXT,
      MISSING_DRAFT_PREFERENCES,
      MISSING_THREAD_SUMMARY,
      MISSING_SCHEDULE,
    ]);
    assert.deepEqual(missingInputKeys(report), [
      'customer_context',
      'preferences',
      'thread_summary',
      'schedule',
    ]);
    for (const key of missingInputKeys(report)) {
      assert.ok(
        report.operatorNote.includes(key),
        `operator note omitted key "${key}": ${report.operatorNote}`,
      );
    }
  });

  it('refuses to build an empty refusal', () => {
    assert.throws(() => buildMissingInputsReport('SUPPORT_CHAT', []), TypeError);
  });
});

describe('missing-inputs audience split', () => {
  it('the end-client is never shown the gap list', () => {
    const report = buildMissingInputsReport(
      'PORTAL_CHAT',
      [MISSING_CASE_TITLE, MISSING_CASE_STATUS],
      { brandName: 'Peachtree Realty' },
    );
    // Their message landed and a person is coming — same posture as the
    // DRAFT_FAILED path, which is the whole point.
    assert.match(report.customerNotice, /Peachtree Realty/);
    assert.match(report.customerNotice, /follow up/i);
    for (const gap of report.missing) {
      assert.ok(
        !report.customerNotice.includes(gap.label),
        `end-client notice leaked the internal gap "${gap.key}"`,
      );
    }
    // The owner-side caller still gets the structured list.
    assert.deepEqual(missingInputKeys(report), ['case_title', 'case_status']);
  });

  it('falls back to a brand-neutral portal notice when no brand is known', () => {
    const report = buildMissingInputsReport('PORTAL_CHAT', [MISSING_CASE_TITLE]);
    assert.match(report.customerNotice, /the team/);
    assert.ok(!report.customerNotice.includes('undefined'));
  });

  it('the business owner IS shown what Plaino can’t see', () => {
    const report = buildMissingInputsReport('SUPPORT_CHAT', [
      MISSING_CAPABILITY_SNAPSHOT,
      MISSING_KNOWLEDGE,
    ]);
    assert.ok(report.customerNotice.includes(MISSING_CAPABILITY_SNAPSHOT.label));
    assert.ok(report.customerNotice.includes(MISSING_KNOWLEDGE.label));
    // Lead-capture hand-off, same as PLAINO_TRANSIENT_REPLY.
    assert.match(report.customerNotice, /email/i);
  });

  it('the held-draft notice names the gap and the way forward', () => {
    const report = buildMissingInputsReport('REPLY_DRAFT', [
      MISSING_CUSTOMER_CONTEXT,
      MISSING_DRAFT_PREFERENCES,
    ]);
    assert.ok(report.customerNotice.includes(MISSING_CUSTOMER_CONTEXT.label));
    assert.ok(report.customerNotice.includes(MISSING_DRAFT_PREFERENCES.label));
    assert.match(report.customerNotice, /held/i);
    assert.match(report.customerNotice, /yourself/i);
  });
});
