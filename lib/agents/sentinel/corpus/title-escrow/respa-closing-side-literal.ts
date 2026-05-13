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
    accessedAt: "2026-05-12",
  },
  literalText: `(a) Imposition of condition prohibited
No seller of property that will be purchased with the assistance of a federally related mortgage loan shall require directly or indirectly, as a condition to selling the property, that title insurance covering the property be purchased by the buyer from any particular title company.

(b) Liability of seller for violation
Any seller who violates the provisions of subsection (a) shall be liable to the buyer in an amount equal to three times all charges made for such title insurance.`,
};
