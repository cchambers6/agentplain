import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  VERTICAL_SLUGS,
  getAllVerticals,
  getVerticalContent,
  getVerticalTier,
} from "@/lib/verticals";
import type { VerticalTier } from "@/lib/verticals/types";

// Canonical tier mapping from the task brief + `project_vertical_tier_mapping.md`.
// This map is the test's source of truth; the content files are checked
// against it so a one-off content edit cannot silently move a vertical
// between tiers.
const EXPECTED_TIER: Record<string, VerticalTier> = {
  "real-estate": "regular",
  mortgage: "regular",
  insurance: "regular",
  "property-management": "regular",
  "title-escrow": "regular",
  recruiting: "regular",
  "home-services": "plus",
  cpa: "plus",
  law: "max",
  ria: "max",
};

const EXPECTED_SLUGS = Object.keys(EXPECTED_TIER).sort();

describe("vertical-routes", () => {
  it("registers exactly the 10 enumerated verticals (no more, no fewer)", () => {
    // NOTE: task brief header says "Verticals (9)" but enumerates 10 names
    // (6 regular + 2 plus + 2 max). The enumerated list is authoritative.
    // Flagged for Conner in the PR description.
    const registered = [...VERTICAL_SLUGS].sort();
    assert.deepEqual(
      registered,
      EXPECTED_SLUGS,
      "Verticals must match the locked set per feedback_no_new_verticals_finish_locked.md",
    );
  });

  it("maps each vertical to the correct tier", () => {
    for (const slug of EXPECTED_SLUGS) {
      const actual = getVerticalTier(slug);
      assert.equal(
        actual,
        EXPECTED_TIER[slug],
        `Tier drift on ${slug} — expected ${EXPECTED_TIER[slug]}, got ${actual}`,
      );
    }
  });

  it("resolves every vertical slug to a populated content object", () => {
    for (const slug of EXPECTED_SLUGS) {
      const content = getVerticalContent(slug);
      assert.ok(content, `getVerticalContent(${slug}) returned null`);
      assert.equal(
        content.slug,
        slug,
        `Content for ${slug} has slug mismatch: ${content.slug}`,
      );

      // Hero shape
      assert.ok(content.hero.headline.length > 10, `${slug} hero headline too short`);
      assert.ok(content.hero.valueProp.length > 40, `${slug} hero valueProp too short`);

      // JTBD shape — at least one role with at least three rows
      assert.ok(
        content.jtbdTables.length >= 1,
        `${slug} has no JTBD role tables`,
      );
      const totalRows = content.jtbdTables.reduce(
        (sum, t) => sum + t.rows.length,
        0,
      );
      assert.ok(
        totalRows >= 3,
        `${slug} has fewer than 3 JTBD rows total (${totalRows})`,
      );

      // ROI shape
      assert.ok(content.roi.multiplier.length > 0, `${slug} ROI missing multiplier`);
      assert.ok(content.roi.math.length > 30, `${slug} ROI math too thin`);
      assert.ok(
        content.roi.citation.length > 20,
        `${slug} ROI missing citation (every claim must cite a source per feedback_no_guesses_no_estimates.md)`,
      );

      // Claims triad shape
      assert.ok(
        content.claims.replace.length > 0,
        `${slug} claims.replace is empty`,
      );
      assert.ok(
        content.claims.integrate.length > 0,
        `${slug} claims.integrate is empty`,
      );
      assert.ok(
        content.claims.augment.length > 0,
        `${slug} claims.augment is empty`,
      );

      // Integrations shape — none shipped today is acceptable, but
      // planned must be populated with a window.
      assert.ok(
        content.integrations.planned.length > 0,
        `${slug} has no planned integrations (must list per project_integration_roadmap.md)`,
      );
      assert.ok(
        content.integrations.plannedWindow.length > 0,
        `${slug} missing plannedWindow`,
      );
    }
  });

  it("getAllVerticals returns all 10 in registry order", () => {
    const all = getAllVerticals();
    assert.equal(all.length, EXPECTED_SLUGS.length);
    const slugs = all.map((v) => v.slug).sort();
    assert.deepEqual(slugs, EXPECTED_SLUGS);
  });

  it("returns null for an unknown vertical slug", () => {
    assert.equal(getVerticalContent("nonexistent-vertical"), null);
    assert.equal(getVerticalTier("nonexistent-vertical"), null);
  });

  it("flags JTBD tables marked draft so the gap is visible in the UI", () => {
    // The 9 non-real-estate verticals have no canonical Phase 0 JTBD table —
    // they MUST mark draft:true on every role so the renderer surfaces the
    // [DRAFT] badge. Only real-estate has a ratified table.
    const realEstate = getVerticalContent("real-estate");
    assert.ok(realEstate);
    for (const t of realEstate.jtbdTables) {
      assert.notEqual(
        t.draft,
        true,
        "real-estate JTBD tables should NOT be draft (Phase 0 spec is ratified)",
      );
    }

    const otherSlugs = EXPECTED_SLUGS.filter((s) => s !== "real-estate");
    for (const slug of otherSlugs) {
      const c = getVerticalContent(slug);
      assert.ok(c);
      const allDraft = c.jtbdTables.every((t) => t.draft === true);
      assert.equal(
        allDraft,
        true,
        `${slug} must mark every JTBD role table draft:true until vertical-CEO ratifies`,
      );
    }
  });
});
