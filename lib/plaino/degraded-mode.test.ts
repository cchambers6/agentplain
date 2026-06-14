/**
 * lib/plaino/degraded-mode.test.ts
 *
 * Pins the Phase-1 honesty contract: when ENCRYPTION_KEY or
 * ANTHROPIC_API_KEY is missing in the env, checkDegradedMode returns
 * a discriminated descriptor with customer-facing + operator-facing
 * copy. The Server Action + the /talk page renderer both read this
 * before doing anything that would touch the encryption seam or call
 * the LLM provider.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { checkDegradedMode } from './degraded-mode';

const VALID_HEX_KEY = 'a'.repeat(64);

describe('plaino degraded-mode check', () => {
  it('returns degraded with ENCRYPTION_KEY_MISSING when the key env is empty', () => {
    const result = checkDegradedMode({
      ENCRYPTION_KEY: '',
      ANTHROPIC_API_KEY: 'sk-ant-test',
    } as unknown as NodeJS.ProcessEnv);
    assert.equal(result.degraded, true);
    if (!result.degraded) return;
    assert.equal(result.reason, 'ENCRYPTION_KEY_MISSING');
    assert.match(result.customerNotice, /Plaino is offline/);
    assert.match(result.operatorNotice, /ENCRYPTION_KEY/);
  });

  it('returns degraded with ENCRYPTION_KEY_MISSING when the key is malformed', () => {
    const result = checkDegradedMode({
      ENCRYPTION_KEY: 'not-hex-not-64-chars',
      ANTHROPIC_API_KEY: 'sk-ant-test',
    } as unknown as NodeJS.ProcessEnv);
    assert.equal(result.degraded, true);
    if (!result.degraded) return;
    assert.equal(result.reason, 'ENCRYPTION_KEY_MISSING');
  });

  it('returns degraded with ANTHROPIC_API_KEY_MISSING when the LLM key is absent', () => {
    const result = checkDegradedMode({
      ENCRYPTION_KEY: VALID_HEX_KEY,
      ANTHROPIC_API_KEY: '',
    } as unknown as NodeJS.ProcessEnv);
    assert.equal(result.degraded, true);
    if (!result.degraded) return;
    assert.equal(result.reason, 'ANTHROPIC_API_KEY_MISSING');
    assert.match(result.customerNotice, /model credential/);
    assert.match(result.operatorNotice, /ANTHROPIC_API_KEY/);
  });

  it('bypasses the LLM credential check when LLM_PROVIDER=test', () => {
    const result = checkDegradedMode({
      ENCRYPTION_KEY: VALID_HEX_KEY,
      ANTHROPIC_API_KEY: '',
      LLM_PROVIDER: 'test',
    } as unknown as NodeJS.ProcessEnv);
    assert.equal(result.degraded, false);
  });

  it('returns not-degraded when both keys are present', () => {
    const result = checkDegradedMode({
      ENCRYPTION_KEY: VALID_HEX_KEY,
      ANTHROPIC_API_KEY: 'sk-ant-real',
    } as unknown as NodeJS.ProcessEnv);
    assert.equal(result.degraded, false);
  });

  it('returns degraded with ANTHROPIC_API_KEY_PAUSED for the paused sentinel', () => {
    // The exact prod outage of 2026-06-13: the key was the non-empty
    // `sk-ant-PAUSED-…` sentinel, so the old empty-check passed and the
    // customer saw the post-send generic error with no operator alert.
    const result = checkDegradedMode({
      ENCRYPTION_KEY: VALID_HEX_KEY,
      ANTHROPIC_API_KEY: 'sk-ant-PAUSED-2026-06-02-conner-restore-when-back',
    } as unknown as NodeJS.ProcessEnv);
    assert.equal(result.degraded, true);
    if (!result.degraded) return;
    assert.equal(result.reason, 'ANTHROPIC_API_KEY_PAUSED');
    assert.match(result.customerNotice, /resting right now/);
    assert.match(result.operatorNotice, /paused sentinel/);
  });

  it('does NOT declare paused when LLM_SENTINEL_BYPASS is on (stack will not short-circuit)', () => {
    const result = checkDegradedMode({
      ENCRYPTION_KEY: VALID_HEX_KEY,
      ANTHROPIC_API_KEY: 'sk-ant-PAUSED-2026-06-02-conner-restore-when-back',
      LLM_SENTINEL_BYPASS: 'on',
    } as unknown as NodeJS.ProcessEnv);
    assert.equal(result.degraded, false);
  });

  it('the paused sentinel still bypasses entirely under LLM_PROVIDER=test', () => {
    const result = checkDegradedMode({
      ENCRYPTION_KEY: VALID_HEX_KEY,
      ANTHROPIC_API_KEY: 'sk-ant-PAUSED-2026-06-02-conner-restore-when-back',
      LLM_PROVIDER: 'test',
    } as unknown as NodeJS.ProcessEnv);
    assert.equal(result.degraded, false);
  });

  it('encryption check fires before LLM check when both are missing', () => {
    // The order matters because the encryption seam fires first on
    // every customer turn — if both are missing, the operator should
    // see the encryption fix first.
    const result = checkDegradedMode({
      ENCRYPTION_KEY: '',
      ANTHROPIC_API_KEY: '',
    } as unknown as NodeJS.ProcessEnv);
    assert.equal(result.degraded, true);
    if (!result.degraded) return;
    assert.equal(result.reason, 'ENCRYPTION_KEY_MISSING');
  });
});
