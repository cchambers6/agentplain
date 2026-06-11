/**
 * Tests for the property-management rent-collection chase sweep gating.
 * Pure unit tests — every dependency (candidate lister, per-workspace runner,
 * install check, fire-gate, live-flag) is injected, so no Prisma / Buildium /
 * Inngest is touched.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { Vertical } from '@prisma/client';

import { runRentCollectionChaseSweep } from '../property-management-rent-collection-chase-sweep';

const PM = 'PROPERTY_MANAGEMENT' as Vertical;

function candidate(id: string, over: Partial<{ hasBuildium: boolean; disabledDisciplines: string[] }> = {}) {
  return {
    id,
    vertical: PM,
    hasBuildium: over.hasBuildium ?? true,
    disabledDisciplines: over.disabledDisciplines ?? [],
  };
}

describe('rent-collection sweep — live-flag gate', () => {
  it('no-ops entirely when BUILDIUM_ADAPTER_LIVE is off', async () => {
    let listed = false;
    const out = await runRentCollectionChaseSweep({
      liveFlag: () => false,
      listCandidates: async () => {
        listed = true;
        return [candidate('ws-1')];
      },
    });
    assert.equal(out.skippedFlagOff, true);
    assert.equal(out.workspacesConsidered, 0);
    assert.equal(listed, false, 'must not even list candidates when flag is off');
  });
});

describe('rent-collection sweep — per-workspace gating (flag on)', () => {
  it('runs installed PM workspaces and skips uninstalled ones', async () => {
    const ran: string[] = [];
    const out = await runRentCollectionChaseSweep({
      liveFlag: () => true,
      listCandidates: async () => [candidate('ws-installed'), candidate('ws-uninstalled')],
      isInstalled: async (id) => id === 'ws-installed',
      gateFire: async () => ({ allowed: true }),
      runForWorkspace: async (id) => {
        ran.push(id);
        return { ok: true, draftsWritten: 2 };
      },
    });
    assert.deepEqual(ran, ['ws-installed']);
    assert.equal(out.workspacesConsidered, 2);
    assert.equal(out.workspacesSkippedNotInstalled, 1);
    assert.equal(out.workspacesWithDrafts, 1);
    assert.equal(out.draftsWritten, 2);
  });

  it('skips a workspace with no Buildium credential', async () => {
    const out = await runRentCollectionChaseSweep({
      liveFlag: () => true,
      listCandidates: async () => [candidate('ws-1', { hasBuildium: false })],
      isInstalled: async () => true,
      gateFire: async () => ({ allowed: true }),
      runForWorkspace: async () => ({ ok: true, draftsWritten: 1 }),
    });
    assert.equal(out.workspacesSkippedNotConnected, 1);
    assert.equal(out.draftsWritten, 0);
  });

  it('honors the fire-gate (vacation/schedule window)', async () => {
    const out = await runRentCollectionChaseSweep({
      liveFlag: () => true,
      listCandidates: async () => [candidate('ws-1')],
      isInstalled: async () => true,
      gateFire: async () => ({
        allowed: false,
        reason: 'off-window',
        detail: 'outside the operator schedule window',
      }),
      runForWorkspace: async () => ({ ok: true, draftsWritten: 1 }),
    });
    assert.equal(out.workspacesSkippedFireGate, 1);
    assert.equal(out.draftsWritten, 0);
  });

  it('skips a workspace that disabled the finance discipline', async () => {
    const out = await runRentCollectionChaseSweep({
      liveFlag: () => true,
      listCandidates: async () => [candidate('ws-1', { disabledDisciplines: ['finance'] })],
      isInstalled: async () => true,
      gateFire: async () => ({ allowed: true }),
      runForWorkspace: async () => ({ ok: true, draftsWritten: 1 }),
    });
    assert.equal(out.workspacesSkippedDisciplineDisabled, 1);
    assert.equal(out.draftsWritten, 0);
  });

  it('records a failure without throwing the whole sweep', async () => {
    const out = await runRentCollectionChaseSweep({
      liveFlag: () => true,
      listCandidates: async () => [candidate('ws-ok'), candidate('ws-bad')],
      isInstalled: async () => true,
      gateFire: async () => ({ allowed: true }),
      runForWorkspace: async (id) =>
        id === 'ws-bad'
          ? { ok: false, draftsWritten: 0, reason: 'NOT_CONFIGURED: connect Buildium' }
          : { ok: true, draftsWritten: 1 },
    });
    assert.equal(out.failures.length, 1);
    assert.equal(out.failures[0].workspaceId, 'ws-bad');
    assert.equal(out.workspacesWithDrafts, 1);
  });
});
