/**
 * lib/skills/invoice-chase-general/skill.test.ts
 *
 * Tests for the general-vertical QuickBooks AR invoice-chase skill.
 *
 * Covers:
 *   - Happy-path: overdue invoices produce correctly-tiered chase drafts.
 *   - Tier escalation: gentle <15d, firm 15-45d, final 45d+.
 *   - Template determinism: drafts work without an LLM (ANTHROPIC_API_KEY
 *     paused / absent — pure template path).
 *   - Approval sink wiring: each draft above the threshold calls sink.record.
 *   - NOT_CONFIGURED propagation: fetcher error bubbles to SkillResult.
 *   - Per-run cap: maxDraftsPerRun limits staged items.
 *   - Value-impact field: draft carries balanceUsd for ROI tracking.
 *   - Zero overdue: clean success with empty drafts array.
 *   - Customer without email: customerEmail can be null (no crash).
 *
 * Per `feedback_runner_portability.md`: no vendor SDK in tests — inline
 * fixture fetcher + recording sink only.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { runSkill } from './skill';
import { chaseEscalationTier, AR_AGING_THRESHOLDS } from './types';
import type {
  ArAgingFetcher,
  ArInvoiceRecord,
  InvoiceChaseApprovalSink,
  InvoiceChaseDraft,
} from './types';
import { skillError, skillOk, type SkillResult } from '../types';

// ── Fixed clock ───────────────────────────────────────────────────────────────

const NOW = new Date('2026-06-09T06:00:00Z');
const WS = 'ws-test-invoice-chase-0001';

// ── Fixture helpers ───────────────────────────────────────────────────────────

function overdueDays(n: number): ArInvoiceRecord {
  const due = new Date(NOW.getTime() - n * 86_400_000);
  const dueDate = due.toISOString().slice(0, 10);
  const tier = chaseEscalationTier(n);
  return {
    invoiceId: `inv-${n}`,
    docNumber: `${1000 + n}`,
    customerId: `cust-${n}`,
    customerName: `ACME Corp ${n}`,
    customerEmail: `ar${n}@acme.example.com`,
    totalAmountUsd: n * 100,
    balanceUsd: n * 100,
    txnDate: '2026-01-01',
    dueDate,
    daysOverdue: n,
    tier,
  };
}

// ── Inline fixture fetcher ────────────────────────────────────────────────────

class FixtureArFetcher implements ArAgingFetcher {
  readonly name = 'fixture' as const;
  constructor(
    private readonly invoices: ArInvoiceRecord[],
    private readonly error?: ReturnType<typeof skillError>,
  ) {}
  async fetchOverdueInvoices(): Promise<SkillResult<ArInvoiceRecord[]>> {
    if (this.error) return this.error;
    return skillOk(this.invoices);
  }
}

// ── Recording sink ────────────────────────────────────────────────────────────

class RecordingSink implements InvoiceChaseApprovalSink {
  readonly name = 'recording' as const;
  readonly recorded: Array<{ workspaceId: string; draft: InvoiceChaseDraft }> = [];
  async record(args: {
    workspaceId: string;
    draft: InvoiceChaseDraft;
  }): Promise<SkillResult<{ sinkId: string }>> {
    this.recorded.push({ workspaceId: args.workspaceId, draft: args.draft });
    return skillOk({ sinkId: `sink-${args.draft.draftId}` });
  }
}

// ── Tier bucketing ────────────────────────────────────────────────────────────

describe('chaseEscalationTier — bucketing thresholds', () => {
  it('returns gentle for 0 days overdue', () => {
    assert.equal(chaseEscalationTier(0), 'gentle');
  });
  it('returns gentle at the gentleMaxDays boundary (14)', () => {
    assert.equal(
      chaseEscalationTier(AR_AGING_THRESHOLDS.gentleMaxDays),
      'gentle',
    );
  });
  it('returns firm at 15 days (one past gentleMax)', () => {
    assert.equal(chaseEscalationTier(15), 'firm');
  });
  it('returns firm at the firmMaxDays boundary (45)', () => {
    assert.equal(
      chaseEscalationTier(AR_AGING_THRESHOLDS.firmMaxDays),
      'firm',
    );
  });
  it('returns final at 46 days (one past firmMax)', () => {
    assert.equal(chaseEscalationTier(46), 'final');
  });
  it('respects custom thresholds', () => {
    assert.equal(
      chaseEscalationTier(5, { gentleMaxDays: 3, firmMaxDays: 10 }),
      'firm',
    );
  });
});

// ── Happy path: three-tier output ────────────────────────────────────────────

describe('runSkill — happy path', () => {
  it('returns one draft per tier for three overdue invoices', async () => {
    const invoices = [
      overdueDays(5),  // gentle
      overdueDays(20), // firm
      overdueDays(60), // final
    ];
    const sink = new RecordingSink();
    const result = await runSkill({
      workspaceId: WS,
      fetcher: new FixtureArFetcher(invoices),
      sink,
      now: NOW,
    });
    assert.ok(result.ok, `skill failed: ${!result.ok ? result.error.message : ''}`);
    const out = result.value;
    assert.equal(out.invoicesConsidered, 3);
    assert.equal(out.drafts.length, 3);
    assert.equal(out.draftsStaged, 3);

    const tiers = out.drafts.map((d) => d.tier).sort();
    assert.deepEqual(tiers, ['final', 'firm', 'gentle']);
  });

  it('embeds balanceUsd in each draft (value-impact field)', async () => {
    const inv = overdueDays(10);
    inv.balanceUsd = 3450.0;
    const sink = new RecordingSink();
    const result = await runSkill({
      workspaceId: WS,
      fetcher: new FixtureArFetcher([inv]),
      sink,
      now: NOW,
    });
    assert.ok(result.ok);
    assert.equal(result.value.drafts[0]!.balanceUsd, 3450.0);
    assert.equal(sink.recorded[0]!.draft.balanceUsd, 3450.0);
  });

  it('sums totalBalanceUsd across all staged drafts', async () => {
    const invoices = [overdueDays(5), overdueDays(20)];
    invoices[0]!.balanceUsd = 1000;
    invoices[1]!.balanceUsd = 2500;
    const result = await runSkill({
      workspaceId: WS,
      fetcher: new FixtureArFetcher(invoices),
      sink: new RecordingSink(),
      now: NOW,
    });
    assert.ok(result.ok);
    assert.equal(result.value.totalBalanceUsd, 3500);
  });
});

// ── Template determinism (no LLM) ────────────────────────────────────────────

describe('runSkill — template path (no LLM)', () => {
  it('gentle draft body contains "circle back"', async () => {
    const result = await runSkill({
      workspaceId: WS,
      fetcher: new FixtureArFetcher([overdueDays(7)]),
      now: NOW,
    });
    assert.ok(result.ok);
    const body = result.value.drafts[0]!.body;
    assert.match(body, /circle back/i);
  });

  it('firm draft body contains "following up"', async () => {
    const result = await runSkill({
      workspaceId: WS,
      fetcher: new FixtureArFetcher([overdueDays(25)]),
      now: NOW,
    });
    assert.ok(result.ok);
    const body = result.value.drafts[0]!.body;
    assert.match(body, /following up/i);
  });

  it('final draft body contains "action required" subject', async () => {
    const result = await runSkill({
      workspaceId: WS,
      fetcher: new FixtureArFetcher([overdueDays(60)]),
      now: NOW,
    });
    assert.ok(result.ok);
    const subject = result.value.drafts[0]!.subject;
    assert.match(subject, /action required/i);
  });

  it('every draft body contains {{operator:}} merge fields', async () => {
    for (const days of [5, 20, 60]) {
      const result = await runSkill({
        workspaceId: WS,
        fetcher: new FixtureArFetcher([overdueDays(days)]),
        now: NOW,
      });
      assert.ok(result.ok);
      const body = result.value.drafts[0]!.body;
      assert.match(
        body,
        /\{\{operator:/,
        `draft for ${days}d overdue should have operator merge fields`,
      );
    }
  });

  it('draft subject includes the doc number', async () => {
    const inv = overdueDays(10);
    inv.docNumber = '9876';
    const result = await runSkill({
      workspaceId: WS,
      fetcher: new FixtureArFetcher([inv]),
      now: NOW,
    });
    assert.ok(result.ok);
    assert.match(result.value.drafts[0]!.subject, /9876/);
  });
});

// ── Confidence ladder ─────────────────────────────────────────────────────────

describe('runSkill — confidence is lower for higher-urgency tiers', () => {
  it('gentle confidence > firm confidence > final confidence', async () => {
    const result = await runSkill({
      workspaceId: WS,
      fetcher: new FixtureArFetcher([
        overdueDays(5),
        overdueDays(20),
        overdueDays(60),
      ]),
      now: NOW,
    });
    assert.ok(result.ok);
    const byTier = Object.fromEntries(
      result.value.drafts.map((d) => [d.tier, d.confidence]),
    );
    assert.ok(
      byTier.gentle! > byTier.firm!,
      'gentle confidence should exceed firm',
    );
    assert.ok(
      byTier.firm! > byTier.final!,
      'firm confidence should exceed final',
    );
  });
});

// ── Sink gate ─────────────────────────────────────────────────────────────────

describe('runSkill — sink is called per draft above threshold', () => {
  it('records each draft in the sink when threshold is 0', async () => {
    const invoices = [overdueDays(5), overdueDays(20)];
    const sink = new RecordingSink();
    const result = await runSkill({
      workspaceId: WS,
      fetcher: new FixtureArFetcher(invoices),
      sink,
      sinkThreshold: 0,
      now: NOW,
    });
    assert.ok(result.ok);
    assert.equal(sink.recorded.length, 2);
  });

  it('respects sinkThreshold — skips drafts below it', async () => {
    // final tier has confidence 0.50; set threshold to 0.60 → final skipped
    const invoices = [overdueDays(5), overdueDays(60)]; // gentle + final
    const sink = new RecordingSink();
    const result = await runSkill({
      workspaceId: WS,
      fetcher: new FixtureArFetcher(invoices),
      sink,
      sinkThreshold: 0.60,
      now: NOW,
    });
    assert.ok(result.ok);
    // gentle (0.80) passes; final (0.50) doesn't
    assert.equal(sink.recorded.length, 1);
    assert.equal(sink.recorded[0]!.draft.tier, 'gentle');
  });

  it('no sink provided → draftsStaged is 0 but drafts array is populated', async () => {
    const result = await runSkill({
      workspaceId: WS,
      fetcher: new FixtureArFetcher([overdueDays(10)]),
      now: NOW,
    });
    assert.ok(result.ok);
    assert.equal(result.value.draftsStaged, 0);
    assert.equal(result.value.drafts.length, 1);
  });
});

// ── maxDraftsPerRun cap ───────────────────────────────────────────────────────

describe('runSkill — maxDraftsPerRun cap', () => {
  it('caps drafts at maxDraftsPerRun', async () => {
    const invoices = [
      overdueDays(60),
      overdueDays(50),
      overdueDays(40),
      overdueDays(30),
    ];
    const result = await runSkill({
      workspaceId: WS,
      fetcher: new FixtureArFetcher(invoices),
      maxDraftsPerRun: 2,
      now: NOW,
    });
    assert.ok(result.ok);
    assert.equal(result.value.drafts.length, 2);
  });
});

// ── Error propagation ─────────────────────────────────────────────────────────

describe('runSkill — error propagation', () => {
  it('propagates NOT_CONFIGURED from fetcher unchanged', async () => {
    const err = skillError(
      'NOT_CONFIGURED',
      'QuickBooks not connected',
      'CREDENTIAL_NOT_FOUND',
    );
    const result = await runSkill({
      workspaceId: WS,
      fetcher: new FixtureArFetcher([], err),
      now: NOW,
    });
    assert.ok(!result.ok);
    assert.equal(result.error.code, 'NOT_CONFIGURED');
  });

  it('propagates UPSTREAM_GMAIL_ERROR unchanged', async () => {
    const err = skillError('UPSTREAM_GMAIL_ERROR', 'QuickBooks API failed');
    const result = await runSkill({
      workspaceId: WS,
      fetcher: new FixtureArFetcher([], err),
      now: NOW,
    });
    assert.ok(!result.ok);
    assert.equal(result.error.code, 'UPSTREAM_GMAIL_ERROR');
  });
});

// ── Edge cases ────────────────────────────────────────────────────────────────

describe('runSkill — edge cases', () => {
  it('zero overdue invoices returns empty output cleanly', async () => {
    const result = await runSkill({
      workspaceId: WS,
      fetcher: new FixtureArFetcher([]),
      now: NOW,
    });
    assert.ok(result.ok);
    assert.equal(result.value.drafts.length, 0);
    assert.equal(result.value.draftsStaged, 0);
    assert.equal(result.value.totalBalanceUsd, 0);
  });

  it('handles null customerEmail without crashing', async () => {
    const inv = overdueDays(10);
    inv.customerEmail = null;
    const result = await runSkill({
      workspaceId: WS,
      fetcher: new FixtureArFetcher([inv]),
      now: NOW,
    });
    assert.ok(result.ok);
    assert.equal(result.value.drafts[0]!.customerEmail, null);
  });

  it('handles null docNumber without crashing', async () => {
    const inv = overdueDays(10);
    inv.docNumber = null;
    const result = await runSkill({
      workspaceId: WS,
      fetcher: new FixtureArFetcher([inv]),
      now: NOW,
    });
    assert.ok(result.ok);
    assert.ok(result.value.drafts[0]!.subject.length > 0);
  });

  it('output includes noOutboundNote', async () => {
    const result = await runSkill({
      workspaceId: WS,
      fetcher: new FixtureArFetcher([overdueDays(5)]),
      now: NOW,
    });
    assert.ok(result.ok);
    assert.match(result.value.noOutboundNote, /no.*sent/i);
  });
});
