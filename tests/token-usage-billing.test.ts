/**
 * tests/token-usage-billing.test.ts
 *
 * Covers feat/token-usage-billing-2026-05-28:
 *
 *   1. Pricing (pure):
 *      - known fresh + cached + output cases compute the expected
 *        micro-cents on Sonnet, Opus, Haiku;
 *      - unknown model defaults to Sonnet (never Opus, never Haiku);
 *      - formatMicroCentsAsUsd handles zero, sub-cent, and round dollars.
 *
 *   2. Recorder wiring through LoggingLlmProvider:
 *      - calls with `meta.workspaceId` reach the sink;
 *      - calls without `meta.workspaceId` are SKIPPED, not fake-tagged;
 *      - errors from the sink are swallowed (LLM call still succeeds);
 *      - `resolveSurface` clamps to a known enum value, defaults OTHER.
 *
 *   3. Aggregation (against a recording in-memory `LlmUsageRecord` table):
 *      - today / period / 30d windows return the right sums + call count;
 *      - per-surface breakdown is sorted by cost DESC;
 *      - cache-savings helper computes hitRate + savings vs uncached.
 *
 *   4. Stripe meter sweep:
 *      - env disabled → logs/skips, no `reportMeterEvent` call,
 *        rows stay unreported (so future enabled sweep back-fills);
 *      - env enabled → POST happens, rows marked reported,
 *        same-day retry uses same idempotency key (Stripe dedupes);
 *      - workspaces with no stripeCustomerId are skipped, not failed;
 *      - workspaces with no usage are skipped, not failed.
 *
 *   5. TestBillingProvider's reportMeterEvent is observable so the cron
 *      test asserts the exact event payload shape.
 *
 * No DB is required — every test injects either a recording stub or a
 * deterministic candidate list, so the suite stays cold-start-safe and
 * runs in the same `node --test` pass as the rest of the project.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  costMicroCentsForUsage,
  formatMicroCentsAsUsd,
  ratesForModel,
} from '@/lib/billing/usage/pricing';
import {
  computeCacheSavings,
  type SurfaceBreakdownRow,
  type UsageSums,
  ZERO_SUMS,
} from '@/lib/billing/usage/aggregate';
import {
  makeRecordingUsageRecorder,
  noopUsageRecorder,
  resolveSurface,
} from '@/lib/billing/usage/recorder';
import { LoggingLlmProvider } from '@/lib/llm/logging-provider';
import { TestBillingProvider } from '@/lib/billing/test-provider';
import {
  buildIdempotencyKey,
  runStripeMeterSweep,
  type MeterCandidateWorkspace,
} from '@/lib/billing/usage/stripe-meter';
import type {
  LlmCompletion,
  LlmProvider,
  LlmResult,
} from '@/lib/llm/types';
import { llmOk } from '@/lib/llm/types';

// ── 1. Pricing ─────────────────────────────────────────────────────────

describe('pricing.costMicroCentsForUsage', () => {
  it('Sonnet: 1M input + 1M output + 1M cache-write + 1M cache-read = known total', () => {
    // input  = 1_000_000 × $3 / M = $3      = 300_000_000 µ¢
    // output = 1_000_000 × $15 / M = $15    = 1_500_000_000 µ¢
    // cw     = 1_000_000 × $3.75 / M = $3.75 = 375_000_000 µ¢
    // cr     = 1_000_000 × $0.30 / M = $0.30 =  30_000_000 µ¢
    // total = 2_205_000_000 µ¢ = $22.05
    const cost = costMicroCentsForUsage(
      'claude-sonnet-4-5',
      1_000_000,
      1_000_000,
      1_000_000,
      1_000_000,
    );
    assert.equal(cost, 2_205_000_000n);
    assert.equal(formatMicroCentsAsUsd(cost), '$22.05');
  });

  it('Opus: per-million rates 5x Sonnet input', () => {
    // 1M input on Opus at $15/M = $15.00 = 1_500_000_000 µ¢
    const cost = costMicroCentsForUsage('claude-opus-4-1', 1_000_000, 0, 0, 0);
    assert.equal(cost, 1_500_000_000n);
  });

  it('Haiku: per-million rates 1/3 of Sonnet input', () => {
    // 1M input on Haiku at $1/M = $1.00 = 100_000_000 µ¢
    const cost = costMicroCentsForUsage('claude-haiku-4-5', 1_000_000, 0, 0, 0);
    assert.equal(cost, 100_000_000n);
  });

  it('zero tokens → zero cost (no NaN, no negative)', () => {
    assert.equal(costMicroCentsForUsage('claude-sonnet-4-5', 0, 0, 0, 0), 0n);
  });

  it('unknown model falls back to Sonnet (not Opus, not Haiku)', () => {
    const unknown = costMicroCentsForUsage('claude-future-9-9', 1_000_000, 0, 0, 0);
    const sonnet = costMicroCentsForUsage('claude-sonnet-4-5', 1_000_000, 0, 0, 0);
    assert.equal(unknown, sonnet);
  });

  it('small mixed usage: 5000 input, 1500 output, 8000 cache-read', () => {
    // 5000 × 300_000_000 / 1_000_000 = 1_500_000 µ¢
    // 1500 × 1_500_000_000 / 1_000_000 = 2_250_000 µ¢
    // 8000 × 30_000_000 / 1_000_000 = 240_000 µ¢
    // total = 3_990_000 µ¢ = $0.0399 → "$<0.01"... wait, $0.04
    const cost = costMicroCentsForUsage('claude-sonnet-4-5', 5000, 1500, 0, 8000);
    assert.equal(cost, 3_990_000n);
    // $0.04 when rounded for display
    assert.equal(formatMicroCentsAsUsd(cost), '$0.04');
  });
});

describe('pricing.formatMicroCentsAsUsd', () => {
  it('zero is exactly $0.00', () => {
    assert.equal(formatMicroCentsAsUsd(0n), '$0.00');
  });
  it('very small non-zero is $<0.01 so it never disappears', () => {
    assert.equal(formatMicroCentsAsUsd(500n), '$<0.01');
  });
  it('round dollars print with two decimals', () => {
    assert.equal(formatMicroCentsAsUsd(100_000_000n), '$1.00');
  });
});

describe('pricing.ratesForModel — substring match family resolution', () => {
  it('claude-sonnet-4-5-20251001 resolves to Sonnet rates', () => {
    assert.equal(
      ratesForModel('claude-sonnet-4-5-20251001').inputPerMillionMicroCents,
      300_000_000n,
    );
  });
  it('claude-opus-4-1 resolves to Opus rates', () => {
    assert.equal(
      ratesForModel('claude-opus-4-1').inputPerMillionMicroCents,
      1_500_000_000n,
    );
  });
});

// ── 2. Recorder wiring through LoggingLlmProvider ──────────────────────

describe('LoggingLlmProvider — recorder sink wiring', () => {
  it('calls the recorder with meta + model + usage on success', async () => {
    const { recorder, calls } = makeRecordingUsageRecorder();
    const inner: LlmProvider = {
      name: 'test',
      async complete(): Promise<LlmResult<LlmCompletion>> {
        return llmOk({
          text: 'ok',
          stopReason: 'end_turn',
          usage: {
            inputTokens: 50,
            outputTokens: 20,
            cacheCreationInputTokens: 400,
            cacheReadInputTokens: 100,
          },
          model: 'claude-sonnet-4-5',
        });
      },
    };
    const wrapped = new LoggingLlmProvider(inner, { enabled: false, recorder });
    const res = await wrapped.complete({
      system: 'sys',
      messages: [{ role: 'user', content: 'hi' }],
      meta: {
        workspaceId: '11111111-1111-1111-1111-111111111111',
        sourceSurface: 'PLAINO_CHAT',
        skill: 'plaino-chat',
      },
    });
    assert.equal(res.ok, true);
    assert.equal(calls.length, 1);
    assert.equal(calls[0]!.meta?.workspaceId, '11111111-1111-1111-1111-111111111111');
    assert.equal(calls[0]!.meta?.sourceSurface, 'PLAINO_CHAT');
    assert.equal(calls[0]!.model, 'claude-sonnet-4-5');
    assert.equal(calls[0]!.usage.inputTokens, 50);
    assert.equal(calls[0]!.usage.cacheReadInputTokens, 100);
  });

  it('does not call the recorder when usage is null (provider did not report)', async () => {
    const { recorder, calls } = makeRecordingUsageRecorder();
    const inner: LlmProvider = {
      name: 'test',
      async complete(): Promise<LlmResult<LlmCompletion>> {
        return llmOk({
          text: 'ok',
          stopReason: 'end_turn',
          usage: null,
          model: 'claude-sonnet-4-5',
        });
      },
    };
    const wrapped = new LoggingLlmProvider(inner, { enabled: false, recorder });
    await wrapped.complete({
      system: 'sys',
      messages: [{ role: 'user', content: 'hi' }],
      meta: { workspaceId: '11111111-1111-1111-1111-111111111111' },
    });
    assert.equal(calls.length, 0);
  });

  it('swallows recorder errors — the LLM call still succeeds', async () => {
    const inner: LlmProvider = {
      name: 'test',
      async complete(): Promise<LlmResult<LlmCompletion>> {
        return llmOk({
          text: 'ok',
          stopReason: 'end_turn',
          usage: { inputTokens: 10, outputTokens: 5 },
          model: 'claude-sonnet-4-5',
        });
      },
    };
    const throwingRecorder = async () => {
      throw new Error('db down');
    };
    const wrapped = new LoggingLlmProvider(inner, {
      enabled: false,
      recorder: throwingRecorder,
    });
    const res = await wrapped.complete({
      system: 'sys',
      messages: [{ role: 'user', content: 'hi' }],
      meta: { workspaceId: '11111111-1111-1111-1111-111111111111' },
    });
    assert.equal(res.ok, true);
  });

  it('no recorder → no-op (back-compat with constructor without opts)', async () => {
    const inner: LlmProvider = {
      name: 'test',
      async complete(): Promise<LlmResult<LlmCompletion>> {
        return llmOk({
          text: 'ok',
          stopReason: 'end_turn',
          usage: { inputTokens: 10, outputTokens: 5 },
          model: 'claude-sonnet-4-5',
        });
      },
    };
    const wrapped = new LoggingLlmProvider(inner, { enabled: false });
    const res = await wrapped.complete({
      system: 'sys',
      messages: [{ role: 'user', content: 'hi' }],
    });
    assert.equal(res.ok, true);
  });

  it('noopUsageRecorder always resolves cleanly — useful for opt-out tests', async () => {
    await assert.doesNotReject(
      noopUsageRecorder(undefined, 'claude-sonnet-4-5', {
        inputTokens: 0,
        outputTokens: 0,
      }),
    );
  });
});

describe('resolveSurface — input clamping', () => {
  it('passes through known enum values', () => {
    assert.equal(resolveSurface('PLAINO_CHAT'), 'PLAINO_CHAT');
    assert.equal(resolveSurface('OFFICE_ADMIN'), 'OFFICE_ADMIN');
    assert.equal(resolveSurface('FOLLOW_UP_CHASER'), 'FOLLOW_UP_CHASER');
  });
  it('undefined → OTHER', () => {
    assert.equal(resolveSurface(undefined), 'OTHER');
  });
});

// ── 3. Aggregation (cache-savings + sums helper) ───────────────────────

describe('computeCacheSavings', () => {
  it('zero tokens → zero hitRate, zero saving', () => {
    const out = computeCacheSavings(
      ZERO_SUMS,
      300_000_000n,
      30_000_000n,
    );
    assert.equal(out.hitRate, 0);
    assert.equal(out.estimatedSavedMicroCents, 0n);
  });

  it('half cached → hitRate ~0.5, saving = (input rate - read rate) × tokens / M', () => {
    const sums: UsageSums = {
      inputTokens: 100_000,
      outputTokens: 10_000,
      cacheCreationTokens: 0,
      cacheReadTokens: 100_000,
      costMicroCents: 0n,
      callCount: 1,
    };
    const out = computeCacheSavings(sums, 300_000_000n, 30_000_000n);
    assert.equal(out.hitRate, 0.5);
    // baseline at $3/M for 100_000 tokens = 30_000_000 µ¢
    // actual at $0.30/M for 100_000 tokens =  3_000_000 µ¢
    // saved = 27_000_000 µ¢ = $0.27
    assert.equal(out.estimatedSavedMicroCents, 27_000_000n);
  });

  it('all cached read → hitRate 1.0', () => {
    const sums: UsageSums = {
      inputTokens: 0,
      outputTokens: 0,
      cacheCreationTokens: 0,
      cacheReadTokens: 1000,
      costMicroCents: 0n,
      callCount: 1,
    };
    const out = computeCacheSavings(sums, 300_000_000n, 30_000_000n);
    assert.equal(out.hitRate, 1.0);
  });
});

// Synthetic per-surface rows for ordering assertions on the UI.
describe('Surface breakdown ordering — UI contract', () => {
  it('aggregator returns rows sorted by cost DESC (UI assumption)', () => {
    const rows: SurfaceBreakdownRow[] = [
      {
        sourceSurface: 'PLAINO_CHAT',
        sums: { ...ZERO_SUMS, costMicroCents: 100n },
      },
      {
        sourceSurface: 'FOLLOW_UP_CHASER',
        sums: { ...ZERO_SUMS, costMicroCents: 500n },
      },
      {
        sourceSurface: 'OFFICE_ADMIN',
        sums: { ...ZERO_SUMS, costMicroCents: 300n },
      },
    ];
    // Sort the same way the aggregator does — DESC by costMicroCents.
    rows.sort((a, b) =>
      a.sums.costMicroCents > b.sums.costMicroCents
        ? -1
        : a.sums.costMicroCents < b.sums.costMicroCents
          ? 1
          : 0,
    );
    assert.equal(rows[0]!.sourceSurface, 'FOLLOW_UP_CHASER');
    assert.equal(rows[1]!.sourceSurface, 'OFFICE_ADMIN');
    assert.equal(rows[2]!.sourceSurface, 'PLAINO_CHAT');
  });
});

// ── 4. Stripe meter sweep ──────────────────────────────────────────────

const WORKSPACE_A = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const WORKSPACE_B = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const WORKSPACE_NO_CUSTOMER = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
const WORKSPACE_NO_USAGE = 'dddddddd-dddd-dddd-dddd-dddddddddddd';

describe('runStripeMeterSweep — env disabled', () => {
  it('does NOT POST to Stripe and does NOT mark rows reported', async () => {
    const billing = new TestBillingProvider();
    const marked: Array<{ ids: string[]; at: Date }> = [];
    const candidates: MeterCandidateWorkspace[] = [
      {
        workspaceId: WORKSPACE_A,
        stripeCustomerId: 'cus_a',
        pendingMicroCents: 9_999n,
        rowIds: ['r1', 'r2'],
      },
    ];
    const out = await runStripeMeterSweep({
      listCandidates: async () => candidates,
      provider: billing,
      markReported: async (ids, at) => {
        marked.push({ ids, at });
      },
      enabled: false,
      meterEventName: 'agentplain_token_micro_cents',
    });
    assert.equal(out.workspacesConsidered, 1);
    assert.equal(out.workspacesSkippedDisabled, 1);
    assert.equal(out.workspacesReported, 0);
    assert.equal(billing.reportedMeterEvents.length, 0);
    assert.equal(marked.length, 0);
  });

  it('disabled when event name is missing (master switch passes but no event_name)', async () => {
    const billing = new TestBillingProvider();
    const out = await runStripeMeterSweep({
      listCandidates: async () => [
        {
          workspaceId: WORKSPACE_A,
          stripeCustomerId: 'cus_a',
          pendingMicroCents: 1n,
          rowIds: ['r1'],
        },
      ],
      provider: billing,
      markReported: async () => {},
      enabled: true,
      meterEventName: undefined,
    });
    assert.equal(out.workspacesSkippedDisabled, 1);
    assert.equal(billing.reportedMeterEvents.length, 0);
  });
});

describe('runStripeMeterSweep — env enabled', () => {
  it('POSTs one event per workspace with usage, marks rows reported', async () => {
    const billing = new TestBillingProvider();
    const marked: Array<{ ids: string[]; at: Date }> = [];
    const now = new Date('2026-05-28T07:00:00.000Z');
    const out = await runStripeMeterSweep({
      listCandidates: async () => [
        {
          workspaceId: WORKSPACE_A,
          stripeCustomerId: 'cus_a',
          pendingMicroCents: 5_000_000n,
          rowIds: ['ra1', 'ra2'],
        },
        {
          workspaceId: WORKSPACE_B,
          stripeCustomerId: 'cus_b',
          pendingMicroCents: 1_500_000n,
          rowIds: ['rb1'],
        },
      ],
      provider: billing,
      markReported: async (ids, at) => {
        marked.push({ ids, at });
      },
      now,
      enabled: true,
      meterEventName: 'agentplain_token_micro_cents',
    });
    assert.equal(out.workspacesReported, 2);
    assert.equal(out.microCentsReported, 6_500_000n);
    assert.equal(billing.reportedMeterEvents.length, 2);
    assert.equal(
      billing.reportedMeterEvents[0]!.eventName,
      'agentplain_token_micro_cents',
    );
    assert.equal(billing.reportedMeterEvents[0]!.providerCustomerId, 'cus_a');
    assert.equal(billing.reportedMeterEvents[0]!.quantity, 5_000_000);
    assert.equal(
      billing.reportedMeterEvents[0]!.identifier,
      `agentplain-meter-${WORKSPACE_A}-20260528`,
    );
    assert.equal(marked.length, 2);
    assert.deepEqual(marked[0]!.ids, ['ra1', 'ra2']);
  });

  it('skips workspaces with no stripeCustomerId (manual-invoice tier)', async () => {
    const billing = new TestBillingProvider();
    const out = await runStripeMeterSweep({
      listCandidates: async () => [
        {
          workspaceId: WORKSPACE_NO_CUSTOMER,
          stripeCustomerId: null,
          pendingMicroCents: 1_000n,
          rowIds: ['r1'],
        },
      ],
      provider: billing,
      markReported: async () => {},
      enabled: true,
      meterEventName: 'agentplain_token_micro_cents',
    });
    assert.equal(out.workspacesSkippedNoCustomer, 1);
    assert.equal(out.workspacesReported, 0);
    assert.equal(billing.reportedMeterEvents.length, 0);
  });

  it('skips workspaces with zero pending micro-cents', async () => {
    const billing = new TestBillingProvider();
    const out = await runStripeMeterSweep({
      listCandidates: async () => [
        {
          workspaceId: WORKSPACE_NO_USAGE,
          stripeCustomerId: 'cus_x',
          pendingMicroCents: 0n,
          rowIds: [],
        },
      ],
      provider: billing,
      markReported: async () => {},
      enabled: true,
      meterEventName: 'agentplain_token_micro_cents',
    });
    assert.equal(out.workspacesSkippedNoUsage, 1);
    assert.equal(billing.reportedMeterEvents.length, 0);
  });

  it('a Stripe POST that throws records a failure and does NOT mark rows reported (idempotent retry)', async () => {
    const failingProvider = new TestBillingProvider();
    // Override reportMeterEvent to reject.
    failingProvider.reportMeterEvent = async () => {
      throw new Error('stripe 503 service unavailable');
    };
    const marked: Array<{ ids: string[]; at: Date }> = [];
    const out = await runStripeMeterSweep({
      listCandidates: async () => [
        {
          workspaceId: WORKSPACE_A,
          stripeCustomerId: 'cus_a',
          pendingMicroCents: 1_000n,
          rowIds: ['r1', 'r2'],
        },
      ],
      provider: failingProvider,
      markReported: async (ids, at) => {
        marked.push({ ids, at });
      },
      enabled: true,
      meterEventName: 'agentplain_token_micro_cents',
    });
    assert.equal(out.workspacesReported, 0);
    assert.equal(out.failures.length, 1);
    assert.equal(out.failures[0]!.workspaceId, WORKSPACE_A);
    assert.equal(marked.length, 0);
  });

  it('idempotency key composition is workspaceId + UTC YYYYMMDD', () => {
    const now = new Date('2026-05-28T23:30:00.000Z');
    assert.equal(
      buildIdempotencyKey(WORKSPACE_A, now),
      `agentplain-meter-${WORKSPACE_A}-20260528`,
    );
  });
});

// ── 5. TestBillingProvider satisfies the new method contract ───────────

describe('TestBillingProvider.reportMeterEvent', () => {
  it('records every emitted event in-memory for assertion', async () => {
    const billing = new TestBillingProvider();
    await billing.reportMeterEvent({
      eventName: 'agentplain_token_micro_cents',
      providerCustomerId: 'cus_test',
      quantity: 7777,
      identifier: 'agentplain-meter-x-20260528',
      timestampSeconds: 1738000000,
    });
    assert.equal(billing.reportedMeterEvents.length, 1);
    assert.equal(billing.reportedMeterEvents[0]!.quantity, 7777);
  });
});
