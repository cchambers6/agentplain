import type { ComplianceRule } from "../../types";

/**
 * FCRA pre-employment background check disclosure / authorization rule.
 *
 * Most-litigated FCRA rule in recruiting workflows: the disclosure must
 * be "in a document that consists solely of the disclosure" — extra
 * waiver/release language packed into the disclosure violates the rule.
 */
export const rule: ComplianceRule = {
  ruleId: "fcra-pre-employment-disclosure",
  title: "FCRA — pre-employment consumer report disclosure and authorization",
  summary:
    "Before procuring a consumer report on a job applicant for employment purposes, the user must (1) make a clear and conspicuous disclosure in writing in a document that consists solely of the disclosure that a consumer report may be obtained, and (2) obtain the applicant's written authorization.",
  jurisdiction: "federal-statute",
  scope: { kind: "federal" },
  citation: {
    source: "15 USC § 1681b(b)(2)(A)",
    url: "https://www.law.cornell.edu/uscode/text/15/1681b",
    accessedAt: "2026-05-12",
  },
  literalText: `(2) Disclosure to consumer
(A) In general
Except as provided in subparagraph (B), a person may not procure a consumer report, or cause a consumer report to be procured, for employment purposes with respect to any consumer, unless—
(i) a clear and conspicuous disclosure has been made in writing to the consumer at any time before the report is procured or caused to be procured, in a document that consists solely of the disclosure, that a consumer report may be obtained for employment purposes; and
(ii) the consumer has authorized in writing (which authorization may be made on the document referred to in clause (i)) the procurement of the report by that person.`,
  drafterNotes:
    "Pre-adverse / adverse action requirements at 15 USC § 1681b(b)(3) are the companion rule sentinel should also load; recommend counsel pass adds that literal.",
};
