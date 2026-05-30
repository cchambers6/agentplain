/**
 * lib/skills/prompts/compose.test.ts
 *
 * Pins the composer's wave-1 extension — `feedbackRulesBlock` injects
 * into every skill prompt so customer-set PREFERENCE rules ride into
 * categorize / coordinate / schedule / draft alongside the existing
 * preferences + customer-context blocks.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { composePromptBundle } from './compose';
import type { VerticalPromptBundle } from './index';

const BASE: VerticalPromptBundle = {
  verticalSlug: 'real-estate',
  verticalName: 'Real Estate',
  categorize:
    'CATEGORIZE_MARKER\nVERTICAL_SLUG: real-estate\nBase categorize body line.',
  draft:
    'DRAFT_MARKER\nVERTICAL_SLUG: real-estate\nBase draft body line.',
  schedule:
    'SCHEDULE_MARKER\nVERTICAL_SLUG: real-estate\nBase schedule body line.',
  coordinate:
    'COORDINATE_MARKER\nVERTICAL_SLUG: real-estate\nBase coordinate body line.',
};

describe('composePromptBundle — feedbackRulesBlock', () => {
  it('injects the rules block into all four skill prompts', () => {
    const rulesBlock =
      'CUSTOMER PREFERENCES (apply where relevant):\n- [scope=inbox-triage] Always flag county-clerk mail';
    const out = composePromptBundle(BASE, {
      feedbackRulesBlock: rulesBlock,
    });
    assert.match(out.categorize, /CUSTOMER PREFERENCES/);
    assert.match(out.categorize, /county-clerk mail/);
    assert.match(out.draft, /CUSTOMER PREFERENCES/);
    assert.match(out.draft, /county-clerk mail/);
    assert.match(out.schedule, /CUSTOMER PREFERENCES/);
    assert.match(out.coordinate, /CUSTOMER PREFERENCES/);
  });

  it('preserves the VERTICAL_SLUG header line so the test provider can still route', () => {
    const out = composePromptBundle(BASE, {
      feedbackRulesBlock: 'CUSTOMER PREFERENCES (apply where relevant):\n- [scope=general] X',
    });
    assert.match(out.categorize, /^CATEGORIZE_MARKER\nVERTICAL_SLUG: real-estate\n/);
    assert.match(out.draft, /^DRAFT_MARKER\nVERTICAL_SLUG: real-estate\n/);
  });

  it('empty feedbackRulesBlock + empty other blocks returns the base bundle unmodified', () => {
    const out = composePromptBundle(BASE, { feedbackRulesBlock: '' });
    assert.strictEqual(out, BASE);
  });

  it('whitespace-only feedbackRulesBlock is treated as empty (no header injected)', () => {
    const out = composePromptBundle(BASE, { feedbackRulesBlock: '   \n  ' });
    assert.equal(out.categorize.includes('CUSTOMER PREFERENCES'), false);
  });

  it('rulesBlock + preferencesBlock + customerContextBlock all coexist', () => {
    const out = composePromptBundle(BASE, {
      preferencesBlockForOther: 'WORKSPACE PREFERENCES: warm tone',
      customerContextBlock: 'CUSTOMER CONTEXT: prior thread snippets',
      feedbackRulesBlock: 'CUSTOMER PREFERENCES (apply where relevant):\n- [scope=general] flag fair-housing',
    });
    // categorize gets preferences + rules (no customer context — that's
    // for draft + coordinate only).
    assert.match(out.categorize, /WORKSPACE PREFERENCES/);
    assert.match(out.categorize, /CUSTOMER PREFERENCES/);
    assert.equal(out.categorize.includes('CUSTOMER CONTEXT'), false);
    // draft gets all three.
    assert.match(out.draft, /CUSTOMER PREFERENCES/);
    assert.match(out.draft, /CUSTOMER CONTEXT/);
  });
});
