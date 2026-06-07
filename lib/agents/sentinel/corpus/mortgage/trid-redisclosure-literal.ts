import type { ComplianceRule } from "../../types";

/**
 * TRID redisclosure timing — 12 CFR § 1026.19(f)(2)(ii). The companion to
 * the three-business-day Closing Disclosure delivery rule
 * (`trid-closing-disclosure-literal.ts`): certain changes after the CD is
 * provided RESTART the three-business-day waiting period before
 * consummation. This is the rule the original drafterNotes on the CD rule
 * flagged for "next pass."
 *
 * The candidate triggers target draft language that pressures the borrower
 * to skip, waive, or compress the waiting period — the most common
 * customer-facing TRID-timing risk. DRAFT, UNVERIFIED — sentinel does NOT
 * fire until counsel red-lines.
 */
export const rule: ComplianceRule = {
  ruleId: "trid-redisclosure-three-day-reset",
  title: "TRID § 1026.19(f)(2)(ii) — redisclosure resets the three-day clock (DRAFT)",
  summary:
    "If the disclosed APR becomes inaccurate, the loan product changes, or a prepayment penalty is added after the Closing Disclosure is provided, the creditor must give a corrected Closing Disclosure and ensure the consumer receives it no later than three business days before consummation — restarting the waiting period. Drafts that promise to waive or rush this window are flagged.",
  jurisdiction: "federal-regulation",
  scope: { kind: "federal" },
  citation: {
    source: "12 CFR § 1026.19(f)(2)(ii) (corrected disclosures; new three-business-day waiting period)",
    url: "https://www.consumerfinance.gov/rules-policy/regulations/1026/19/",
    accessedAt: "2026-06-03",
  },
  literalText:
    "[DRAFT — needs counsel] 12 CFR § 1026.19(f)(2)(ii) — Changes requiring a new waiting period. If, during the three-business-day period before consummation, the creditor provides corrected disclosures and one of the following occurs, the consumer must receive the corrected disclosures no later than three business days before consummation: (A) the disclosed annual percentage rate becomes inaccurate (as defined in § 1026.22); (B) the loan product changes; or (C) a prepayment penalty is added. Other changes are disclosed but do not restart the three-business-day period.\n\nThe bona fide personal financial emergency exception to the waiting period is narrow (§ 1026.19(f)(1)(iv)) and requires a dated written statement describing the emergency, signed by all consumers primarily liable.\n\nCandidate trigger phrases below target draft language that pressures the borrower to skip or compress this window and have NOT been counsel-verified.",
  purpose: "literal-match",
  severity: "blocking",
  counselReviewStatus: "draft",
  unverified: true,
  category: "closing-timing",
  triggers: [
    "waive your three-day",
    "waive the three-day",
    "waive your three day",
    "waive the waiting period",
    "waive the three-day waiting period",
    "skip the waiting period",
    "close early",
    "close before the three days",
    "no waiting period",
  ],
  triggerRegexes: [
    {
      pattern: "waiv\\w*\\b[^.!?\\n]{0,30}\\b(waiting period|three[\\s-]?day|3[\\s-]?day)",
      flags: "i",
      description:
        "Catches waive/waiving/waiver phrasings aimed at the TRID waiting period that the literal list misses.",
      example: "You can sign a waiver to skip the three-day wait.",
      counterExample: "We waive the application fee for veterans.",
    },
  ],
  safeRewrite:
    "Do not offer, promise, or imply that the borrower can waive, skip, or compress the three-business-day Closing Disclosure waiting period. The waiting period is waivable ONLY for a documented bona fide personal financial emergency under § 1026.19(f)(1)(iv) (dated written, consumer-signed statement) — never as a marketing convenience. Frame closing dates as 'on or after the third business day following receipt of your Closing Disclosure.'",
  drafterNotes:
    "Drafted 2026-06-03 to close the companion-rule gap noted on `trid-closing-disclosure-literal.ts`. Counsel: confirm the § 1026.22 APR-tolerance cross-reference and whether 'close early'/'no waiting period' are too broad (they could appear in benign non-mortgage contexts) — candidates only; sentinel does not fire. Consider scoping 'close early' to counsel-reference if false-positive rate is a concern.",
};
