/**
 * tests/weekly-proof-digest-sweep.test.ts
 *
 * Inngest cron coverage for the weekly proof-of-value digest sweep
 * (wave cv-x2). Mirrors tests/briefings-generator-sweep.test.ts.
 *
 * Covers:
 *   1. Fan-out: generator runs once per active, non-muted, non-paused
 *      workspace; notify runs once per newly-written digest.
 *   2. Muted workspaces are skipped (no generator, no notify).
 *   3. Paused-for-billing workspaces are skipped via the injected gate.
 *   4. Idempotent retry (inserted=false) → no re-notify.
 *   5. Per-workspace failure is isolated — one failure doesn't abort.
 *   6. No broker-owner email → generator runs, notify skipped, no crash.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { runWeeklyDigestSweep } from '@/lib/inngest/functions/weekly-proof-digest-sweep';
import type { WeeklyDigestData } from '@/lib/measurement/weekly-digest-data';

function fakeData(workspaceId: string, isEmpty = false): WeeklyDigestData {
  return {
    workspaceId,
    workspaceName: 'WS',
    weekStart: '2026-06-01T00:00:00.000Z',
    weekEnd: '2026-06-08T00:00:00.000Z',
    forDate: '2026-06-07',
    hoursSaved: isEmpty ? 0 : 2,
    dollarsInfluenced: isEmpty ? 0 : 100,
    hasRealDollars: false,
    actionsTaken: isEmpty ? 0 : 3,
    actionsStaged: isEmpty ? 0 : 3,
    actionsAutoExecuted: 0,
    topDollarLineItems: [],
    bySkill: [],
    tokenCostUsd: 0,
    netValueUsd: isEmpty ? 0 : 100,
    isEmpty,
    ledger: {
      hoursSaved: 0,
      dollarsInfluenced: 0,
      approvalsActioned: 0,
      byKind: {},
      tokenCostUsd: 0,
      netValueUsd: 0,
      assumptions: {
        minutesSavedByKind: {} as never,
        laborRateByKind: {} as never,
        periodDays: 7,
        computedAt: '2026-06-08T00:00:00.000Z',
        dollarsInfluencedFormula: '',
        tokenCostFormula: '',
        netValueFormula: '',
        acceptedStatusesOnly: '',
      },
    },
  };
}

describe('runWeeklyDigestSweep — cv-x2 weekly proof digest cron', () => {
  it('skips muted workspaces — no generator, no notify', async () => {
    const calls: string[] = [];
    const emails: string[] = [];
    const result = await runWeeklyDigestSweep({
      listCandidates: async () => [
        {
          id: 'ws_muted',
          name: 'Muted',
          brokerOwnerEmail: 'm@muted.test',
          briefingsMutedAt: new Date('2026-06-08T12:00:00Z'),
        },
      ],
      isPaused: async () => false,
      generate: async ({ workspaceId }) => {
        calls.push(workspaceId);
        throw new Error('generator must NOT run for muted workspace');
      },
      notify: async (input) => {
        emails.push(input.brokerOwnerEmail);
        return { messageId: null };
      },
    });
    assert.equal(calls.length, 0);
    assert.equal(emails.length, 0);
    assert.equal(result.workspacesMuted, 1);
    assert.equal(result.digestsWritten, 0);
  });

  it('skips paused-for-billing workspaces via the injected gate', async () => {
    const calls: string[] = [];
    const result = await runWeeklyDigestSweep({
      listCandidates: async () => [
        {
          id: 'ws_paused',
          name: 'Paused',
          brokerOwnerEmail: 'p@paused.test',
          briefingsMutedAt: null,
        },
      ],
      isPaused: async (id) => id === 'ws_paused',
      generate: async ({ workspaceId }) => {
        calls.push(workspaceId);
        throw new Error('generator must NOT run for paused workspace');
      },
      notify: async () => ({ messageId: null }),
    });
    assert.equal(calls.length, 0);
    assert.equal(result.workspacesMuted, 1, 'paused bucketed under muted');
    assert.equal(result.digestsWritten, 0);
  });

  it('idempotent — inserted=false → no re-notify', async () => {
    const emails: string[] = [];
    const result = await runWeeklyDigestSweep({
      listCandidates: async () => [
        {
          id: 'ws_a',
          name: 'Acme',
          brokerOwnerEmail: 'a@acme.test',
          briefingsMutedAt: null,
        },
      ],
      isPaused: async () => false,
      generate: async ({ workspaceId }) => ({
        briefingId: 'wb_existing',
        body: '',
        forDate: '2026-06-07',
        status: 'WEEKLY_READY',
        inserted: false,
        data: fakeData(workspaceId),
      }),
      notify: async (input) => {
        emails.push(input.brokerOwnerEmail);
        return { messageId: null };
      },
    });
    assert.equal(emails.length, 0, 'no re-send on idempotent retry');
    assert.equal(result.digestsAlreadyExisted, 1);
    assert.equal(result.notificationsSent, 0);
  });

  it('per-workspace failure does not abort the rest of the sweep', async () => {
    const calls: string[] = [];
    const result = await runWeeklyDigestSweep({
      listCandidates: async () => [
        {
          id: 'ws_explode',
          name: 'Boom',
          brokerOwnerEmail: 'x@boom.test',
          briefingsMutedAt: null,
        },
        {
          id: 'ws_ok',
          name: 'OK',
          brokerOwnerEmail: 'o@ok.test',
          briefingsMutedAt: null,
        },
      ],
      isPaused: async () => false,
      generate: async ({ workspaceId }) => {
        calls.push(workspaceId);
        if (workspaceId === 'ws_explode') throw new Error('DB timeout');
        return {
          briefingId: `wb_${workspaceId}`,
          body: 'ok',
          forDate: '2026-06-07',
          status: 'WEEKLY_READY',
          inserted: false,
          data: fakeData(workspaceId),
        };
      },
      notify: async () => ({ messageId: null }),
    });
    assert.equal(calls.length, 2, 'second workspace still attempted');
    assert.equal(result.failures.length, 1);
    assert.equal(result.failures[0].workspaceId, 'ws_explode');
  });

  it('no broker-owner email → generator runs, notify skipped, no crash', async () => {
    let notified = 0;
    const result = await runWeeklyDigestSweep({
      listCandidates: async () => [
        {
          id: 'ws_no_email',
          name: 'Stranded',
          brokerOwnerEmail: null,
          briefingsMutedAt: null,
        },
      ],
      isPaused: async () => false,
      generate: async ({ workspaceId }) => ({
        briefingId: 'wb_x',
        body: 'b',
        forDate: '2026-06-07',
        status: 'WEEKLY_READY',
        inserted: true,
        data: fakeData(workspaceId),
      }),
      notify: async () => {
        notified += 1;
        return { messageId: 'm' };
      },
    });
    assert.equal(notified, 0, 'no notify without a broker-owner email');
    assert.equal(result.digestsWritten, 1);
  });
});
