import type { ComplianceRule } from "../../types";

/**
 * Property-management rental-advertising candidate triggers — Fair Housing
 * port + rental-specific source-of-income overlay.
 *
 * DRAFT, UNVERIFIED. Sentinel WILL NOT fire on these — the scanner skips
 * `unverified: true` rules. Candidate list for counsel red-line.
 *
 * Two distinct match classes bundled here so counsel can split them:
 *
 *   1. PORTED Fair Housing literal triggers — Per `fair-housing-reference.ts`
 *      in this directory, the property-management vertical relies on the
 *      same Fair Housing Act § 804(c) / 24 CFR § 100.75 trigger list as
 *      real-estate. Because `loadCorpusFor()` keys on verticalSlug only,
 *      sentinel does NOT cross-load real-estate's trigger file when
 *      scanning a property-management workspace. This rule ports the HUD
 *      literal list so PM workspaces get the same advertising protection.
 *
 *   2. RENTAL-SPECIFIC source-of-income phrases — Federal Section 8 / HCV
 *      participation is NOT a federally protected class, but 19+ states
 *      and dozens of cities have enacted source-of-income protections that
 *      prohibit "no Section 8" / "no vouchers" language. Counsel decides
 *      per jurisdiction.
 *
 * Counsel: consider splitting into two rules (one per match class) and
 * separately, whether the PM corpus should literally duplicate the HUD
 * list or whether `loadCorpusFor()` should be extended to cross-load.
 */
export const rule: ComplianceRule = {
  ruleId: "property-management-rental-advertising-candidates",
  title: "Property management rental advertising — candidate triggers (DRAFT)",
  summary:
    "Candidate literal phrases — HUD § 804(c) literal triggers ported from real-estate plus rental-specific source-of-income phrases. Sentinel does NOT fire on these until counsel red-lines (and decides whether to keep a duplicated list or extend the loader to cross-load).",
  jurisdiction: "federal-statute",
  scope: { kind: "federal" },
  citation: {
    source: "42 USC § 3604(c); 24 CFR § 100.75; state source-of-income statutes (varies)",
    url: "https://www.ecfr.gov/current/title-24/subtitle-B/chapter-I/subchapter-A/part-100/subpart-B/section-100.75",
    accessedAt: "2026-05-25",
  },
  literalText:
    "[DRAFT — needs counsel] Two match classes:\n\n(A) HUD § 804(c) literal triggers — ported from `lib/agents/sentinel/corpus/real-estate/fair-housing-hud-literal.ts`. Sentinel does not cross-load real-estate's corpus into a property-management workspace, so this rule ports the trigger list so PM rental ads receive equivalent Fair Housing coverage.\n\n(B) Source-of-income phrases — 'no Section 8', 'no vouchers', 'no DSS' etc. Federal Fair Housing Act does NOT protect source of income, but 19+ states (CA, MA, NJ, NY, OR, WA, IL, MN, ND, OK, RI, UT, VT, CT, MD, DE, DC, plus many cities) prohibit these phrases in rental advertising. Counsel: confirm jurisdictional scope before flipping to verified literal-match.\n\nCandidate trigger phrases below are nominated from these sources but have NOT been counsel-verified.",
  purpose: "literal-match",
  unverified: true,
  category: "rental-advertising",
  triggers: [
    // Ported HUD § 804(c) literal triggers — keep in sync with
    // real-estate/fair-housing-hud-literal.ts. Familial status:
    "no children",
    "no kids",
    "adults only",
    "adult building",
    "adult community",
    "mature persons",
    "mature adults",
    "mature couple",
    "empty nesters",
    "singles only",
    "one child",
    "great for families",
    "perfect for families",
    "family-oriented",
    "family neighborhood",
    "bachelor",
    "bachelorette",
    "bachelor pad",
    // Religion
    "christian home",
    "christian community",
    "christian family",
    "jewish home",
    "muslim home",
    "catholic family",
    // Race / color / national origin
    "no blacks",
    "whites only",
    "white only",
    "caucasian preferred",
    "caucasian only",
    "no hispanics",
    "no latinos",
    "no asians",
    "no foreigners",
    "english speaking",
    "english speaking only",
    // Sex
    "no women",
    "no men",
    "female only",
    "male only",
    "ladies only",
    "gentlemen only",
    // Disability
    "no wheelchairs",
    "able-bodied",
    "must be able-bodied",
    "no mentally ill",
    "no handicapped",
    "no disabled",
    // Rental-specific source-of-income (state-by-state)
    "no section 8",
    "no section-8",
    "no vouchers",
    "no housing voucher",
    "no dss",
    "no welfare",
    "no government assistance",
  ],
  drafterNotes:
    "Drafted 2026-05-25. The 46 HUD-list phrases are ported VERBATIM from `lib/agents/sentinel/corpus/real-estate/fair-housing-hud-literal.ts` — counsel should review whether duplicating the list is acceptable or whether the loader should be extended to cross-load (which would avoid the drift risk between the two files). The source-of-income block ('no section 8', 'no vouchers', 'no DSS', 'no welfare') is genuinely jurisdiction-dependent: federally legal, illegal in 19+ states and many cities. Counsel: confirm operating jurisdiction(s) before flipping verified, and consider state-scoped category metadata so the rule fires only for PM workspaces operating in source-of-income-protected jurisdictions.",
};
