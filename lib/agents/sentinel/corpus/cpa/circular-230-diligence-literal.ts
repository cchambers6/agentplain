import type { ComplianceRule } from "../../types";

/**
 * Circular 230 § 10.22 — diligence as to accuracy.
 */
export const rule: ComplianceRule = {
  ruleId: "circular-230-diligence-10-22",
  title: "Circular 230 § 10.22 — diligence as to accuracy",
  summary:
    "A practitioner must exercise due diligence in preparing, approving, and filing returns and other papers relating to IRS matters; in determining the correctness of oral or written representations made to the Department of the Treasury; and in determining the correctness of oral or written representations made to clients.",
  jurisdiction: "federal-regulation",
  scope: { kind: "federal" },
  citation: {
    source: "31 CFR § 10.22",
    url: "https://www.ecfr.gov/current/title-31/subtitle-A/part-10/subpart-B/section-10.22",
    accessedAt: "2026-05-12",
  },
  literalText: `[UNVERIFIED — needs counsel] Substance of 31 CFR § 10.22:

(a) In general. A practitioner must exercise due diligence—
  (1) In preparing or assisting in the preparation of, approving, and filing tax returns, documents, affidavits, and other papers relating to Internal Revenue Service matters;
  (2) In determining the correctness of oral or written representations made by the practitioner to the Department of the Treasury; and
  (3) In determining the correctness of oral or written representations made by the practitioner to clients with reference to any matter administered by the Internal Revenue Service.

(b) Reliance on others. Except as modified by §§ 10.34 and 10.37, a practitioner will be presumed to have exercised due diligence for purposes of this section if the practitioner relies on the work product of another person and the practitioner used reasonable care in engaging, supervising, training, and evaluating the person, taking proper account of the nature of the relationship between the practitioner and the person.`,
  unverified: true,
};
