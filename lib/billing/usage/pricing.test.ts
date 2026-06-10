/**
 * lib/billing/usage/pricing.test.ts
 *
 * Unit tests for the pure token-cost functions in pricing.ts.
 * No DB, no network, no API keys required.
 *
 * Key invariants under test:
 *   - ratesForModel resolves all three families (Opus, Haiku, Sonnet)
 *   - Minor-version suffixes map to the same table as the base id
 *   - Unknown / empty model ids default to Sonnet (conservative middle)
 *   - costMicroCentsForUsage produces exact BigInt results for hand-known inputs
 *   - Zero / negative token counts never throw; they contribute 0
 *   - formatMicroCentsAsUsd formats edge cases correctly
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  ratesForModel,
  costMicroCentsForUsage,
  formatMicroCentsAsUsd,
} from './pricing';

// ── ratesForModel ─────────────────────────────────────────────────────────────

describe('ratesForModel', () => {
  it('resolves Sonnet family by base id', () => {
    const r = ratesForModel('claude-sonnet-4-5');
    // $3 / million tokens = 300_000_000 micro-cents / million
    assert.equal(r.inputPerMillionMicroCents, 300_000_000n);
    assert.equal(r.outputPerMillionMicroCents, 1_500_000_000n);
  });

  it('resolves Sonnet family for a minor-version suffix', () => {
    const base = ratesForModel('claude-sonnet-4-5');
    const suffixed = ratesForModel('claude-sonnet-4-5-20251001');
    assert.deepEqual(base, suffixed, 'minor-version suffix shares same table');
  });

  it('resolves Opus family by base id', () => {
    const r = ratesForModel('claude-opus-4-7');
    // $15 / million input = 1_500_000_000 micro-cents
    assert.equal(r.inputPerMillionMicroCents, 1_500_000_000n);
    assert.equal(r.outputPerMillionMicroCents, 7_500_000_000n);
  });

  it('resolves Opus family for earlier minor versions', () => {
    const r4_7 = ratesForModel('claude-opus-4-7');
    const r4_0 = ratesForModel('claude-opus-4-0');
    assert.deepEqual(r4_7, r4_0, 'all opus versions share the same table');
  });

  it('resolves Haiku family by base id', () => {
    const r = ratesForModel('claude-haiku-4-5-20251001');
    // $1 / million input = 100_000_000 micro-cents
    assert.equal(r.inputPerMillionMicroCents, 100_000_000n);
    assert.equal(r.outputPerMillionMicroCents, 500_000_000n);
  });

  it('defaults to Sonnet for an unknown model (conservative middle, never under-bills Opus)', () => {
    const sonnet = ratesForModel('claude-sonnet-4-5');
    const unknown = ratesForModel('gpt-4o');
    assert.deepEqual(unknown, sonnet, 'unknown model defaults to Sonnet rates');
  });

  it('defaults to Sonnet for an empty string', () => {
    const sonnet = ratesForModel('claude-sonnet-4-5');
    const empty = ratesForModel('');
    assert.deepEqual(empty, sonnet);
  });

  it('cache-write rate is ~1.25x input rate for Sonnet', () => {
    const r = ratesForModel('claude-sonnet-4-5');
    // $3.75 vs $3: ratio = 1.25
    const ratio = Number(r.cacheWritePerMillionMicroCents) / Number(r.inputPerMillionMicroCents);
    assert.ok(Math.abs(ratio - 1.25) < 0.001, `expected 1.25, got ${ratio}`);
  });

  it('cache-read rate is ~0.10x input rate for Sonnet', () => {
    const r = ratesForModel('claude-sonnet-4-5');
    // $0.30 vs $3: ratio = 0.10
    const ratio = Number(r.cacheReadPerMillionMicroCents) / Number(r.inputPerMillionMicroCents);
    assert.ok(Math.abs(ratio - 0.10) < 0.001, `expected 0.10, got ${ratio}`);
  });
});

// ── costMicroCentsForUsage ────────────────────────────────────────────────────

describe('costMicroCentsForUsage', () => {
  it('returns 0n for all-zero inputs', () => {
    const cost = costMicroCentsForUsage('claude-sonnet-4-5', 0, 0, 0, 0);
    assert.equal(cost, 0n);
  });

  it('handles negative token counts as zero (no negative cost)', () => {
    const cost = costMicroCentsForUsage('claude-sonnet-4-5', -100, -50, -10, -5);
    assert.equal(cost, 0n, 'negative token counts contribute 0');
  });

  it('computes a hand-known Sonnet cost: 1M input tokens → $3 exactly', () => {
    // $3 per million input = 300_000_000 micro-cents per million tokens.
    const cost = costMicroCentsForUsage('claude-sonnet-4-5', 1_000_000, 0, 0, 0);
    assert.equal(cost, 300_000_000n);
  });

  it('computes a hand-known Sonnet cost: 1M output tokens → $15 exactly', () => {
    const cost = costMicroCentsForUsage('claude-sonnet-4-5', 0, 1_000_000, 0, 0);
    assert.equal(cost, 1_500_000_000n);
  });

  it('computes Opus cost: 1M input → $15', () => {
    const cost = costMicroCentsForUsage('claude-opus-4-7', 1_000_000, 0, 0, 0);
    assert.equal(cost, 1_500_000_000n);
  });

  it('computes Haiku cost: 1M input → $1', () => {
    const cost = costMicroCentsForUsage('claude-haiku-4-5-20251001', 1_000_000, 0, 0, 0);
    assert.equal(cost, 100_000_000n);
  });

  it('sums all four token types for Sonnet (combined call)', () => {
    // 1000 input  @ $3/M     → 300_000_000n * 1000 / 1_000_000 = 300_000 mc
    // 500 output  @ $15/M    → 1_500_000_000n * 500 / 1_000_000 = 750_000 mc
    // 200 cw      @ $3.75/M  → 375_000_000n * 200 / 1_000_000 = 75_000 mc
    // 100 cr      @ $0.30/M  → 30_000_000n * 100 / 1_000_000 = 3_000 mc
    // total = 1_128_000 mc
    const cost = costMicroCentsForUsage('claude-sonnet-4-5', 1000, 500, 200, 100);
    assert.equal(cost, 1_128_000n);
  });

  it('output cost is always 5x input cost for the same token count (all families)', () => {
    for (const model of ['claude-sonnet-4-5', 'claude-opus-4-7', 'claude-haiku-4-5-20251001']) {
      const inputCost = costMicroCentsForUsage(model, 1_000_000, 0, 0, 0);
      const outputCost = costMicroCentsForUsage(model, 0, 1_000_000, 0, 0);
      assert.equal(outputCost / inputCost, 5n, `${model}: output should be 5× input cost`);
    }
  });

  it('Opus costs 5x Haiku for the same input-only call (5x more expensive per token)', () => {
    const haiku = costMicroCentsForUsage('claude-haiku-4-5-20251001', 1_000_000, 0, 0, 0);
    const opus  = costMicroCentsForUsage('claude-opus-4-7', 1_000_000, 0, 0, 0);
    // Haiku $1/M, Opus $15/M → 15x. Not 5x for input.
    // Ratio = 15.
    assert.equal(opus / haiku, 15n, 'Opus input cost is 15x Haiku input cost');
  });

  it('returns a bigint (not a number)', () => {
    const cost = costMicroCentsForUsage('claude-sonnet-4-5', 100, 50, 0, 0);
    assert.equal(typeof cost, 'bigint');
  });

  it('large realistic call stays within JS safe-integer range when converted', () => {
    // A heavy workspace: 500K input + 200K output on Opus.
    // Opus: input $15/M → 1_500_000_000n mc/M
    //   500_000 × 1_500_000_000n / 1_000_000 = 750_000_000 mc
    // Opus: output $75/M → 7_500_000_000n mc/M
    //   200_000 × 7_500_000_000n / 1_000_000 = 1_500_000_000 mc
    // Total: 2_250_000_000 mc — well within Number.MAX_SAFE_INTEGER (9e15)
    const cost = costMicroCentsForUsage('claude-opus-4-7', 500_000, 200_000, 0, 0);
    assert.equal(cost, 2_250_000_000n);
    assert.ok(Number(cost) < Number.MAX_SAFE_INTEGER);
  });
});

// ── formatMicroCentsAsUsd ─────────────────────────────────────────────────────

describe('formatMicroCentsAsUsd', () => {
  it('returns "$0.00" for zero', () => {
    assert.equal(formatMicroCentsAsUsd(0n), '$0.00');
  });

  it('returns "$<0.01" for amounts below one cent', () => {
    // 1 cent = 1_000_000 micro-cents. A single Haiku input token costs ~100 mc.
    assert.equal(formatMicroCentsAsUsd(1n), '$<0.01');
    assert.equal(formatMicroCentsAsUsd(999_999n), '$<0.01');
  });

  it('returns "$0.01" for exactly one cent', () => {
    assert.equal(formatMicroCentsAsUsd(1_000_000n), '$0.01');
  });

  it('returns "$1.00" for exactly one dollar', () => {
    // 1 dollar = 100 cents = 100_000_000 micro-cents
    assert.equal(formatMicroCentsAsUsd(100_000_000n), '$1.00');
  });

  it('formats multi-dollar amounts with two decimal places', () => {
    // $3.00 = 300_000_000 mc (1M Sonnet input tokens)
    assert.equal(formatMicroCentsAsUsd(300_000_000n), '$3.00');
  });

  it('formats a realistic monthly spend', () => {
    // ~$162 in micro-cents
    const mc = BigInt(162 * 100_000_000);
    assert.equal(formatMicroCentsAsUsd(mc), '$162.00');
  });
});
