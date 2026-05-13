import type { ComplianceRule } from "../../types";

/**
 * Fair Housing — REFERENCE-ONLY entry.
 *
 * Rental advertising, tenant screening, and reasonable-accommodation
 * requests are governed by the same Fair Housing Act / 24 CFR Part 100
 * Subpart B/D the real-estate corpus already loads. This entry is a
 * pointer so loadCorpusFor('property-management') surfaces the cross-
 * reference; sentinel's matching path consumes the real-estate corpus
 * directly when scanning property-management drafts.
 *
 * NOT a duplicate — the actual rule text lives in
 * `lib/agents/sentinel/corpus/real-estate/fair-housing-hud-literal.ts`
 * and is the SOURCE OF TRUTH. Any divergence between this summary and
 * the source-of-truth file is a bug in this reference, not in source.
 */
export const rule: ComplianceRule = {
  ruleId: "property-mgmt-fair-housing-crossref",
  title: "Fair Housing — applies to rental advertising and tenant selection (see real-estate corpus)",
  summary:
    "Fair Housing Act and HUD advertising guidance apply equally to rental listings, tenant screening, and reasonable-accommodation requests. The literal trigger list lives in the real-estate corpus.",
  jurisdiction: "federal-statute",
  scope: { kind: "federal" },
  citation: {
    source: "42 USC §§ 3601–3619 (Fair Housing Act); 24 CFR Part 100",
    url: "https://www.law.cornell.edu/uscode/text/42/chapter-45",
    accessedAt: "2026-05-12",
  },
  literalText: `[CROSS-REFERENCE] Property-management drafts (rental listings, tenant communications, application screening, reasonable-accommodation responses) are evaluated against the Fair Housing trigger list in the real-estate corpus. See:

  lib/agents/sentinel/corpus/real-estate/fair-housing-hud-literal.ts

That file is the single source of truth for HUD-literal triggers across the protected classes (race, color, national origin, religion, sex, familial status, disability). Sentinel automatically loads it when scanning a property-management workspace; no duplicate phrase list lives here.`,
  drafterNotes:
    "Counsel: confirm cross-corpus loading semantics are acceptable — the alternative is duplicating the HUD trigger list, which creates a drift risk between the two corpora.",
};
