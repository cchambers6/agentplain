/**
 * lib/skills/insurance-coi-request/skill.test.ts
 *
 * Pins the deterministic COI-request behavior: in-force lines fall
 * through to ready-to-issue, missing lines surface as coverage-gap,
 * expired terms downgrade to expired-coverage, waiver-of-subrogation
 * always routes to operator review, and the draft never quotes a
 * premium or binding date.
 *
 * Gates the catalog listing: no test pass, no SKILL_CATALOG entry.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { runSkill } from './skill';
import { JsonPolicyLookup } from './json-fetcher';
import { RecordingDraftPersister } from '../draft';
import type { CoiRequestRecord, PolicyOnFile } from './types';

const WORKSPACE_ID = 'ws-insurance-0001';
const NOW = new Date('2026-05-24T15:00:00Z');

function request(overrides: Partial<CoiRequestRecord> = {}): CoiRequestRecord {
  return {
    requestId: 'coi-2026-0142',
    requester: {
      organizationName: 'Acme Construction GC',
      contact: { name: 'Lee Sample', email: 'lee@acme-gc.example' },
      projectReference: '2510 Peachtree St remodel',
    },
    insured: {
      displayName: 'Beacon Roofing & Restoration',
      legalName: 'Beacon Roofing & Restoration LLC',
      contact: { name: 'Sam Beacon', email: 'sam@beacon-roof.example' },
    },
    requestedLines: ['general-liability', 'workers-comp'],
    additionalInsured: true,
    waiverOfSubrogation: false,
    hasDeadline: false,
    responsibleCsr: { name: 'Jordan Hill', email: 'jordan@agency.example' },
    rawRequestBody:
      'Please send a COI for Beacon Roofing showing GL and WC for the 2510 ' +
      'Peachtree St remodel. Add Acme Construction GC as additional insured.',
    ...overrides,
  };
}

function lookup(policies: PolicyOnFile[]): JsonPolicyLookup {
  return new JsonPolicyLookup({
    workspaceId: WORKSPACE_ID,
    policiesByInsured: {
      'Beacon Roofing & Restoration LLC': policies,
    },
  });
}

function policy(overrides: Partial<PolicyOnFile> = {}): PolicyOnFile {
  return {
    policyNumber: 'GL-7788-2026',
    carrierName: 'Travelers',
    line: 'general-liability',
    expirationDate: '2026-12-01',
    inForce: true,
    ...overrides,
  };
}

describe('insurance-coi-request — ready-to-issue path', () => {
  it('returns ready-to-issue when every requested line is in force', async () => {
    const res = await runSkill({
      workspaceId: WORKSPACE_ID,
      request: request(),
      lookup: lookup([
        policy({ policyNumber: 'GL-7788-2026', line: 'general-liability' }),
        policy({
          policyNumber: 'WC-1122-2026',
          line: 'workers-comp',
          carrierName: 'Liberty Mutual',
        }),
      ]),
      now: NOW,
    });
    assert.equal(res.ok, true);
    if (!res.ok) return;
    assert.equal(res.value.status, 'ready-to-issue');
    assert.equal(res.value.issuance.certificateHolder, 'Acme Construction GC');
    assert.equal(res.value.issuance.additionalInsured, true);
    assert.equal(res.value.issuance.coverageDecisions.length, 2);
    assert.ok(res.value.issuance.coverageDecisions.every((d) => d.match === 'in-force'));
    assert.match(res.value.requesterReply.subject, /received, in progress/);
    // never confirms a binding date in the draft body
    assert.match(res.value.requesterReply.body, /\{\{operator: bind\/effective date\}\}/);
    assert.equal(res.value.requesterReply.tone, 'formal');
  });
});

describe('insurance-coi-request — coverage gap path', () => {
  it('flags coverage-gap when a requested line has no policy on file', async () => {
    const res = await runSkill({
      workspaceId: WORKSPACE_ID,
      request: request({
        requestedLines: ['general-liability', 'workers-comp', 'auto-liability'],
      }),
      lookup: lookup([
        policy({ policyNumber: 'GL-7788-2026', line: 'general-liability' }),
        policy({
          policyNumber: 'WC-1122-2026',
          line: 'workers-comp',
          carrierName: 'Liberty Mutual',
        }),
      ]),
      now: NOW,
    });
    assert.equal(res.ok, true);
    if (!res.ok) return;
    assert.equal(res.value.status, 'coverage-gap');
    const auto = res.value.issuance.coverageDecisions.find((d) => d.line === 'auto-liability');
    assert.ok(auto);
    assert.equal(auto!.match, 'not-on-file');
    assert.equal(auto!.policy, null);
    assert.match(res.value.requesterReply.body, /Commercial Auto Liability/);
    assert.match(res.value.requesterReply.body, /subject to underwriting/);
  });
});

describe('insurance-coi-request — expired coverage path', () => {
  it('downgrades to expired-coverage when the on-file policy has a lapsed term', async () => {
    const res = await runSkill({
      workspaceId: WORKSPACE_ID,
      request: request({ requestedLines: ['general-liability'] }),
      lookup: lookup([
        policy({
          policyNumber: 'GL-LAPSED-2025',
          line: 'general-liability',
          expirationDate: '2025-12-01',
          inForce: false,
        }),
      ]),
      now: NOW,
    });
    assert.equal(res.ok, true);
    if (!res.ok) return;
    assert.equal(res.value.status, 'expired-coverage');
    assert.match(res.value.requesterReply.subject, /renewal pending/);
    assert.match(res.value.requesterReply.body, /lapsed term/);
  });
});

describe('insurance-coi-request — waiver of subrogation routing', () => {
  it('routes to needs-operator-review when waiver of subrogation is requested', async () => {
    const res = await runSkill({
      workspaceId: WORKSPACE_ID,
      request: request({ waiverOfSubrogation: true }),
      lookup: lookup([
        policy({ line: 'general-liability' }),
        policy({ line: 'workers-comp', policyNumber: 'WC-1122-2026' }),
      ]),
      now: NOW,
    });
    assert.equal(res.ok, true);
    if (!res.ok) return;
    assert.equal(res.value.status, 'needs-operator-review');
    assert.match(res.value.requesterReply.body, /\{\{operator: confirm endorsement availability/);
    assert.equal(res.value.issuance.waiverOfSubrogation, true);
  });
});

describe('insurance-coi-request — never quotes a premium', () => {
  it('always surfaces premium and bind-date as operator merge fields', async () => {
    const res = await runSkill({
      workspaceId: WORKSPACE_ID,
      request: request(),
      lookup: lookup([
        policy({ line: 'general-liability' }),
        policy({ line: 'workers-comp', policyNumber: 'WC-1122-2026' }),
      ]),
      now: NOW,
    });
    assert.equal(res.ok, true);
    if (!res.ok) return;
    assert.match(res.value.requesterReply.body, /\{\{operator: premium\}\}/);
    assert.match(res.value.requesterReply.body, /\{\{operator: bind\/effective date\}\}/);
    // never the word "guarantee" anywhere in the body
    assert.doesNotMatch(res.value.requesterReply.body, /guarantee/i);
  });
});

describe('insurance-coi-request — persistence', () => {
  it('persists the ready-to-issue acknowledgement above threshold', async () => {
    const persister = new RecordingDraftPersister();
    const res = await runSkill({
      workspaceId: WORKSPACE_ID,
      request: request(),
      lookup: lookup([
        policy({ line: 'general-liability' }),
        policy({ line: 'workers-comp', policyNumber: 'WC-1122-2026' }),
      ]),
      now: NOW,
      persister,
    });
    assert.equal(res.ok, true);
    if (!res.ok) return;
    assert.equal(persister.calls.length, 1);
    assert.equal(res.value.requesterReply.persisted, true);
    assert.ok(res.value.requesterReply.providerDraftId);
  });

  it('suppresses persistence on needs-operator-review (low confidence)', async () => {
    const persister = new RecordingDraftPersister();
    const res = await runSkill({
      workspaceId: WORKSPACE_ID,
      request: request({ waiverOfSubrogation: true }),
      lookup: lookup([policy({ line: 'general-liability' }), policy({ line: 'workers-comp', policyNumber: 'WC-1122-2026' })]),
      now: NOW,
      persister,
      persistThreshold: 0.5,
    });
    assert.equal(res.ok, true);
    if (!res.ok) return;
    assert.equal(persister.calls.length, 0);
    assert.equal(res.value.requesterReply.persisted, false);
  });
});

describe('insurance-coi-request — workspace mismatch', () => {
  it('returns INVALID_INPUT when the lookup is seeded for a different workspace', async () => {
    const res = await runSkill({
      workspaceId: 'ws-other',
      request: request(),
      lookup: lookup([policy()]),
      now: NOW,
    });
    assert.equal(res.ok, false);
    if (res.ok) return;
    assert.equal(res.error.reference, 'INVALID_INPUT');
  });
});
