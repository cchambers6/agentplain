/**
 * Pins the wave-3 research-on-demand-general skill:
 *   - Empty substrate → placeholder brief, LLM is NOT called.
 *   - Substrate snippets present → LLM composes the brief, gaps include
 *     the "no web search wired" note.
 *   - Malformed LLM JSON → templated brief listing snippets verbatim.
 *   - Hard LLM failure with snippets → UPSTREAM_LLM_ERROR (no fake brief).
 *   - User prompt carries the snippet bodies so the LLM has the grounding.
 *   - Cross-workspace isolation — the substrate is asked with the right
 *     workspaceId.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import type { LlmProvider } from '@/lib/llm/types';
import { runSkill } from './skill';
import { RecordingResearchSubstrate } from './substrate';
import type { SupportContextSnippet } from '../support-handler';

const WORKSPACE_A = 'ws-research-a';
const WORKSPACE_B = 'ws-research-b';

function snip(overrides: Partial<SupportContextSnippet> = {}): SupportContextSnippet {
  return {
    title: 'Listing-coordinator SOP',
    bodyExcerpt: 'Every listing hand-off includes a 24h response window…',
    sourceUrl: null,
    similarity: 0.81,
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

describe('research-on-demand-general — skill', () => {
  it('emits a placeholder brief and does NOT call the LLM when the substrate is empty', async () => {
    const substrate = new RecordingResearchSubstrate({});
    let llmCalled = 0;
    const llm: LlmProvider = {
      name: 'test',
      complete: async () => {
        llmCalled += 1;
        return {
          ok: true,
          value: { text: '{}', stopReason: 'end_turn', usage: null, model: 'test-stub' },
        };
      },
    };
    const res = await runSkill({
      workspaceId: WORKSPACE_A,
      instructionText: 'Research how fast we typically respond to buyer inquiries',
      dispatcherReasoning: 'classifier: research',
      substrate,
      llm,
    });
    assert.ok(res.ok);
    assert.equal(llmCalled, 0);
    assert.equal(res.value.isPlaceholder, true);
    assert.equal(res.value.brief.keyFindings.length, 0);
    assert.ok(
      res.value.brief.gaps.some((g) => g.toLowerCase().includes('web search')),
      'every brief must NAME the web-search gap',
    );
  });

  it('composes a brief from substrate snippets and adds the web-search gap', async () => {
    const substrate = new RecordingResearchSubstrate({
      [WORKSPACE_A]: [snip(), snip({ title: 'Buyer-inquiry router playbook' })],
    });
    const llm = stubLlm(JSON.stringify({
      summary: 'Plaino reviewed your listing-coordinator SOP and buyer-inquiry router playbook.',
      keyFindings: [
        'Listing-coordinator SOP enforces a 24-hour first-response window.',
        'Buyer-inquiry router escalates after 4h of no response.',
      ],
      gaps: ['No data on outcomes by lead source.'],
    }));
    const res = await runSkill({
      workspaceId: WORKSPACE_A,
      instructionText: 'How fast do we respond to buyer inquiries on average?',
      dispatcherReasoning: 'classifier: research',
      substrate,
      llm,
    });
    assert.ok(res.ok);
    assert.equal(res.value.isPlaceholder, false);
    assert.equal(res.value.substrateSnippets.length, 2);
    assert.equal(res.value.brief.citations.length, 2);
    assert.equal(res.value.brief.keyFindings.length, 2);
    assert.ok(
      res.value.brief.gaps.some((g) => g.toLowerCase().includes('web search')),
      'web-search gap must always be present',
    );
  });

  it('falls back to a templated brief when the LLM returns malformed JSON', async () => {
    const substrate = new RecordingResearchSubstrate({
      [WORKSPACE_A]: [snip(), snip({ title: 'Compliance corpus' })],
    });
    const llm = stubLlm('not JSON');
    const res = await runSkill({
      workspaceId: WORKSPACE_A,
      instructionText: 'Research the firm\'s compliance corpus',
      dispatcherReasoning: 'classifier: research',
      substrate,
      llm,
    });
    assert.ok(res.ok);
    assert.equal(res.value.brief.keyFindings.length, 2);
    assert.match(res.value.brief.summary, /LLM-composed brief failed/);
  });

  it('returns ok=false on hard LLM failure (no fake brief)', async () => {
    const substrate = new RecordingResearchSubstrate({
      [WORKSPACE_A]: [snip()],
    });
    const llm: LlmProvider = {
      name: 'test',
      complete: async () => ({
        ok: false,
        error: { code: 'NETWORK', message: 'connect ECONNRESET' },
      }),
    };
    const res = await runSkill({
      workspaceId: WORKSPACE_A,
      instructionText: 'Research X',
      dispatcherReasoning: 'classifier: research',
      substrate,
      llm,
    });
    assert.ok(!res.ok);
    assert.equal(res.error.code, 'UPSTREAM_LLM_ERROR');
  });

  it('queries substrate with the right workspaceId (cross-workspace isolation)', async () => {
    const substrate = new RecordingResearchSubstrate({
      [WORKSPACE_A]: [snip({ title: 'WS-A doc' })],
      [WORKSPACE_B]: [snip({ title: 'WS-B doc' })],
    });
    const llm = stubLlm(JSON.stringify({
      summary: 's', keyFindings: [], gaps: [],
    }));
    const res = await runSkill({
      workspaceId: WORKSPACE_A,
      instructionText: 'q',
      dispatcherReasoning: 'r',
      substrate,
      llm,
    });
    assert.ok(res.ok);
    assert.equal(substrate.calls.length, 1);
    assert.equal(substrate.calls[0].workspaceId, WORKSPACE_A);
    assert.equal(res.value.substrateSnippets[0]?.title, 'WS-A doc');
  });

  // ── Wave-5 (theme #11 / ratif #8): live web-search grounding ──────────
  it('DROPS the "no web search wired" gap when groundingIsLive is true', async () => {
    const substrate = new RecordingResearchSubstrate({
      [WORKSPACE_A]: [
        snip({
          title: 'Georgia Seller Property Disclosure guide',
          sourceUrl: 'https://georgiarealtors.example.org/disclosure-guide',
        }),
      ],
    });
    const llm = stubLlm(
      JSON.stringify({
        summary: 'Live web sources confirm Georgia is caveat-emptor with active-concealment limits.',
        keyFindings: [
          'Sellers must not actively conceal known material defects.',
          'The GAR disclosure form covers structural and environmental items.',
        ],
        gaps: ['Plaino does not have web search wired yet.'],
      }),
    );
    const res = await runSkill({
      workspaceId: WORKSPACE_A,
      instructionText: 'What are Georgia seller disclosure requirements?',
      dispatcherReasoning: 'classifier: research',
      substrate,
      groundingIsLive: true,
      llm,
    });
    assert.ok(res.ok);
    // The model emitted the stale gap; the skill must strip it because the
    // brief IS now grounded on live sources.
    assert.ok(
      !res.value.brief.gaps.some((g) => g.toLowerCase().includes('web search')),
      'live-grounded briefs must NOT claim web search is unwired',
    );
    // Citations carry the real source URL.
    assert.equal(
      res.value.brief.citations[0]?.sourceUrl,
      'https://georgiarealtors.example.org/disclosure-guide',
    );
  });
});
