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
    url: "https://www.law.cornell.edu/cfr/text/31/10.22",
    accessedAt: "2026-06-06",
  },
  literalText: `31 CFR § 10.22 — Diligence as to accuracy.

(a) In general. A practitioner must exercise due diligence—
  (1) In preparing or assisting in the preparation of, approving, and filing tax returns, documents, affidavits, and other papers relating to Internal Revenue Service matters;
  (2) In determining the correctness of oral or written representations made by the practitioner to the Department of the Treasury; and
  (3) In determining the correctness of oral or written representations made by the practitioner to clients with reference to any matter administered by the Internal Revenue Service.

(b) Reliance on others. Except as modified by §§ 10.34 and 10.37, a practitioner will be presumed to have exercised due diligence for purposes of this section if the practitioner relies on the work product of another person and the practitioner used reasonable care in engaging, supervising, training, and evaluating the person, taking proper account of the nature of the relationship between the practitioner and the person.`,
  purpose: "counsel-reference",
  severity: "info",
  counselReviewStatus: "draft",
  safeRewrite:
    "When a draft promises a return, filing, or representation will be delivered without review (e.g. 'we'll file it as-is', 'no need to double-check your numbers', 'same-day filing, no questions asked'), surface § 10.22's due-diligence duty: the practitioner must exercise due diligence in preparing/approving/filing and in confirming the correctness of representations to Treasury and to the client. Rewrite to preserve a review/verification step rather than waiving it.",
  drafterNotes:
    "Verified 2026-06-06 against Cornell LII mirror of 31 CFR § 10.22 — both (a)(1)-(3) and the (b) reliance-on-others presumption (including the §§ 10.34/10.37 cross-reference) match the published text. Severity 'info': this is a duty-of-care/routing rule, not a draft-text per-se violation; counsel-reference because diligence is judgment-based.",
};
