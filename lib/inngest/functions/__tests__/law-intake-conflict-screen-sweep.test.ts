/**
 * lib/inngest/functions/__tests__/law-intake-conflict-screen-sweep.test.ts
 *
 * Behavior + smoke tests for the law conflict-screen daily sweep (pfd-8).
 *
 * THE GAP TEST: law-intake-conflict-screen shipped module-complete with NO
 * production caller, so a law workspace's new-matter conflict screens
 * silently never ran. The happy-path test below asserts a law workspace
 * with pending intakes produces screened verdicts (NOT a silent no-op).
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';

import {
  LAW_CONFLICT_SCREEN_SWEEP_CRON,
  LAW_CONFLICT_SCREEN_SWEEP_FUNCTION_ID,
  lawConflictScreenSweepFn,
  runLawConflictScreenSweep,
} from '../law-intake-conflict-screen-sweep';
import { SKILL_DISCIPLINE } from '@/lib/disciplines/skill-mapping';
import type { FireGateOutcome } from '@/lib/skills/fire-gate';

const NOW = new Date('2026-06-10T07:00:00Z');

describe('runLawConflictScreenSweep — happy law workspace screens intakes (the gap test)', () => {
  it('a law workspace with pending intakes does NOT silently no-op', async () => {
    const result = await runLawConflictScreenSweep({
      now: NOW,
      listCandidates: async () => [
        { id: 'ws-law', vertical: 'LAW', disabledDisciplines: [] },
      ],
      isInstalled: async () => true,
      gateFire: async () => ({ allowed: true }),
      runForWorkspace: async () => ({
        ok: true,
        intakesScreened: 2,
        failures: [],
      }),
    });
    assert.equal(result.workspacesConsidered, 1);
    assert.equal(result.workspacesWithVerdicts, 1);
    assert.equal(result.intakesScreened, 2);
    assert.equal(result.failures.length, 0);
  });
});

describe('runLawConflictScreenSweep — no pending intakes is a quiet pass', () => {
  it('zero screened → no verdicts, no failures', async () => {
    const result = await runLawConflictScreenSweep({
      now: NOW,
      listCandidates: async () => [
        { id: 'ws-quiet', vertical: 'LAW', disabledDisciplines: [] },
      ],
      isInstalled: async () => true,
      gateFire: async () => ({ allowed: true }),
      runForWorkspace: async () => ({ ok: true, intakesScreened: 0, failures: [] }),
    });
    assert.equal(result.workspacesWithVerdicts, 0);
    assert.equal(result.failures.length, 0);
  });
});

describe('runLawConflictScreenSweep — discipline-disabled is skipped', () => {
  it('legal disabled → skipped', async () => {
    const result = await runLawConflictScreenSweep({
      now: NOW,
      listCandidates: async () => [
        { id: 'ws-disabled', vertical: 'LAW', disabledDisciplines: ['legal'] },
      ],
      runForWorkspace: async () => {
        throw new Error('runner must not be reached for a disabled workspace');
      },
    });
    assert.equal(result.workspacesSkippedDisciplineDisabled, 1);
  });
});

describe('runLawConflictScreenSweep — fire-gate deny is a clean skip', () => {
  it('counts as workspacesSkippedFireGate', async () => {
    const gateResult: FireGateOutcome = {
      allowed: false,
      reason: 'off-window',
      detail: 'off',
    };
    const result = await runLawConflictScreenSweep({
      now: NOW,
      listCandidates: async () => [
        { id: 'ws-offwindow', vertical: 'LAW', disabledDisciplines: [] },
      ],
      isInstalled: async () => true,
      gateFire: async () => gateResult,
      runForWorkspace: async () => {
        throw new Error('runner must not be reached when fire-gate denies');
      },
    });
    assert.equal(result.workspacesSkippedFireGate, 1);
  });
});

describe('runLawConflictScreenSweep — per-matter failure is recorded', () => {
  it('records workspace + matter id', async () => {
    const result = await runLawConflictScreenSweep({
      now: NOW,
      listCandidates: async () => [
        { id: 'ws-fail', vertical: 'LAW', disabledDisciplines: [] },
      ],
      isInstalled: async () => true,
      gateFire: async () => ({ allowed: true }),
      runForWorkspace: async () => ({
        ok: true,
        intakesScreened: 0,
        failures: [{ matterId: 'm-7', reason: 'ledger boom' }],
      }),
    });
    assert.equal(result.failures.length, 1);
    assert.match(result.failures[0]!.reason, /m-7/);
  });
});

// ── Smoke ─────────────────────────────────────────────────────────────────

describe('lawConflictScreenSweepFn — registration shape', () => {
  it('function id is the documented constant', () => {
    assert.equal(
      LAW_CONFLICT_SCREEN_SWEEP_FUNCTION_ID,
      'agentplain-law-intake-conflict-screen-sweep',
    );
  });
  it('cron is daily at 7 AM UTC', () => {
    assert.equal(LAW_CONFLICT_SCREEN_SWEEP_CRON, '0 7 * * *');
  });
  it('exported function object is defined', () => {
    assert.ok(typeof lawConflictScreenSweepFn === 'object' && lawConflictScreenSweepFn !== null);
  });
  it('law-intake-conflict-screen maps to legal', () => {
    assert.equal(SKILL_DISCIPLINE['law-intake-conflict-screen'], 'legal');
  });
  it('route.ts references lawConflictScreenSweepFn', () => {
    const repoRoot = path.resolve(__dirname, '..', '..', '..', '..');
    const src = fs.readFileSync(
      path.join(repoRoot, 'app', 'api', 'inngest', 'route.ts'),
      'utf-8',
    );
    assert.match(src, /lawConflictScreenSweepFn/);
  });
});
