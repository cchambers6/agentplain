/**
 * Behavior tests for the first-5-min demo substrate + deterministic activation
 * draft builder. These are the customer-facing content paths: if a vertical's
 * dataset or draft template regresses, the magic moment breaks. No DB, no LLM —
 * pure data + pure builders.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { Vertical } from '@prisma/client';

import {
  buildActivationDraft,
  demoDatasetFor,
  pickUrgentRecord,
  __testing,
  type DemoDataset,
} from './demo-data';

const ALL_VERTICALS: Vertical[] = [
  'REAL_ESTATE',
  'MORTGAGE',
  'INSURANCE',
  'PROPERTY_MANAGEMENT',
  'TITLE_ESCROW',
  'RECRUITING',
  'HOME_SERVICES',
  'CPA',
  'LAW',
  'RIA',
];

function datasetsToCheck(): Array<{ label: string; dataset: DemoDataset }> {
  return [
    ...ALL_VERTICALS.map((v) => ({ label: v, dataset: demoDatasetFor(v) })),
    { label: 'general(null)', dataset: __testing.GENERAL_DATASET },
  ];
}

describe('demoDatasetFor', () => {
  it('returns a dataset for every vertical and falls back to general for null', () => {
    for (const v of ALL_VERTICALS) {
      const ds = demoDatasetFor(v);
      assert.ok(ds.records.length >= 2, `${v} should seed at least 2 records`);
    }
    assert.equal(demoDatasetFor(null), __testing.GENERAL_DATASET);
    assert.equal(demoDatasetFor(undefined), __testing.GENERAL_DATASET);
  });
});

describe('demo dataset invariants', () => {
  for (const { label, dataset } of datasetsToCheck()) {
    it(`${label}: has exactly one urgent record and positive savedMinutes`, () => {
      const urgentCount = dataset.records.filter((r) => r.urgent).length;
      assert.equal(urgentCount, 1, `${label} must have exactly one urgent record`);
      assert.ok(dataset.savedMinutes > 0, `${label} savedMinutes must be > 0`);
    });

    it(`${label}: every record uses a demo @example.com counterparty + unique demoId`, () => {
      const ids = new Set<string>();
      for (const r of dataset.records) {
        assert.match(
          r.party.email,
          /@example\.com$/,
          `${label}/${r.demoId} must use an @example.com placeholder, got ${r.party.email}`,
        );
        assert.ok(!ids.has(r.demoId), `${label} duplicate demoId ${r.demoId}`);
        ids.add(r.demoId);
        assert.ok(r.title.length > 0 && r.summary.length > 0);
      }
    });
  }
});

describe('pickUrgentRecord', () => {
  it('returns the flagged urgent record for each dataset', () => {
    for (const { label, dataset } of datasetsToCheck()) {
      const urgent = pickUrgentRecord(dataset);
      assert.ok(urgent, `${label} should resolve an urgent record`);
      assert.equal(urgent!.urgent, true);
    }
  });

  it('falls back to the first record when none is urgent', () => {
    const ds: DemoDataset = {
      vertical: null,
      savedMinutes: 10,
      records: [
        {
          demoId: 'a',
          demoKind: 'invoice-chase',
          title: 'A',
          summary: 's',
          party: { name: 'A Co', email: 'a@example.com' },
          urgent: false,
          contextLines: [],
        },
      ],
    };
    assert.equal(pickUrgentRecord(ds)?.demoId, 'a');
  });
});

describe('buildActivationDraft', () => {
  for (const { label, dataset } of datasetsToCheck()) {
    it(`${label}: builds a non-empty, send-ready draft for the urgent record`, () => {
      const record = pickUrgentRecord(dataset)!;
      const draft = buildActivationDraft({
        vertical: dataset.vertical,
        record,
        businessName: 'Pope & Co',
        savedMinutes: dataset.savedMinutes,
      });
      assert.ok(draft.subject.trim().length > 0, `${label} subject empty`);
      assert.ok(draft.body.trim().length > 40, `${label} body too short`);
      // The owner's business signs the draft (their inbox sends it).
      assert.match(draft.body, /Pope & Co/, `${label} body must sign with the business`);
      // Plaino's plain register — never the banned framings.
      assert.doesNotMatch(draft.body, /\bSMB\b/i, `${label} body must not say "SMB"`);
      assert.doesNotMatch(
        draft.subject + draft.body,
        /Initializing|AI agent/i,
        `${label} must not use SaaS-demo language`,
      );
      assert.equal(draft.savedMinutes, dataset.savedMinutes);
      assert.ok(draft.promiseHeadline.length > 0, `${label} missing promise headline`);
      assert.equal(draft.party.email, record.party.email);
    });
  }

  it('addresses a person by first name and an org by its whole name', () => {
    const re = demoDatasetFor('REAL_ESTATE');
    const lead = re.records.find((r) => r.demoId === 'lead-marcus-pope')!;
    const personDraft = buildActivationDraft({
      vertical: 'REAL_ESTATE',
      record: lead,
      businessName: 'Acme Realty',
      savedMinutes: re.savedMinutes,
    });
    assert.match(personDraft.body, /Hi Marcus,/);

    const hs = demoDatasetFor('HOME_SERVICES');
    const org = hs.records.find((r) => r.demoId === 'estimate-greenwood-hoa');
    if (org) {
      const orgDraft = buildActivationDraft({
        vertical: 'HOME_SERVICES',
        record: org,
        businessName: 'Acme Roofing',
        savedMinutes: hs.savedMinutes,
      });
      assert.match(orgDraft.body, /Greenwood HOA/);
    }
  });

  it('missing-receipts list keeps a parenthesised amount intact (no comma split)', () => {
    const cpa = demoDatasetFor('CPA');
    const urgent = pickUrgentRecord(cpa)!;
    const draft = buildActivationDraft({
      vertical: 'CPA',
      record: urgent,
      businessName: 'Lane CPAs',
      savedMinutes: cpa.savedMinutes,
    });
    // The "($1,840)" amount must survive as one bullet, not split on its comma.
    assert.match(draft.body, /\$1,840\)/);
    assert.doesNotMatch(draft.body, /•\s*840\)/);
  });

  it('invoice-chase drafts reference the amount when present', () => {
    const general = __testing.GENERAL_DATASET;
    const urgent = pickUrgentRecord(general)!;
    const draft = buildActivationDraft({
      vertical: null,
      record: urgent,
      businessName: 'Westside Services',
      savedMinutes: general.savedMinutes,
    });
    assert.match(draft.body, /\$[\d,]+/, 'invoice chase should include the dollar amount');
  });
});
