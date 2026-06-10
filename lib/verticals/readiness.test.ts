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

<<<<<<< HEAD
  it('cpa is SUPPORTED (pfd-8 — month-end-close-cpa is runtime:live + has the monthly sweep)', () => {
    const r = resolveVerticalReadiness('cpa');
    assert.equal(r.supported, true);
    assert.equal(r.reason, 'supported');
    assert.equal(r.killerWorkflowSkillSlug, 'month-end-close-cpa');
  });

  it('home-services is UNSUPPORTED — runtime still schema-only (sweep ships in PR #207)', () => {
    // Honest: home-services-estimate-followup has no sweep on this branch.
    // It flips live when PR #207 (the sweep) merges; until then the gate
    // correctly waitlists it.
=======
  it('cpa is UNSUPPORTED — month-end-close-cpa is schema-only (no runtime field)', () => {
    const r = resolveVerticalReadiness('cpa');
    assert.equal(r.supported, false);
    // The skill is in the catalog but not live → skill-not-live.
    assert.equal(r.reason, 'skill-not-live');
    assert.equal(r.killerWorkflowSkillSlug, 'month-end-close-cpa');
  });

  it('home-services is UNSUPPORTED — runtime defaults schema-only (the audit 🚨)', () => {
>>>>>>> f597d4c (feat(pfd-4): unsupported-vertical signup gating + leak-path auto-refund)
    const r = resolveVerticalReadiness('home-services');
    assert.equal(r.supported, false);
    assert.equal(r.reason, 'skill-not-live');
  });

<<<<<<< HEAD
  it('law is SUPPORTED (pfd-8 — law-intake-conflict-screen is runtime:live + has the daily sweep)', () => {
    const r = resolveVerticalReadiness('law');
    assert.equal(r.supported, true);
    assert.equal(r.reason, 'supported');
    assert.equal(r.killerWorkflowSkillSlug, 'law-intake-conflict-screen');
=======
  it('law is UNSUPPORTED — law-intake-conflict-screen is schema-only', () => {
    const r = resolveVerticalReadiness('law');
    assert.equal(r.supported, false);
    assert.equal(r.reason, 'skill-not-live');
>>>>>>> f597d4c (feat(pfd-4): unsupported-vertical signup gating + leak-path auto-refund)
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
<<<<<<< HEAD
    // cpa + law are now supported (pfd-8 wired their callers); the
    // credential-gated + no-flagship verticals stay unsupported.
    assert.equal(isVerticalSupportedSafe('cpa'), true);
    assert.equal(isVerticalSupportedSafe('insurance'), false);
=======
    assert.equal(isVerticalSupportedSafe('cpa'), false);
>>>>>>> f597d4c (feat(pfd-4): unsupported-vertical signup gating + leak-path auto-refund)
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
<<<<<<< HEAD
  it('CPA enum resolves supported (pfd-8)', () => {
    assert.equal(resolveVerticalReadinessForEnum('CPA').supported, true);
  });
  it('INSURANCE enum resolves unsupported (credential-gated)', () => {
    assert.equal(resolveVerticalReadinessForEnum('INSURANCE').supported, false);
=======
  it('CPA enum resolves unsupported', () => {
    assert.equal(resolveVerticalReadinessForEnum('CPA').supported, false);
>>>>>>> f597d4c (feat(pfd-4): unsupported-vertical signup gating + leak-path auto-refund)
  });
});

describe('verticalReadinessSelfCheck — manifest cannot silently lie', () => {
  it('reports no problems (enum↔slug agree, every caller-skill is catalog-live)', () => {
    assert.deepEqual(verticalReadinessSelfCheck(), []);
  });

<<<<<<< HEAD
  it('the four wired killer skills have production callers today (pfd-8)', () => {
    assert.deepEqual(
      [...SKILLS_WITH_PRODUCTION_CALLER].sort(),
      [
        'invoice-chase-general',
        'law-intake-conflict-screen',
        'lead-triage-realestate',
        'month-end-close-cpa',
      ],
    );
=======
  it('only lead-triage-realestate has a production caller today', () => {
    assert.deepEqual([...SKILLS_WITH_PRODUCTION_CALLER], ['lead-triage-realestate']);
>>>>>>> f597d4c (feat(pfd-4): unsupported-vertical signup gating + leak-path auto-refund)
  });
});
