import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  VOICE_PLAYBOOKS,
  DEFAULT_PLAYBOOK,
  playbookForVerticalSlug,
  playbookForVertical,
  playbookById,
} from './index';
import { verticalEnumFromSlug } from '@/lib/auth/vertical-enum';

describe('voice playbooks registry', () => {
  it('ships the five required scenarios', () => {
    const ids = new Set(VOICE_PLAYBOOKS.map((p) => p.id));
    assert.ok(ids.has('cpa-after-hours-intake'));
    assert.ok(ids.has('real-estate-buyer-lead-callback'));
    assert.ok(ids.has('law-inbound-intake'));
    assert.ok(ids.has('property-management-maintenance-triage'));
    assert.ok(ids.has('general-receptionist'));
  });

  it('every playbook is well-formed', () => {
    for (const p of VOICE_PLAYBOOKS) {
      assert.ok(p.id.length > 0, `${p.id}: id`);
      assert.ok(p.systemPrompt.length > 200, `${p.id}: system prompt should be substantive`);
      assert.ok(p.welcomeGreeting.length > 0, `${p.id}: greeting`);
      assert.ok(p.defaultVoice.length > 0, `${p.id}: voice`);
      assert.ok(p.guardrails.length >= 2, `${p.id}: guardrails`);
      assert.ok(p.label.length > 0, `${p.id}: label`);
    }
  });

  it('non-general playbooks map to a real vertical slug', () => {
    for (const p of VOICE_PLAYBOOKS) {
      if (p.verticalSlug === 'general') {
        assert.equal(p.vertical, null);
        continue;
      }
      assert.notEqual(
        verticalEnumFromSlug(p.verticalSlug),
        null,
        `${p.id}: ${p.verticalSlug} should be a known vertical slug`,
      );
      // The playbook's own vertical enum must agree with the slug mapping.
      assert.equal(p.vertical, verticalEnumFromSlug(p.verticalSlug), `${p.id}: enum/slug agree`);
    }
  });

  it('no playbook names the underlying model vendor on the customer surface', () => {
    const banned = /\b(claude|anthropic)\b/i;
    for (const p of VOICE_PLAYBOOKS) {
      assert.doesNotMatch(p.systemPrompt, banned, `${p.id}: system prompt`);
      assert.doesNotMatch(p.welcomeGreeting, banned, `${p.id}: greeting`);
    }
  });

  it('resolves by slug, enum, and id with a general fallback', () => {
    assert.equal(playbookForVerticalSlug('cpa').id, 'cpa-after-hours-intake');
    assert.equal(playbookForVerticalSlug('real-estate').id, 'real-estate-buyer-lead-callback');
    assert.equal(playbookForVerticalSlug('mortgage').id, DEFAULT_PLAYBOOK.id, 'unknown → general');
    assert.equal(playbookForVerticalSlug(null).id, DEFAULT_PLAYBOOK.id);
    assert.equal(playbookForVertical('LAW').id, 'law-inbound-intake');
    assert.equal(playbookForVertical(null).id, DEFAULT_PLAYBOOK.id);
    assert.equal(playbookById('property-management-maintenance-triage')?.verticalSlug, 'property-management');
    assert.equal(playbookById('does-not-exist'), null);
  });
});
