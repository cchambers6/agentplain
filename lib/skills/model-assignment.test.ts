/**
 * lib/skills/model-assignment.test.ts
 *
 * Guards the per-skill model registry against drift:
 *   - it covers every skill in SKILL_CATALOG (no skill is left untiered);
 *   - every tier resolves to a real MODEL_* id;
 *   - it never contradicts the routing-policy surface→model map for a skill
 *     whose sourceSurface is one of the canonical routed surfaces;
 *   - customer-read surfaces stay on Opus (Conner's calibration).
 *
 * Pure — no DB, no network.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { SKILL_CATALOG } from './registry';
import {
  SKILL_MODEL_REGISTRY,
  getSkillModel,
  tierDistribution,
} from './model-assignment';
import { MODEL_HAIKU, MODEL_OPUS, MODEL_SONNET } from '@/lib/llm/model-tiers';
import { DEFAULT_ROUTING_POLICY } from '@/lib/llm/routing-provider';

const KNOWN_MODELS = new Set([MODEL_OPUS, MODEL_SONNET, MODEL_HAIKU]);

describe('SKILL_MODEL_REGISTRY coverage', () => {
  it('assigns a tier to every catalog skill', () => {
    const missing = SKILL_CATALOG.map((s) => s.slug).filter(
      (slug) => getSkillModel(slug) === undefined,
    );
    assert.deepEqual(
      missing,
      [],
      `every SKILL_CATALOG slug must have a model assignment; missing: ${missing.join(', ')}`,
    );
  });

  it('has no registry entry for a slug not in the catalog', () => {
    const catalog = new Set(SKILL_CATALOG.map((s) => s.slug));
    const orphans = SKILL_MODEL_REGISTRY.filter((a) => !catalog.has(a.slug)).map(
      (a) => a.slug,
    );
    assert.deepEqual(orphans, [], `registry has orphan slugs: ${orphans.join(', ')}`);
  });

  it('every assignment resolves to a real MODEL_* id', () => {
    for (const a of SKILL_MODEL_REGISTRY) {
      assert.ok(
        KNOWN_MODELS.has(a.model),
        `${a.slug} → ${a.model} is not a known MODEL_* id`,
      );
    }
  });
});

describe('routing-policy consistency', () => {
  it('never contradicts the surface→model routing policy', () => {
    // For any skill tagged with a surface that the routing policy maps, the
    // registry tier MUST resolve to the same model — otherwise a call routed
    // by surface would land on a different tier than the skill declares.
    for (const a of SKILL_MODEL_REGISTRY) {
      // OTHER is the catch-all default bucket (Sonnet), not a per-skill
      // routing decision — a skill tagged OTHER may still declare any tier
      // explicitly, so it imposes no constraint.
      if (a.sourceSurface === 'OTHER') continue;
      const routed = (DEFAULT_ROUTING_POLICY as Record<string, string>)[a.sourceSurface];
      if (!routed) continue; // unmapped surfaces impose no constraint
      assert.equal(
        a.model,
        routed,
        `${a.slug} declares ${a.model} but routing maps ${a.sourceSurface} → ${routed}`,
      );
    }
  });
});

describe('calibration invariants', () => {
  it('keeps the customer-read support reply on Opus', () => {
    assert.equal(getSkillModel('support-handler'), MODEL_OPUS);
  });

  it('keeps compliance on Opus (highest stakes)', () => {
    assert.equal(getSkillModel('compliance-watch-general'), MODEL_OPUS);
  });

  it('runs the narrow inbox/admin classifiers on Haiku', () => {
    assert.equal(getSkillModel('inbox-triage-general'), MODEL_HAIKU);
    assert.equal(getSkillModel('office-admin'), MODEL_HAIKU);
  });

  it('tier distribution sums to the registry size', () => {
    const dist = tierDistribution();
    assert.equal(
      dist.opus + dist.sonnet + dist.haiku,
      SKILL_MODEL_REGISTRY.length,
    );
  });
});
