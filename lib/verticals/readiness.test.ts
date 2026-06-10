/**
 * Tests for the vertical-readiness resolver (pfd-4).
 *
 * The bar: registry truth drives the gate, and the gate fails CLOSED
 * (toward the honest waitlist, never toward taking money) when the
 * registry can't be read.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveVerticalReadiness,
  isVerticalSupportedSafe,
  resolveVerticalReadinessForEnum,
  verticalReadinessSelfCheck,
  SKILLS_WITH_PRODUCTION_CALLER,
} from './readiness';

describe('resolveVerticalReadiness — registry truth', () => {
  it('real-estate is SUPPORTED (lead-triage is runtime:live + has a production caller)', () => {
    const r = resolveVerticalReadiness('real-estate');
    assert.equal(r.supported, true);
    assert.equal(r.reason, 'supported');
    assert.equal(r.killerWorkflowSkillSlug, 'lead-triage-realestate');
  });

  it('cpa is UNSUPPORTED — month-end-close-cpa is schema-only (no runtime field)', () => {
    const r = resolveVerticalReadiness('cpa');
    assert.equal(r.supported, false);
    // The skill is in the catalog but not live → skill-not-live.
    assert.equal(r.reason, 'skill-not-live');
    assert.equal(r.killerWorkflowSkillSlug, 'month-end-close-cpa');
  });

  it('home-services is UNSUPPORTED — runtime defaults schema-only (the audit 🚨)', () => {
    const r = resolveVerticalReadiness('home-services');
    assert.equal(r.supported, false);
    assert.equal(r.reason, 'skill-not-live');
  });

  it('law is UNSUPPORTED — law-intake-conflict-screen is schema-only', () => {
    const r = resolveVerticalReadiness('law');
    assert.equal(r.supported, false);
    assert.equal(r.reason, 'skill-not-live');
  });

  it('insurance / mortgage / property-management / title-escrow / ria are UNSUPPORTED', () => {
    for (const slug of [
      'insurance',
      'mortgage',
      'property-management',
      'title-escrow',
      'ria',
    ]) {
      const r = resolveVerticalReadiness(slug);
      assert.equal(r.supported, false, `${slug} must be unsupported`);
    }
  });

  it('recruiting is UNSUPPORTED — no flagship workflow defined', () => {
    const r = resolveVerticalReadiness('recruiting');
    assert.equal(r.supported, false);
    assert.equal(r.reason, 'no-killer-workflow-defined');
    assert.equal(r.killerWorkflowSkillSlug, null);
  });

  it('an unknown slug resolves to unsupported (no-killer-workflow) without throwing', () => {
    const r = resolveVerticalReadiness('quantum-widgets');
    assert.equal(r.supported, false);
    assert.equal(r.reason, 'no-killer-workflow-defined');
  });

  it('is case + whitespace insensitive on the slug', () => {
    assert.equal(resolveVerticalReadiness('  REAL-ESTATE ').supported, true);
  });
});

describe('isVerticalSupportedSafe — fail closed', () => {
  it('returns true only for genuinely supported verticals', () => {
    assert.equal(isVerticalSupportedSafe('real-estate'), true);
    assert.equal(isVerticalSupportedSafe('cpa'), false);
    assert.equal(isVerticalSupportedSafe('recruiting'), false);
  });

  it('fails CLOSED (false) and calls onError when the resolver throws', () => {
    // Force a throw by passing a non-string — resolveVerticalReadiness
    // calls .trim() which throws on a non-string. The safe wrapper must
    // swallow it and return false (→ waitlist, not money).
    let captured: unknown = null;
    const result = isVerticalSupportedSafe(
      undefined as unknown as string,
      (err) => {
        captured = err;
      },
    );
    assert.equal(result, false, 'must fail toward waitlist, never toward taking money');
    assert.ok(captured instanceof Error, 'onError received the throw');
  });

  it('an onError that itself throws never re-throws into the caller', () => {
    assert.doesNotThrow(() => {
      const r = isVerticalSupportedSafe(undefined as unknown as string, () => {
        throw new Error('logger blew up');
      });
      assert.equal(r, false);
    });
  });
});

describe('resolveVerticalReadinessForEnum', () => {
  it('REAL_ESTATE enum resolves supported', () => {
    assert.equal(resolveVerticalReadinessForEnum('REAL_ESTATE').supported, true);
  });
  it('CPA enum resolves unsupported', () => {
    assert.equal(resolveVerticalReadinessForEnum('CPA').supported, false);
  });
});

describe('verticalReadinessSelfCheck — manifest cannot silently lie', () => {
  it('reports no problems (enum↔slug agree, every caller-skill is catalog-live)', () => {
    assert.deepEqual(verticalReadinessSelfCheck(), []);
  });

  it('only lead-triage-realestate has a production caller today', () => {
    assert.deepEqual([...SKILLS_WITH_PRODUCTION_CALLER], ['lead-triage-realestate']);
  });
});
