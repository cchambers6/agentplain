/**
 * lib/plaino/support-prompt.test.ts
 *
 * Pins the in-app support prompt's contract:
 *   - version marker
 *   - workspace context (name / vertical / tier / integrations / queue) present
 *   - knowledge snippets rendered with titles for citation
 *   - the three resolution paths + no-outbound guardrail present
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  buildSupportSystemPrompt,
  PLAINO_SUPPORT_PROMPT_VERSION,
  type SupportPromptContext,
} from './support-prompt';

const BASE: SupportPromptContext = {
  workspaceName: 'Peachtree Realty',
  verticalSlug: 'real-estate',
  tierDisplayName: 'Regular',
  connectedIntegrations: ['Gmail', 'Follow Up Boss'],
  pendingApprovalsCount: 3,
  knowledge: [
    {
      title: 'How approvals work',
      body: 'Every draft lands in your approval queue before anything is sent.',
      sourceUrl: null,
    },
  ],
};

describe('buildSupportSystemPrompt', () => {
  it('carries the version marker', () => {
    const prompt = buildSupportSystemPrompt(BASE);
    assert.equal(PLAINO_SUPPORT_PROMPT_VERSION, 'PLAINO_SUPPORT_V1');
    assert.ok(prompt.includes(PLAINO_SUPPORT_PROMPT_VERSION));
  });

  it('injects the workspace context', () => {
    const prompt = buildSupportSystemPrompt(BASE);
    assert.ok(prompt.includes('Peachtree Realty'));
    assert.ok(prompt.includes('real-estate'));
    assert.ok(prompt.includes('Regular'));
    assert.ok(prompt.includes('Gmail'));
    assert.ok(prompt.includes('Follow Up Boss'));
    assert.ok(prompt.includes('3'));
  });

  it('renders knowledge snippets with their titles for citation', () => {
    const prompt = buildSupportSystemPrompt(BASE);
    assert.ok(prompt.includes('How approvals work'));
    assert.ok(prompt.includes('approval queue'));
  });

  it('handles the empty-knowledge + no-integrations case honestly', () => {
    const prompt = buildSupportSystemPrompt({
      ...BASE,
      connectedIntegrations: [],
      knowledge: [],
    });
    assert.ok(prompt.includes('none connected yet'));
    assert.ok(prompt.includes('no relevant snippets found'));
  });

  it('describes all three resolution paths + no-outbound', () => {
    const prompt = buildSupportSystemPrompt(BASE);
    assert.ok(prompt.includes('ANSWER'));
    assert.ok(prompt.includes('DRAFT'));
    assert.ok(prompt.includes('ESCALATE'));
    assert.ok(prompt.includes('NO OUTBOUND'));
  });

  it('bounds an over-long snippet body', () => {
    const longBody = 'x'.repeat(2000);
    const prompt = buildSupportSystemPrompt({
      ...BASE,
      knowledge: [{ title: 'Long doc', body: longBody, sourceUrl: null }],
    });
    assert.ok(prompt.includes('…'));
    assert.ok(!prompt.includes('x'.repeat(800)));
  });
});
