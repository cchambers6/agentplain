/**
 * lib/skills/bounded-execute.test.ts
 *
 * Wave-3 — proves the bounded-auto-execute seam is default-OFF, fails
 * CLOSED at every branch, never auto-executes a non-allowlisted kind, and
 * honors the $/risk ceiling + composed standing gates. The safety bar:
 * merging this PR must NOT cause any action to auto-execute. These tests
 * pin that invariant.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  decideBoundedExecute,
  boundedExecuteStatusFlip,
  resolveCeilingUsd,
  isAutoExecEligibleKind,
  getAllowlistedClass,
  autoExecEnabledFlagName,
  autoExecCeilingFlagName,
  isBoundedAutoExecuteMasterOn,
  boundedAutoExecuteMasterState,
  shouldSurfaceUnconfiguredMaster,
  AUTO_EXEC_ALLOWLIST,
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
const MASTER_OFF = env({ [BOUNDED_AUTO_EXECUTE_MASTER_ENV]: 'off' });
/** Neither 'on' nor 'off' — the ambiguous config the simulation flagged. */
const MASTER_UNSET = env({});

const ALL_GATES_PASS: ComposedGateOutcomes = {
  fireGatePassed: true,
  billingActive: true,
  activationPassed: true,
};

/** An enabled, eligible class fully primed to auto-execute. */
const KIND: WorkApprovalKind = 'ADMIN_BILLING_NOTICE';
function enabledStore(ceiling?: string): InMemoryOpsFlagStore {
  const seed: Record<string, string> = {
    [autoExecEnabledFlagName(KIND)]: 'true',
  };
  if (ceiling !== undefined) seed[autoExecCeilingFlagName(KIND)] = ceiling;
  return new InMemoryOpsFlagStore(seed);
}

describe('master switch', () => {
  it('defaults OFF (unset env)', () => {
    assert.equal(isBoundedAutoExecuteMasterOn(MASTER_UNSET), false);
    assert.equal(isBoundedAutoExecuteMasterOn(MASTER_OFF), false);
  });
  it('OFF on any value but the literal "on"', () => {
    for (const v of ['', 'off', 'true', '1', 'On', 'ON', 'yes']) {
      assert.equal(
        isBoundedAutoExecuteMasterOn(env({ [BOUNDED_AUTO_EXECUTE_MASTER_ENV]: v })),
        false,
        `value ${v} should be OFF`,
      );
    }
  });
  it('ON only for exactly "on"', () => {
    assert.equal(isBoundedAutoExecuteMasterOn(MASTER_ON), true);
  });

  // mode #3 — the unset/off ambiguity is the fix.
  it('tri-state distinguishes on / off / unset', () => {
    assert.equal(boundedAutoExecuteMasterState(MASTER_ON), 'on');
    assert.equal(boundedAutoExecuteMasterState(MASTER_OFF), 'off');
    assert.equal(boundedAutoExecuteMasterState(MASTER_UNSET), 'unset');
    // Garbage / typos are 'unset', NOT 'off' — we never guess intent.
    assert.equal(
      boundedAutoExecuteMasterState(env({ [BOUNDED_AUTO_EXECUTE_MASTER_ENV]: 'yes' })),
      'unset',
    );
  });
});

describe('reversibility allowlist', () => {
  it('excludes every compliance / security / money-moving kind', () => {
    const banned: WorkApprovalKind[] = [
      'COMPLIANCE_FLAG',
      'COMPLIANCE_DIGEST',
      'ADMIN_SECURITY_ALERT',
      'ADMIN_PASSWORD_RESET',
      'PRICING_RECOMMENDATION',
      'LISTING_RECOMMENDATION',
      'LEAD_TRIAGE',
      'BUYER_INQUIRY_REPLY_DRAFT',
      'PLAINO_INSTRUCTION',
    ];
    for (const k of banned) {
      assert.equal(isAutoExecEligibleKind(k), false, `${k} must NOT be eligible`);
    }
  });
  it('includes the safe, reversible, high-frequency classes', () => {
    const allowed: WorkApprovalKind[] = [
      'ADMIN_BILLING_NOTICE',
      'ADMIN_TRIAL_ENDING',
      'ADMIN_VERIFICATION_CODE',
      'FOLLOW_UP_NUDGE',
      'CHIEF_OF_STAFF_TODO',
      'CHIEF_OF_STAFF_MEETING',
    ];
    for (const k of allowed) {
      assert.equal(isAutoExecEligibleKind(k), true, `${k} should be eligible`);
    }
  });
  it('every allowlist entry carries a non-negative estUsd + reversibility note', () => {
    for (const c of AUTO_EXEC_ALLOWLIST) {
      assert.ok(c.estUsd >= 0, `${c.kind} estUsd >= 0`);
      assert.ok(c.reversibility.length > 0, `${c.kind} has a reversibility note`);
    }
  });
});

describe('decideBoundedExecute — fail-closed branches (no auto-execute)', () => {
  it('master explicit OFF → PENDING (master-off, quiet) even when fully enabled', async () => {
    const d = await decideBoundedExecute({
      kind: KIND,
      store: enabledStore('100'),
      gates: ALL_GATES_PASS,
      env: MASTER_OFF,
    });
    assert.equal(d.autoExecute, false);
    assert.equal(d.reason, 'master-off');
    // A deliberate off is NOT surfaced as a config problem.
    assert.equal(shouldSurfaceUnconfiguredMaster(d), false);
  });

  it('master UNSET + eligible kind → master-unset (LOUD, surfaced to admin)', async () => {
    const d = await decideBoundedExecute({
      kind: KIND,
      store: enabledStore('100'),
      gates: ALL_GATES_PASS,
      env: MASTER_UNSET,
    });
    assert.equal(d.autoExecute, false);
    // mode #3: an unset master that an eligible action hit is surfaced, not
    // silently swallowed as "off by default."
    assert.equal(d.reason, 'master-unset');
    assert.equal(shouldSurfaceUnconfiguredMaster(d), true);
    assert.match(d.detail, /UNSET/);
  });

  it('master UNSET + NON-eligible kind → plain master-off (no false alarm)', async () => {
    const d = await decideBoundedExecute({
      kind: 'COMPLIANCE_FLAG',
      store: new InMemoryOpsFlagStore({}),
      gates: ALL_GATES_PASS,
      env: MASTER_UNSET,
    });
    assert.equal(d.autoExecute, false);
    assert.equal(d.reason, 'master-off');
    assert.equal(shouldSurfaceUnconfiguredMaster(d), false);
  });

  it('billing-sync frozen → billing-dependent kind fails closed (mode #5)', async () => {
    const d = await decideBoundedExecute({
      kind: KIND, // ADMIN_BILLING_NOTICE is billingDependent
      store: enabledStore('100'),
      gates: { ...ALL_GATES_PASS, billingSyncFresh: false },
      env: MASTER_ON,
    });
    assert.equal(d.autoExecute, false);
    assert.equal(d.reason, 'gate-not-passed');
    assert.match(d.detail, /sync is stale\/frozen/);
  });

  it('billing-sync frozen does NOT block a non-billing-dependent kind', async () => {
    const store = new InMemoryOpsFlagStore({
      [autoExecEnabledFlagName('CHIEF_OF_STAFF_TODO')]: 'true',
      [autoExecCeilingFlagName('CHIEF_OF_STAFF_TODO')]: '100',
    });
    const d = await decideBoundedExecute({
      kind: 'CHIEF_OF_STAFF_TODO',
      store,
      gates: { ...ALL_GATES_PASS, billingSyncFresh: false },
      env: MASTER_ON,
    });
    assert.equal(d.autoExecute, true);
  });

  it('non-allowlisted kind → never eligible, even master ON + enabled', async () => {
    const store = new InMemoryOpsFlagStore({
      [autoExecEnabledFlagName('COMPLIANCE_FLAG')]: 'true',
      [autoExecCeilingFlagName('COMPLIANCE_FLAG')]: '10000',
    });
    const d = await decideBoundedExecute({
      kind: 'COMPLIANCE_FLAG',
      store,
      gates: ALL_GATES_PASS,
      env: MASTER_ON,
    });
    assert.equal(d.autoExecute, false);
    assert.equal(d.reason, 'kind-not-eligible');
  });

  it('class not enabled (no OpsFlag row) → PENDING', async () => {
    const d = await decideBoundedExecute({
      kind: KIND,
      store: new InMemoryOpsFlagStore({}),
      gates: ALL_GATES_PASS,
      env: MASTER_ON,
    });
    assert.equal(d.autoExecute, false);
    assert.equal(d.reason, 'class-not-enabled');
  });

  it('store read error → fail CLOSED', async () => {
    const store = enabledStore('100');
    store.failNextRead = true;
    const d = await decideBoundedExecute({
      kind: KIND,
      store,
      gates: ALL_GATES_PASS,
      env: MASTER_ON,
    });
    assert.equal(d.autoExecute, false);
    assert.equal(d.reason, 'store-error');
  });

  it('fire gate not passed → PENDING', async () => {
    const d = await decideBoundedExecute({
      kind: KIND,
      store: enabledStore('100'),
      gates: { ...ALL_GATES_PASS, fireGatePassed: false },
      env: MASTER_ON,
    });
    assert.equal(d.autoExecute, false);
    assert.equal(d.reason, 'gate-not-passed');
  });

  it('billing paused → PENDING', async () => {
    const d = await decideBoundedExecute({
      kind: KIND,
      store: enabledStore('100'),
      gates: { ...ALL_GATES_PASS, billingActive: false },
      env: MASTER_ON,
    });
    assert.equal(d.autoExecute, false);
    assert.equal(d.reason, 'gate-not-passed');
  });

  it('activation gate explicitly false → PENDING', async () => {
    const d = await decideBoundedExecute({
      kind: KIND,
      store: enabledStore('100'),
      gates: { ...ALL_GATES_PASS, activationPassed: false },
      env: MASTER_ON,
    });
    assert.equal(d.autoExecute, false);
    assert.equal(d.reason, 'gate-not-passed');
  });

  it('estimate over the ceiling → PENDING', async () => {
    // CHIEF_OF_STAFF_MEETING has class estUsd=2; a $1 ceiling rejects it.
    const meeting: WorkApprovalKind = 'CHIEF_OF_STAFF_MEETING';
    const store = new InMemoryOpsFlagStore({
      [autoExecEnabledFlagName(meeting)]: 'true',
      [autoExecCeilingFlagName(meeting)]: '1',
    });
    const d = await decideBoundedExecute({
      kind: meeting,
      store,
      gates: ALL_GATES_PASS,
      env: MASTER_ON,
    });
    assert.equal(d.autoExecute, false);
    assert.equal(d.reason, 'over-ceiling');
    assert.equal(d.estUsd, 2);
    assert.equal(d.ceilingUsd, 1);
  });

  it('caller estUsdOverride cannot under-report below the class floor', async () => {
    const meeting: WorkApprovalKind = 'CHIEF_OF_STAFF_MEETING';
    const store = new InMemoryOpsFlagStore({
      [autoExecEnabledFlagName(meeting)]: 'true',
      [autoExecCeilingFlagName(meeting)]: '1',
    });
    const d = await decideBoundedExecute({
      kind: meeting,
      store,
      gates: ALL_GATES_PASS,
      env: MASTER_ON,
      estUsdOverride: 0, // tries to claim $0; floor is $2
    });
    assert.equal(d.estUsd, 2);
    assert.equal(d.autoExecute, false);
    assert.equal(d.reason, 'over-ceiling');
  });
});

describe('decideBoundedExecute — the single allow branch', () => {
  it('all five conditions hold → auto-executed', async () => {
    const d = await decideBoundedExecute({
      kind: KIND,
      store: enabledStore('100'),
      gates: ALL_GATES_PASS,
      env: MASTER_ON,
    });
    assert.equal(d.autoExecute, true);
    assert.equal(d.reason, 'auto-executed');
    assert.equal(d.estUsd, 0);
    assert.equal(d.ceilingUsd, 100);
  });

  it('uses the conservative default ceiling when none configured', async () => {
    const d = await decideBoundedExecute({
      kind: KIND,
      store: enabledStore(), // enabled, no ceiling row
      gates: ALL_GATES_PASS,
      env: MASTER_ON,
    });
    assert.equal(d.autoExecute, true);
    assert.equal(d.ceilingUsd, DEFAULT_AUTO_EXEC_CEILING_USD);
  });
});

describe('resolveCeilingUsd', () => {
  it('missing → default', () => {
    assert.equal(resolveCeilingUsd(null), DEFAULT_AUTO_EXEC_CEILING_USD);
  });
  it('garbage / non-positive → default (never uncapped)', () => {
    for (const v of ['', '   ', 'abc', '0', '-5', 'NaN', 'Infinity']) {
      assert.equal(
        resolveCeilingUsd(v),
        DEFAULT_AUTO_EXEC_CEILING_USD,
        `'${v}' should fall back to default`,
      );
    }
  });
  it('valid positive → parsed', () => {
    assert.equal(resolveCeilingUsd('25'), 25);
    assert.equal(resolveCeilingUsd(' 12.5 '), 12.5);
  });
});

describe('boundedExecuteStatusFlip', () => {
  it('null on a deny decision (caller keeps PENDING)', () => {
    assert.equal(
      boundedExecuteStatusFlip({
        autoExecute: false,
        reason: 'class-not-enabled',
        detail: 'x',
        estUsd: null,
        ceilingUsd: null,
      }),
      null,
    );
  });
  it('AUTO_APPROVED flip on an allow decision, reason names the path', () => {
    const flip = boundedExecuteStatusFlip({
      autoExecute: true,
      reason: 'auto-executed',
      detail: 'because reasons',
      estUsd: 0,
      ceilingUsd: 100,
    });
    assert.ok(flip);
    assert.equal(flip.status, 'AUTO_APPROVED');
    assert.match(flip.decisionReason, /bounded-execute/);
  });
});

describe('flag name helpers', () => {
  it('compose stable, distinct names', () => {
    assert.equal(
      autoExecEnabledFlagName('ADMIN_BILLING_NOTICE'),
      'AUTO_EXEC_ADMIN_BILLING_NOTICE',
    );
    assert.equal(
      autoExecCeilingFlagName('ADMIN_BILLING_NOTICE'),
      'AUTO_EXEC_CEILING_ADMIN_BILLING_NOTICE',
    );
    assert.notEqual(
      autoExecEnabledFlagName('ADMIN_BILLING_NOTICE'),
      autoExecCeilingFlagName('ADMIN_BILLING_NOTICE'),
    );
  });
  it('getAllowlistedClass resolves entries + null for the rest', () => {
    assert.ok(getAllowlistedClass('FOLLOW_UP_NUDGE'));
    assert.equal(getAllowlistedClass('COMPLIANCE_FLAG'), null);
  });
});
