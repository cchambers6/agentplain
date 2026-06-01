/**
 * Behavior tests for the wave-9 picked-skills helper.
 *
 * Covers:
 *   - the honesty filter: only runtime: 'live' skills surface
 *   - inbox-gating: inbox-required skills hidden when no Gmail/Outlook
 *   - default-picked: every pickable defaults to `defaultPicked: true`
 *   - sanitizePickedSlugs: drops non-pickable + duplicate slugs
 *   - readPickedSlugs: malformed JSON returns []
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  PickedSkillSlugsSchema,
  readPickedSlugs,
  resolvePickableSkills,
  sanitizePickedSlugs,
} from './picked-skills';

describe('resolvePickableSkills', () => {
  it('returns the always-on cross-vertical set when no inbox is connected', () => {
    const out = resolvePickableSkills({ hasInbox: false });
    const slugs = out.map((p) => p.slug);
    // Cross-vertical skills that fire on internal-only data.
    assert.ok(slugs.includes('analytics-weekly-pulse-general'));
    assert.ok(slugs.includes('content-calendar-drafter-general'));
    assert.ok(slugs.includes('finance-pulse-general'));
    assert.ok(slugs.includes('compliance-watch-general'));
    // Inbox-required skills must NOT surface.
    assert.ok(!slugs.includes('inbox-triage-general'));
    assert.ok(!slugs.includes('office-admin'));
    assert.ok(!slugs.includes('chief-of-staff-scheduler'));
    assert.ok(!slugs.includes('follow-up-chaser-general'));
  });

  it('adds the inbox-gated skills when hasInbox is true', () => {
    const out = resolvePickableSkills({ hasInbox: true });
    const slugs = out.map((p) => p.slug);
    assert.ok(slugs.includes('inbox-triage-general'));
    assert.ok(slugs.includes('office-admin'));
    assert.ok(slugs.includes('chief-of-staff-scheduler'));
    assert.ok(slugs.includes('follow-up-chaser-general'));
    assert.ok(slugs.includes('process-doc-drafter-general'));
  });

  it('excludes always-excluded slugs that lack day-one customer input', () => {
    const out = resolvePickableSkills({ hasInbox: true });
    const slugs = out.map((p) => p.slug);
    // research-on-demand needs a /talk turn; support-handler needs a
    // /help submission; lead-triage needs an inbound CRM webhook.
    assert.ok(!slugs.includes('research-on-demand-general'));
    assert.ok(!slugs.includes('support-handler'));
    assert.ok(!slugs.includes('lead-triage-realestate'));
  });

  it('marks every pickable as defaultPicked: true', () => {
    const out = resolvePickableSkills({ hasInbox: true });
    assert.ok(out.length > 0);
    for (const p of out) {
      assert.equal(p.defaultPicked, true, `${p.slug} should default-pick`);
    }
  });

  it('every pickable carries a non-empty first-fire promise', () => {
    const out = resolvePickableSkills({ hasInbox: true });
    for (const p of out) {
      assert.ok(p.firstFirePromise.length > 0, `${p.slug} missing promise`);
      assert.ok(p.name.length > 0, `${p.slug} missing name`);
      assert.ok(p.discipline.length > 0, `${p.slug} missing discipline`);
    }
  });
});

describe('sanitizePickedSlugs', () => {
  it('drops slugs not present in the pickable set', () => {
    const pickable = resolvePickableSkills({ hasInbox: true });
    const out = sanitizePickedSlugs(
      ['inbox-triage-general', 'definitely-not-real', 'analytics-weekly-pulse-general'],
      pickable,
    );
    assert.deepEqual(out, ['inbox-triage-general', 'analytics-weekly-pulse-general']);
  });

  it('drops inbox-required slugs when those slugs are not pickable for this workspace', () => {
    const pickable = resolvePickableSkills({ hasInbox: false });
    // inbox-triage-general is NOT pickable without an inbox. A hand-
    // crafted POST that sneaks it through must be dropped.
    const out = sanitizePickedSlugs(['inbox-triage-general'], pickable);
    assert.deepEqual(out, []);
  });

  it('de-duplicates repeated slugs', () => {
    const pickable = resolvePickableSkills({ hasInbox: false });
    const out = sanitizePickedSlugs(
      [
        'analytics-weekly-pulse-general',
        'analytics-weekly-pulse-general',
        'finance-pulse-general',
      ],
      pickable,
    );
    assert.deepEqual(out, [
      'analytics-weekly-pulse-general',
      'finance-pulse-general',
    ]);
  });

  it('returns [] when given an empty input', () => {
    const pickable = resolvePickableSkills({ hasInbox: true });
    assert.deepEqual(sanitizePickedSlugs([], pickable), []);
  });
});

describe('readPickedSlugs', () => {
  it('parses a valid string array', () => {
    assert.deepEqual(readPickedSlugs(['a', 'b', 'c']), ['a', 'b', 'c']);
  });

  it('returns [] on null / undefined / non-array input', () => {
    assert.deepEqual(readPickedSlugs(null), []);
    assert.deepEqual(readPickedSlugs(undefined), []);
    assert.deepEqual(readPickedSlugs('not-an-array'), []);
    assert.deepEqual(readPickedSlugs(42), []);
    assert.deepEqual(readPickedSlugs({ foo: 'bar' }), []);
  });

  it('returns [] on array containing non-string entries', () => {
    assert.deepEqual(readPickedSlugs(['a', 1, 'b']), []);
  });
});

describe('PickedSkillSlugsSchema', () => {
  it('accepts an empty array', () => {
    const r = PickedSkillSlugsSchema.safeParse([]);
    assert.ok(r.success);
  });

  it('rejects a non-array', () => {
    const r = PickedSkillSlugsSchema.safeParse('foo');
    assert.ok(!r.success);
  });
});
