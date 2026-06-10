/**
 * lib/skills/home-services-estimate-followup/estimate-followup-qb.test.ts
 *
 * Integration tests: QuickbooksEstimateLookup → runSkill → approval sink.
 *
 * Verifies the full value path from a QB Pending estimate through the
 * follow-up stage classifier, draft renderer, and approval staging —
 * without any network or DB calls.
 *
 * Uses:
 *   - TestQuickbooksMcpServer (fixture-backed QB server)
 *   - QuickbooksEstimateLookup (adapter under test)
 *   - runSkill (the skill under test)
 *   - RecordingEstimateApprovalSink (in-memory approval sink)
 *
 * Fixture QB data (from test-server.ts):
 *   EST-401: $6,200 roofing, txnDate 2026-05-20 → at NOW=2026-05-24, 4 days old → soft-nudge
 *   EST-402: $3,800 HVAC,    txnDate 2026-05-16 → at NOW=2026-05-24, 8 days old → check-in
 *   EST-403: $950  plumbing, Accepted           → filtered out by QB adapter
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { TestQuickbooksMcpServer } from '../../integrations/quickbooks-mcp/test-server';
import { QuickbooksEstimateLookup } from '../../integrations/quickbooks-mcp/estimate-lookup';
import { runSkill } from './skill';
import { RecordingEstimateApprovalSink } from './approval-sink';

const WORKSPACE_ID = 'ws-homesvc-qb-e2e-01';
// "Now" is 2026-05-24 — EST-401 is 4 days old (soft-nudge), EST-402 is 8 days old (check-in).
const NOW = new Date('2026-05-24T15:00:00Z');

const REP = { name: 'Sam Cooper', email: 'sam@shop.example', phone: null };

function buildLookup() {
  return new QuickbooksEstimateLookup({
    serverFactory: (args) => new TestQuickbooksMcpServer(args),
    rep: REP,
  });
}

describe('estimate-followup + QuickBooks adapter (e2e, no network)', () => {
  it('produces one draft per Pending estimate, filtered by stage', async () => {
    const sink = new RecordingEstimateApprovalSink();
    const res = await runSkill({
      workspaceId: WORKSPACE_ID,
      lookup: buildLookup(),
      sink,
      now: NOW,
    });
    assert.ok(res.ok, `skill failed: ${!res.ok ? res.error.message : ''}`);
    if (!res.ok) return;
    // 2 Pending estimates (Accepted one filtered) → 2 drafts
    assert.equal(res.value.drafts.length, 2);
    // Both staged as approvals
    assert.equal(sink.calls.length, 2);
  });

  it('EST-401 (4 days old) renders as soft-nudge', async () => {
    const res = await runSkill({
      workspaceId: WORKSPACE_ID,
      lookup: buildLookup(),
      now: NOW,
    });
    assert.ok(res.ok);
    if (!res.ok) return;
    const d = res.value.drafts.find((x) => x.estimateId === 'EST-401');
    assert.ok(d, 'draft for EST-401 not found');
    assert.equal(d?.stage, 'soft-nudge');
    assert.match(d?.subject ?? '', /Quick check-in/);
  });

  it('EST-402 (8 days old) renders as check-in', async () => {
    const res = await runSkill({
      workspaceId: WORKSPACE_ID,
      lookup: buildLookup(),
      now: NOW,
    });
    assert.ok(res.ok);
    if (!res.ok) return;
    const d = res.value.drafts.find((x) => x.estimateId === 'EST-402');
    assert.ok(d, 'draft for EST-402 not found');
    assert.equal(d?.stage, 'check-in');
  });

  it('estimate dollar amounts flow through to draft.estimateAmountUsd', async () => {
    const res = await runSkill({
      workspaceId: WORKSPACE_ID,
      lookup: buildLookup(),
      now: NOW,
    });
    assert.ok(res.ok);
    if (!res.ok) return;
    const est401Draft = res.value.drafts.find((d) => d.estimateId === 'EST-401');
    const est402Draft = res.value.drafts.find((d) => d.estimateId === 'EST-402');
    assert.equal(est401Draft?.estimateAmountUsd, 6200, 'EST-401 carries $6,200');
    assert.equal(est402Draft?.estimateAmountUsd, 3800, 'EST-402 carries $3,800');
  });

  it('approval sink receives estimateAmountUsd for the value ledger', async () => {
    const sink = new RecordingEstimateApprovalSink();
    const res = await runSkill({
      workspaceId: WORKSPACE_ID,
      lookup: buildLookup(),
      sink,
      now: NOW,
    });
    assert.ok(res.ok);
    if (!res.ok) return;
    // Both sink calls carry the estimate dollar amount
    const amounts = sink.calls
      .map((c) => c.approval.draft.estimateAmountUsd)
      .sort((a, b) => a - b);
    assert.deepEqual(amounts, [3800, 6200]);
  });

  it('stage counts reflect two Pending estimates', async () => {
    const res = await runSkill({
      workspaceId: WORKSPACE_ID,
      lookup: buildLookup(),
      now: NOW,
    });
    assert.ok(res.ok);
    if (!res.ok) return;
    assert.equal(res.value.stageCounts['soft-nudge'], 1);
    assert.equal(res.value.stageCounts['check-in'], 1);
    // No fresh, last-call, or cold at this fixture date/time
    assert.equal(res.value.stageCounts.fresh, 0);
    assert.equal(res.value.stageCounts['last-call'], 0);
    assert.equal(res.value.stageCounts.cold, 0);
  });

  it('drafts never quote a dollar amount (defers to operator merge field)', async () => {
    const res = await runSkill({
      workspaceId: WORKSPACE_ID,
      lookup: buildLookup(),
      now: NOW,
    });
    assert.ok(res.ok);
    if (!res.ok) return;
    for (const d of res.value.drafts) {
      // Body must NOT contain a bare dollar sign followed by digits
      assert.doesNotMatch(d.body, /\$\d/,
        `Draft ${d.estimateId} contains a dollar amount — must defer to {{operator}} merge field`);
    }
  });

  it('no cold handoff needed (both estimates are actionable)', async () => {
    const res = await runSkill({
      workspaceId: WORKSPACE_ID,
      lookup: buildLookup(),
      now: NOW,
    });
    assert.ok(res.ok);
    if (!res.ok) return;
    assert.equal(res.value.coldHandoff.needed, false);
  });
});
