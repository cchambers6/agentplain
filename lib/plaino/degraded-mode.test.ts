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

import {
  checkDegradedMode,
  PLAINO_RESTING_CUSTOMER_NOTICE,
} from './degraded-mode';

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

  it('forces degraded with LLM_DEGRADED_MODE_FORCED when LLM_DEGRADED_MODE=true', () => {
    // Conner's local-test lever + generic dispatch kill-switch. Forces the
    // calm resting state on every surface without touching the prod key.
    const result = checkDegradedMode({
      ENCRYPTION_KEY: VALID_HEX_KEY,
      ANTHROPIC_API_KEY: 'sk-ant-real',
      LLM_DEGRADED_MODE: 'true',
    } as unknown as NodeJS.ProcessEnv);
    assert.equal(result.degraded, true);
    if (!result.degraded) return;
    assert.equal(result.reason, 'LLM_DEGRADED_MODE_FORCED');
    assert.equal(result.customerNotice, PLAINO_RESTING_CUSTOMER_NOTICE);
    assert.match(result.operatorNotice, /LLM_DEGRADED_MODE/);
  });

  it('accepts on-ish values (1 / on) for LLM_DEGRADED_MODE', () => {
    for (const v of ['1', 'on']) {
      const result = checkDegradedMode({
        ENCRYPTION_KEY: VALID_HEX_KEY,
        ANTHROPIC_API_KEY: 'sk-ant-real',
        LLM_DEGRADED_MODE: v,
      } as unknown as NodeJS.ProcessEnv);
      assert.equal(result.degraded, true, `expected degraded for "${v}"`);
    }
  });

  it('the forced toggle overrides even LLM_PROVIDER=test', () => {
    // So a dev running the heuristic provider can still preview the customer
    // resting state. The override is checked ahead of the test-mode bypass.
    const result = checkDegradedMode({
      ENCRYPTION_KEY: VALID_HEX_KEY,
      ANTHROPIC_API_KEY: '',
      LLM_PROVIDER: 'test',
      LLM_DEGRADED_MODE: 'true',
    } as unknown as NodeJS.ProcessEnv);
    assert.equal(result.degraded, true);
    if (!result.degraded) return;
    assert.equal(result.reason, 'LLM_DEGRADED_MODE_FORCED');
  });

  it('off-ish / unset LLM_DEGRADED_MODE leaves real signals in charge', () => {
    for (const v of ['', 'off', '0', 'false']) {
      const result = checkDegradedMode({
        ENCRYPTION_KEY: VALID_HEX_KEY,
        ANTHROPIC_API_KEY: 'sk-ant-real',
        LLM_DEGRADED_MODE: v,
      } as unknown as NodeJS.ProcessEnv);
      assert.equal(result.degraded, false, `expected live for "${v}"`);
    }
  });

  it('no customer notice leaks a model vendor or credential term', () => {
    // The customer surface never names a vendor, an API key, or a provider
    // (feedback_no_silent_vendor_lock). Operator notices may — they are
    // staff-only — so only the customerNotice is checked here.
    const BANNED = ['anthropic', 'claude', 'openai', 'api key', 'api_key', 'token', 'sk-ant'];
    const envs: NodeJS.ProcessEnv[] = [
      { ENCRYPTION_KEY: '', ANTHROPIC_API_KEY: 'sk-ant-real' } as never,
      { ENCRYPTION_KEY: VALID_HEX_KEY, ANTHROPIC_API_KEY: '' } as never,
      {
        ENCRYPTION_KEY: VALID_HEX_KEY,
        ANTHROPIC_API_KEY: 'sk-ant-PAUSED-2026-06-02-conner-restore-when-back',
      } as never,
      {
        ENCRYPTION_KEY: VALID_HEX_KEY,
        ANTHROPIC_API_KEY: 'sk-ant-real',
        LLM_DEGRADED_MODE: 'true',
      } as never,
    ];
    for (const env of envs) {
      const r = checkDegradedMode(env);
      assert.equal(r.degraded, true);
      if (!r.degraded) continue;
      const lower = r.customerNotice.toLowerCase();
      for (const term of BANNED) {
        assert.ok(
          !lower.includes(term),
          `customer notice leaked "${term}": ${r.customerNotice}`,
        );
      }
    }
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
