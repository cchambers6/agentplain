/**
 * Tests for the connect-time FUB sync scoping (pilot dry-run 2026-07-11,
 * P0-4). The connect route fires the sweep's trigger event with a
 * workspaceId; `onlyWorkspaceId` must scope the run to that workspace so
 * the first triage lands seconds after key-verify, and a cron fire (no
 * workspaceId) still sweeps everything.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { runFubSyncSweep } from '../follow-up-boss-sync-sweep';

const WS_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const WS_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

function twoCandidates() {
  return [WS_A, WS_B].map((id) => ({
    id,
    vertical: 'REAL_ESTATE' as const,
    disabledDisciplines: [],
    hasFubCredential: true,
  }));
}

describe('runFubSyncSweep — onlyWorkspaceId (connect-time scope)', () => {
  it('runs the sweep for exactly the workspace that just connected', async () => {
    const ran: string[] = [];
    const res = await runFubSyncSweep({
      listCandidates: async () => twoCandidates(),
      isInstalled: async () => true,
      runForWorkspace: async (workspaceId) => {
        ran.push(workspaceId);
        return { ok: true, leadsTriaged: 2, notesWritten: 2 };
      },
      onlyWorkspaceId: WS_B,
    });

    assert.deepEqual(ran, [WS_B]);
    assert.equal(res.workspacesConsidered, 1);
    assert.equal(res.workspacesSyncedSuccessfully, 1);
    assert.equal(res.leadsTriaged, 2);
  });

  it('a cron fire (no scope) still sweeps every candidate', async () => {
    const ran: string[] = [];
    const res = await runFubSyncSweep({
      listCandidates: async () => twoCandidates(),
      isInstalled: async () => true,
      runForWorkspace: async (workspaceId) => {
        ran.push(workspaceId);
        return { ok: true, leadsTriaged: 1, notesWritten: 1 };
      },
    });
    assert.deepEqual(ran, [WS_A, WS_B]);
    assert.equal(res.workspacesConsidered, 2);
  });

  it('a scope that matches no candidate runs nothing (key not yet visible)', async () => {
    const ran: string[] = [];
    const res = await runFubSyncSweep({
      listCandidates: async () => twoCandidates(),
      isInstalled: async () => true,
      runForWorkspace: async (workspaceId) => {
        ran.push(workspaceId);
        return { ok: true, leadsTriaged: 0, notesWritten: 0 };
      },
      onlyWorkspaceId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    });
    assert.deepEqual(ran, []);
    assert.equal(res.workspacesConsidered, 0);
  });
});
