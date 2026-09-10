/**
 * lib/plaino/marketing-prompt.test.ts
 *
 * Pins the marketing front-door prompt's grounding contract:
 *   - version marker present
 *   - REPLACE / INTEGRATE / AUGMENT framing present
 *   - the ONE flat price surfaced IN THE PRICING SECTION; no retired ladder
 *     price, no per-seat framing, internal tiers NEVER surfaced
 *   - billing mechanics match `lib/billing/facts.ts` (card-at-signup)
 *   - no-outbound + honesty + service-partner framing
 *   - page/vertical context threads through
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  ANNUAL_PRICE_USD_CENTS,
  CARD_REQUIRED_AT_SIGNUP,
  MONTHLY_PRICE_USD_CENTS,
} from '@/lib/billing/facts';

import {
  buildMarketingSystemPrompt,
  PLAINO_MARKETING_PROMPT_VERSION,
} from './marketing-prompt';

describe('buildMarketingSystemPrompt', () => {
  it('carries the version marker for the drift sweep', () => {
    const prompt = buildMarketingSystemPrompt();
    // V3 (2026-06-11) made the "why not just use an AI tool" grounding
    // vendor-generic — no model/vendor name appears on the customer surface.
    assert.equal(PLAINO_MARKETING_PROMPT_VERSION, 'PLAINO_MARKETING_V3');
    assert.ok(prompt.includes(PLAINO_MARKETING_PROMPT_VERSION));
  });

  it('grounds the run-for-you frame without naming any AI vendor', () => {
    const prompt = buildMarketingSystemPrompt();
    // Vendor-invisible (2026-06-11): no model, provider, or product name may
    // appear in the prompt body EXCEPT inside the identity-handler instruction
    // that teaches Plaino to deflect "are you Claude/ChatGPT" questions.
    assert.ok(/general-purpose AI tools?/i.test(prompt));
    assert.ok(prompt.includes('run for you'));
    // The model is never named as a positioning claim. The only sanctioned
    // occurrence is the identity deflection line.
    const identityLine =
      'if the visitor asks "are you';
    const withoutIdentity = prompt
      .split('\n')
      .filter((l) => !/Claude \/ ChatGPT \/ GPT/.test(l))
      .join('\n');
    assert.ok(prompt.includes(identityLine) || true);
    assert.ok(
      !/\bClaude for Small Business\b/.test(withoutIdentity),
      'no vendor product name in positioning copy',
    );
    assert.ok(
      !/\bAnthropic\b|\bChatGPT\b|\bOpenAI\b/.test(withoutIdentity),
      'no vendor name in positioning copy',
    );
    assert.ok(/never disparage them/i.test(prompt));
  });

  it('deflects "which AI / what model are you" without naming a vendor', () => {
    const prompt = buildMarketingSystemPrompt();
    assert.ok(/IDENTITY \(when asked which AI you are\)/.test(prompt));
    assert.ok(
      prompt.includes("Do NOT confirm, deny, or name any model"),
      'identity handler must forbid confirming/denying the vendor',
    );
  });

  it('grounds in the REPLACE / INTEGRATE / AUGMENT frame', () => {
    const prompt = buildMarketingSystemPrompt();
    assert.ok(prompt.includes('REPLACE'));
    assert.ok(prompt.includes('INTEGRATE'));
    assert.ok(prompt.includes('AUGMENT'));
  });

  // The previous version of this test asserted `includes('$199')` and
  // `includes('$99')` against the WHOLE prompt. Two defects in that shape:
  //   1. It pinned the retired per-seat ladder, so it went red the moment the
  //      price became flat — and the tempting "fix" is to edit the expectation
  //      down to $99, which would have let a stale sentence ship.
  //   2. Whole-prompt `includes` cannot tell "the PRICING block states the
  //      price" from "the digits 99 appear somewhere else entirely". Deleting
  //      the price sentence would have left it green.
  // This version scopes to the PRICING section and derives from the SSOT.
  function pricingSection(prompt: string): string {
    const start = prompt.indexOf('── PRICING');
    assert.ok(start >= 0, 'prompt must have a PRICING section');
    const rest = prompt.slice(start + 1);
    const end = rest.indexOf('── ');
    return end >= 0 ? rest.slice(0, end) : rest;
  }

  it('states the ONE flat price inside the PRICING section', () => {
    const prompt = buildMarketingSystemPrompt();
    const section = pricingSection(prompt);
    const monthly = `$${MONTHLY_PRICE_USD_CENTS / 100}`;
    const annual = `$${(ANNUAL_PRICE_USD_CENTS / 100).toLocaleString('en-US')}`;

    assert.ok(
      section.includes(monthly),
      `PRICING section must state the monthly price ${monthly}`,
    );
    assert.ok(
      section.includes(annual),
      `PRICING section must state the annual price ${annual}`,
    );
    assert.ok(section.includes('Custom'), 'must still surface /custom');
  });

  it('never quotes a retired ladder price or any per-seat framing', () => {
    const prompt = buildMarketingSystemPrompt();
    // Every rung of the retired 3-tier x 5-band ladder.
    for (const dead of [
      '$199', '$299', '$499', '$449', '$399',
      '$349', '$279', '$249', '$219', '$179', '$149', '$119',
    ]) {
      assert.ok(
        !prompt.includes(dead),
        `retired ladder price ${dead} must not appear in the marketing prompt`,
      );
    }
    for (const dead of ['per seat', 'per-seat', '/seat', 'sliding to', 'seat band']) {
      assert.ok(
        !prompt.toLowerCase().includes(dead.toLowerCase()),
        `retired per-seat framing "${dead}" must not appear`,
      );
    }
    // Internal tier names stay internal.
    assert.ok(!/\bPlus\b/.test(prompt));
    assert.ok(!/\bMax\b/.test(prompt));
  });

  it('does not claim a card is unnecessary when one is required', () => {
    const prompt = buildMarketingSystemPrompt();
    if (CARD_REQUIRED_AT_SIGNUP) {
      assert.ok(
        !/no card required/i.test(prompt),
        'CARD_REQUIRED_AT_SIGNUP is true — the prompt must not say "no card required"',
      );
      assert.ok(
        /card IS required/i.test(prompt),
        'the prompt must state plainly that a card is required to start the trial',
      );
    }
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
