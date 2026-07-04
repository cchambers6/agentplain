import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  VERTICAL_SLUGS,
  ON_RAMP_SLUGS,
  getAllVerticals,
  getAllVerticalsIncludingOnRamps,
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

  it("no JTBD role table is marked draft on any vertical", () => {
    // Inverted 2026-05-12 (`feat/agentplain-vertical-jtbd-tables`): the 9
    // non-real-estate verticals were ratified against published role
    // workflows. From this point forward, NO vertical may surface
    // `[DRAFT — needs vertical-CEO review]` to customers. A new role added
    // by a future PR ships ratified or it does not ship.
    //
    // Anyone re-introducing draft:true is failing fast here. To intentionally
    // surface a [DRAFT] badge (e.g., for a new vertical mid-bring-up), the
    // expected pattern is: land the new vertical's content in a feature
    // branch with this test excluded for that slug, ratify, then re-enable.
    for (const slug of EXPECTED_SLUGS) {
      const c = getVerticalContent(slug);
      assert.ok(c);
      const draftTables = c.jtbdTables.filter((t) => t.draft === true);
      assert.equal(
        draftTables.length,
        0,
        `${slug} has ${draftTables.length} JTBD role table(s) still marked draft:true — ratify before merging (see lib/verticals/${slug}/content.ts)`,
      );
    }
  });

  // Integrations honesty tiers (wave-10) — the wired adapters from
  // wave-1/1b (#179, #182) must surface in the right tier so the page is
  // honest: truly-live connectors (status: 'available' in
  // `lib/integrations/marketplace.ts`) land in `shipped`; vendor adapters
  // that are BUILT + TESTED but need a credential + `<VENDOR>_ADAPTER_LIVE`
  // flag land in `supported`; everything else stays `planned`.
  //
  // This guards against (a) regressing a wired adapter back to `planned`
  // (under-claiming) and (b) overclaiming a flag/credential-gated adapter
  // as `shipped`/live.

  it("no vertical leaves its `shipped` integrations array empty", () => {
    // Every vertical now has at least the horizontal OAuth connectors live
    // (Outlook/M365, Gmail, QuickBooks) per the marketplace catalog. An
    // empty `shipped` would mean a content regression dropped them.
    for (const slug of [...EXPECTED_SLUGS, "general"]) {
      const c = getVerticalContent(slug);
      assert.ok(c);
      assert.ok(
        c.integrations.shipped.length > 0,
        `${slug} has an empty shipped[] — at least the live horizontal connectors should be listed (see lib/integrations/marketplace.ts status:'available')`,
      );
    }
  });

  it("flag/credential-gated vertical adapters land in `supported`, never `shipped`", () => {
    // Wave-1/1b adapters that are built + tested but gated behind a per-
    // vendor `<VENDOR>_ADAPTER_LIVE` flag + a connected credential. They
    // are honestly "ready", not "live", so they MUST appear in `supported`
    // and MUST NOT appear in `shipped`.
    const SUPPORTED_BY_VERTICAL: Record<string, string> = {
      "property-management": "Buildium",
      insurance: "EZLynx",
      mortgage: "Encompass",
      "title-escrow": "Qualia",
    };
    for (const [slug, vendor] of Object.entries(SUPPORTED_BY_VERTICAL)) {
      const c = getVerticalContent(slug);
      assert.ok(c);
      const supported = c.integrations.supported ?? [];
      assert.ok(
        supported.some((i) => i.name === vendor),
        `${slug}: "${vendor}" must be in integrations.supported (adapter built + tested, gated on a credential + flag)`,
      );
      assert.ok(
        !c.integrations.shipped.some((i) => i.name === vendor),
        `${slug}: "${vendor}" must NOT be in integrations.shipped — it is flag/credential-gated, so claiming it live overclaims (say "ready", not "live")`,
      );
      assert.ok(
        !c.integrations.planned.some((i) => i.name === vendor),
        `${slug}: "${vendor}" must NOT be in integrations.planned — the adapter is built, so leaving it planned under-claims (see lib/integrations/${vendor.toLowerCase()}-mcp/)`,
      );
    }
  });

  it("truly-live CRMs (Follow Up Boss, Sierra) are shipped on real-estate", () => {
    // Follow Up Boss + Sierra Interactive are status:'available' in the
    // marketplace catalog — wired end-to-end with an open connect path —
    // so they belong in `shipped`, not `planned`.
    const re = getVerticalContent("real-estate");
    assert.ok(re);
    for (const vendor of ["Follow Up Boss", "Sierra Interactive"]) {
      assert.ok(
        re.integrations.shipped.some((i) => i.name === vendor),
        `real-estate: "${vendor}" must be in shipped[] (status:'available' in marketplace.ts)`,
      );
      assert.ok(
        !re.integrations.planned.some((i) => i.name === vendor),
        `real-estate: "${vendor}" must NOT remain in planned[] — it is live`,
      );
    }
    // BoldTrail is coming-soon (partner enrollment not complete) — must NOT
    // be claimed shipped. It does not appear on the page at all today; this
    // guards against a future edit promoting it prematurely.
    assert.ok(
      !re.integrations.shipped.some((i) => i.name === "BoldTrail"),
      "real-estate: BoldTrail must not be shipped — partner enrollment is not complete (marketplace status: 'coming-soon')",
    );
  });

  it("CPA practice-mgmt connectors (TaxDome, Karbon) are planned, not shipped", () => {
    // 2026-07-03 send-path wave: both are `coming-soon` in the marketplace
    // catalog — the read layer is built but no connect form exists, so the
    // vertical page must not claim them live (audit-2026-07-02 dept-5 P0-1).
    // When the connect forms ship and the catalog flips them back to
    // `available`, move them to shipped[] and update this test with them.
    const cpa = getVerticalContent("cpa");
    assert.ok(cpa);
    for (const vendor of ["TaxDome", "Karbon"]) {
      assert.ok(
        !cpa.integrations.shipped.some((i) => i.name === vendor),
        `cpa: "${vendor}" must NOT be in shipped[] — marketplace status is 'coming-soon' (no open connect path)`,
      );
      assert.ok(
        cpa.integrations.planned.some((i) => i.name === vendor),
        `cpa: "${vendor}" must be in planned[] so the roadmap still names it honestly`,
      );
    }
  });

  it("real-estate's JTBD tables remain ratified (regression guard)", () => {
    const realEstate = getVerticalContent("real-estate");
    assert.ok(realEstate);
    for (const t of realEstate.jtbdTables) {
      assert.notEqual(
        t.draft,
        true,
        "real-estate JTBD tables should NOT be draft (Phase 0 spec is ratified)",
      );
    }
  });
});

// `/general` — on-ramp SURFACE for businesses outside the ratified ten.
// Per `feedback_no_new_verticals_finish_locked.md`, the ten-vertical lock
// is intact; `/general` lives in a separate registry and must NOT leak
// into any surface that enumerates the ratified ten (chip row, footer
// column, `/verticals` grid).
//
// Framing note: the task brief asked for "Partner/Max upgrade language" on
// `/general`. That naming predates `project_stripe_both_surfaces.md`
// (simplified 2026-05-12), which bans Plus/Max surfacing in customer copy
// and routes anything-beyond-Regular to `/custom` as a Custom engagement.
// We honor the locked memory rule: the on-ramp page advertises Regular
// pricing and points to `/custom` for depth. The test below asserts that
// path, not the stale Plus/Max framing.
describe("vertical-routes — /general on-ramp surface", () => {
  it("registers exactly one on-ramp surface (general)", () => {
    assert.deepEqual(
      [...ON_RAMP_SLUGS].sort(),
      ["general"],
      "On-ramp registry must contain exactly `general` — adding another on-ramp requires a memory ratification, same bar as adding a vertical",
    );
  });

  it("does NOT appear in VERTICAL_SLUGS (ten-vertical lock intact)", () => {
    assert.equal(
      VERTICAL_SLUGS.includes("general"),
      false,
      "`general` must not appear in VERTICAL_SLUGS — chip row + footer + /verticals grid read from VERTICAL_SLUGS and the ten-vertical lock would silently break",
    );
  });

  it("does NOT appear in getAllVerticals() (chip-row source)", () => {
    const slugs = getAllVerticals().map((v) => v.slug);
    assert.equal(
      slugs.includes("general"),
      false,
      "getAllVerticals() must enumerate the ratified ten only — homepage chip row would surface /general as an eleventh vertical otherwise",
    );
    assert.equal(slugs.length, 10, "getAllVerticals() must return exactly 10");
  });

  it("DOES appear in getAllVerticalsIncludingOnRamps() (route source)", () => {
    const slugs = getAllVerticalsIncludingOnRamps().map((v) => v.slug);
    assert.equal(
      slugs.includes("general"),
      true,
      "getAllVerticalsIncludingOnRamps() drives generateStaticParams — /general must be statically built",
    );
    assert.equal(
      slugs.length,
      11,
      "getAllVerticalsIncludingOnRamps() must return the ten plus the on-ramp",
    );
  });

  it("resolves via getVerticalContent() so the [vertical] route renders /general", () => {
    const content = getVerticalContent("general");
    assert.ok(content, "getVerticalContent('general') must resolve");
    assert.equal(content.slug, "general");
    assert.equal(content.name, "Local businesses");
  });

  it("is marked status: 'on-ramp' (the distinguishing flag)", () => {
    const content = getVerticalContent("general");
    assert.ok(content);
    assert.equal(
      content.status,
      "on-ramp",
      "/general must carry status: 'on-ramp' — the type discriminator for every surface that treats on-ramps differently from ratified verticals",
    );
  });

  it("defaults to Regular tier per project_stripe_both_surfaces.md", () => {
    const content = getVerticalContent("general");
    assert.ok(content);
    assert.equal(
      content.tier,
      "regular",
      "/general must be Regular — single productized tier per the 2026-05-12 lock",
    );
    assert.equal(getVerticalTier("general"), "regular");
  });

  it("has the full VerticalContent shape (hero, JTBDs, ROI, claims, integrations)", () => {
    const content = getVerticalContent("general");
    assert.ok(content);

    assert.ok(content.hero.headline.length > 10, "hero headline too short");
    assert.ok(content.hero.valueProp.length > 40, "hero valueProp too short");

    assert.ok(content.jtbdTables.length >= 1, "must surface at least one role");
    const totalRows = content.jtbdTables.reduce(
      (sum, t) => sum + t.rows.length,
      0,
    );
    assert.ok(totalRows >= 3, `must have >=3 JTBD rows (got ${totalRows})`);

    assert.ok(content.roi.multiplier.length > 0, "ROI missing multiplier");
    assert.ok(content.roi.math.length > 30, "ROI math too thin");
    assert.ok(
      content.roi.citation.length > 20,
      "ROI missing citation — every claim cites per feedback_no_guesses_no_estimates.md",
    );

    assert.ok(content.claims.replace.length > 0, "claims.replace empty");
    assert.ok(content.claims.integrate.length > 0, "claims.integrate empty");
    assert.ok(content.claims.augment.length > 0, "claims.augment empty");

    assert.ok(
      content.integrations.planned.length > 0,
      "must list common-denominator integrations on the roadmap",
    );
    assert.ok(
      content.integrations.plannedWindow.length > 0,
      "missing plannedWindow",
    );
  });

  it("frames upgrade depth toward /custom (NOT Plus/Max language, banned by project_stripe_both_surfaces.md)", () => {
    const content = getVerticalContent("general");
    assert.ok(content);

    // The on-ramp's only honest upgrade path is a Custom engagement on
    // `/custom`. The page text must NOT surface Plus / Max tier names —
    // those are schema-only per the 2026-05-12 simplification.
    const haystack = [
      content.hero.valueProp,
      content.metaDescription,
      content.roi.math,
      content.roi.citation,
      ...content.claims.replace,
      ...content.claims.integrate,
      ...content.claims.augment,
      content.valueLoopExample?.outcome ?? "",
    ]
      .join(" ")
      .toLowerCase();

    assert.equal(
      /\bplus\s+tier\b/.test(haystack),
      false,
      "/general must not surface 'Plus tier' — banned per project_stripe_both_surfaces.md",
    );
    assert.equal(
      /\bmax\s+tier\b/.test(haystack),
      false,
      "/general must not surface 'Max tier' — banned per project_stripe_both_surfaces.md",
    );

    // Affirmative: the page must point to Custom as the depth path.
    assert.ok(
      /custom\s+engagement/.test(haystack),
      "/general must point to Custom engagement as the depth path (per project_stripe_both_surfaces.md)",
    );
  });

  it("ratified verticals carry no status (default 'live') so the on-ramp flag is unambiguous", () => {
    for (const slug of VERTICAL_SLUGS) {
      const c = getVerticalContent(slug);
      assert.ok(c);
      assert.notEqual(
        c.status,
        "on-ramp",
        `${slug} must not carry status: 'on-ramp' — only /general does`,
      );
    }
  });
});

// /general cross-role roster — separate describe block so the buildout
// is pinned independently. Per `feedback_no_new_verticals_finish_locked.md`
// the roster expansion (2026-05-25) is a SURFACE buildout, not a new
// vertical: every card must bind to a `vertical: 'all'` catalog skill so
// the roster stays HORIZONTAL by construction.
describe("vertical-routes — /general cross-role roster (buildout 2026-05-25)", () => {
  it("declares a four-card horizontal roster (CoS + Inbox Triage + Follow-Up + Process-Doc)", async () => {
    const { SKILL_CATALOG } = await import("@/lib/skills/registry");
    const content = getVerticalContent("general");
    assert.ok(content);
    const roster = content.agentRoster ?? [];
    assert.equal(
      roster.length,
      4,
      "/general must surface exactly 4 horizontal capabilities post-2026-05-25 buildout",
    );
    const slugs = roster.map((a) => a.slug).sort();
    assert.deepEqual(slugs, [
      "general-chief-of-staff",
      "general-follow-up-chaser",
      "general-inbox-triage",
      "general-process-doc-drafter",
    ]);
    // Every card must be live + boundSkill, and every bound skill must be
    // catalog-registered with vertical 'all' (the horizontal marker).
    const catalogBySlug = new Map(SKILL_CATALOG.map((s) => [s.slug, s]));
    for (const card of roster) {
      assert.equal(
        card.runtime,
        "live",
        `${card.slug}: /general roster must be live — every card is bound to a runnable, test-gated skill`,
      );
      assert.ok(
        card.boundSkill,
        `${card.slug}: /general roster cards must declare a boundSkill (the live pathway)`,
      );
      const skill = catalogBySlug.get(card.boundSkill!);
      assert.ok(
        skill,
        `${card.slug}: boundSkill "${card.boundSkill}" not in SKILL_CATALOG`,
      );
      assert.equal(
        skill!.vertical,
        "all",
        `${card.slug}: bound skill "${card.boundSkill}" must be vertical: 'all' to keep /general HORIZONTAL — found vertical "${skill!.vertical}"`,
      );
    }
  });

  it("the three new buildout skills are catalog-registered and horizontal", async () => {
    const { SKILL_CATALOG } = await import("@/lib/skills/registry");
    const newSlugs = [
      "inbox-triage-general",
      "follow-up-chaser-general",
      "process-doc-drafter-general",
    ];
    const catalogBySlug = new Map(SKILL_CATALOG.map((s) => [s.slug, s]));
    for (const slug of newSlugs) {
      const entry = catalogBySlug.get(slug);
      assert.ok(entry, `expected catalog entry for ${slug}`);
      assert.equal(
        entry!.vertical,
        "all",
        `${slug} must be vertical: 'all' — cross-role, not vertical-locked`,
      );
    }
  });

  it("the roster copy reads cross-role, never as a new industry vertical", () => {
    const content = getVerticalContent("general");
    assert.ok(content);
    const haystack = (content.agentRoster ?? [])
      .map((a) => `${a.name} ${a.job}`)
      .join(" ")
      .toLowerCase();
    // No copy may name one of the ten ratified verticals — the buildout
    // is industry-agnostic by construction. (We DO mention "vertical" /
    // industry concepts elsewhere on the page; what's banned here is a
    // roster card naming a specific industry.)
    const verticalSlurs = [
      "real estate",
      "real-estate",
      "mortgage",
      "insurance",
      "property management",
      "title-escrow",
      "title escrow",
      "recruiting",
      "home services",
      "home-services",
      " cpa ",
      " law ",
      " ria ",
    ];
    for (const slur of verticalSlurs) {
      assert.equal(
        haystack.includes(slur),
        false,
        `/general roster card mentions "${slur.trim()}" — cards must read CROSS-ROLE, never as an industry vertical (per feedback_no_new_verticals_finish_locked.md)`,
      );
    }
  });
});
