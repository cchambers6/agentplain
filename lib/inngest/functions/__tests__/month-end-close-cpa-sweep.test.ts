/**
 * lib/inngest/functions/__tests__/month-end-close-cpa-sweep.test.ts
 *
 * Behavior + smoke tests for the CPA month-end-close monthly sweep (pfd-8).
 *
 * THE GAP TEST: the audit found month-end-close-cpa shipped module-complete
 * with NO production caller, so a CPA workspace's close-prep silently never
 * fired. The happy-path test below is the one that would have caught it —
 * it asserts a CPA workspace with QuickBooks connected produces prepped
 * engagements (NOT a silent no-op).
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';

import {
  MONTH_END_CLOSE_CPA_SWEEP_CRON,
  MONTH_END_CLOSE_CPA_SWEEP_FUNCTION_ID,
  monthEndCloseCpaSweepFn,
  runMonthEndCloseCpaSweep,
} from '../month-end-close-cpa-sweep';
import { SKILL_DISCIPLINE } from '@/lib/disciplines/skill-mapping';
import type { FireGateOutcome } from '@/lib/skills/fire-gate';

const NOW = new Date('2026-06-01T05:00:00Z');

describe('runMonthEndCloseCpaSweep — happy CPA workspace preps engagements (the gap test)', () => {
  it('a CPA workspace with QB connected does NOT silently no-op', async () => {
    const result = await runMonthEndCloseCpaSweep({
      now: NOW,
      listCandidates: async () => [
        { id: 'ws-cpa', vertical: 'CPA', disabledDisciplines: [] },
      ],
      isInstalled: async () => true,
      gateFire: async () => ({ allowed: true }),
      runForWorkspace: async () => ({
        ok: true,
        notConfigured: false,
        clientsPrepped: 3,
        failures: [],
      }),
    });
    assert.equal(result.workspacesConsidered, 1);
    assert.equal(result.workspacesWithDrafts, 1);
    assert.equal(result.engagementsPrepped, 3);
    assert.equal(result.failures.length, 0);
  });
});

describe('runMonthEndCloseCpaSweep — QB-not-connected is a clean skip', () => {
  it('counts as unconfigured, not a failure', async () => {
    const result = await runMonthEndCloseCpaSweep({
      now: NOW,
      listCandidates: async () => [
        { id: 'ws-no-qb', vertical: 'CPA', disabledDisciplines: [] },
      ],
      isInstalled: async () => true,
      gateFire: async () => ({ allowed: true }),
      runForWorkspace: async () => ({
        ok: true,
        notConfigured: true,
        clientsPrepped: 0,
        failures: [],
      }),
    });
    assert.equal(result.workspacesSkippedUnconfigured, 1);
    assert.equal(result.workspacesWithDrafts, 0);
    assert.equal(result.failures.length, 0);
  });
});

describe('runMonthEndCloseCpaSweep — discipline-disabled is skipped', () => {
  it('finance disabled → skipped, not failed', async () => {
    const result = await runMonthEndCloseCpaSweep({
      now: NOW,
      listCandidates: async () => [
        { id: 'ws-disabled', vertical: 'CPA', disabledDisciplines: ['finance'] },
      ],
      runForWorkspace: async () => {
        throw new Error('runner must not be reached for a disabled workspace');
      },
    });
    assert.equal(result.workspacesSkippedDisciplineDisabled, 1);
    assert.equal(result.workspacesWithDrafts, 0);
  });
});

describe('runMonthEndCloseCpaSweep — fire-gate deny is a clean skip', () => {
  it('counts as workspacesSkippedFireGate', async () => {
    const gateResult: FireGateOutcome = {
      allowed: false,
      reason: 'workspace-paused',
      detail: 'paused',
    };
    const result = await runMonthEndCloseCpaSweep({
      now: NOW,
      listCandidates: async () => [
        { id: 'ws-paused', vertical: 'CPA', disabledDisciplines: [] },
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

describe('runMonthEndCloseCpaSweep — not-installed skip', () => {
  it('counts as workspacesSkippedNotInstalled', async () => {
    const result = await runMonthEndCloseCpaSweep({
      now: NOW,
      listCandidates: async () => [
        { id: 'ws-uninstalled', vertical: 'CPA', disabledDisciplines: [] },
      ],
      isInstalled: async () => false,
      gateFire: async () => ({ allowed: true }),
    });
    assert.equal(result.workspacesSkippedNotInstalled, 1);
  });
});

describe('runMonthEndCloseCpaSweep — per-client failure is recorded', () => {
  it('records workspace + client id in failures', async () => {
    const result = await runMonthEndCloseCpaSweep({
      now: NOW,
      listCandidates: async () => [
        { id: 'ws-fail', vertical: 'CPA', disabledDisciplines: [] },
      ],
      isInstalled: async () => true,
      gateFire: async () => ({ allowed: true }),
      runForWorkspace: async () => ({
        ok: true,
        notConfigured: false,
        clientsPrepped: 1,
        failures: [{ clientId: 'cust-99', reason: 'boom' }],
      }),
    });
    assert.equal(result.failures.length, 1);
    assert.match(result.failures[0]!.reason, /cust-99/);
    // A partial failure still counts the prepped engagement.
    assert.equal(result.engagementsPrepped, 1);
  });
});

// ── Smoke ─────────────────────────────────────────────────────────────────

describe('monthEndCloseCpaSweepFn — registration shape', () => {
  it('function id is the documented constant', () => {
    assert.equal(
      MONTH_END_CLOSE_CPA_SWEEP_FUNCTION_ID,
      'agentplain-month-end-close-cpa-sweep',
    );
  });
  it('cron is monthly on the 1st at 5 AM UTC', () => {
    assert.equal(MONTH_END_CLOSE_CPA_SWEEP_CRON, '0 5 1 * *');
  });
  it('exported function object is defined', () => {
    assert.ok(typeof monthEndCloseCpaSweepFn === 'object' && monthEndCloseCpaSweepFn !== null);
  });
  it('month-end-close-cpa maps to finance', () => {
    assert.equal(SKILL_DISCIPLINE['month-end-close-cpa'], 'finance');
  });
  it('route.ts references monthEndCloseCpaSweepFn', () => {
    const repoRoot = path.resolve(__dirname, '..', '..', '..', '..');
    const src = fs.readFileSync(
      path.join(repoRoot, 'app', 'api', 'inngest', 'route.ts'),
      'utf-8',
    );
    assert.match(src, /monthEndCloseCpaSweepFn/);
  });
});
