/**
 * Behavior tests for the wave-4 `finance-pulse-sweep`.
 *
 * Behavior (DI — no DB, no LLM):
 *   - PAUSED-for-billing workspaces skip the runner entirely.
 *   - Discipline-disabled workspaces skip on the discipline gate.
 *   - Not-installed workspaces skip on the install gate.
 *   - Happy candidates run the per-workspace runner and counts as
 *     workspacesWithPulse when the runner reports `sunk: true`.
 *
 * Smoke:
 *   - Function id + cron schedule are the documented constants
 *     (Monday 13:05 UTC, five minutes after the analytics pulse).
 *   - `finance-pulse-general` is mapped to `finance`.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  FINANCE_PULSE_SWEEP_CRON,
  FINANCE_PULSE_SWEEP_FUNCTION_ID,
  financePulseSweepFn,
  runFinancePulseSweep,
} from '../finance-pulse-sweep';
import { SKILL_DISCIPLINE } from '@/lib/disciplines/skill-mapping';

const WORKSPACE_OK = '11111111-1111-1111-1111-111111111111';
const WORKSPACE_PAUSED = '22222222-2222-2222-2222-222222222222';
const WORKSPACE_DISCIPLINE_DISABLED = '33333333-3333-3333-3333-333333333333';
const WORKSPACE_NOT_INSTALLED = '44444444-4444-4444-4444-444444444444';
const WORKSPACE_LLM_FAIL = '55555555-5555-5555-5555-555555555555';

describe('runFinancePulseSweep — gate behavior', () => {
  it('PAUSED-for-billing workspaces are skipped before discipline / install / runner', async () => {
    const ranFor: string[] = [];
    const result = await runFinancePulseSweep({
      listCandidates: async () => [
        {
          id: WORKSPACE_PAUSED,
          vertical: 'REAL_ESTATE' as const,
          disabledDisciplines: [],
        },
        {
          id: WORKSPACE_OK,
          vertical: 'REAL_ESTATE' as const,
          disabledDisciplines: [],
        },
      ],
      isPaused: async (wsId) => wsId === WORKSPACE_PAUSED,
      isInstalled: async () => true,
      runForWorkspace: async ({ workspaceId }) => {
        ranFor.push(workspaceId);
        return { ok: true, sunk: true };
      },
    });
    assert.equal(result.workspacesConsidered, 2);
    assert.equal(result.workspacesSkippedPausedForBilling, 1);
    assert.equal(result.workspacesWithPulse, 1);
    assert.deepEqual(ranFor, [WORKSPACE_OK]);
  });

  it('discipline-disabled + not-installed workspaces are skipped on their respective gates', async () => {
    const ranFor: string[] = [];
    const result = await runFinancePulseSweep({
      listCandidates: async () => [
        {
          id: WORKSPACE_DISCIPLINE_DISABLED,
          vertical: 'CPA' as const,
          disabledDisciplines: ['finance'],
        },
        {
          id: WORKSPACE_NOT_INSTALLED,
          vertical: 'CPA' as const,
          disabledDisciplines: [],
        },
        {
          id: WORKSPACE_OK,
          vertical: 'CPA' as const,
          disabledDisciplines: [],
        },
      ],
      isPaused: async () => false,
      isInstalled: async (wsId) => wsId !== WORKSPACE_NOT_INSTALLED,
      runForWorkspace: async ({ workspaceId }) => {
        ranFor.push(workspaceId);
        return { ok: true, sunk: true };
      },
    });
    assert.equal(result.workspacesSkippedDisciplineDisabled, 1);
    assert.equal(result.workspacesSkippedNotInstalled, 1);
    assert.equal(result.workspacesWithPulse, 1);
    assert.deepEqual(ranFor, [WORKSPACE_OK]);
  });

  it('runner failures are counted, not thrown', async () => {
    const result = await runFinancePulseSweep({
      listCandidates: async () => [
        {
          id: WORKSPACE_LLM_FAIL,
          vertical: 'REAL_ESTATE' as const,
          disabledDisciplines: [],
        },
      ],
      isPaused: async () => false,
      isInstalled: async () => true,
      runForWorkspace: async () => ({
        ok: false,
        sunk: false,
        reason: 'UPSTREAM_LLM_ERROR: anthropic 500',
      }),
    });
    assert.equal(result.failures.length, 1);
    assert.match(result.failures[0].reason, /anthropic 500/);
    assert.equal(result.workspacesWithPulse, 0);
  });
});

describe('finance-pulse-sweep — registration smoke', () => {
  it('function id + cron expression match the documented constants', () => {
    assert.equal(FINANCE_PULSE_SWEEP_FUNCTION_ID, 'agentplain-finance-pulse-sweep');
    // Monday 13:05 UTC — five minutes after the analytics pulse so the two
    // weekly LLM-heavy crons don't collide on the same minute.
    assert.equal(FINANCE_PULSE_SWEEP_CRON, '5 13 * * MON');
    assert.ok(typeof financePulseSweepFn === 'object' && financePulseSweepFn !== null);
  });

  it('finance-pulse-general is mapped to the finance discipline', () => {
    assert.equal(SKILL_DISCIPLINE['finance-pulse-general'], 'finance');
  });
});
