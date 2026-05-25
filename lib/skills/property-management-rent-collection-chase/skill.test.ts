/**
 * lib/skills/property-management-rent-collection-chase/skill.test.ts
 *
 * Pins the deterministic rent-collection-chase behavior:
 *   - one draft per delinquent unit, scoped to bucket
 *   - grace units never get a draft
 *   - never quotes a dollar amount in body
 *   - escalation units always queue for PM review (low confidence)
 *   - payment-plan-in-place softens soft-chase tone
 *   - maintenance ETAs always defer
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { runSkill } from './skill';
import { JsonRentRollLookup } from './json-fetcher';
import { RecordingDraftPersister } from '../draft';
import type { UnitDelinquency } from './types';

const WORKSPACE_ID = 'ws-pm-0001';
const NOW = new Date('2026-05-24T15:00:00Z');

function unit(overrides: Partial<UnitDelinquency> = {}): UnitDelinquency {
  return {
    leaseId: 'lease-2026-0211',
    unitLabel: '1234 Oak St #4B',
    primaryTenant: { name: 'Riley Park', email: 'riley@tenant.example', phone: null },
    coTenants: [],
    daysPastDue: 5,
    paymentPlanInPlace: false,
    tenantAcknowledged: false,
    lastChaseAt: null,
    propertyManager: { name: 'Jordan Tate', email: 'jordan@pm.example', phone: null },
    formalNoticeRequiresOwnerApproval: true,
    ...overrides,
  };
}

function lookup(units: UnitDelinquency[]): JsonRentRollLookup {
  return new JsonRentRollLookup({ workspaceId: WORKSPACE_ID, delinquentUnits: units });
}

describe('property-management-rent-collection-chase — bucketing', () => {
  it('classifies grace / soft-chase / formal-notice / escalation by daysPastDue', async () => {
    const res = await runSkill({
      workspaceId: WORKSPACE_ID,
      lookup: lookup([
        unit({ leaseId: 'l-grace', daysPastDue: 1 }),
        unit({ leaseId: 'l-soft', daysPastDue: 5 }),
        unit({ leaseId: 'l-formal', daysPastDue: 9 }),
        unit({ leaseId: 'l-esc', daysPastDue: 18 }),
      ]),
      now: NOW,
    });
    assert.equal(res.ok, true);
    if (!res.ok) return;
    assert.deepEqual(res.value.bucketCounts, {
      grace: 1,
      'soft-chase': 1,
      'formal-notice': 1,
      escalation: 1,
    });
  });

  it('does NOT draft for grace units', async () => {
    const res = await runSkill({
      workspaceId: WORKSPACE_ID,
      lookup: lookup([unit({ daysPastDue: 1 })]),
      now: NOW,
    });
    assert.equal(res.ok, true);
    if (!res.ok) return;
    assert.equal(res.value.drafts.length, 0);
  });
});

describe('property-management-rent-collection-chase — soft-chase', () => {
  it('uses the friendly cold-chase tone when no payment plan is in place', async () => {
    const res = await runSkill({
      workspaceId: WORKSPACE_ID,
      lookup: lookup([unit({ daysPastDue: 5 })]),
      now: NOW,
    });
    assert.equal(res.ok, true);
    if (!res.ok) return;
    const d = res.value.drafts[0];
    assert.equal(d.bucket, 'soft-chase');
    assert.match(d.body, /friendly heads up/);
    assert.match(d.body, /\{\{operator: amount due\}\}/);
  });

  it('softens tone when a payment plan is already in place', async () => {
    const res = await runSkill({
      workspaceId: WORKSPACE_ID,
      lookup: lookup([unit({ daysPastDue: 5, paymentPlanInPlace: true })]),
      now: NOW,
    });
    assert.equal(res.ok, true);
    if (!res.ok) return;
    assert.match(res.value.drafts[0].body, /payment plan in place/);
    assert.ok(res.value.drafts[0].confidence >= 0.75);
  });
});

describe('property-management-rent-collection-chase — formal-notice', () => {
  it('warns about formal-notice path without committing legal language', async () => {
    const res = await runSkill({
      workspaceId: WORKSPACE_ID,
      lookup: lookup([unit({ daysPastDue: 9 })]),
      now: NOW,
    });
    assert.equal(res.ok, true);
    if (!res.ok) return;
    const d = res.value.drafts[0];
    assert.equal(d.bucket, 'formal-notice');
    assert.match(d.body, /next step on our side becomes a formal notice/);
    // defers maintenance ETA
    assert.match(d.body, /\{\{operator: maintenance ETA\}\}/);
  });
});

describe('property-management-rent-collection-chase — escalation', () => {
  it('routes escalation drafts with low confidence + owner-review queue', async () => {
    const res = await runSkill({
      workspaceId: WORKSPACE_ID,
      lookup: lookup([unit({ daysPastDue: 18 })]),
      now: NOW,
    });
    assert.equal(res.ok, true);
    if (!res.ok) return;
    const d = res.value.drafts[0];
    assert.equal(d.bucket, 'escalation');
    assert.ok(d.confidence < 0.5, `escalation confidence ${d.confidence}`);
    assert.match(d.body, /\{\{operator: formal-notice attachment/);
    assert.equal(res.value.ownerReview.length, 1);
    assert.match(res.value.ownerReview[0].note, /owner approval required/);
  });
});

describe('property-management-rent-collection-chase — co-tenant CC', () => {
  it('CCs co-tenants on the chase draft', async () => {
    const res = await runSkill({
      workspaceId: WORKSPACE_ID,
      lookup: lookup([
        unit({
          coTenants: [
            { name: 'Alex Park', email: 'alex@tenant.example', phone: null },
          ],
        }),
      ]),
      now: NOW,
    });
    assert.equal(res.ok, true);
    if (!res.ok) return;
    assert.equal(res.value.drafts[0].ccEmails.length, 1);
    assert.equal(res.value.drafts[0].ccEmails[0], 'alex@tenant.example');
  });
});

describe('property-management-rent-collection-chase — persistence', () => {
  it('persists soft-chase drafts above threshold', async () => {
    const persister = new RecordingDraftPersister();
    const res = await runSkill({
      workspaceId: WORKSPACE_ID,
      lookup: lookup([unit({ daysPastDue: 5 })]),
      now: NOW,
      persister,
    });
    assert.equal(res.ok, true);
    if (!res.ok) return;
    assert.equal(persister.calls.length, 1);
    assert.equal(res.value.drafts[0].persisted, true);
  });

  it('suppresses persistence on escalation drafts (PM must re-read)', async () => {
    const persister = new RecordingDraftPersister();
    const res = await runSkill({
      workspaceId: WORKSPACE_ID,
      lookup: lookup([unit({ daysPastDue: 18 })]),
      now: NOW,
      persister,
    });
    assert.equal(res.ok, true);
    if (!res.ok) return;
    assert.equal(persister.calls.length, 0);
    assert.equal(res.value.drafts[0].persisted, false);
  });
});

describe('property-management-rent-collection-chase — workspace mismatch', () => {
  it('returns INVALID_INPUT when the seed is for a different workspace', async () => {
    const res = await runSkill({
      workspaceId: 'ws-other',
      lookup: lookup([unit()]),
      now: NOW,
    });
    assert.equal(res.ok, false);
    if (res.ok) return;
    assert.equal(res.error.reference, 'INVALID_INPUT');
  });
});
