/**
 * lib/skills/ria-client-update-draft/skill.test.ts
 *
 * Pins the RIA client-update behavior: no dollar amounts in body, no
 * investment recommendations, all numeric content defers to advisor
 * merge fields, Form ADV + custody-rule pointers always present.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { runSkill } from './skill';
import { JsonPortfolioFetcher } from './json-fetcher';
import { RecordingDraftPersister } from '../draft';
import type {
  AdvisorNote,
  ClientHousehold,
  PortfolioSnapshot,
} from './types';

const WORKSPACE_ID = 'ws-ria-0001';
const HOUSEHOLD_ID = 'hh-smith';
const PERIOD = 'Q2 2026';

function household(overrides: Partial<ClientHousehold> = {}): ClientHousehold {
  return {
    householdId: HOUSEHOLD_ID,
    displayName: 'The Smith Household',
    primaryContact: { name: 'Pat Smith', email: 'pat.smith@example.com' },
    copyContacts: [{ name: 'Jamie Smith', email: 'jamie.smith@example.com' }],
    periodLabel: PERIOD,
    advisor: { name: 'Avery Lin', email: 'avery@firm.example' },
    ...overrides,
  };
}

function snapshot(overrides: Partial<PortfolioSnapshot> = {}): PortfolioSnapshot {
  return {
    hadContributions: false,
    hadDistributions: false,
    rebalanced: false,
    reviewedThisPeriod: false,
    ...overrides,
  };
}

function fetcher(opts: {
  household?: ClientHousehold;
  snapshot?: PortfolioSnapshot;
  notes?: AdvisorNote[];
}): JsonPortfolioFetcher {
  return new JsonPortfolioFetcher({
    workspaceId: WORKSPACE_ID,
    household: opts.household ?? household(),
    snapshot: opts.snapshot ?? snapshot(),
    notes: opts.notes ?? [],
  });
}

describe('ria-client-update-draft — required regulatory pointers', () => {
  it('every draft includes the Form ADV + qualified-custodian pointers via merge fields', async () => {
    const res = await runSkill({
      workspaceId: WORKSPACE_ID,
      householdId: HOUSEHOLD_ID,
      periodLabel: PERIOD,
      fetcher: fetcher({}),
    });
    assert.equal(res.ok, true);
    if (!res.ok) return;
    assert.match(res.value.draft.body, /Form ADV/);
    assert.match(res.value.draft.body, /qualified custodian/);
    assert.match(res.value.draft.body, /\{\{advisor: Form ADV link\}\}/);
    assert.match(res.value.draft.body, /\{\{advisor: qualified custodian name\}\}/);
  });

  it('NEVER renders any dollar figure in body — only advisor merge fields', async () => {
    const res = await runSkill({
      workspaceId: WORKSPACE_ID,
      householdId: HOUSEHOLD_ID,
      periodLabel: PERIOD,
      fetcher: fetcher({ snapshot: snapshot({ hadContributions: true }) }),
    });
    assert.equal(res.ok, true);
    if (!res.ok) return;
    // No naked dollar amounts — every numeric reference is a merge field.
    assert.doesNotMatch(
      res.value.draft.body,
      /\$[0-9]/,
      'body must never carry a literal dollar amount — defer to advisor merge fields',
    );
  });

  it('signs with the advisor of record + IA disclosures merge field', async () => {
    const res = await runSkill({
      workspaceId: WORKSPACE_ID,
      householdId: HOUSEHOLD_ID,
      periodLabel: PERIOD,
      fetcher: fetcher({}),
    });
    assert.equal(res.ok, true);
    if (!res.ok) return;
    assert.match(res.value.draft.body, /Avery Lin/);
    assert.match(res.value.draft.body, /\{\{advisor: firm name \+ IA disclosures footer\}\}/);
  });
});

describe('ria-client-update-draft — activity rendering from snapshot', () => {
  it('surfaces contribution + distribution activity via merge fields when flags fire', async () => {
    const res = await runSkill({
      workspaceId: WORKSPACE_ID,
      householdId: HOUSEHOLD_ID,
      periodLabel: PERIOD,
      fetcher: fetcher({
        snapshot: snapshot({ hadContributions: true, hadDistributions: true }),
      }),
    });
    assert.equal(res.ok, true);
    if (!res.ok) return;
    assert.match(res.value.draft.body, /\{\{advisor: confirm contribution detail\}\}/);
    assert.match(res.value.draft.body, /\{\{advisor: confirm distribution detail\}\}/);
  });

  it('renders advisor notes verbatim under the Notes section', async () => {
    const res = await runSkill({
      workspaceId: WORKSPACE_ID,
      householdId: HOUSEHOLD_ID,
      periodLabel: PERIOD,
      fetcher: fetcher({
        notes: [
          {
            label: 'Annual planning review completed',
            detail: 'Confirmed cash-flow targets for the year and updated the IPS.',
          },
        ],
      }),
    });
    assert.equal(res.ok, true);
    if (!res.ok) return;
    assert.match(res.value.draft.body, /Annual planning review completed/);
    assert.match(res.value.draft.body, /Confirmed cash-flow targets/);
    assert.equal(res.value.noteCount, 1);
  });

  it('drops confidence when activity flags fire (advisor re-reads)', async () => {
    const noActivity = await runSkill({
      workspaceId: WORKSPACE_ID,
      householdId: HOUSEHOLD_ID,
      periodLabel: PERIOD,
      fetcher: fetcher({}),
    });
    const withActivity = await runSkill({
      workspaceId: WORKSPACE_ID,
      householdId: HOUSEHOLD_ID,
      periodLabel: PERIOD,
      fetcher: fetcher({
        snapshot: snapshot({ hadContributions: true }),
      }),
    });
    assert.ok(noActivity.ok && withActivity.ok);
    if (!noActivity.ok || !withActivity.ok) return;
    assert.ok(
      withActivity.value.draft.confidence < noActivity.value.draft.confidence,
      'activity-flagged draft should drop confidence below routine draft',
    );
  });
});

describe('ria-client-update-draft — persistence', () => {
  it('routine update persists when confidence ≥ threshold', async () => {
    const persister = new RecordingDraftPersister();
    const res = await runSkill({
      workspaceId: WORKSPACE_ID,
      householdId: HOUSEHOLD_ID,
      periodLabel: PERIOD,
      fetcher: fetcher({
        notes: [{ label: 'Annual review', detail: 'completed' }],
      }),
      persister,
    });
    assert.equal(res.ok, true);
    if (!res.ok) return;
    assert.equal(persister.calls.length, 1);
    assert.equal(res.value.draft.persisted, true);
  });

  it('threshold suppression keeps a low-confidence draft out of the persister', async () => {
    const persister = new RecordingDraftPersister();
    const res = await runSkill({
      workspaceId: WORKSPACE_ID,
      householdId: HOUSEHOLD_ID,
      periodLabel: PERIOD,
      fetcher: fetcher({
        snapshot: snapshot({ hadDistributions: true }),
      }),
      persister,
      persistThreshold: 0.7,
    });
    assert.equal(res.ok, true);
    if (!res.ok) return;
    assert.equal(persister.calls.length, 0);
    assert.equal(res.value.draft.persisted, false);
  });
});
