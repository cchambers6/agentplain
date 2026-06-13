/**
 * Behavior tests for the weekly-customer-report sweep (DI — no DB, no email).
 *
 *   - Counters tally sent vs each skip reason vs failures.
 *   - A per-workspace throw is captured, not propagated (one bad row never
 *     aborts the run).
 * Smoke:
 *   - Function id + cron schedule are the documented constants (Fri 12:00 UTC).
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  WEEKLY_REPORT_SWEEP_CRON,
  WEEKLY_REPORT_SWEEP_FUNCTION_ID,
  runWeeklyReportSweep,
  weeklyCustomerReportSweepFn,
} from '../weekly-customer-report-sweep';
import type { SendWeeklyReportResult } from '@/lib/reports/weekly-report';

const A = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const B = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const C = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
const D = 'dddddddd-dddd-dddd-dddd-dddddddddddd';
const E = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';

describe('runWeeklyReportSweep', () => {
  it('tallies sent, empty, and each skip reason', async () => {
    const byId: Record<string, SendWeeklyReportResult> = {
      [A]: { workspaceId: A, sent: true, wasEmpty: false },
      [B]: { workspaceId: B, sent: true, wasEmpty: true },
      [C]: { workspaceId: C, sent: false, skipped: 'opted_out' },
      [D]: { workspaceId: D, sent: false, skipped: 'billing_paused' },
      [E]: { workspaceId: E, sent: false, skipped: 'already_sent' },
    };
    const result = await runWeeklyReportSweep({
      listCandidates: async () => [A, B, C, D, E],
      sendForWorkspace: async (id) => byId[id],
    });

    assert.equal(result.workspacesConsidered, 5);
    assert.equal(result.emailsSent, 2);
    assert.equal(result.emptyWeekEmails, 1);
    assert.equal(result.skippedOptedOut, 1);
    assert.equal(result.skippedBillingPaused, 1);
    assert.equal(result.skippedAlreadySent, 1);
    assert.equal(result.failures.length, 0);
  });

  it('captures a per-workspace failure without aborting the sweep', async () => {
    const result = await runWeeklyReportSweep({
      listCandidates: async () => [A, B],
      sendForWorkspace: async (id) => {
        if (id === A) throw new Error('boom');
        return { workspaceId: B, sent: true };
      },
    });
    assert.equal(result.emailsSent, 1);
    assert.equal(result.failures.length, 1);
    assert.equal(result.failures[0].workspaceId, A);
    assert.match(result.failures[0].reason, /boom/);
  });

  it('no-ops cleanly on an empty candidate list', async () => {
    const result = await runWeeklyReportSweep({ listCandidates: async () => [] });
    assert.equal(result.workspacesConsidered, 0);
    assert.equal(result.emailsSent, 0);
  });

  it('exposes the documented id + Friday cron', () => {
    assert.equal(
      WEEKLY_REPORT_SWEEP_FUNCTION_ID,
      'agentplain-weekly-customer-report-sweep',
    );
    assert.equal(WEEKLY_REPORT_SWEEP_CRON, '0 12 * * 5');
    assert.equal(typeof weeklyCustomerReportSweepFn, 'object');
  });
});
