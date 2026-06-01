/**
 * Behavior tests for the wave-9 onboarding state machine.
 *
 * Covers:
 *   - STEP_ORDER is the documented 6-step sequence (5 input + done sentinel)
 *   - INPUT_STEPS excludes the `done` sentinel
 *   - nextStepAfter advances linearly; terminal step → done
 *   - isStepId narrows free-form strings to the union
 *   - readCompletedSteps tolerates malformed JSON
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  INPUT_STEPS,
  STEP_META,
  STEP_ORDER,
  isStepId,
  nextStepAfter,
  readCompletedSteps,
  type StepId,
} from './steps';

describe('STEP_ORDER + INPUT_STEPS', () => {
  it('is the documented six-step sequence', () => {
    assert.deepEqual(
      [...STEP_ORDER],
      [
        'confirm_details',
        'connect_integration',
        'pick_skills',
        'set_preferences',
        'first_fire_watch',
        'done',
      ],
    );
  });

  it('INPUT_STEPS drops the done sentinel', () => {
    assert.deepEqual(
      [...INPUT_STEPS],
      [
        'confirm_details',
        'connect_integration',
        'pick_skills',
        'set_preferences',
        'first_fire_watch',
      ],
    );
  });

  it('every STEP_ORDER entry has STEP_META', () => {
    for (const s of STEP_ORDER) {
      const meta = STEP_META[s];
      assert.ok(meta, `${s} missing STEP_META`);
      assert.equal(meta.id, s);
      assert.ok(meta.label.length > 0);
      assert.ok(meta.description.length > 0);
    }
  });
});

describe('nextStepAfter', () => {
  it('advances linearly through INPUT_STEPS', () => {
    assert.equal(nextStepAfter('confirm_details'), 'connect_integration');
    assert.equal(nextStepAfter('connect_integration'), 'pick_skills');
    assert.equal(nextStepAfter('pick_skills'), 'set_preferences');
    assert.equal(nextStepAfter('set_preferences'), 'first_fire_watch');
    assert.equal(nextStepAfter('first_fire_watch'), 'done');
  });

  it('returns done from done', () => {
    assert.equal(nextStepAfter('done'), 'done');
  });
});

describe('isStepId', () => {
  it('accepts known step ids', () => {
    for (const s of STEP_ORDER) assert.ok(isStepId(s));
  });

  it('rejects unknown strings + non-strings', () => {
    assert.ok(!isStepId('not_a_step'));
    assert.ok(!isStepId(''));
    assert.ok(!isStepId(null));
    assert.ok(!isStepId(undefined));
    assert.ok(!isStepId(42));
    assert.ok(!isStepId({}));
  });
});

describe('readCompletedSteps', () => {
  it('reads a valid string-array JSON column', () => {
    const state = {
      completedSteps: ['confirm_details', 'connect_integration'],
    } as { completedSteps: unknown } as Parameters<typeof readCompletedSteps>[0];
    const out = readCompletedSteps(state);
    assert.deepEqual(out, ['confirm_details', 'connect_integration']);
  });

  it('filters out non-step-id entries', () => {
    const state = {
      completedSteps: ['confirm_details', 'made_up_step', 42, null],
    } as { completedSteps: unknown } as Parameters<typeof readCompletedSteps>[0];
    const out = readCompletedSteps(state);
    assert.deepEqual(out, ['confirm_details']);
  });

  it('returns [] for non-array input', () => {
    const state = {
      completedSteps: { foo: 'bar' },
    } as { completedSteps: unknown } as Parameters<typeof readCompletedSteps>[0];
    assert.deepEqual(readCompletedSteps(state), []);
  });
});
