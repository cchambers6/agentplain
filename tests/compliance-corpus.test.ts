/**
 * tests/compliance-corpus.test.ts
 *
 * Pins the integrity of the per-vertical compliance corpus drafts that
 * land alongside the sentinel agent in
 * `lib/agents/sentinel/corpus/<vertical>/`.
 *
 * What this test enforces:
 *   1. `loadCorpusFor(verticalSlug)` returns a corpus for each of the
 *      10 active verticals (matches `lib/verticals/index.ts`).
 *   2. Every corpus has metadata; status defaults to DRAFT and
 *      counselReviewer is null for the initial pre-counsel-review pass.
 *   3. Every rule in every corpus has: a non-empty ruleId, title,
 *      summary, literalText, AND a citation with source + url + accessedAt.
 *   4. Cross-reference entries (the property-management → real-estate
 *      Fair Housing crossref, title-escrow → mortgage RESPA crossref)
 *      are allowed to have placeholder text but must still cite an
 *      authoritative source.
 *   5. Per `feedback_no_guesses_no_estimates.md`: every rule has a
 *      citation URL and accessedAt date so counsel can audit staleness.
 *   6. Per `project_counsel_engaged.md`: DRAFT corpora ship with at
 *      least one openQuestion so counsel knows what to look at first.
 *
 * What this test DOES NOT enforce (intentionally — counsel does this):
 *   - The substantive accuracy of any literal text.
 *   - That every `[UNVERIFIED — needs counsel]` placeholder is replaced.
 *     (Drafter is allowed to ship placeholders; counsel review flips
 *     `unverified: false` after red-line.)
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  loadCorpusFor,
  listCorpusVerticals,
  type CorpusBundle,
} from "@/lib/agents/sentinel";
import { VERTICAL_SLUGS } from "@/lib/verticals";

// The 10 active verticals locked in `project_vertical_tier_mapping.md` /
// `lib/verticals/index.ts`. The compliance corpus must cover all 10.
const EXPECTED_VERTICAL_SLUGS = [
  "real-estate",
  "mortgage",
  "insurance",
  "property-management",
  "title-escrow",
  "recruiting",
  "home-services",
  "cpa",
  "law",
  "ria",
];

describe("compliance corpus — coverage", () => {
  it("registers a corpus for every active vertical", () => {
    const covered = new Set(listCorpusVerticals());
    for (const slug of EXPECTED_VERTICAL_SLUGS) {
      assert.equal(
        covered.has(slug),
        true,
        `Sentinel corpus is missing for vertical "${slug}". loadCorpusFor("${slug}") must return a CorpusBundle.`,
      );
    }
  });

  it("vertical registry and corpus registry agree on slugs", () => {
    const corpusSlugs = new Set(listCorpusVerticals());
    const verticalSlugs = new Set(VERTICAL_SLUGS);
    for (const slug of verticalSlugs) {
      assert.equal(
        corpusSlugs.has(slug),
        true,
        `Active vertical "${slug}" has no compliance corpus. Add one under lib/agents/sentinel/corpus/${slug}/.`,
      );
    }
  });

  it("returns null for an unknown vertical slug (does not silently fall through)", () => {
    const corpus = loadCorpusFor("not-a-real-vertical");
    assert.equal(
      corpus,
      null,
      "loadCorpusFor should return null for unregistered slugs, not throw and not return a default corpus.",
    );
  });
});

for (const slug of EXPECTED_VERTICAL_SLUGS) {
  describe(`compliance corpus — ${slug}`, () => {
    const corpus = loadCorpusFor(slug);

    it("loads without throwing", () => {
      assert.ok(corpus, `loadCorpusFor("${slug}") returned null`);
    });

    it("has matching verticalSlug on bundle and metadata", () => {
      const c = corpus as CorpusBundle;
      assert.equal(c.verticalSlug, slug);
      assert.equal(c.metadata.verticalSlug, slug);
    });

    it('metadata.status is "DRAFT" pre-counsel review', () => {
      const c = corpus as CorpusBundle;
      assert.equal(
        c.metadata.status,
        "DRAFT",
        `Corpus for "${slug}" should ship as DRAFT until counsel red-lines.`,
      );
    });

    it("metadata.counselReviewer is null pre-counsel review", () => {
      const c = corpus as CorpusBundle;
      assert.equal(
        c.metadata.counselReviewer,
        null,
        `Corpus for "${slug}" should leave counselReviewer null until counsel signs off.`,
      );
    });

    it("metadata.lastReviewedAt is an ISO date (YYYY-MM-DD)", () => {
      const c = corpus as CorpusBundle;
      assert.match(
        c.metadata.lastReviewedAt,
        /^\d{4}-\d{2}-\d{2}$/,
        `Corpus for "${slug}" should record lastReviewedAt as ISO YYYY-MM-DD; got "${c.metadata.lastReviewedAt}".`,
      );
    });

    it("metadata.openQuestions has at least one entry (counsel triage hook)", () => {
      const c = corpus as CorpusBundle;
      assert.ok(
        Array.isArray(c.metadata.openQuestions) &&
          (c.metadata.openQuestions?.length ?? 0) > 0,
        `Corpus for "${slug}" should ship with at least one openQuestion so counsel knows what to look at first.`,
      );
    });

    it("has at least one rule", () => {
      const c = corpus as CorpusBundle;
      assert.ok(
        c.rules.length > 0,
        `Corpus for "${slug}" must contain at least one rule. Found 0.`,
      );
    });

    for (const rule of (corpus as CorpusBundle).rules) {
      describe(`  rule: ${rule.ruleId}`, () => {
        it("has a non-empty ruleId", () => {
          assert.ok(rule.ruleId && rule.ruleId.trim().length > 0);
        });
        it("has a non-empty title", () => {
          assert.ok(rule.title && rule.title.trim().length > 0);
        });
        it("has a non-empty summary", () => {
          assert.ok(rule.summary && rule.summary.trim().length > 0);
        });
        it("has non-empty literalText", () => {
          assert.ok(
            rule.literalText && rule.literalText.trim().length > 0,
            `Rule "${rule.ruleId}" must have literalText (placeholder allowed if marked unverified).`,
          );
        });
        it("has a citation.source", () => {
          assert.ok(
            rule.citation.source && rule.citation.source.trim().length > 0,
            `Rule "${rule.ruleId}" must cite a source (statute / regulation / pronouncement number).`,
          );
        });
        it("has a citation.url", () => {
          assert.ok(
            rule.citation.url && rule.citation.url.startsWith("http"),
            `Rule "${rule.ruleId}" must cite a URL pointing at an authoritative published copy.`,
          );
        });
        it("has citation.accessedAt as ISO date", () => {
          assert.match(
            rule.citation.accessedAt,
            /^\d{4}-\d{2}-\d{2}$/,
            `Rule "${rule.ruleId}" citation.accessedAt should be ISO YYYY-MM-DD; got "${rule.citation.accessedAt}".`,
          );
        });
      });
    }
  });
}
