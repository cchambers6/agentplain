import type { ComplianceRule } from "../../types";

/**
 * RESPA Section 8 — cross-reference. Same anti-kickback rule the mortgage
 * corpus loads, but referenced here so a title/escrow workspace gets the
 * same flag on referral-fee drafts.
 *
 * Single source of truth lives in the mortgage corpus
 * (`respa-section-8-literal.ts`); this entry preserves the cross-link.
 */
export const rule: ComplianceRule = {
  ruleId: "title-escrow-respa-section-8-crossref",
  title: "RESPA Section 8 — anti-kickback (cross-reference to mortgage corpus)",
  summary:
    "RESPA Section 8 anti-kickback prohibition applies to title and escrow settlement service providers. Single literal lives in the mortgage corpus.",
  jurisdiction: "federal-statute",
  scope: { kind: "federal" },
  citation: {
    source: "12 USC § 2607(a)–(b); see also 12 CFR § 1024.14",
    url: "https://www.law.cornell.edu/uscode/text/12/2607",
    accessedAt: "2026-06-06",
  },
  literalText: `[CROSS-REFERENCE] Title and escrow drafts (closing protection letter language, lender-instructions exchanges, marketing co-arrangements with realtors and lenders) are evaluated against the RESPA Section 8 anti-kickback literal in the mortgage corpus. See:

  lib/agents/sentinel/corpus/mortgage/respa-section-8-literal.ts

That file is the single source of truth. Sentinel automatically loads it when scanning a title-escrow workspace; no duplicate text lives here.`,
  purpose: "counsel-reference",
  severity: "blocking",
  counselReviewStatus: "draft",
  safeRewrite:
    "Apply the same anti-kickback fix as the mortgage RESPA § 8 rule: strike any exchange of value tied to a referral of settlement-service business. Title/escrow marketing arrangements with referring brokers or lenders must pay only fair market value for services actually performed and never be contingent on referral volume.",
  drafterNotes:
    "Counsel: title/escrow agents often face Section 8 exposure on marketing arrangements with referring brokers — confirm cross-corpus loading semantics are acceptable, otherwise duplicate the literal in this file.",
};
