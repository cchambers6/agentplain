/**
 * lib/inngest/__tests__/sweep-fire-gate.test.ts
 *
 * Wave-7 — proves the composed sweep gate (activation default-OFF +
 * customer fire gate) and the SWEEP-CALLER-COVERAGE invariant: every
 * activation-ready agent's cron actually routes its fire through
 * `shouldSweepFire`. The coverage test is the guard the audit asked for —
 * "a gate-bypassing caller is caught."
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { shouldSweepFire } from '../sweep-fire-gate';
import { ACTIVATABLE_AGENTS } from '@/lib/fleet/activation';
import type { AgentActivationResult } from '@/lib/fleet/activation';
import type { FireGateOutcome } from '@/lib/skills/fire-gate';

const ACTIVE: AgentActivationResult = {
  active: true,
  reason: 'active',
  detail: 'activated',
};
const DORMANT: AgentActivationResult = {
  active: false,
  reason: 'agent-not-activated',
  detail: 'dormant',
};
const ALLOW: FireGateOutcome = { allowed: true };
const PAUSED: FireGateOutcome = {
  allowed: false,
  reason: 'workspace-paused',
  detail: 'paused',
};

const WS = 'ws-1';
const baseArgs = {
  workspaceId: WS,
  agentSlug: 'finance-pulse',
  skillSlug: 'finance-pulse-general',
  disciplineId: 'finance',
};

describe('shouldSweepFire — composed decision', () => {
  it('dormant agent → no fire, gate=activation, and the fire gate is NOT consulted', async () => {
    let gateConsulted = false;
    const decision = await shouldSweepFire({
      ...baseArgs,
      isActivated: async () => DORMANT,
      gateFire: async () => {
        gateConsulted = true;
        return ALLOW;
      },
    });
    assert.equal(decision.fire, false);
    assert.equal(decision.fire === false && decision.gate, 'activation');
    assert.equal(
      gateConsulted,
      false,
      'a dormant agent must not even read the pause/schedule tables',
    );
  });

  it('activated + gate allows → fire', async () => {
    const decision = await shouldSweepFire({
      ...baseArgs,
      isActivated: async () => ACTIVE,
      gateFire: async () => ALLOW,
    });
    assert.equal(decision.fire, true);
  });

  it('activated + gate denies (vacation/schedule) → no fire, gate=fire-gate', async () => {
    const decision = await shouldSweepFire({
      ...baseArgs,
      isActivated: async () => ACTIVE,
      gateFire: async () => PAUSED,
    });
    assert.equal(decision.fire, false);
    assert.equal(decision.fire === false && decision.gate, 'fire-gate');
    assert.equal(
      decision.fire === false && decision.gate === 'fire-gate' && decision.reason,
      'workspace-paused',
    );
  });
});

/**
 * Coverage guard: each activation-ready agent maps to a sweep cron file
 * (`lib/inngest/functions/*.ts`). EVERY such file must route its fire
 * through `shouldSweepFire`. If a future skill-firing cron is added to the
 * registry but forgets the gate, this test fails — the "a gate-bypassing
 * caller is caught" requirement.
 */
describe('sweep-caller gate coverage', () => {
  // Map activation slug → the cron source file that drives it.
  const AGENT_TO_SOURCE: Record<string, string> = {
    'analytics-weekly-pulse': 'analytics-weekly-pulse-sweep.ts',
    'finance-pulse': 'finance-pulse-sweep.ts',
    'compliance-watch': 'compliance-watch-sweep.ts',
    'content-calendar-drafter': 'content-calendar-drafter-sweep.ts',
    'process-doc-drafter': 'process-doc-drafter-sweep.ts',
  };

  const FUNCTIONS_DIR = resolve(__dirname, '..', 'functions');

  it('every ACTIVATABLE_AGENTS slug has a mapped sweep source file', () => {
    for (const a of ACTIVATABLE_AGENTS) {
      assert.ok(
        AGENT_TO_SOURCE[a.slug],
        `activation registry agent '${a.slug}' has no mapped sweep source — ` +
          'add it here AND wire shouldSweepFire into the cron',
      );
    }
  });

  it('every mapped sweep source calls shouldSweepFire (no gate bypass)', () => {
    for (const [slug, file] of Object.entries(AGENT_TO_SOURCE)) {
      const src = readFileSync(resolve(FUNCTIONS_DIR, file), 'utf8');
      assert.match(
        src,
        /shouldSweepFire\(/,
        `${file} (agent '${slug}') does not call shouldSweepFire — gate bypass`,
      );
      // And it must pass the matching activation slug so a copy-paste error
      // (wrong slug → always-dormant or wrong agent) is caught.
      assert.match(
        src,
        new RegExp(`agentSlug:\\s*[A-Z_]+_AGENT_SLUG`),
        `${file} must pass an agentSlug constant to shouldSweepFire`,
      );
    }
  });
});
