/**
 * lib/plaino/vertical-voice.test.ts
 *
 * Pins per-vertical Plaino voice: the five productized verticals get bespoke
 * voice; everything else falls back to the grounded general voice; and no
 * voice string leaks a banned term (model/vendor name, "SMB", exclamation).
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  GENERAL_VOICE,
  hasBespokeVoice,
  verticalVoiceFor,
} from './vertical-voice';

const BESPOKE = ['REAL_ESTATE', 'CPA', 'LAW', 'PROPERTY_MANAGEMENT'] as const;

describe('plaino vertical voice', () => {
  it('gives each productized vertical bespoke, non-generic voice', () => {
    for (const v of BESPOKE) {
      assert.ok(hasBespokeVoice(v), `${v} should have bespoke voice`);
      const voice = verticalVoiceFor(v);
      assert.notEqual(
        voice.understands,
        GENERAL_VOICE.understands,
        `${v} understands line should differ from the general fallback`,
      );
      assert.ok(voice.exampleAsks.length >= 2, `${v} needs example asks`);
      assert.ok(voice.promptContext.length > 40, `${v} needs prompt context`);
    }
  });

  it('falls back to the grounded general voice for unmapped verticals', () => {
    assert.equal(verticalVoiceFor(null), GENERAL_VOICE);
    assert.equal(verticalVoiceFor(undefined), GENERAL_VOICE);
    // A locked vertical without bespoke voice yet resolves to general —
    // grounded, never a fabricated specialization.
    assert.equal(verticalVoiceFor('MORTGAGE'), GENERAL_VOICE);
    assert.ok(!hasBespokeVoice('MORTGAGE'));
  });

  it('keeps each vertical voice on-brand (no banned terms)', () => {
    const all = [GENERAL_VOICE, ...BESPOKE.map((v) => verticalVoiceFor(v))];
    for (const voice of all) {
      const blob = [
        voice.label,
        voice.understands,
        voice.talkReality,
        voice.talkPrompt,
        voice.promptContext,
        ...voice.exampleAsks,
      ].join(' ');
      assert.doesNotMatch(blob, /\bSMB\b/, 'never say SMB');
      assert.doesNotMatch(blob, /claude|anthropic|chatgpt|\bgpt\b/i, 'never name a model/vendor');
      assert.doesNotMatch(blob, /!/, 'no exclamation points in Plaino voice');
    }
  });

  it('distinguishes the verticals it claims to understand', () => {
    // The whole point: a CPA, a lawyer, and a PM should not read the same
    // line. Assert the understands lines are pairwise distinct.
    const lines = BESPOKE.map((v) => verticalVoiceFor(v).understands);
    assert.equal(new Set(lines).size, lines.length, 'voices must be distinct');
  });
});
