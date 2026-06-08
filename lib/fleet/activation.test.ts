/**
 * lib/fleet/activation.test.ts
 *
 * Wave-7 — proves the agent-activation seam is default-OFF and fail-CLOSED.
 * The safety bar: merging this PR must NOT cause any dormant agent to start
 * firing. These tests pin that invariant at the unit level.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  isAgentActivated,
  setAgentActivation,
  isFleetActivationMasterOn,
  agentActivationFlagName,
  getActivatableAgent,
  ACTIVATABLE_AGENTS,
  FLEET_ACTIVATION_MASTER_ENV,
} from './activation';
import { InMemoryOpsFlagStore } from '@/lib/ops/flag-store';

function env(vars: Record<string, string>): NodeJS.ProcessEnv {
  return vars as unknown as NodeJS.ProcessEnv;
}
const MASTER_ON = env({ [FLEET_ACTIVATION_MASTER_ENV]: 'on' });
const MASTER_OFF = env({});
const SLUG = 'finance-pulse';

describe('agentActivationFlagName', () => {
  it('normalizes dashes → underscores + upper-case with the AGENT_ACTIVE_ prefix', () => {
    assert.equal(
      agentActivationFlagName('analytics-weekly-pulse'),
      'AGENT_ACTIVE_ANALYTICS_WEEKLY_PULSE',
    );
  });
  it('throws on an empty slug', () => {
    assert.throws(() => agentActivationFlagName(''));
  });
});

describe('isFleetActivationMasterOn', () => {
  it('is OFF by default (unset env)', () => {
    assert.equal(isFleetActivationMasterOn(MASTER_OFF), false);
  });
  it('is OFF for any value other than the literal "on" (fail-safe direction)', () => {
    for (const v of ['', 'off', 'true', '1', 'On', 'ON', 'yes']) {
      assert.equal(
        isFleetActivationMasterOn(env({ [FLEET_ACTIVATION_MASTER_ENV]: v })),
        false,
        `expected OFF for value '${v}'`,
      );
    }
  });
  it('is ON only for the literal "on"', () => {
    assert.equal(isFleetActivationMasterOn(MASTER_ON), true);
  });
});

describe('isAgentActivated — default-OFF / fail-CLOSED', () => {
  it('(a) DEFAULT = dormant: master OFF → not active even if the agent flag is set', async () => {
    const store = new InMemoryOpsFlagStore({
      [agentActivationFlagName(SLUG)]: 'true',
    });
    const res = await isAgentActivated({ slug: SLUG, store, env: MASTER_OFF });
    assert.equal(res.active, false);
    assert.equal(res.reason, 'master-off');
  });

  it('master ON but agent flag absent → dormant (agent-not-activated)', async () => {
    const store = new InMemoryOpsFlagStore();
    const res = await isAgentActivated({ slug: SLUG, store, env: MASTER_ON });
    assert.equal(res.active, false);
    assert.equal(res.reason, 'agent-not-activated');
  });

  it('master ON but agent flag is "false" → dormant', async () => {
    const store = new InMemoryOpsFlagStore({
      [agentActivationFlagName(SLUG)]: 'false',
    });
    const res = await isAgentActivated({ slug: SLUG, store, env: MASTER_ON });
    assert.equal(res.active, false);
    assert.equal(res.reason, 'agent-not-activated');
  });

  it('(b) ON path: master ON + agent flag "true" → active', async () => {
    const store = new InMemoryOpsFlagStore({
      [agentActivationFlagName(SLUG)]: 'true',
    });
    const res = await isAgentActivated({ slug: SLUG, store, env: MASTER_ON });
    assert.equal(res.active, true);
    assert.equal(res.reason, 'active');
  });

  it('unknown slug → dormant (never invents activation)', async () => {
    const store = new InMemoryOpsFlagStore();
    const res = await isAgentActivated({
      slug: 'does-not-exist',
      store,
      env: MASTER_ON,
    });
    assert.equal(res.active, false);
    assert.equal(res.reason, 'unknown-agent');
  });

  it('store read error → dormant (fails CLOSED, opposite of gateSkillFire)', async () => {
    const store = new InMemoryOpsFlagStore({
      [agentActivationFlagName(SLUG)]: 'true',
    });
    store.failNextRead = true;
    const res = await isAgentActivated({ slug: SLUG, store, env: MASTER_ON });
    assert.equal(res.active, false);
    assert.equal(res.reason, 'store-error');
  });
});

describe('setAgentActivation', () => {
  it('writes the flag so a subsequent isAgentActivated returns active (with master ON)', async () => {
    const store = new InMemoryOpsFlagStore();
    const set = await setAgentActivation({ slug: SLUG, active: true, store });
    assert.equal(set.active, true);
    const check = await isAgentActivated({ slug: SLUG, store, env: MASTER_ON });
    assert.equal(check.active, true);
  });

  it('deactivation flips the flag back to dormant', async () => {
    const store = new InMemoryOpsFlagStore({
      [agentActivationFlagName(SLUG)]: 'true',
    });
    await setAgentActivation({ slug: SLUG, active: false, store });
    const check = await isAgentActivated({ slug: SLUG, store, env: MASTER_ON });
    assert.equal(check.active, false);
  });
});

describe('ACTIVATABLE_AGENTS registry invariants', () => {
  it('every activatable agent has firePathGated=true (gate of record for going live)', () => {
    for (const a of ACTIVATABLE_AGENTS) {
      assert.equal(
        a.firePathGated,
        true,
        `${a.slug} must call gateSkillFire before it can be activation-ready`,
      );
    }
  });
  it('slugs are unique', () => {
    const slugs = ACTIVATABLE_AGENTS.map((a) => a.slug);
    assert.equal(new Set(slugs).size, slugs.length);
  });
  it('getActivatableAgent resolves every registered slug and null otherwise', () => {
    for (const a of ACTIVATABLE_AGENTS) {
      assert.equal(getActivatableAgent(a.slug)?.slug, a.slug);
    }
    assert.equal(getActivatableAgent('nope'), null);
  });
});
