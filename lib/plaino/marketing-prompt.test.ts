/**
 * lib/plaino/marketing-prompt.test.ts
 *
 * Pins the marketing front-door prompt's grounding contract:
 *   - version marker present
 *   - REPLACE / INTEGRATE / AUGMENT framing present
 *   - Regular + Custom pricing surfaced; internal tiers NEVER surfaced
 *   - no-outbound + honesty + service-partner framing
 *   - page/vertical context threads through
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  buildMarketingSystemPrompt,
  PLAINO_MARKETING_PROMPT_VERSION,
} from './marketing-prompt';

describe('buildMarketingSystemPrompt', () => {
  it('carries the version marker for the drift sweep', () => {
    const prompt = buildMarketingSystemPrompt();
    assert.equal(PLAINO_MARKETING_PROMPT_VERSION, 'PLAINO_MARKETING_V1');
    assert.ok(prompt.includes(PLAINO_MARKETING_PROMPT_VERSION));
  });

  it('grounds in the REPLACE / INTEGRATE / AUGMENT frame', () => {
    const prompt = buildMarketingSystemPrompt();
    assert.ok(prompt.includes('REPLACE'));
    assert.ok(prompt.includes('INTEGRATE'));
    assert.ok(prompt.includes('AUGMENT'));
  });

  it('surfaces Regular + Custom pricing but never the internal tiers', () => {
    const prompt = buildMarketingSystemPrompt();
    assert.ok(prompt.includes('Regular'));
    assert.ok(prompt.includes('Custom'));
    assert.ok(prompt.includes('$199'));
    assert.ok(prompt.includes('$99'));
    // Plus / Max stay schema-only (project_stripe_both_surfaces). The prompt
    // must not name them as customer-facing tiers.
    assert.ok(!/\bPlus\b/.test(prompt));
    assert.ok(!/\bMax\b/.test(prompt));
  });

  it('holds the no-outbound + honesty + service-partner guardrails', () => {
    const prompt = buildMarketingSystemPrompt();
    assert.ok(prompt.includes('NO OUTBOUND'));
    assert.ok(prompt.includes('HONESTY'));
    assert.ok(prompt.includes('service partner'));
    // Audience is "local businesses" (the prompt names SMB only as a
    // forbidden synonym, so we assert the positive framing is present).
    assert.ok(prompt.includes('local businesses'));
  });

  it('threads page + vertical context when provided', () => {
    const generic = buildMarketingSystemPrompt();
    assert.ok(generic.includes('from the agentplain site'));

    const scoped = buildMarketingSystemPrompt({
      sourcePage: '/real-estate',
      verticalSlug: 'real-estate',
    });
    assert.ok(scoped.includes('/real-estate'));
    assert.ok(scoped.includes('real-estate page'));
  });

  it('instructs the model to never literalize the persona', () => {
    const prompt = buildMarketingSystemPrompt();
    // The persona scaffolding forbids the mascot reveal (it names "woof" as
    // an example of what NOT to say) — assert the guardrail is present.
    assert.ok(prompt.includes('DO NOT DISCLOSE'));
    assert.ok(prompt.includes('literalize'));
  });
});
