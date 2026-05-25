/**
 * lib/skills/home-services-estimate-followup/skill.test.ts
 *
 * Pins the deterministic estimate-followup behavior:
 *   - one draft per estimate, scoped to its cadence stage
 *   - fresh estimates don't get a draft
 *   - cold estimates roll up into a single rep handoff (no email)
 *   - never quotes a price — defers via the {{operator: quote/time estimate}}
 *     merge field
 *   - confidence falls as the cadence advances (last-call tightest)
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { runSkill } from './skill';
import { JsonEstimateLookup } from './json-fetcher';
import { RecordingDraftPersister } from '../draft';
import type { EstimateRecord } from './types';

const WORKSPACE_ID = 'ws-home-services-0001';
const NOW = new Date('2026-05-24T15:00:00Z');

function estimate(overrides: Partial<EstimateRecord> = {}): EstimateRecord {
  return {
    estimateId: 'est-2026-0341',
    homeowner: {
      name: 'Jamie Carter',
      email: 'jamie@homeowner.example',
      phone: '+1-770-555-0101',
    },
    serviceAddress: '317 Cedar Knoll Dr, Marietta GA',
    trade: 'roofing',
    sentAt: new Date('2026-05-21T15:00:00Z'),
    insuranceClaim: false,
    homeownerAcknowledged: false,
    rep: {
      name: 'Sam Cooper',
      email: 'sam@shop.example',
      phone: null,
    },
    ...overrides,
  };
}

function lookup(estimates: EstimateRecord[]): JsonEstimateLookup {
  return new JsonEstimateLookup({ workspaceId: WORKSPACE_ID, estimates });
}

describe('home-services-estimate-followup — stage classification', () => {
  it('classifies fresh / soft-nudge / check-in / last-call / cold', async () => {
    const res = await runSkill({
      workspaceId: WORKSPACE_ID,
      lookup: lookup([
        estimate({ estimateId: 'est-fresh', sentAt: new Date('2026-05-24T01:00:00Z') }),
        estimate({ estimateId: 'est-soft', sentAt: new Date('2026-05-21T15:00:00Z') }),
        estimate({ estimateId: 'est-checkin', sentAt: new Date('2026-05-17T15:00:00Z') }),
        estimate({ estimateId: 'est-lastcall', sentAt: new Date('2026-05-12T15:00:00Z') }),
        estimate({ estimateId: 'est-cold', sentAt: new Date('2026-04-25T15:00:00Z') }),
      ]),
      now: NOW,
    });
    assert.equal(res.ok, true);
    if (!res.ok) return;
    assert.deepEqual(res.value.stageCounts, {
      fresh: 1,
      'soft-nudge': 1,
      'check-in': 1,
      'last-call': 1,
      cold: 1,
    });
  });

  it('no draft for fresh estimates (under 2 days)', async () => {
    const res = await runSkill({
      workspaceId: WORKSPACE_ID,
      lookup: lookup([estimate({ sentAt: new Date('2026-05-24T01:00:00Z') })]),
      now: NOW,
    });
    assert.equal(res.ok, true);
    if (!res.ok) return;
    assert.equal(res.value.drafts.length, 0);
  });
});

describe('home-services-estimate-followup — drafts per stage', () => {
  it('soft-nudge draft uses polite-not-pushy framing', async () => {
    const res = await runSkill({
      workspaceId: WORKSPACE_ID,
      lookup: lookup([estimate()]),
      now: NOW,
    });
    assert.equal(res.ok, true);
    if (!res.ok) return;
    assert.equal(res.value.drafts.length, 1);
    const d = res.value.drafts[0];
    assert.equal(d.stage, 'soft-nudge');
    assert.match(d.subject, /Quick check-in/);
    assert.match(d.body, /No urgency on our end/);
    assert.ok(d.confidence >= 0.7);
  });

  it('check-in draft surfaces a clarifying-question bullet list', async () => {
    const res = await runSkill({
      workspaceId: WORKSPACE_ID,
      lookup: lookup([estimate({ sentAt: new Date('2026-05-17T15:00:00Z') })]),
      now: NOW,
    });
    assert.equal(res.ok, true);
    if (!res.ok) return;
    const d = res.value.drafts[0];
    assert.equal(d.stage, 'check-in');
    assert.match(d.body, /A few quick things/);
    assert.match(d.body, /what's locked vs\. flexible/);
  });

  it('last-call draft closes the loop and lowers confidence', async () => {
    const res = await runSkill({
      workspaceId: WORKSPACE_ID,
      lookup: lookup([estimate({ sentAt: new Date('2026-05-12T15:00:00Z') })]),
      now: NOW,
    });
    assert.equal(res.ok, true);
    if (!res.ok) return;
    const d = res.value.drafts[0];
    assert.equal(d.stage, 'last-call');
    assert.match(d.subject, /Closing the loop/);
    assert.ok(d.confidence < 0.65, `last-call confidence ${d.confidence}`);
  });
});

describe('home-services-estimate-followup — never quotes a price', () => {
  it('always defers price + schedule to operator merge field', async () => {
    const res = await runSkill({
      workspaceId: WORKSPACE_ID,
      lookup: lookup([
        estimate({ sentAt: new Date('2026-05-17T15:00:00Z') }),
        estimate({
          estimateId: 'est-lastcall',
          sentAt: new Date('2026-05-12T15:00:00Z'),
        }),
      ]),
      now: NOW,
    });
    assert.equal(res.ok, true);
    if (!res.ok) return;
    for (const d of res.value.drafts) {
      assert.match(d.body, /\{\{operator: quote\/time estimate\}\}/);
    }
  });
});

describe('home-services-estimate-followup — insurance-claim adjuster line', () => {
  it('adds the adjuster-coordination offer only on insurance-claim estimates', async () => {
    const res = await runSkill({
      workspaceId: WORKSPACE_ID,
      lookup: lookup([
        estimate({ insuranceClaim: true, sentAt: new Date('2026-05-17T15:00:00Z') }),
      ]),
      now: NOW,
    });
    assert.equal(res.ok, true);
    if (!res.ok) return;
    assert.match(res.value.drafts[0].body, /happy to coordinate directly with the adjuster/);
  });
});

describe('home-services-estimate-followup — cold-handoff to rep', () => {
  it('rolls cold estimates into a single rep handoff (no email)', async () => {
    const res = await runSkill({
      workspaceId: WORKSPACE_ID,
      lookup: lookup([
        estimate({ estimateId: 'est-c1', sentAt: new Date('2026-04-20T15:00:00Z') }),
        estimate({ estimateId: 'est-c2', sentAt: new Date('2026-04-15T15:00:00Z') }),
      ]),
      now: NOW,
    });
    assert.equal(res.ok, true);
    if (!res.ok) return;
    assert.equal(res.value.coldHandoff.needed, true);
    assert.equal(res.value.coldHandoff.coldEstimateIds.length, 2);
    // No drafts for cold estimates.
    assert.equal(res.value.drafts.length, 0);
    assert.match(res.value.coldHandoff.message, /past the email-cadence window/);
  });
});

describe('home-services-estimate-followup — persistence', () => {
  it('persists each soft-nudge / check-in draft above threshold', async () => {
    const persister = new RecordingDraftPersister();
    const res = await runSkill({
      workspaceId: WORKSPACE_ID,
      lookup: lookup([
        estimate({ estimateId: 'est-1', sentAt: new Date('2026-05-21T15:00:00Z') }),
        estimate({ estimateId: 'est-2', sentAt: new Date('2026-05-17T15:00:00Z') }),
      ]),
      now: NOW,
      persister,
    });
    assert.equal(res.ok, true);
    if (!res.ok) return;
    assert.equal(persister.calls.length, 2);
    assert.ok(res.value.drafts.every((d) => d.persisted));
  });

  it('suppresses persistence on last-call drafts (low confidence)', async () => {
    const persister = new RecordingDraftPersister();
    const res = await runSkill({
      workspaceId: WORKSPACE_ID,
      lookup: lookup([estimate({ sentAt: new Date('2026-05-12T15:00:00Z') })]),
      now: NOW,
      persister,
      persistThreshold: 0.65,
    });
    assert.equal(res.ok, true);
    if (!res.ok) return;
    assert.equal(persister.calls.length, 0);
    assert.equal(res.value.drafts[0].persisted, false);
  });
});

describe('home-services-estimate-followup — workspace mismatch', () => {
  it('returns INVALID_INPUT when the seed is for a different workspace', async () => {
    const res = await runSkill({
      workspaceId: 'ws-other',
      lookup: lookup([estimate()]),
      now: NOW,
    });
    assert.equal(res.ok, false);
    if (res.ok) return;
    assert.equal(res.error.reference, 'INVALID_INPUT');
  });
});
