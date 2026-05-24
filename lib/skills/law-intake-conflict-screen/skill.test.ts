/**
 * lib/skills/law-intake-conflict-screen/skill.test.ts
 *
 * Pins the deterministic conflict-screen behavior for law-firm intakes.
 * Gates the catalog listing: no test pass, no SKILL_CATALOG entry.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { runSkill } from './skill';
import { JsonLedgerFetcher } from './json-fetcher';
import { RecordingDraftPersister } from '../draft';
import type { LedgerEntry, ProspectiveIntake } from './types';

const WORKSPACE_ID = 'ws-law-0001';

function intake(overrides: Partial<ProspectiveIntake> = {}): ProspectiveIntake {
  return {
    matterId: 'matter-2026-0042',
    prospectName: 'Jane Roe',
    prospectEmail: 'jane.roe@example.com',
    opposingParties: ['Acme Industries LLC'],
    matterDescription: 'Wrongful termination claim against former employer.',
    responsibleAttorney: { name: 'Sarah Hill', email: 'sarah@firm.example' },
    ...overrides,
  };
}

function ledger(entries: LedgerEntry[]): JsonLedgerFetcher {
  return new JsonLedgerFetcher({ workspaceId: WORKSPACE_ID, ledger: entries });
}

describe('law-intake-conflict-screen — clear path', () => {
  it('returns status=clear with no conflicts when ledger has no overlap', async () => {
    const fetcher = ledger([
      { clientName: 'Beacon Foods Co.', status: 'active' },
      { clientName: 'Yonder Capital LLC', status: 'closed' },
    ]);
    const res = await runSkill({ workspaceId: WORKSPACE_ID, intake: intake(), fetcher });
    assert.equal(res.ok, true);
    if (!res.ok) return;
    assert.equal(res.value.status, 'clear');
    assert.equal(res.value.conflicts.length, 0);
    assert.match(res.value.attorneyNotice.subject, /Conflict screen — clear/);
    assert.match(res.value.attorneyNotice.body, /No prospect \/ opposing-party overlaps/);
    assert.equal(res.value.attorneyNotice.tone, 'formal');
  });
});

describe('law-intake-conflict-screen — adverse-party detection', () => {
  it('flags an ADVERSE conflict when an opposing party matches an active client', async () => {
    const fetcher = ledger([
      { clientName: 'Acme Industries LLC', status: 'active', matterLabel: 'Acme — IP licensing' },
    ]);
    const res = await runSkill({ workspaceId: WORKSPACE_ID, intake: intake(), fetcher });
    assert.equal(res.ok, true);
    if (!res.ok) return;
    assert.equal(res.value.status, 'needs-counsel-review');
    assert.equal(res.value.conflicts.length, 1);
    const c = res.value.conflicts[0];
    assert.equal(c.severity, 'adverse');
    assert.equal(c.matchedAgainst, 'opposing-party');
    assert.equal(c.opposingPartyText, 'Acme Industries LLC');
    assert.match(res.value.attorneyNotice.subject, /counsel review REQUIRED/);
    assert.match(res.value.attorneyNotice.body, /ADVERSE/);
    // Never states a legal conclusion.
    assert.match(res.value.attorneyNotice.body, /\{\{operator: legal conclusion\}\}/);
  });

  it('downgrades a closed-matter opposing-party hit to former-adverse', async () => {
    const fetcher = ledger([
      { clientName: 'Acme Industries Inc', status: 'closed' },
    ]);
    const res = await runSkill({ workspaceId: WORKSPACE_ID, intake: intake(), fetcher });
    assert.equal(res.ok, true);
    if (!res.ok) return;
    assert.equal(res.value.status, 'flagged');
    assert.equal(res.value.conflicts.length, 1);
    assert.equal(res.value.conflicts[0].severity, 'former-adverse');
  });
});

describe('law-intake-conflict-screen — direct-conflict detection', () => {
  it('flags DIRECT when the prospect IS an existing client', async () => {
    const fetcher = ledger([
      { clientName: 'Jane Roe', status: 'active' },
    ]);
    const res = await runSkill({ workspaceId: WORKSPACE_ID, intake: intake(), fetcher });
    assert.equal(res.ok, true);
    if (!res.ok) return;
    assert.equal(res.value.status, 'needs-counsel-review');
    assert.equal(res.value.conflicts[0].severity, 'direct');
    assert.equal(res.value.conflicts[0].matchedAgainst, 'prospect');
  });

  it('case-insensitive + entity-suffix-normalized matching (LLC / Inc / etc.)', async () => {
    const fetcher = ledger([
      { clientName: 'ACME INDUSTRIES, INC.', status: 'active' },
    ]);
    const res = await runSkill({
      workspaceId: WORKSPACE_ID,
      intake: intake({ opposingParties: ['Acme Industries LLC'] }),
      fetcher,
    });
    assert.equal(res.ok, true);
    if (!res.ok) return;
    assert.equal(res.value.conflicts.length, 1, 'should match across entity-suffix differences');
  });

  it('single-token coincidence does NOT fire a conflict (e.g. just "Industries")', async () => {
    const fetcher = ledger([
      { clientName: 'Industries Group', status: 'active' },
    ]);
    const res = await runSkill({
      workspaceId: WORKSPACE_ID,
      intake: intake({ opposingParties: ['Acme'] }),
      fetcher,
    });
    assert.equal(res.ok, true);
    if (!res.ok) return;
    assert.equal(res.value.conflicts.length, 0);
  });
});

describe('law-intake-conflict-screen — persistence', () => {
  it('persists the clear-screen draft to the recording persister above threshold', async () => {
    const persister = new RecordingDraftPersister();
    const fetcher = ledger([]);
    const res = await runSkill({
      workspaceId: WORKSPACE_ID,
      intake: intake(),
      fetcher,
      persister,
    });
    assert.equal(res.ok, true);
    if (!res.ok) return;
    assert.equal(persister.calls.length, 1);
    assert.equal(res.value.attorneyNotice.persisted, true);
    assert.ok(res.value.attorneyNotice.providerDraftId);
  });

  it('suppresses persistence on needs-counsel-review (confidence below default threshold)', async () => {
    const persister = new RecordingDraftPersister();
    const fetcher = ledger([
      { clientName: 'Acme Industries LLC', status: 'active' },
    ]);
    const res = await runSkill({
      workspaceId: WORKSPACE_ID,
      intake: intake(),
      fetcher,
      persister,
      persistThreshold: 0.6,
    });
    assert.equal(res.ok, true);
    if (!res.ok) return;
    assert.equal(persister.calls.length, 0, 'high-stakes calls stay in operator queue');
    assert.equal(res.value.attorneyNotice.persisted, false);
  });
});

describe('law-intake-conflict-screen — workspace mismatch', () => {
  it('returns INVALID_INPUT when the fetcher seed is wrong workspace', async () => {
    const fetcher = ledger([]);
    const res = await runSkill({
      workspaceId: 'ws-other',
      intake: intake(),
      fetcher,
    });
    assert.equal(res.ok, false);
    if (res.ok) return;
    assert.equal(res.error.reference, 'INVALID_INPUT');
  });
});
