/**
 * Tests for the Day-7 walk-away executor — the money + deletion path.
 *
 * The bar: a one-tap walk-away must (1) refund within cap, (2) delete the
 * customer's data, (3) close the workspace, (4) never double-act, and
 * (5) when a refund can't auto-complete, still honor the deletion AND page
 * a human — never silently under-deliver.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { TestBillingProvider } from '../billing/test-provider';
import { TestEmailProvider } from '../email/test-provider';
import { InMemoryOpsFlagStore } from '../ops/flag-store';
import type { SystemContextRunner } from '../billing/provisioning';
import {
  executeWalkAway,
  walkAwayGuardFlagName,
  type ExecuteWalkAwayArgs,
} from './walk-away';
import type { DeleteCustomerDataResult } from './delete-customer-data';

const WS = '11111111-1111-1111-1111-111111111111';
const CUS = 'cus_test_walkaway';

function fakeSystemContext() {
  const audits: Array<{ action: string; payload: unknown }> = [];
  const tx = {
    workspace: {
      findUnique: async () => ({
        id: WS,
        name: 'Acme Realty',
        stripeCustomerId: CUS,
        memberships: [{ user: { email: 'owner@acme.example', name: 'Pat Owner' } }],
      }),
    },
    auditLog: {
      create: async (args: { data: { action: string; payload: unknown } }) => {
        audits.push({ action: args.data.action, payload: args.data.payload });
        return { id: 'audit' };
      },
    },
  };
  const run: SystemContextRunner = async (cb) => cb(tx as never);
  return { run, audits };
}

function fakeTeardown(): DeleteCustomerDataResult {
  return {
    workspaceId: WS,
    teardown: { customerEmbeddingsDeleted: 0 } as DeleteCustomerDataResult['teardown'],
    closedAt: new Date(),
  };
}

function baseArgs(over: Partial<ExecuteWalkAwayArgs> = {}): ExecuteWalkAwayArgs {
  const sys = fakeSystemContext();
  const flagStore = new InMemoryOpsFlagStore();
  const email = new TestEmailProvider();
  let deleteCalls = 0;
  const deleteData = async () => {
    deleteCalls += 1;
    return fakeTeardown();
  };
  // Stash test handles on the returned object for assertions.
  const args: ExecuteWalkAwayArgs & {
    _sys: typeof sys;
    _flagStore: InMemoryOpsFlagStore;
    _email: TestEmailProvider;
    _deleteCalls: () => number;
  } = {
    workspaceId: WS,
    systemContext: sys.run,
    notifyDeps: { flagStore, email },
    email,
    deleteData,
    refundEnabled: true,
    billingEnabled: true,
    refundCapUsd: 500,
    now: new Date('2026-06-17T12:00:00Z'),
    _sys: sys,
    _flagStore: flagStore,
    _email: email,
    _deleteCalls: () => deleteCalls,
    ...over,
  };
  return args;
}

describe('executeWalkAway — happy path (refund within cap)', () => {
  it('refunds, deletes data, closes, and guards against re-run', async () => {
    const billing = new TestBillingProvider();
    billing.seedCharge(CUS, 9900);
    const args = baseArgs({ billing }) as ReturnType<typeof baseArgs> & {
      _flagStore: InMemoryOpsFlagStore;
      _deleteCalls: () => number;
    };

    const result = await executeWalkAway(args);
    assert.equal(result.status, 'completed');
    assert.equal(result.refundedUsdCents, 9900);
    assert.equal(args._deleteCalls(), 1, 'data deleted exactly once');

    const guard = await args._flagStore.get(walkAwayGuardFlagName(WS));
    assert.ok(guard.ok && guard.value !== null, 'guard flag set');

    // Second tap is a clean no-op.
    const again = await executeWalkAway(args);
    assert.equal(again.status, 'already-done');
    assert.equal(again.refundedUsdCents, 0);
    assert.equal(args._deleteCalls(), 1, 'no second deletion');
  });
});

describe('executeWalkAway — refund paused by policy', () => {
  it('still deletes + closes, and pages a human for the refund', async () => {
    const billing = new TestBillingProvider();
    billing.seedCharge(CUS, 9900);
    const args = baseArgs({ billing, refundEnabled: false }) as ReturnType<
      typeof baseArgs
    > & { _flagStore: InMemoryOpsFlagStore; _deleteCalls: () => number };

    const result = await executeWalkAway(args);
    assert.equal(result.status, 'completed-refund-paged');
    assert.equal(result.refundedUsdCents, 0);
    assert.equal(args._deleteCalls(), 1, 'deletion still honored');
    assert.equal(billing.refundCalls.length, 0, 'no money moved while paused');

    // A human page was written as a durable flag (HUMAN_PAGE_<key>).
    const page = await args._flagStore.get(`HUMAN_PAGE_guarantee-walkaway:${WS}`);
    assert.ok(page.ok && page.value !== null, 'human paged for manual refund');
  });
});

describe('executeWalkAway — billing disabled (dev/test)', () => {
  it('deletes + closes without attempting a refund or paging', async () => {
    const billing = new TestBillingProvider();
    billing.seedCharge(CUS, 9900);
    const args = baseArgs({ billing, billingEnabled: false }) as ReturnType<
      typeof baseArgs
    > & { _deleteCalls: () => number };

    const result = await executeWalkAway(args);
    assert.equal(result.status, 'completed');
    assert.equal(result.refundedUsdCents, 0);
    assert.equal(billing.refundCalls.length, 0);
    assert.equal(args._deleteCalls(), 1);
  });
});
