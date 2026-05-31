/**
 * Wave-3 phase 4 — support-handler honors FEEDBACK rules.
 *
 * The skill accepts a pre-rendered feedbackRulesBlock string from the
 * run-for-* wrapper. When the block is non-empty it appears in the
 * user message; when empty, no CUSTOMER PREFERENCES header is rendered
 * (the honesty bar — never leak "(no preferences set)" into the prompt).
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import type { LlmProvider } from '@/lib/llm/types';
import { runSkill } from './skill';
import {
  RecordingApprovalSink,
} from './approval-sink';
import { RecordingKnowledgeSubstrate } from './knowledge-substrate';
import type {
  SupportHandlerInput,
  SupportRequestSnapshot,
} from './types';

const WORKSPACE_ID = 'ws-support-feedback-001';

function buildRequest(): SupportRequestSnapshot {
  return {
    id: 'sr-1',
    workspaceId: WORKSPACE_ID,
    workspaceName: 'Acme Brokerage',
    verticalSlug: 'real-estate',
    fromEmail: 'customer@example.com',
    fromName: 'Sam Customer',
    subject: 'Question about closing process',
    body: 'How long does closing usually take?',
    partnerName: 'Plaino',
    receivedAt: new Date('2026-05-30T12:00:00Z'),
  };
}

function buildInput(
  llm: LlmProvider,
  feedbackRulesBlock?: string,
): SupportHandlerInput {
  return {
    workspaceId: WORKSPACE_ID,
    request: buildRequest(),
    substrate: new RecordingKnowledgeSubstrate({
      [WORKSPACE_ID]: [
        {
          title: 'Closing process SOP',
          bodyExcerpt:
            'Standard closings take 30-45 days from contract acceptance.',
          sourceUrl: null,
          similarity: 0.78,
        },
      ],
    }),
    llm,
    sink: new RecordingApprovalSink(),
    feedbackRulesBlock,
  };
}

describe('support-handler — feedback rules', () => {
  it('inlines the feedbackRulesBlock in the LLM user message verbatim', async () => {
    let captured = '';
    const llm: LlmProvider = {
      name: 'test',
      complete: async (req) => {
        const last = req.messages[req.messages.length - 1];
        captured = typeof last.content === 'string'
          ? last.content
          : last.content.map((c) => (c.type === 'text' ? c.text : '')).join('');
        return {
          ok: true,
          value: {
            text: JSON.stringify({
              subject: 'Re: Question about closing process',
              body: 'Closings usually run 30-45 days from contract.',
              citedTitles: ['Closing process SOP'],
              reasoning: 'grounded',
            }),
            stopReason: 'end_turn',
            usage: null,
            model: 'test',
          },
        };
      },
    };
    const RULE_LINE =
      'WORKSPACE FEEDBACK (apply these): never mention specific timelines in the first reply.';
    const res = await runSkill(buildInput(llm, RULE_LINE));
    assert.ok(res.ok);
    assert.ok(
      captured.includes(RULE_LINE),
      'FEEDBACK rules must reach the LLM prompt verbatim',
    );
  });

  it('does NOT inject a CUSTOMER PREFERENCES header when the block is empty', async () => {
    let captured = '';
    const llm: LlmProvider = {
      name: 'test',
      complete: async (req) => {
        const last = req.messages[req.messages.length - 1];
        captured = typeof last.content === 'string'
          ? last.content
          : last.content.map((c) => (c.type === 'text' ? c.text : '')).join('');
        return {
          ok: true,
          value: {
            text: JSON.stringify({
              subject: 'Re: closing',
              body: 'Closings vary.',
              citedTitles: [],
              reasoning: 'grounded',
            }),
            stopReason: 'end_turn',
            usage: null,
            model: 'test',
          },
        };
      },
    };
    const res = await runSkill(buildInput(llm, ''));
    assert.ok(res.ok);
    assert.equal(
      captured.toLowerCase().includes('customer preferences'),
      false,
      'empty block must NOT leak a CUSTOMER PREFERENCES header',
    );
  });
});
