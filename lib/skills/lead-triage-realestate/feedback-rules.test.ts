/**
 * lib/skills/lead-triage-realestate/feedback-rules.test.ts
 *
 * Wave-4 — pins the LLM-refinement seam on lead-triage. Proves a
 * FEEDBACK rule + LLM override actually changes the category — without
 * a FEEDBACK rule the heuristic alone would bucket the lead as `cold`,
 * with the rule the LLM overrides to `hot`.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { runSkill } from './skill';
import { JsonLeadFetcher } from './json-fetcher';
import type { LlmProvider } from '@/lib/llm/types';
import type { LeadRecord } from './types';

const WORKSPACE_ID = 'ws-lead-001';

function lead(overrides: Partial<LeadRecord> = {}): LeadRecord {
  return {
    id: 'lead-1',
    fullName: 'Sam Driscoll',
    email: 'sam@example.com',
    phone: null,
    source: 'referral',
    inquiryText:
      'Just browsing for now — thinking about maybe selling next year, no rush.',
    inquirySubject: null,
    propertyContext: { type: 'general', mlsNumber: null, addressText: null },
    statedTimeline: 'someday',
    statedFinancing: null,
    receivedAt: new Date('2026-05-31T10:00:00.000Z'),
    hasBeenContacted: false,
    ...overrides,
  };
}

describe('lead-triage — LLM refinement seam (wave-4)', () => {
  it('without LLM, "just browsing" referral defaults to nurture / cold', async () => {
    const res = await runSkill({
      workspaceId: WORKSPACE_ID,
      fetcher: new JsonLeadFetcher({
        workspaceId: WORKSPACE_ID,
        leads: [lead()],
        agents: [],
        campaigns: [],
      }),
    });
    assert.ok(res.ok);
    const t = res.value.triaged[0];
    assert.ok(
      ['nurture', 'cold'].includes(t.category),
      `heuristic should bucket as nurture/cold; got ${t.category}`,
    );
  });

  it('FEEDBACK rule + LLM bumps the category to HOT', async () => {
    let llmCalls = 0;
    const stubLlm: LlmProvider = {
      name: 'test',
      complete: async () => {
        llmCalls += 1;
        return {
          ok: true,
          value: {
            text: JSON.stringify({
              overrides: [
                {
                  leadId: 'lead-1',
                  newCategory: 'hot',
                  ruleApplied:
                    'Any referral lead is HOT, regardless of stated timeline.',
                },
              ],
            }),
            stopReason: 'end_turn',
            usage: null,
            model: 'test-stub',
          },
        };
      },
    };
    const res = await runSkill({
      workspaceId: WORKSPACE_ID,
      fetcher: new JsonLeadFetcher({
        workspaceId: WORKSPACE_ID,
        leads: [lead()],
        agents: [],
        campaigns: [],
      }),
      llm: stubLlm,
      feedbackRulesBlock:
        'CUSTOMER PREFERENCES:\n- lead-triage: Any referral lead is HOT, regardless of stated timeline.',
    });
    assert.ok(res.ok);
    assert.equal(llmCalls, 1);
    const t = res.value.triaged[0];
    assert.equal(t.category, 'hot', `category should be overridden to hot; got ${t.category}`);
    assert.match(t.routing.rationale, /FEEDBACK override/);
    // Honesty: the SCORE stays the heuristic's — only the category was
    // overridden.
    assert.ok(t.scores.composite < 0.7);
  });

  it('LLM error degrades gracefully to heuristic', async () => {
    const stubLlm: LlmProvider = {
      name: 'test',
      complete: async () => ({
        ok: false,
        error: { code: 'UPSTREAM_ERROR', message: 'anthropic 500' },
      }),
    };
    const res = await runSkill({
      workspaceId: WORKSPACE_ID,
      fetcher: new JsonLeadFetcher({
        workspaceId: WORKSPACE_ID,
        leads: [lead()],
        agents: [],
        campaigns: [],
      }),
      llm: stubLlm,
      feedbackRulesBlock:
        'CUSTOMER PREFERENCES:\n- lead-triage: Any referral lead is HOT.',
    });
    assert.ok(res.ok);
    const t = res.value.triaged[0];
    assert.ok(['nurture', 'cold'].includes(t.category));
  });
});
