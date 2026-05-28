/**
 * Behavior + smoke tests for `process-doc-drafter-sweep`.
 *
 * Behavior (DI — no DB):
 *   - Workspaces with no email credential → skipped unconfigured.
 *   - Workspaces with discipline disabled → skipped on discipline gate.
 *   - Race-condition NOT_CONFIGURED → clean skip.
 *   - Happy fetcher with a recurring pattern emits an SOP draft.
 *
 * Smoke:
 *   - Function id + cron schedule are the documented constants
 *     (weekly Monday 13:00 UTC).
 *   - `process-doc-drafter-general` is mapped to `operations`.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  PROCESS_DOC_DRAFTER_SWEEP_CRON,
  PROCESS_DOC_DRAFTER_SWEEP_FUNCTION_ID,
  processDocDrafterSweepFn,
  runProcessDocDrafterSweep,
} from '../process-doc-drafter-sweep';
import { SKILL_DISCIPLINE } from '@/lib/disciplines/skill-mapping';
import {
  JsonProcessDocFetcher,
  RecordingProcessDocApprovalSink,
} from '@/lib/skills/process-doc-drafter-general';
import { runProcessDocDrafterForWorkspace } from '@/lib/skills/process-doc-drafter-general/run-for-workspace';
import type {
  ProcessDocFetcher,
  ProcessDocSnapshot,
} from '@/lib/skills/process-doc-drafter-general';
import { skillError, skillOk, type SkillResult } from '@/lib/skills/types';

const WORKSPACE_GOOGLE = '11111111-1111-1111-1111-111111111111';
const WORKSPACE_DISABLED = '33333333-3333-3333-3333-333333333333';
const WORKSPACE_NEITHER = '44444444-4444-4444-4444-444444444444';

class EmptyProcessDocFetcher implements ProcessDocFetcher {
  readonly name = 'empty-stub' as const;
  async fetchSnapshot(): Promise<SkillResult<ProcessDocSnapshot>> {
    return skillOk({ pastActions: [], existingProcessDocs: [] });
  }
}

class RaceConditionFetcher implements ProcessDocFetcher {
  readonly name = 'race-stub' as const;
  async fetchSnapshot(): Promise<SkillResult<ProcessDocSnapshot>> {
    return skillError(
      'NOT_CONFIGURED',
      'workspace disconnected between candidate listing and execution',
    );
  }
}

describe('runProcessDocDrafterSweep — workspaces with no email credential are skipped', () => {
  it('counts them as skipped, not failed', async () => {
    const result = await runProcessDocDrafterSweep({
      listCandidates: async () => [
        {
          id: WORKSPACE_NEITHER,
          hasGoogle: false,
          hasM365: false,
          disabledDisciplines: [],
        },
      ],
      buildFetcher: () => new EmptyProcessDocFetcher(),
    });
    assert.equal(result.workspacesConsidered, 1);
    assert.equal(result.workspacesSkippedUnconfigured, 1);
    assert.equal(result.workspacesWithProposals, 0);
    assert.equal(result.failures.length, 0);
  });
});

describe('runProcessDocDrafterSweep — workspaces with the discipline disabled are skipped', () => {
  it('honors WorkspacePreference.disabledDisciplines', async () => {
    const result = await runProcessDocDrafterSweep({
      listCandidates: async () => [
        {
          id: WORKSPACE_DISABLED,
          hasGoogle: true,
          hasM365: false,
          disabledDisciplines: [
            SKILL_DISCIPLINE['process-doc-drafter-general']!,
          ],
        },
      ],
      buildFetcher: () => new EmptyProcessDocFetcher(),
    });
    assert.equal(result.workspacesConsidered, 1);
    assert.equal(result.workspacesSkippedDisciplineDisabled, 1);
    assert.equal(result.workspacesWithProposals, 0);
  });
});

describe('runProcessDocDrafterSweep — race-condition NOT_CONFIGURED is a clean skip', () => {
  it('counts NOT_CONFIGURED from run-time fetcher as skipped, not failed', async () => {
    const result = await runProcessDocDrafterSweep({
      listCandidates: async () => [
        {
          id: WORKSPACE_GOOGLE,
          hasGoogle: true,
          hasM365: false,
          disabledDisciplines: [],
        },
      ],
      buildFetcher: () => new RaceConditionFetcher(),
    });
    assert.equal(result.workspacesConsidered, 1);
    assert.equal(result.workspacesSkippedUnconfigured, 1);
    assert.equal(result.failures.length, 0);
  });
});

describe('runProcessDocDrafterSweep — recurring pattern produces an SOP draft', () => {
  it('clusters past actions and emits a process-doc proposal', async () => {
    const now = new Date('2026-05-28T12:00:00.000Z');
    const days = (n: number) => new Date(now.getTime() - n * 24 * 60 * 60 * 1000);
    const fetcher = new JsonProcessDocFetcher({
      workspaceId: WORKSPACE_GOOGLE,
      snapshot: {
        pastActions: [
          {
            id: 'a-1',
            occurredAt: days(1),
            kind: 'send',
            triggerHint: 'deposit-receipt',
            subject: 'Deposit receipt — Jane',
            bodySnippet: 'Thanks Jane, here is your deposit receipt for the project.',
          },
          {
            id: 'a-2',
            occurredAt: days(5),
            kind: 'send',
            triggerHint: 'deposit-receipt',
            subject: 'Deposit receipt — Mark',
            bodySnippet: 'Thanks Mark, here is your deposit receipt for the project.',
          },
          {
            id: 'a-3',
            occurredAt: days(10),
            kind: 'send',
            triggerHint: 'deposit-receipt',
            subject: 'Deposit receipt — Tara',
            bodySnippet: 'Thanks Tara, here is your deposit receipt for the project.',
          },
        ],
        existingProcessDocs: [],
      },
    });
    const sink = new RecordingProcessDocApprovalSink();
    const run = await runProcessDocDrafterForWorkspace({
      workspaceId: WORKSPACE_GOOGLE,
      fetcher,
      sink,
      now,
    });
    assert.ok(run.ok, 'runProcessDocDrafterForWorkspace must succeed');
    assert.equal(run.value.proposals.length, 1);
    assert.equal(run.value.sunk, 1);
    assert.equal(sink.calls.length, 1);
    assert.equal(sink.calls[0].proposal.occurrenceCount, 3);
  });
});

// ── Smoke ──────────────────────────────────────────────────────────────

describe('processDocDrafterSweepFn — registration shape', () => {
  it('uses the documented function id + cron schedule', () => {
    assert.equal(
      PROCESS_DOC_DRAFTER_SWEEP_FUNCTION_ID,
      'agentplain-process-doc-drafter-sweep',
    );
    assert.equal(PROCESS_DOC_DRAFTER_SWEEP_CRON, '0 13 * * 1');
    assert.ok(processDocDrafterSweepFn, 'function export defined');
  });

  it('process-doc-drafter-general is mapped to the documented discipline', () => {
    const id = SKILL_DISCIPLINE['process-doc-drafter-general'];
    assert.ok(id, 'process-doc-drafter-general must be mapped in SKILL_DISCIPLINE');
    assert.equal(id, 'operations');
  });

  it('serve route file literally references processDocDrafterSweepFn', async () => {
    const fs = await import('node:fs/promises');
    const path = await import('node:path');
    const src = await fs.readFile(
      path.resolve('app/api/inngest/route.ts'),
      'utf8',
    );
    assert.match(src, /processDocDrafterSweepFn/);
  });
});
