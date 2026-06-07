import type { ComplianceRule } from "../../types";

/**
 * TILA / Reg Z — material loan-cost disclosure principle.
 *
 * Drafter flagged the precise statutory enumeration as too long for a
 * single literal excerpt; this rule loads the published Regulation Z
 * preamble text describing the disclosure purpose. Counsel should add
 * the full § 1026.18 / § 1026.37 enumerations as separate companion
 * literals on review.
 */
export const rule: ComplianceRule = {
  ruleId: "tila-reg-z-disclosure-purpose",
  title: "TILA / Regulation Z — disclosure of credit terms",
  summary:
    "Creditor must give the consumer accurate, clear disclosure of the cost of credit (finance charge, APR, payment schedule, total of payments) before consummation.",
  jurisdiction: "federal-regulation",
  scope: { kind: "federal" },
  citation: {
    source: "15 USC § 1601 (TILA purpose); 12 CFR § 1026.1(b) (Reg Z purpose)",
    url: "https://www.consumerfinance.gov/rules-policy/regulations/1026/1/",
    accessedAt: "2026-05-12",
  },
  literalText: `(b) Purpose. The purpose of this part is to promote the informed use of consumer credit by requiring disclosures about its terms and cost, to ensure that consumers are provided with greater and more timely information on the nature and costs of the residential real estate settlement process, and to effect certain changes in the settlement process for residential real estate that will result in more effective advance disclosure to home buyers and sellers of settlement costs.`,
  purpose: "counsel-reference",
  severity: "info",
  counselReviewStatus: "draft",
  safeRewrite:
    "Do not state or imply a rate, payment, APR, or 'cost of credit' figure in customer-facing copy unless the corresponding TILA/Reg Z disclosures are delivered with it. Quote terms only from the issued Loan Estimate / Closing Disclosure, not ad-hoc in correspondence.",
  drafterNotes:
    "Counsel: the field-by-field disclosure list (12 CFR § 1026.18 for closed-end non-mortgage; § 1026.37 for the Loan Estimate; § 1026.38 for the Closing Disclosure) is what sentinel actually needs to match against. This excerpt establishes purpose; the field-level literals are the next pass.",
};
