/**
 * Tests for the Day-7 guarantee evaluation sweep.
 *
 * Synthetic time-travel: candidates carry an `ageDays`, and a per-workspace
 * minutes map stands in for the ledger, so we can assert the routing
 * (clears the bar → recorded; under the bar → walk-away offered + emailed)
 * and the once-per-lifetime guard without a database or a real clock.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { TestEmailProvider } from '@/lib/email/test-provider';
import { InMemoryOpsFlagStore } from '@/lib/ops/flag-store';
import type { SystemContextRunner } from '@/lib/billing/provisioning';
import {
  runGuaranteeEvaluate,
  evaluatedGuardFlagName,
  walkAwayOfferedFlagName,
  type GuaranteeCandidate,
} from './guarantee-evaluate';

const MET = '11111111-1111-1111-1111-111111111111';
const UNDER = '22222222-2222-2222-2222-222222222222';

/** A system-context runner whose ledger delegate returns canned totals per
 *  workspace (keyed off the `where.workspaceId`). */
function fakeLedgerContext(minutesByWorkspace: Record<string, number>): SystemContextRunner {
  const tx = {
    timeSavingsEntry: {
      aggregate: async (args: { where: { workspaceId: string } }) => {
        const total = minutesByWorkspace[args.where.workspaceId] ?? 0;
        return { _sum: { minutesSaved: total }, _count: { _all: total > 0 ? 1 : 0 } };
      },
      groupBy: async () => [],
    },
    auditLog: { create: async () => ({ id: 'audit' }) },
  };
  return async (cb) => cb(tx as never);
}

function candidate(over: Partial<GuaranteeCandidate>): GuaranteeCandidate {
  return {
    workspaceId: MET,
    workspaceName: 'Acme',
    brokerOwnerEmail: 'owner@acme.example',
    ageDays: 7,
    ...over,
  };
}

describe('runGuaranteeEvaluate', () => {
  it('records met-bar, offers walk-away under bar, and emails only the latter', async () => {
    const flagStore = new InMemoryOpsFlagStore();
    const email = new TestEmailProvider();
    const out = await runGuaranteeEvaluate({
      listCandidates: async () => [
        candidate({ workspaceId: MET, workspaceName: 'Met Co' }),
        candidate({
          workspaceId: UNDER,
          workspaceName: 'Under Co',
          brokerOwnerEmail: 'under@acme.example',
        }),
      ],
      systemContext: fakeLedgerContext({ [MET]: 360, [UNDER]: 60 }),
      flagStore,
      email,
      barMinutes: 300,
      evaluationDays: 7,
      now: new Date('2026-06-17T11:00:00Z'),
    });

    assert.equal(out.workspacesConsidered, 2);
    assert.equal(out.metBar, 1);
    assert.equal(out.walkAwayOffered, 1);
    assert.equal(out.failures.length, 0);

    // Both are marked evaluated (once-per-lifetime guard).
    const metGuard = await flagStore.get(evaluatedGuardFlagName(MET));
    const underGuard = await flagStore.get(evaluatedGuardFlagName(UNDER));
    assert.ok(metGuard.ok && metGuard.value !== null);
    assert.ok(underGuard.ok && underGuard.value !== null);

    // Only the under-bar workspace got the offer flag + an email.
    const offered = await flagStore.get(walkAwayOfferedFlagName(UNDER));
    assert.ok(offered.ok && offered.value !== null, 'walk-away offered flag set');
    const metOffered = await flagStore.get(walkAwayOfferedFlagName(MET));
    assert.ok(metOffered.ok && metOffered.value === null, 'no offer for met-bar');
  });

  it('skips workspaces already evaluated (idempotent)', async () => {
    const flagStore = new InMemoryOpsFlagStore();
    await flagStore.set(evaluatedGuardFlagName(UNDER), 'evaluated', {
      updatedBy: 'test',
    });
    const out = await runGuaranteeEvaluate({
      listCandidates: async () => [
        candidate({ workspaceId: UNDER, brokerOwnerEmail: 'under@acme.example' }),
      ],
      systemContext: fakeLedgerContext({ [UNDER]: 60 }),
      flagStore,
      email: new TestEmailProvider(),
      barMinutes: 300,
      evaluationDays: 7,
      now: new Date('2026-06-17T11:00:00Z'),
    });
    assert.equal(out.alreadyEvaluated, 1);
    assert.equal(out.walkAwayOffered, 0);
  });
});
