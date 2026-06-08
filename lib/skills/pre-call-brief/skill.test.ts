/**
 * lib/skills/pre-call-brief/skill.test.ts
 *
 * Wave-5 (theme #15 / ratif #10). Proves the pre-call brief is EXACTLY 5
 * bullets across the LLM-success, wrong-count, LLM-failure, and no-grounding
 * paths; that grounding flows from the substrate; and that the call subject
 * is parsed from the title.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import type { LlmProvider } from '@/lib/llm/types';
import { runSkill, BRIEF_BULLET_COUNT, parseSubject, __testing } from './skill';
import { RecordingResearchSubstrate } from '../research-on-demand-general';
import type { UpcomingCall } from './types';

const WS = 'ws-precall';

function call(overrides: Partial<UpcomingCall> = {}): UpcomingCall {
  return {
    id: 'evt-1',
    title: 'Intro call — Acme Realty (Jane Doe)',
    startUtc: '2026-06-08T15:30:00Z',
    ...overrides,
  };
}

function stubLlm(text: string): LlmProvider {
  return {
    name: 'test',
    complete: async () => ({
      ok: true,
      value: { text, stopReason: 'end_turn', usage: null, model: 'test-stub' },
    }),
  };
}

function failingLlm(): LlmProvider {
  return {
    name: 'test',
    complete: async () => ({
      ok: false,
      error: { code: 'UPSTREAM_ERROR', message: 'down' },
    }),
  };
}

describe('pre-call-brief — skill', () => {
  it('returns exactly 5 bullets when the LLM cooperates', async () => {
    const substrate = new RecordingResearchSubstrate({
      [WS]: [
        {
          title: 'Acme Realty profile',
          bodyExcerpt: 'Independent brokerage, 12 agents, Atlanta metro.',
          sourceUrl: 'https://example.com/acme',
          similarity: 0.9,
        },
      ],
    });
    const llm = stubLlm(
      JSON.stringify({
        bullets: [
          'Acme Realty: 12-agent independent brokerage in Atlanta.',
          'They likely feel the FSBO + flat-fee pressure in their market.',
          'Ask how they currently handle listing coordination.',
          'Compliance is a soft spot for small brokerages — probe it.',
          'Open with: what would make this call worth your 20 minutes?',
        ],
      }),
    );
    const res = await runSkill({ call: call(), substrate, workspaceId: WS, llm });
    assert.ok(res.ok);
    if (!res.ok) return;
    assert.equal(res.value.bullets.length, BRIEF_BULLET_COUNT);
    assert.equal(res.value.subject, 'Acme Realty');
    assert.equal(res.value.citations.length, 1);
    assert.equal(res.value.citations[0].sourceUrl, 'https://example.com/acme');
  });

  it('truncates to 5 when the LLM returns more', async () => {
    const substrate = new RecordingResearchSubstrate({
      [WS]: [{ title: 't', bodyExcerpt: 'b', sourceUrl: null, similarity: 0.5 }],
    });
    const llm = stubLlm(
      JSON.stringify({ bullets: ['a', 'b', 'c', 'd', 'e', 'f', 'g'] }),
    );
    const res = await runSkill({ call: call(), substrate, workspaceId: WS, llm });
    assert.ok(res.ok);
    if (!res.ok) return;
    assert.equal(res.value.bullets.length, BRIEF_BULLET_COUNT);
  });

  it('pads to 5 when the LLM returns fewer', async () => {
    const substrate = new RecordingResearchSubstrate({
      [WS]: [
        { title: 's1', bodyExcerpt: 'one', sourceUrl: null, similarity: 0.6 },
        { title: 's2', bodyExcerpt: 'two', sourceUrl: null, similarity: 0.6 },
      ],
    });
    const llm = stubLlm(JSON.stringify({ bullets: ['only one bullet'] }));
    const res = await runSkill({ call: call(), substrate, workspaceId: WS, llm });
    assert.ok(res.ok);
    if (!res.ok) return;
    assert.equal(res.value.bullets.length, BRIEF_BULLET_COUNT);
  });

  it('falls back to a templated 5-bullet brief on LLM failure (with grounding)', async () => {
    const substrate = new RecordingResearchSubstrate({
      [WS]: [
        { title: 'fact a', bodyExcerpt: 'detail a', sourceUrl: null, similarity: 0.7 },
      ],
    });
    const res = await runSkill({
      call: call(),
      substrate,
      workspaceId: WS,
      llm: failingLlm(),
    });
    assert.ok(res.ok);
    if (!res.ok) return;
    assert.equal(res.value.bullets.length, BRIEF_BULLET_COUNT);
  });

  it('emits 5 bullets naming the gap when grounding is empty (no LLM call)', async () => {
    const substrate = new RecordingResearchSubstrate({});
    let llmCalls = 0;
    const llm: LlmProvider = {
      name: 'test',
      complete: async () => {
        llmCalls += 1;
        return {
          ok: true,
          value: { text: '{}', stopReason: 'end_turn', usage: null, model: 's' },
        };
      },
    };
    const res = await runSkill({ call: call(), substrate, workspaceId: WS, llm });
    assert.ok(res.ok);
    if (!res.ok) return;
    assert.equal(llmCalls, 0);
    assert.equal(res.value.bullets.length, BRIEF_BULLET_COUNT);
    assert.equal(res.value.citations.length, 0);
  });

  it('rejects a call without id/title', async () => {
    const substrate = new RecordingResearchSubstrate({});
    const res = await runSkill({
      call: { id: '', title: '', startUtc: '2026-06-08T15:30:00Z' },
      substrate,
      workspaceId: WS,
    });
    assert.equal(res.ok, false);
    if (res.ok) return;
    assert.equal(res.error.code, 'INVALID_INPUT');
  });
});

describe('parseSubject', () => {
  it('strips the intro-call prefix and trailing person name', () => {
    assert.equal(parseSubject('Intro call — Acme Realty (Jane Doe)'), 'Acme Realty');
    assert.equal(parseSubject('Demo: Beta Insurance'), 'Beta Insurance');
  });
  it('picks the non-agentplain side of a slash title', () => {
    assert.equal(parseSubject('Gamma Co / agentplain'), 'Gamma Co');
  });
  it('falls back to the whole title', () => {
    assert.equal(parseSubject('Weekly sync'), 'Weekly sync');
  });
});

describe('__testing.normalizeToFive', () => {
  it('always yields 5 bullets', () => {
    const five = __testing.normalizeToFive([], 'X', [], false);
    assert.equal(five.length, 5);
  });
});
