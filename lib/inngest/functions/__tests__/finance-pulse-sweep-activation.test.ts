/**
 * lib/inngest/functions/__tests__/finance-pulse-sweep-activation.test.ts
 *
 * Wave-7 — end-to-end through a real sweep: proves the finance-pulse sweep
 * (a representative of all five Wave-7 dormant sweeps) honors the activation
 * default-OFF switch + the customer fire gate, and only fires when BOTH
 * pass. The same gate seam (`shouldSweepFire`) drives every sweep, so this
 * pins the behavior for all five.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { runFinancePulseSweep } from '../finance-pulse-sweep';
import type { AgentActivationResult } from '@/lib/fleet/activation';
import type { FireGateOutcome } from '@/lib/skills/fire-gate';

const WS = '11111111-1111-1111-1111-111111111111';

function candidate() {
  return {
    id: WS,
    vertical: 'REAL_ESTATE' as const,
    disabledDisciplines: [] as string[],
  };
}

const ACTIVE: AgentActivationResult = { active: true, reason: 'active', detail: '' };
const DORMANT: AgentActivationResult = {
  active: false,
  reason: 'agent-not-activated',
  detail: '',
};

const common = {
  listCandidates: async () => [candidate()],
  isInstalled: async () => true,
  isPaused: async () => false,
};

describe('runFinancePulseSweep — Wave-7 activation + fire gate', () => {
  it('(a) DEFAULT-OFF: dormant agent → skipped as dormant, skill NEVER runs', async () => {
    let ran = false;
    const out = await runFinancePulseSweep({
      ...common,
      isActivated: async () => DORMANT,
      runForWorkspace: async () => {
        ran = true;
        return { ok: true, sunk: true };
      },
    });
    assert.equal(out.workspacesConsidered, 1);
    assert.equal(out.workspacesSkippedDormant, 1);
    assert.equal(out.workspacesWithPulse, 0);
    assert.equal(ran, false, 'dormant agent must not fire the skill');
  });

  it('(b) ON + gate allows + data → fires (writes a pulse)', async () => {
    let ran = false;
    const out = await runFinancePulseSweep({
      ...common,
      isActivated: async () => ACTIVE,
      gateFire: async (): Promise<FireGateOutcome> => ({ allowed: true }),
      runForWorkspace: async () => {
        ran = true;
        return { ok: true, sunk: true };
      },
    });
    assert.equal(out.workspacesSkippedDormant, 0);
    assert.equal(out.workspacesSkippedFireGate, 0);
    assert.equal(out.workspacesWithPulse, 1);
    assert.equal(ran, true);
  });

  it('(c) ON but customer vacation/schedule pause → fire-gate skip, skill NEVER runs', async () => {
    let ran = false;
    const out = await runFinancePulseSweep({
      ...common,
      isActivated: async () => ACTIVE,
      gateFire: async (): Promise<FireGateOutcome> => ({
        allowed: false,
        reason: 'workspace-paused',
        detail: 'on vacation',
      }),
      runForWorkspace: async () => {
        ran = true;
        return { ok: true, sunk: true };
      },
    });
    assert.equal(out.workspacesSkippedFireGate, 1);
    assert.equal(out.workspacesWithPulse, 0);
    assert.equal(ran, false, 'a paused workspace must not fire the skill');
  });
});
