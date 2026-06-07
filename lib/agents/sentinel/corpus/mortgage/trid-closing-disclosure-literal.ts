import type { ComplianceRule } from "../../types";

/**
 * TRID closing-disclosure timing rule. Three-business-day pre-consummation
 * delivery is the most-litigated TRID anchor — sentinel flags any draft
 * that references rushing or compressing the CD window.
 */
export const rule: ComplianceRule = {
  ruleId: "trid-closing-disclosure-three-day",
  title: "TRID — Closing Disclosure three-business-day rule",
  summary:
    "Closing Disclosure must be delivered to the consumer no later than three business days before consummation; certain changes restart the three-day clock.",
  jurisdiction: "federal-regulation",
  scope: { kind: "federal" },
  citation: {
    source: "12 CFR § 1026.19(f)(1)(ii)(A)",
    url: "https://www.consumerfinance.gov/rules-policy/regulations/1026/19/",
    accessedAt: "2026-05-12",
  },
  literalText: `(ii) Timing.
(A) In general. The creditor shall ensure that the consumer receives the disclosures required under paragraph (f)(1)(i) of this section no later than three business days before consummation.`,
  purpose: "counsel-reference",
  severity: "advisory",
  counselReviewStatus: "draft",
  safeRewrite:
    "Do not promise, imply, or pressure a closing date inside the three-business-day window after the Closing Disclosure is received. Frame timelines as 'on or after the third business day following your Closing Disclosure.' Never describe the waiting period as waivable except for a documented bona fide personal financial emergency under § 1026.19(f)(1)(iv).",
  drafterNotes:
    "Counsel: the corresponding redisclosure trigger in 12 CFR § 1026.19(f)(2)(ii) (APR change > 1/8%, loan product change, prepayment penalty added) should ship as a companion literal in the next pass.",
};
