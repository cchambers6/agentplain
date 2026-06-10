/**
 * lib/skills/autonomy-settings.test.ts
 *
 * cv-x1 — proves the owner settings seam round-trips through the SAME
 * resolvers the bounded-execute decision path reads: what an owner
 * saves is exactly what fires (and ONLY for their workspace), the
 * allowlist floor is enforced at write time, and 'inherit' cleanly
 * restores fleet behavior.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  readWorkspaceAutonomySettings,
  writeWorkspaceAutonomySetting,
  preferenceFromStored,
  storedCeilingUsd,
} from './autonomy-settings';
import {
  decideBoundedExecute,
  autoExecEnabledFlagName,
  autoExecCeilingFlagName,
  AUTO_EXEC_ALLOWLIST,
  BOUNDED_AUTO_EXECUTE_MASTER_ENV,
  DEFAULT_AUTO_EXEC_CEILING_USD,
  type ComposedGateOutcomes,
} from './bounded-execute';
import { InMemoryOpsFlagStore } from '@/lib/ops/flag-store';
import type { WorkApprovalKind } from '@prisma/client';

const MASTER_ON = {
  [BOUNDED_AUTO_EXECUTE_MASTER_ENV]: 'on',
} as unknown as NodeJS.ProcessEnv;
const GATES: ComposedGateOutcomes = {
  fireGatePassed: true,
  billingActive: true,
  activationPassed: true,
};
const KIND: WorkApprovalKind = 'FOLLOW_UP_NUDGE';
const WS = 'ws-owner-a';
const OTHER_WS = 'ws-owner-b';

describe('write → decide round-trip (the trust loop)', () => {
  it("owner's opt-in + ceiling governs THEIR workspace only", async () => {
    const store = new InMemoryOpsFlagStore({});
    const w = await writeWorkspaceAutonomySetting({
      store,
      workspaceId: WS,
      kind: KIND,
      preference: 'on',
      ceilingUsd: 3,
      updatedBy: 'user:owner-a',
    });
    assert.ok(w.ok);

    const mine = await decideBoundedExecute({
      kind: KIND,
      store,
      gates: GATES,
      env: MASTER_ON,
      workspaceId: WS,
    });
    assert.equal(mine.autoExecute, true);
    assert.equal(mine.ceilingUsd, 3);

    const theirs = await decideBoundedExecute({
      kind: KIND,
      store,
      gates: GATES,
      env: MASTER_ON,
      workspaceId: OTHER_WS,
    });
    assert.equal(theirs.autoExecute, false, "one owner's comfort must not leak");
    assert.equal(theirs.reason, 'class-not-enabled');
  });

  it("owner's opt-out beats a fleet-wide enable after a save", async () => {
    const store = new InMemoryOpsFlagStore({
      [autoExecEnabledFlagName(KIND)]: 'true',
      [autoExecCeilingFlagName(KIND)]: '100',
    });
    const w = await writeWorkspaceAutonomySetting({
      store,
      workspaceId: WS,
      kind: KIND,
      preference: 'off',
      ceilingUsd: null,
      updatedBy: 'user:owner-a',
    });
    assert.ok(w.ok);

    const d = await decideBoundedExecute({
      kind: KIND,
      store,
      gates: GATES,
      env: MASTER_ON,
      workspaceId: WS,
    });
    assert.equal(d.autoExecute, false);
    assert.equal(d.reason, 'class-not-enabled');
  });

  it("saving 'inherit' restores fleet behavior (cleared rows)", async () => {
    const store = new InMemoryOpsFlagStore({
      [autoExecEnabledFlagName(KIND)]: 'true',
    });
    // Opt out first, then flip back to inherit.
    await writeWorkspaceAutonomySetting({
      store,
      workspaceId: WS,
      kind: KIND,
      preference: 'off',
      ceilingUsd: 2,
      updatedBy: 'user:owner-a',
    });
    await writeWorkspaceAutonomySetting({
      store,
      workspaceId: WS,
      kind: KIND,
      preference: 'inherit',
      ceilingUsd: null,
      updatedBy: 'user:owner-a',
    });
    const d = await decideBoundedExecute({
      kind: KIND,
      store,
      gates: GATES,
      env: MASTER_ON,
      workspaceId: WS,
    });
    assert.equal(d.autoExecute, true, 'fleet enable applies again');
    assert.equal(d.ceilingUsd, DEFAULT_AUTO_EXEC_CEILING_USD);
  });
});

describe('write — safety floor', () => {
  it('refuses any non-allowlisted kind', async () => {
    const store = new InMemoryOpsFlagStore({});
    const w = await writeWorkspaceAutonomySetting({
      store,
      workspaceId: WS,
      kind: 'COMPLIANCE_FLAG',
      preference: 'on',
      ceilingUsd: 10000,
      updatedBy: 'user:owner-a',
    });
    assert.equal(w.ok, false);
    assert.equal(
      store.peek(autoExecEnabledFlagName('COMPLIANCE_FLAG', WS)),
      undefined,
      'no row may be written for a non-allowlisted kind',
    );
  });

  it('refuses a non-positive or non-finite ceiling', async () => {
    const store = new InMemoryOpsFlagStore({});
    for (const bad of [0, -5, Number.NaN, Number.POSITIVE_INFINITY]) {
      const w = await writeWorkspaceAutonomySetting({
        store,
        workspaceId: WS,
        kind: KIND,
        preference: 'on',
        ceilingUsd: bad,
        updatedBy: 'user:owner-a',
      });
      assert.equal(w.ok, false, `ceiling ${bad} must be rejected`);
    }
  });
});

describe('read — the settings panel view', () => {
  it('renders every allowlisted class with inherit defaults on a fresh workspace', async () => {
    const r = await readWorkspaceAutonomySettings({
      store: new InMemoryOpsFlagStore({}),
      workspaceId: WS,
      env: MASTER_ON,
    });
    assert.ok(r.ok);
    assert.equal(r.value.masterOn, true);
    assert.equal(r.value.classes.length, AUTO_EXEC_ALLOWLIST.length);
    for (const c of r.value.classes) {
      assert.equal(c.preference, 'inherit');
      assert.equal(c.workspaceCeilingUsd, null);
      assert.equal(c.effectiveEnabled, false);
      assert.equal(c.effectiveEnabledScope, 'default');
      assert.equal(c.effectiveCeilingUsd, DEFAULT_AUTO_EXEC_CEILING_USD);
      assert.ok(c.reversibility.length > 0, 'plain-English reversibility renders');
    }
  });

  it('reflects a saved preference AND the effective clamped policy', async () => {
    const store = new InMemoryOpsFlagStore({
      [autoExecCeilingFlagName(KIND)]: '10',
    });
    await writeWorkspaceAutonomySetting({
      store,
      workspaceId: WS,
      kind: KIND,
      preference: 'on',
      ceilingUsd: 999, // tries to exceed the fleet's $10
      updatedBy: 'user:owner-a',
    });
    const r = await readWorkspaceAutonomySettings({
      store,
      workspaceId: WS,
      env: MASTER_ON,
    });
    assert.ok(r.ok);
    const c = r.value.classes.find((x) => x.kind === KIND);
    assert.ok(c);
    assert.equal(c.preference, 'on');
    assert.equal(c.workspaceCeilingUsd, 999, 'stored value shown honestly');
    assert.equal(c.effectiveEnabled, true);
    assert.equal(c.effectiveEnabledScope, 'workspace');
    assert.equal(c.effectiveCeilingUsd, 10, 'effective is the CLAMPED value');
    assert.equal(c.effectiveCeilingScope, 'fleet');
  });

  it('surfaces a store failure instead of guessing', async () => {
    const store = new InMemoryOpsFlagStore({});
    store.failNextRead = true;
    const r = await readWorkspaceAutonomySettings({
      store,
      workspaceId: WS,
      env: MASTER_ON,
    });
    assert.equal(r.ok, false);
  });
});

describe('stored-value mappers', () => {
  it('preferenceFromStored mirrors the resolver semantics', () => {
    assert.equal(preferenceFromStored(null), 'inherit');
    assert.equal(preferenceFromStored(''), 'inherit');
    assert.equal(preferenceFromStored('true'), 'on');
    assert.equal(preferenceFromStored('false'), 'off');
    assert.equal(preferenceFromStored('garbage'), 'off');
  });
  it('storedCeilingUsd parses display values conservatively', () => {
    assert.equal(storedCeilingUsd(null), null);
    assert.equal(storedCeilingUsd(''), null);
    assert.equal(storedCeilingUsd(' 12.5 '), 12.5);
    assert.equal(storedCeilingUsd('-3'), null);
    assert.equal(storedCeilingUsd('abc'), null);
  });
});
