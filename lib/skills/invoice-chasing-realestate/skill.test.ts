/**
 * lib/skills/invoice-chasing-realestate/skill.test.ts
 *
 * Pinning tests for the vertical-specific invoice-chasing skill. Covers
 * the bucketing rules (paid/extension/not-yet-due skip, warm/firm/escalate
 * tiers), the vertical-aware tone (real-estate-specific copy), and the
 * persistence guard (no Gmail draft write when no persister is given).
 *
 * Per `feedback_runner_portability.md`: the test wires `JsonInvoiceFetcher`
 * and `RecordingDraftPersister`. The skill code itself does not import a
 * vendor SDK.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { runSkill } from './skill';
import { JsonInvoiceFetcher } from './json-fetcher';
import { RecordingDraftPersister } from '../draft';
import type { ContactRecord, InvoiceRecord } from './types';

const WORKSPACE_ID = 'ws-realestate-test-0001';
const NOW = new Date('2026-05-15T15:00:00Z');

function inv(overrides: Partial<InvoiceRecord> = {}): InvoiceRecord {
  return {
    id: 'inv-1',
    invoiceNumber: 'INV-2026-04-001',
    contactId: 'c-1',
    closingReference: '4421 Magnolia Dr, Atlanta',
    amountCents: 1250000, // $12,500.00
    currency: 'USD',
    issuedAt: new Date('2026-04-15T00:00:00Z'),
    dueAt: new Date('2026-04-30T00:00:00Z'),
    status: 'open',
    lastActivityAt: null,
    negotiatedExtensionUntil: null,
    ...overrides,
  };
}

function contact(overrides: Partial<ContactRecord> = {}): ContactRecord {
  return {
    id: 'c-1',
    name: 'Sarah Mitchell',
    email: 'sarah.mitchell@example-title.com',
    kind: 'title-company',
    phone: null,
    ...overrides,
  };
}

describe('invoice-chasing-realestate — happy path bucketing', () => {
  it('buckets one invoice per tier and skips paid + future-due + extended', async () => {
    const invoices: InvoiceRecord[] = [
      inv({ id: 'warm-1', dueAt: new Date('2026-05-10T00:00:00Z') }), //   5 days
      inv({ id: 'firm-1', dueAt: new Date('2026-04-25T00:00:00Z') }), //  20 days
      inv({ id: 'escalate-1', dueAt: new Date('2026-03-10T00:00:00Z') }), // 66 days
      inv({ id: 'paid-1', status: 'paid' }),
      inv({ id: 'future-1', dueAt: new Date('2026-06-01T00:00:00Z') }),
      inv({
        id: 'extend-1',
        negotiatedExtensionUntil: new Date('2026-06-15T00:00:00Z'),
      }),
    ];
    const contacts: Record<string, ContactRecord> = { 'c-1': contact() };
    const fetcher = new JsonInvoiceFetcher({
      workspaceId: WORKSPACE_ID,
      invoices,
      contacts,
    });
    const res = await runSkill({ workspaceId: WORKSPACE_ID, fetcher, now: NOW });
    assert.equal(res.ok, true);
    if (!res.ok) return;
    assert.equal(res.value.processed, 6);
    assert.equal(res.value.followUps.length, 3);
    assert.deepEqual(res.value.bucketCounts, { warm: 1, firm: 1, escalate: 1 });

    const byId = Object.fromEntries(res.value.followUps.map((f) => [f.invoiceId, f]));
    assert.equal(byId['warm-1'].tier, 'warm');
    assert.equal(byId['firm-1'].tier, 'firm');
    assert.equal(byId['escalate-1'].tier, 'escalate');

    const skipReasons = new Set(res.value.skipped.map((s) => s.kind));
    assert.ok(skipReasons.has('paid'));
    assert.ok(skipReasons.has('not-yet-due'));
    assert.ok(skipReasons.has('negotiated-extension'));
  });
});

describe('invoice-chasing-realestate — vertical-aware draft body', () => {
  it('draft cites commission + closing reference, uses real-estate tone (not generic AR)', async () => {
    const invoices = [
      inv({
        id: 'inv-1',
        dueAt: new Date('2026-04-15T00:00:00Z'), // 30 days outstanding
        closingReference: '1247 Magnolia Dr — MLS 7128341',
      }),
    ];
    const contacts: Record<string, ContactRecord> = { 'c-1': contact() };
    const fetcher = new JsonInvoiceFetcher({
      workspaceId: WORKSPACE_ID,
      invoices,
      contacts,
    });
    const res = await runSkill({ workspaceId: WORKSPACE_ID, fetcher, now: NOW });
    assert.equal(res.ok, true);
    if (!res.ok) return;
    const f = res.value.followUps[0];
    assert.ok(f, 'expected a follow-up');
    assert.ok(
      f.draft.body.toLowerCase().includes('commission'),
      `expected real-estate language ("commission") in draft body; got: ${f.draft.body}`,
    );
    assert.ok(
      f.draft.body.includes('1247 Magnolia Dr — MLS 7128341'),
      'expected closing reference in draft body',
    );
    // Per project_no_outbound_architecture.md: drafts contain operator
    // merge fields for anything that requires broker judgment.
    assert.ok(
      f.draft.body.includes('{{operator: signature}}'),
      'expected operator signature merge field',
    );
    // Confidence is fixed-bucket; tone for firm tier is casual.
    assert.equal(f.draft.tone, 'casual');
  });

  it('escalate tier uses formal tone + adds escalation merge fields', async () => {
    const invoices = [
      inv({
        id: 'inv-late',
        dueAt: new Date('2026-03-01T00:00:00Z'), // 75 days outstanding
        closingReference: '88 Peachtree St — closing 2026-02-26',
      }),
    ];
    const contacts: Record<string, ContactRecord> = {
      'c-1': contact({ kind: 'attorney', name: 'Marcus Reed' }),
    };
    const fetcher = new JsonInvoiceFetcher({
      workspaceId: WORKSPACE_ID,
      invoices,
      contacts,
    });
    const res = await runSkill({ workspaceId: WORKSPACE_ID, fetcher, now: NOW });
    assert.equal(res.ok, true);
    if (!res.ok) return;
    const f = res.value.followUps[0];
    assert.equal(f.tier, 'escalate');
    assert.equal(f.draft.tone, 'formal');
    assert.ok(f.draft.body.startsWith('Dear Marcus Reed,'));
    assert.ok(f.draft.body.includes('{{operator: target reply date}}'));
    assert.ok(f.draft.body.includes('{{operator: next-step'));
    // Per project_no_outbound_architecture.md: low confidence on
    // escalate so the broker reviews before sending.
    assert.ok(
      f.draft.confidence < 0.7,
      `escalate confidence should be modest (broker reviews); got ${f.draft.confidence}`,
    );
  });
});

describe('invoice-chasing-realestate — persistence guard', () => {
  it('persister is called for above-threshold drafts; persisted draft has providerDraftId', async () => {
    const invoices = [inv({ dueAt: new Date('2026-05-01T00:00:00Z') })]; // 14 days — warm tier
    const contacts: Record<string, ContactRecord> = { 'c-1': contact() };
    const fetcher = new JsonInvoiceFetcher({
      workspaceId: WORKSPACE_ID,
      invoices,
      contacts,
    });
    const persister = new RecordingDraftPersister();
    const res = await runSkill({
      workspaceId: WORKSPACE_ID,
      fetcher,
      persister,
      now: NOW,
    });
    assert.equal(res.ok, true);
    if (!res.ok) return;
    assert.equal(res.value.followUps.length, 1);
    assert.equal(persister.calls.length, 1);
    assert.equal(persister.calls[0].workspaceId, WORKSPACE_ID);
    assert.equal(persister.calls[0].toEmails[0], 'sarah.mitchell@example-title.com');
    assert.equal(res.value.followUps[0].draft.persisted, true);
    assert.ok(res.value.followUps[0].draft.providerDraftId);
  });

  it('escalate-tier drafts (below 0.7 confidence + default 0.5 threshold) still persist; ' +
    'raising persistThreshold to 0.6 keeps them out of the drafts folder', async () => {
    const invoices = [
      inv({ id: 'inv-late', dueAt: new Date('2026-03-01T00:00:00Z') }),
    ];
    const contacts: Record<string, ContactRecord> = { 'c-1': contact() };
    const fetcher = new JsonInvoiceFetcher({
      workspaceId: WORKSPACE_ID,
      invoices,
      contacts,
    });
    const persister = new RecordingDraftPersister();
    const res = await runSkill({
      workspaceId: WORKSPACE_ID,
      fetcher,
      persister,
      persistThreshold: 0.6,
      now: NOW,
    });
    assert.equal(res.ok, true);
    if (!res.ok) return;
    assert.equal(persister.calls.length, 0, 'escalate draft should not persist above 0.6 threshold');
    assert.equal(res.value.followUps[0].draft.persisted, false);
  });
});

describe('invoice-chasing-realestate — edge cases', () => {
  it('empty input — processed=0, no follow-ups, no skips', async () => {
    const fetcher = new JsonInvoiceFetcher({
      workspaceId: WORKSPACE_ID,
      invoices: [],
      contacts: {},
    });
    const res = await runSkill({ workspaceId: WORKSPACE_ID, fetcher, now: NOW });
    assert.equal(res.ok, true);
    if (!res.ok) return;
    assert.equal(res.value.processed, 0);
    assert.equal(res.value.followUps.length, 0);
    assert.equal(res.value.skipped.length, 0);
    assert.deepEqual(res.value.bucketCounts, { warm: 0, firm: 0, escalate: 0 });
  });

  it('invoice with no matching contact record is recorded as skipped', async () => {
    const invoices = [inv({ id: 'orphan', contactId: 'c-missing' })];
    const fetcher = new JsonInvoiceFetcher({
      workspaceId: WORKSPACE_ID,
      invoices,
      contacts: {}, // no contact 'c-missing'
    });
    const res = await runSkill({ workspaceId: WORKSPACE_ID, fetcher, now: NOW });
    assert.equal(res.ok, true);
    if (!res.ok) return;
    assert.equal(res.value.followUps.length, 0);
    const miss = res.value.skipped.find((s) => s.kind === 'missing-contact');
    assert.ok(miss, 'expected missing-contact skip');
  });

  it('workspace id mismatch on the fetcher returns INVALID_INPUT', async () => {
    const fetcher = new JsonInvoiceFetcher({
      workspaceId: WORKSPACE_ID,
      invoices: [inv()],
      contacts: { 'c-1': contact() },
    });
    const res = await runSkill({
      workspaceId: 'ws-some-other-id',
      fetcher,
      now: NOW,
    });
    assert.equal(res.ok, false);
    if (res.ok) return;
    assert.equal(res.error.code, 'UPSTREAM_GMAIL_ERROR');
    assert.equal(res.error.reference, 'INVALID_INPUT');
  });
});
