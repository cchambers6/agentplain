import type { ComplianceRule } from "../../types";

/**
 * Regulation Z (TILA) § 1026.24(d)(1) — TRIGGERING TERMS in dwelling-
 * secured credit advertising.
 *
 * Split out from the former combined `reg-z-advertising-candidates` rule
 * per the mortgage corpus open question (2026-05-25). Unlike the prohibited
 * representations in `reg-z-advertising-prohibited-literal.ts`, these
 * phrases are NOT unlawful on their face — their presence in an
 * advertisement TRIGGERS the additional-disclosure requirement of
 * § 1026.24(d)(2) (the advertisement must also state the downpayment,
 * repayment terms, APR, and any increase in rate/payment after
 * consummation). The operator-facing flag should therefore read "confirm
 * the § 1026.24(d)(2) disclosures accompany this term," not "remove."
 *
 * DRAFT, UNVERIFIED. Sentinel WILL NOT fire on these — the scanner skips
 * `unverified: true` rules. Candidate list for counsel red-line.
 */
export const rule: ComplianceRule = {
  ruleId: "reg-z-mortgage-advertising-triggering-terms",
  title: "Regulation Z § 1026.24(d)(1) — mortgage advertising triggering terms (DRAFT)",
  summary:
    "Lawful advertising terms whose use triggers the additional-disclosure duty of § 1026.24(d)(2) (downpayment amount/percentage, number/period of payments, payment amount, finance charge). Sentinel flags so the operator can confirm the required disclosures are present — these are NOT removed. Does NOT fire until counsel red-lines.",
  jurisdiction: "federal-regulation",
  scope: { kind: "federal" },
  citation: {
    source: "12 CFR § 1026.24(d)(1) and § 1026.24(d)(2)",
    url: "https://www.ecfr.gov/current/title-12/chapter-X/part-1026/subpart-C/section-1026.24",
    accessedAt: "2026-05-25",
  },
  literalText:
    "[DRAFT — needs counsel] 12 CFR § 1026.24(d)(1) — Advertisement of terms that require additional disclosures. If any of the following terms is set forth in an advertisement, the advertisement shall meet the requirements of paragraph (d)(2) of this section: (i) The amount or percentage of any downpayment. (ii) The number of payments or period of repayment. (iii) The amount of any payment. (iv) The amount of any finance charge.\n\n§ 1026.24(d)(2) then requires the advertisement to clearly and conspicuously state the amount/percentage of the downpayment, the terms of repayment (reflecting the repayment obligations over the full term of the loan, including balloon payments), and the 'annual percentage rate,' using that term or 'APR,' and whether the rate may increase after consummation.\n\nThe phrases below are nominated as triggering-term candidates and have NOT been counsel-verified.",
  purpose: "literal-match",
  severity: "advisory",
  counselReviewStatus: "draft",
  unverified: true,
  category: "advertising",
  triggers: [
    "no down payment",
    "zero down",
    "no money down",
    "no closing costs",
    "low monthly payment",
    "low monthly payments",
  ],
  triggerRegexes: [
    {
      pattern: "\\$\\s?0\\s+down",
      flags: "i",
      description:
        "Catches '$0 down' (downpayment-amount triggering term) without firing on dollar figures like '$500 down'.",
      example: "Buy now with $0 down and move in this month.",
      counterExample: "A deposit of $500 down holds the rate.",
    },
    {
      pattern: "\\b0%\\s*down\\b",
      flags: "i",
      description: "Catches '0% down' downpayment-percentage triggering term.",
      example: "0% down for qualified veterans.",
      counterExample: "Rates start at 6% on a 30-year term.",
    },
  ],
  safeRewrite:
    "Keep the term only if the advertisement also clearly and conspicuously states the § 1026.24(d)(2) disclosures: the downpayment amount/percentage, the repayment terms over the full loan term, the 'annual percentage rate' (spelled out or 'APR'), and whether the rate can increase after consummation. If those cannot be included in this surface, remove the triggering term.",
  drafterNotes:
    "Split from the combined candidate rule on 2026-06-03. These are NOT prohibited — the flag exists to prompt a disclosure check. Counsel: confirm whether 'low monthly payment(s)' should be treated as a § 1026.24(d)(1)(iii) 'amount of any payment' triggering term (it states a payment characteristic without a figure) or held for counsel-reference. Specific APR / dollar payment figures still require structured parsing and are intentionally out of this literal/regex set.",
};
