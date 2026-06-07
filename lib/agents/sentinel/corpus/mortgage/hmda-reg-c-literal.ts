import type { ComplianceRule } from "../../types";

/**
 * Home Mortgage Disclosure Act (HMDA) / Regulation C § 1003.1 — purpose +
 * fair-lending data-reporting authority.
 *
 * § 1003.1 purpose text below is quoted from the CFPB rendering read
 * 2026-06-03. This is a REPORTING obligation, not a draft-text matcher:
 * sentinel never auto-flags HMDA, it carries the rule as counsel-reference
 * so the fair-lending picture (alongside ECOA) is complete for counsel and
 * so the operator UI can surface "this is a HMDA-reportable institution"
 * context. Severity `info`.
 */
export const rule: ComplianceRule = {
  ruleId: "hmda-reg-c-reporting",
  title: "HMDA / Regulation C § 1003.1 — mortgage data reporting (fair-lending)",
  summary:
    "Covered financial institutions must collect, record, and report data about mortgage applications, originations, and purchases so the public and regulators can assess whether institutions serve community housing needs and identify possible discriminatory lending patterns.",
  jurisdiction: "federal-regulation",
  scope: { kind: "federal" },
  citation: {
    source: "12 USC § 2801 et seq. (HMDA); 12 CFR § 1003.1 (Regulation C, Authority, purpose, and scope)",
    url: "https://www.consumerfinance.gov/rules-policy/regulations/1003/1/",
    accessedAt: "2026-06-03",
  },
  literalText: `12 CFR § 1003.1 — Authority, purpose, and scope.

(b) Purpose. (1) This part implements the Home Mortgage Disclosure Act, which is intended to provide the public with loan data that can be used:

(i) To help determine whether financial institutions are serving the housing needs of their communities;

(ii) To assist public officials in distributing public-sector investment so as to attract private investment to areas where it is needed; and

(iii) To assist in identifying possible discriminatory lending patterns and enforcing antidiscrimination statutes.

(2) Neither the act nor this part is intended to encourage unsound lending practices or the allocation of credit.`,
  purpose: "counsel-reference",
  severity: "info",
  counselReviewStatus: "draft",
  category: "fair-lending",
  unverified: false,
  safeRewrite:
    "No draft rewrite — HMDA is a data-collection/reporting duty, not a content rule. Surface as context so the operator confirms HMDA loan/application register (LAR) data is captured for reportable transactions; do not rely on sentinel text matching for HMDA compliance.",
  drafterNotes:
    "§ 1003.1(b) purpose text pulled from CFPB 2026-06-03 (authentic). Counsel: confirm whether the workspace's institution meets the § 1003.2(g) 'financial institution' coverage test and the § 1003.3(c) loan-volume thresholds before any HMDA messaging is surfaced; that determination is institution-specific and out of corpus scope. Carried as counsel-reference + info severity — never fires.",
};
