/**
 * lib/skills/bounded-execute.workspace.test.ts
 *
 * cv-x1 — proves the per-workspace autonomy policy: one owner's comfort
 * level is never another owner's policy. Pins the documented resolution
 * order (workspace-scoped row → fleet-wide row → default OFF), the
 * lower-only ceiling clamp, the hardcoded allowlist as a floor NO
 * workspace can opt past, fail-closed on scoped read errors, and full
 * backward compatibility for unscoped legacy fleet rows.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  decideBoundedExecute,
  autoExecEnabledFlagName,
  autoExecCeilingFlagName,
  resolveAutoExecEnabled,
  resolveAutoExecCeiling,
  DEFAULT_AUTO_EXEC_CEILING_USD,
  BOUNDED_AUTO_EXECUTE_MASTER_ENV,
  type ComposedGateOutcomes,
} from './bounded-execute';
import { InMemoryOpsFlagStore } from '@/lib/ops/flag-store';
import type { WorkApprovalKind } from '@prisma/client';

function env(vars: Record<string, string>): NodeJS.ProcessEnv {
  return vars as unknown as NodeJS.ProcessEnv;
}
const MASTER_ON = env({ [BOUNDED_AUTO_EXECUTE_MASTER_ENV]: 'on' });

const ALL_GATES_PASS: ComposedGateOutcomes = {
  fireGatePassed: true,
  billingActive: true,
  activationPassed: true,
};

const KIND: WorkApprovalKind = 'ADMIN_BILLING_NOTICE';
const WS = 'ws-cautious-law-firm';
const OTHER_WS = 'ws-aggressive-contractor';

describe('flag name scoping', () => {
  it('scoped names embed the workspace; unscoped names are unchanged (legacy)', () => {
    assert.equal(
      autoExecEnabledFlagName(KIND),
      'AUTO_EXEC_ADMIN_BILLING_NOTICE',
    );
    assert.equal(
      autoExecEnabledFlagName(KIND, 'ws-1'),
      'AUTO_EXEC_ADMIN_BILLING_NOTICE:ws_ws-1',
    );
    assert.equal(
      autoExecCeilingFlagName(KIND, 'ws-1'),
      'AUTO_EXEC_CEILING_ADMIN_BILLING_NOTICE:ws_ws-1',
    );
  });
});

describe('per-workspace enable resolution', () => {
  it('workspace opt-in beats fleet default OFF — and only for THAT workspace', async () => {
    const store = new InMemoryOpsFlagStore({
      [autoExecEnabledFlagName(KIND, WS)]: 'true',
    });
    const mine = await decideBoundedExecute({
      kind: KIND,
      store,
      gates: ALL_GATES_PASS,
      env: MASTER_ON,
      workspaceId: WS,
    });
    assert.equal(mine.autoExecute, true);

    const theirs = await decideBoundedExecute({
      kind: KIND,
      store,
      gates: ALL_GATES_PASS,
      env: MASTER_ON,
      workspaceId: OTHER_WS,
    });
    assert.equal(theirs.autoExecute, false);
    assert.equal(theirs.reason, 'class-not-enabled');
  });

  it('explicit workspace opt-out beats a fleet-wide enable', async () => {
    const store = new InMemoryOpsFlagStore({
      [autoExecEnabledFlagName(KIND)]: 'true', // fleet says ON
      [autoExecEnabledFlagName(KIND, WS)]: 'false', // this owner says NO
    });
    const d = await decideBoundedExecute({
      kind: KIND,
      store,
      gates: ALL_GATES_PASS,
      env: MASTER_ON,
      workspaceId: WS,
    });
    assert.equal(d.autoExecute, false);
    assert.equal(d.reason, 'class-not-enabled');
    assert.match(d.detail, /opted out/);

    // A workspace WITHOUT an opt-out still gets the fleet enable.
    const other = await decideBoundedExecute({
      kind: KIND,
      store,
      gates: ALL_GATES_PASS,
      env: MASTER_ON,
      workspaceId: OTHER_WS,
    });
    assert.equal(other.autoExecute, true);
  });

  it("cleared scoped row ('') means no preference — fleet row decides", async () => {
    const withFleet = new InMemoryOpsFlagStore({
      [autoExecEnabledFlagName(KIND)]: 'true',
      [autoExecEnabledFlagName(KIND, WS)]: '',
    });
    const d1 = await decideBoundedExecute({
      kind: KIND,
      store: withFleet,
      gates: ALL_GATES_PASS,
      env: MASTER_ON,
      workspaceId: WS,
    });
    assert.equal(d1.autoExecute, true);

    const withoutFleet = new InMemoryOpsFlagStore({
      [autoExecEnabledFlagName(KIND, WS)]: '',
    });
    const d2 = await decideBoundedExecute({
      kind: KIND,
      store: withoutFleet,
      gates: ALL_GATES_PASS,
      env: MASTER_ON,
      workspaceId: WS,
    });
    assert.equal(d2.autoExecute, false);
    assert.equal(d2.reason, 'class-not-enabled');
  });

  it('a workspace can NEVER opt into a non-allowlisted kind', async () => {
    const store = new InMemoryOpsFlagStore({
      [autoExecEnabledFlagName('COMPLIANCE_FLAG', WS)]: 'true',
      [autoExecCeilingFlagName('COMPLIANCE_FLAG', WS)]: '10000',
      [autoExecEnabledFlagName('COMPLIANCE_FLAG')]: 'true',
    });
    const d = await decideBoundedExecute({
      kind: 'COMPLIANCE_FLAG',
      store,
      gates: ALL_GATES_PASS,
      env: MASTER_ON,
      workspaceId: WS,
    });
    assert.equal(d.autoExecute, false);
    assert.equal(d.reason, 'kind-not-eligible');
  });

  it('scoped read error fails CLOSED (store-error → PENDING)', async () => {
    const store = new InMemoryOpsFlagStore({
      [autoExecEnabledFlagName(KIND)]: 'true',
    });
    store.failNextRead = true; // first read = the workspace-scoped row
    const d = await decideBoundedExecute({
      kind: KIND,
      store,
      gates: ALL_GATES_PASS,
      env: MASTER_ON,
      workspaceId: WS,
    });
    assert.equal(d.autoExecute, false);
    assert.equal(d.reason, 'store-error');
  });
});

describe('per-workspace ceiling resolution (lower-only)', () => {
  // CHIEF_OF_STAFF_MEETING carries estUsd=2 — useful for clamp proofs.
  const MEETING: WorkApprovalKind = 'CHIEF_OF_STAFF_MEETING';

  it('workspace ceiling LOWER than fleet → workspace ceiling applies', async () => {
    const store = new InMemoryOpsFlagStore({
      [autoExecEnabledFlagName(MEETING, WS)]: 'true',
      [autoExecCeilingFlagName(MEETING)]: '10',
      [autoExecCeilingFlagName(MEETING, WS)]: '1',
    });
    const d = await decideBoundedExecute({
      kind: MEETING,
      store,
      gates: ALL_GATES_PASS,
      env: MASTER_ON,
      workspaceId: WS,
    });
    // estUsd 2 > workspace ceiling 1 → denied, even though fleet is 10.
    assert.equal(d.autoExecute, false);
    assert.equal(d.reason, 'over-ceiling');
    assert.equal(d.ceilingUsd, 1);
  });

  it('workspace ceiling ABOVE fleet clamps DOWN to fleet (lower-only)', async () => {
    const store = new InMemoryOpsFlagStore({
      [autoExecEnabledFlagName(KIND, WS)]: 'true',
      [autoExecCeilingFlagName(KIND)]: '10',
      [autoExecCeilingFlagName(KIND, WS)]: '10000',
    });
    const d = await decideBoundedExecute({
      kind: KIND,
      store,
      gates: ALL_GATES_PASS,
      env: MASTER_ON,
      workspaceId: WS,
    });
    assert.equal(d.autoExecute, true);
    assert.equal(d.ceilingUsd, 10, 'must clamp to the fleet ceiling');
  });

  it('workspace ceiling clamps to the conservative DEFAULT when no fleet row exists', async () => {
    const store = new InMemoryOpsFlagStore({
      [autoExecEnabledFlagName(KIND, WS)]: 'true',
      [autoExecCeilingFlagName(KIND, WS)]: '10000',
    });
    const d = await decideBoundedExecute({
      kind: KIND,
      store,
      gates: ALL_GATES_PASS,
      env: MASTER_ON,
      workspaceId: WS,
    });
    assert.equal(d.autoExecute, true);
    assert.equal(d.ceilingUsd, DEFAULT_AUTO_EXEC_CEILING_USD);
  });

  it('no workspace ceiling row → fleet ceiling applies untouched', async () => {
    const store = new InMemoryOpsFlagStore({
      [autoExecEnabledFlagName(KIND, WS)]: 'true',
      [autoExecCeilingFlagName(KIND)]: '25',
    });
    const d = await decideBoundedExecute({
      kind: KIND,
      store,
      gates: ALL_GATES_PASS,
      env: MASTER_ON,
      workspaceId: WS,
    });
    assert.equal(d.autoExecute, true);
    assert.equal(d.ceilingUsd, 25);
  });
});

describe('backward compatibility — unscoped legacy rows', () => {
  it('no workspaceId arg → exact legacy fleet behavior', async () => {
    const store = new InMemoryOpsFlagStore({
      [autoExecEnabledFlagName(KIND)]: 'true',
      [autoExecCeilingFlagName(KIND)]: '100',
    });
    const d = await decideBoundedExecute({
      kind: KIND,
      store,
      gates: ALL_GATES_PASS,
      env: MASTER_ON,
    });
    assert.equal(d.autoExecute, true);
    assert.equal(d.ceilingUsd, 100);
  });

  it('workspaceId given but only fleet rows exist → fleet rows still work', async () => {
    const store = new InMemoryOpsFlagStore({
      [autoExecEnabledFlagName(KIND)]: 'true',
      [autoExecCeilingFlagName(KIND)]: '100',
    });
    const d = await decideBoundedExecute({
      kind: KIND,
      store,
      gates: ALL_GATES_PASS,
      env: MASTER_ON,
      workspaceId: WS,
    });
    assert.equal(d.autoExecute, true);
    assert.equal(d.ceilingUsd, 100);
  });
});

describe('resolvers (the shared truth the settings page renders)', () => {
  it('resolveAutoExecEnabled reports the deciding scope', async () => {
    const store = new InMemoryOpsFlagStore({
      [autoExecEnabledFlagName(KIND)]: 'true',
      [autoExecEnabledFlagName(KIND, WS)]: 'false',
    });
    const scoped = await resolveAutoExecEnabled(store, KIND, WS);
    assert.ok(scoped.ok);
    assert.deepEqual(scoped.value, { enabled: false, scope: 'workspace' });

    const fleet = await resolveAutoExecEnabled(store, KIND, OTHER_WS);
    assert.ok(fleet.ok);
    assert.deepEqual(fleet.value, { enabled: true, scope: 'fleet' });

    const none = await resolveAutoExecEnabled(
      new InMemoryOpsFlagStore({}),
      KIND,
      WS,
    );
    assert.ok(none.ok);
    assert.deepEqual(none.value, { enabled: false, scope: 'default' });
  });

  it('resolveAutoExecCeiling reports the deciding scope + clamp', async () => {
    const store = new InMemoryOpsFlagStore({
      [autoExecCeilingFlagName(KIND)]: '10',
      [autoExecCeilingFlagName(KIND, WS)]: '3',
    });
    const lowered = await resolveAutoExecCeiling(store, KIND, WS);
    assert.ok(lowered.ok);
    assert.deepEqual(lowered.value, { ceilingUsd: 3, scope: 'workspace' });

    const raised = await resolveAutoExecCeiling(
      new InMemoryOpsFlagStore({
        [autoExecCeilingFlagName(KIND)]: '10',
        [autoExecCeilingFlagName(KIND, WS)]: '999',
      }),
      KIND,
      WS,
    );
    assert.ok(raised.ok);
    assert.deepEqual(raised.value, { ceilingUsd: 10, scope: 'fleet' });
  });
});
