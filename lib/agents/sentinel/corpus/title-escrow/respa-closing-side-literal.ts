import type { ComplianceRule } from "../../types";

/**
 * RESPA Section 9 — seller required title insurance.
 *
 * Prohibits the seller from requiring (directly or indirectly), as a
 * condition of sale, that title insurance be purchased from any
 * particular title company.
 */
export const rule: ComplianceRule = {
  ruleId: "respa-section-9-seller-title-insurance",
  title: "RESPA Section 9 — seller may not require particular title insurer",
  summary:
    "No seller of property that will be purchased with the assistance of a federally related mortgage loan may require directly or indirectly, as a condition to selling the property, that title insurance covering the property be purchased by the buyer from any particular title company.",
  jurisdiction: "federal-statute",
  scope: { kind: "federal" },
  citation: {
    source: "12 USC § 2608",
    url: "https://www.law.cornell.edu/uscode/text/12/2608",
    accessedAt: "2026-06-06",
  },
  literalText: `(a) Imposition of condition prohibited
No seller of property that will be purchased with the assistance of a federally related mortgage loan shall require directly or indirectly, as a condition to selling the property, that title insurance covering the property be purchased by the buyer from any particular title company.

(b) Liability of seller for violation
Any seller who violates the provisions of subsection (a) shall be liable to the buyer in an amount equal to three times all charges made for such title insurance.`,
  purpose: "counsel-reference",
  severity: "blocking",
  counselReviewStatus: "draft",
  safeRewrite:
    "Never condition the sale on the buyer using a particular title company. Strike any 'buyer must use [title company]' or 'closing must go through [our title agency]' language from seller-side drafts. State that the buyer is free to select their own title insurer; you may recommend providers but cannot require one. Violation exposes the seller to treble damages on all title charges.",
  drafterNotes:
    "Verified against Cornell LII 12 USC § 2608 on 2026-06-06; subsections (a) and (b) match the published text verbatim. counsel-reference (not literal-match): a violation is conduct ('require ... as a condition to selling'), not a fixed phrase, so a literal trigger list would over- or under-fire. Counsel may later authorize a narrow regex on 'must use our title' / 'required to close with' patterns if false-positive rate is acceptable.",
};
