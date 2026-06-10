/**
 * lib/skills/month-end-close-cpa/polish.test.ts
 *
 * Unit test for the flag-gated LLM polish seam. Proves:
 *  - polish is OFF by default (no flag, no provider → no-op)
 *  - a PAUSED provider (the parked-key sentinel) silently keeps the
 *    deterministic body — the close never depends on the LLM
 *  - when enabled, polish runs but a dropped merge field is rejected
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import type { LlmCompletionRequest, LlmProvider, LlmResult, LlmCompletion } from '@/lib/llm/types';
import { polishBody, polishEnabled } from './polish';

function provider(
  respond: (req: LlmCompletionRequest) => LlmResult<LlmCompletion>,
): LlmProvider {
  return {
    name: 'test',
    async complete(req) {
      return respond(req);
    },
  };
}

const DETERMINISTIC = [
  'Hi Pat,',
  '',
  'Outstanding items:',
  '  - Bank statement(s) for 2026-04',
  '',
  'Please direct any questions about a tax position to {{operator: tax position}}.',
  '',
  '{{operator: signature}}',
].join('\n');

describe('polishEnabled', () => {
  it('is false with no options', () => {
    assert.equal(polishEnabled(null), false);
    assert.equal(polishEnabled(undefined), false);
  });

  it('is true when force is set (test bypass), independent of env', () => {
    const llm = provider(() => ({
      ok: true,
      value: { text: 'x', stopReason: null, usage: null, model: 'test' },
    }));
    assert.equal(polishEnabled({ llm, force: true }), true);
  });

  it('respects the env flag when force is not set', () => {
    const llm = provider(() => ({
      ok: true,
      value: { text: 'x', stopReason: null, usage: null, model: 'test' },
    }));
    const prev = process.env.MONTH_END_CLOSE_LLM_POLISH;
    process.env.MONTH_END_CLOSE_LLM_POLISH = 'on';
    assert.equal(polishEnabled({ llm }), true);
    delete process.env.MONTH_END_CLOSE_LLM_POLISH;
    assert.equal(polishEnabled({ llm }), false);
    if (prev !== undefined) process.env.MONTH_END_CLOSE_LLM_POLISH = prev;
  });
});

describe('polishBody', () => {
  it('keeps the deterministic body when the provider is PAUSED', async () => {
    const llm = provider(() => ({
      ok: false,
      error: { code: 'PAUSED', message: 'key parked' },
    }));
    const out = await polishBody({
      opts: { llm, force: true },
      deterministicBody: DETERMINISTIC,
      subject: 'Documents needed',
    });
    assert.equal(out, DETERMINISTIC);
  });

  it('returns the polished body when it preserves all merge fields', async () => {
    const polished = DETERMINISTIC.replace('Hi Pat,', 'Hello Pat,');
    const llm = provider(() => ({
      ok: true,
      value: { text: polished, stopReason: 'end_turn', usage: null, model: 'test' },
    }));
    const out = await polishBody({
      opts: { llm, force: true },
      deterministicBody: DETERMINISTIC,
      subject: 'Documents needed',
    });
    assert.equal(out, polished);
  });

  it('rejects a polish that drops a required merge field', async () => {
    const broken = 'Hello Pat, send the bank statement. Thanks.'; // no merge fields
    const llm = provider(() => ({
      ok: true,
      value: { text: broken, stopReason: 'end_turn', usage: null, model: 'test' },
    }));
    const out = await polishBody({
      opts: { llm, force: true },
      deterministicBody: DETERMINISTIC,
      subject: 'Documents needed',
    });
    assert.equal(out, DETERMINISTIC);
  });
});
