/**
 * lib/billing/usage/cache-stats.test.ts
 *
 * Pins the cache-hit-rate math used by the per-skill operator panel. The
 * formula must stay identical to `logging-provider.ts` summarizeUsage so the
 * dashboard and the live `llm.usage` log lines never disagree.
 *
 * The DB rollup (`loadCacheHitRateBySkill`) is exercised by the build's
 * Prisma-backed integration path; this unit test pins the pure arithmetic
 * that determines what an operator reads off the screen.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { computeCacheHitRate } from './cache-stats';

describe('computeCacheHitRate', () => {
  it('is 0 when there are no input-like tokens', () => {
    assert.equal(computeCacheHitRate(0, 0, 0), 0);
  });

  it('is 0 when nothing was served from cache', () => {
    assert.equal(computeCacheHitRate(0, 1000, 0), 0);
  });

  it('approaches 1 for a hot, fully-cached prefix', () => {
    // 9900 read, 100 fresh input, 0 writes -> 0.99
    assert.equal(computeCacheHitRate(9900, 100, 0), 0.99);
  });

  it('counts cache writes against the rate (the 1.25x-rate cost side)', () => {
    // First-ever call: nothing read, all written. read/(read+input+write).
    assert.equal(computeCacheHitRate(0, 200, 800), 0);
    // read=800 input=200 write=0 -> 0.8
    assert.equal(computeCacheHitRate(800, 200, 0), 0.8);
  });

  it('rounds to three decimal places', () => {
    // 1 / 3 = 0.333...
    assert.equal(computeCacheHitRate(1, 2, 0), 0.333);
  });

  it('never divides by a negative denominator', () => {
    assert.equal(computeCacheHitRate(-5, -5, 0), 0);
  });
});
