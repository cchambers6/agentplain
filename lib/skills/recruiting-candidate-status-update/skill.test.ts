/**
 * lib/skills/recruiting-candidate-status-update/skill.test.ts
 *
 * Pins the deterministic candidate-status-update behavior:
 *   - one draft per candidate transition (advanced / held / rejected /
 *     withdrawn / offer-extended)
 *   - stable candidates with no recent change → "held" if stale, no draft if fresh
 *   - never quotes salary / offer detail — defers to merge field
 *   - offer-extended and rejected drafts always queue for recruiter review
 *   - hiring-manager feedback never leaks into the draft body verbatim
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { runSkill } from './skill';
import { JsonRolePipelineLookup } from './json-fetcher';
import { RecordingDraftPersister } from '../draft';
import type { CandidateRecord, RoleContext } from './types';

const WORKSPACE_ID = 'ws-recruiting-0001';
const ROLE_ID = 'role-2026-0118';
const NOW = new Date('2026-05-24T15:00:00Z');

function role(overrides: Partial<RoleContext> = {}): RoleContext {
  return {
    roleId: ROLE_ID,
    title: 'Senior Engineering Manager',
    clientName: 'Beacon Health',
    recruiter: { name: 'Sasha Reed', email: 'sasha@firm.example' },
    onHold: false,
    ...overrides,
  };
}

function candidate(overrides: Partial<CandidateRecord> = {}): CandidateRecord {
  return {
    candidateId: 'cand-001',
    candidate: { name: 'Dana Park', email: 'dana@candidate.example' },
    currentStage: 'screened',
    previousStage: 'screened',
    lastTouchAt: new Date('2026-05-21T15:00:00Z'),
    stageChangedAt: new Date('2026-05-21T15:00:00Z'),
    hiringManagerFeedback: null,
    candidateAcknowledged: false,
    ...overrides,
  };
}

function lookup(opts: {
  candidates?: CandidateRecord[];
  roleCtx?: RoleContext;
}): JsonRolePipelineLookup {
  return new JsonRolePipelineLookup({
    workspaceId: WORKSPACE_ID,
    roleId: ROLE_ID,
    role: opts.roleCtx ?? role(),
    candidates: opts.candidates ?? [],
  });
}

describe('recruiting-candidate-status-update — advance transition', () => {
  it('drafts a next-step update when the candidate moved to a new stage', async () => {
    const res = await runSkill({
      workspaceId: WORKSPACE_ID,
      roleId: ROLE_ID,
      lookup: lookup({
        candidates: [
          candidate({
            candidateId: 'cand-advance',
            previousStage: 'screened',
            currentStage: 'manager-screen',
            stageChangedAt: new Date('2026-05-23T15:00:00Z'),
            lastTouchAt: new Date('2026-05-21T15:00:00Z'),
          }),
        ],
      }),
      now: NOW,
    });
    assert.equal(res.ok, true);
    if (!res.ok) return;
    assert.equal(res.value.drafts.length, 1);
    const d = res.value.drafts[0];
    assert.equal(d.transition, 'advanced');
    assert.match(d.subject, /Next step/);
    assert.match(d.body, /hiring-manager screen/);
  });
});

describe('recruiting-candidate-status-update — held / stale', () => {
  it('drafts a held check-in when the candidate is stale (no stage change, past threshold)', async () => {
    const res = await runSkill({
      workspaceId: WORKSPACE_ID,
      roleId: ROLE_ID,
      lookup: lookup({
        candidates: [
          candidate({
            candidateId: 'cand-stale',
            previousStage: 'manager-screen',
            currentStage: 'manager-screen',
            lastTouchAt: new Date('2026-05-13T15:00:00Z'), // 11 days
          }),
        ],
      }),
      now: NOW,
    });
    assert.equal(res.ok, true);
    if (!res.ok) return;
    const d = res.value.drafts[0];
    assert.equal(d.transition, 'held');
    assert.match(d.body, /circle back/);
  });

  it('does NOT draft when the candidate is stable and within the cadence window', async () => {
    const res = await runSkill({
      workspaceId: WORKSPACE_ID,
      roleId: ROLE_ID,
      lookup: lookup({
        candidates: [
          candidate({
            candidateId: 'cand-fresh',
            previousStage: 'manager-screen',
            currentStage: 'manager-screen',
            lastTouchAt: new Date('2026-05-22T15:00:00Z'),
          }),
        ],
      }),
      now: NOW,
    });
    assert.equal(res.ok, true);
    if (!res.ok) return;
    assert.equal(res.value.drafts.length, 0);
  });

  it('surfaces the on-hold note when the role itself is on hold', async () => {
    const res = await runSkill({
      workspaceId: WORKSPACE_ID,
      roleId: ROLE_ID,
      lookup: lookup({
        roleCtx: role({ onHold: true }),
        candidates: [
          candidate({
            previousStage: 'manager-screen',
            currentStage: 'manager-screen',
            lastTouchAt: new Date('2026-05-13T15:00:00Z'),
          }),
        ],
      }),
      now: NOW,
    });
    assert.equal(res.ok, true);
    if (!res.ok) return;
    assert.match(res.value.drafts[0].body, /the role itself is on a brief hold/);
  });
});

describe('recruiting-candidate-status-update — never quotes comp / offer detail', () => {
  it('always defers comp + offer to operator merge field', async () => {
    const res = await runSkill({
      workspaceId: WORKSPACE_ID,
      roleId: ROLE_ID,
      lookup: lookup({
        candidates: [
          candidate({
            candidateId: 'cand-offer',
            previousStage: 'reference-check',
            currentStage: 'offer-extended',
            stageChangedAt: new Date('2026-05-23T15:00:00Z'),
          }),
        ],
      }),
      now: NOW,
    });
    assert.equal(res.ok, true);
    if (!res.ok) return;
    const d = res.value.drafts[0];
    assert.equal(d.transition, 'offer-extended');
    assert.match(d.body, /\{\{operator: comp\/offer details\}\}/);
    // Confidence is intentionally low so the recruiter must re-read.
    assert.ok(d.confidence < 0.5);
  });
});

describe('recruiting-candidate-status-update — recruiter review queue', () => {
  it('queues offer-extended and rejection drafts for recruiter review', async () => {
    const res = await runSkill({
      workspaceId: WORKSPACE_ID,
      roleId: ROLE_ID,
      lookup: lookup({
        candidates: [
          candidate({
            candidateId: 'cand-offer',
            previousStage: 'reference-check',
            currentStage: 'offer-extended',
          }),
          candidate({
            candidateId: 'cand-reject',
            candidate: { name: 'Sam Lee', email: 'sam@candidate.example' },
            previousStage: 'manager-screen',
            currentStage: 'rejected',
          }),
        ],
      }),
      now: NOW,
    });
    assert.equal(res.ok, true);
    if (!res.ok) return;
    assert.deepEqual(res.value.reviewQueue.candidateIds.sort(), ['cand-offer', 'cand-reject']);
    assert.match(res.value.reviewQueue.message, /pending recruiter review/);
  });
});

describe('recruiting-candidate-status-update — feedback isolation', () => {
  it('NEVER renders hiringManagerFeedback verbatim in the draft body', async () => {
    const harshFeedback = 'cultural fit not there; communication style felt off';
    const res = await runSkill({
      workspaceId: WORKSPACE_ID,
      roleId: ROLE_ID,
      lookup: lookup({
        candidates: [
          candidate({
            candidateId: 'cand-reject',
            previousStage: 'onsite',
            currentStage: 'rejected',
            hiringManagerFeedback: harshFeedback,
          }),
        ],
      }),
      now: NOW,
    });
    assert.equal(res.ok, true);
    if (!res.ok) return;
    const d = res.value.drafts[0];
    assert.doesNotMatch(d.body, /cultural fit/i);
    assert.doesNotMatch(d.body, /communication style felt off/i);
  });
});

describe('recruiting-candidate-status-update — persistence', () => {
  it('persists routine advance drafts above threshold', async () => {
    const persister = new RecordingDraftPersister();
    const res = await runSkill({
      workspaceId: WORKSPACE_ID,
      roleId: ROLE_ID,
      lookup: lookup({
        candidates: [
          candidate({
            candidateId: 'cand-advance',
            previousStage: 'screened',
            currentStage: 'manager-screen',
          }),
        ],
      }),
      now: NOW,
      persister,
    });
    assert.equal(res.ok, true);
    if (!res.ok) return;
    assert.equal(persister.calls.length, 1);
    assert.equal(res.value.drafts[0].persisted, true);
  });

  it('suppresses persistence on offer-extended (low confidence — recruiter must re-read)', async () => {
    const persister = new RecordingDraftPersister();
    const res = await runSkill({
      workspaceId: WORKSPACE_ID,
      roleId: ROLE_ID,
      lookup: lookup({
        candidates: [
          candidate({
            candidateId: 'cand-offer',
            previousStage: 'reference-check',
            currentStage: 'offer-extended',
          }),
        ],
      }),
      now: NOW,
      persister,
    });
    assert.equal(res.ok, true);
    if (!res.ok) return;
    assert.equal(persister.calls.length, 0);
  });
});

describe('recruiting-candidate-status-update — workspace mismatch', () => {
  it('returns INVALID_INPUT when the seed is for a different workspace', async () => {
    const res = await runSkill({
      workspaceId: 'ws-other',
      roleId: ROLE_ID,
      lookup: lookup({ candidates: [candidate()] }),
      now: NOW,
    });
    assert.equal(res.ok, false);
    if (res.ok) return;
    assert.equal(res.error.reference, 'INVALID_INPUT');
  });
});
