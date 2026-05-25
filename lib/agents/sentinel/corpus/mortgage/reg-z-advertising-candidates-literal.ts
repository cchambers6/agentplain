import type { ComplianceRule } from "../../types";

/**
 * Regulation Z (TILA) § 1026.24 — closed-end mortgage advertising candidate
 * triggers; plus MAP Rule (Regulation N) misrepresentation overlay.
 *
 * DRAFT, UNVERIFIED. Sentinel WILL NOT fire on these — the scanner skips
 * `unverified: true` rules. Candidate list for counsel red-line.
 *
 * Two distinct match classes are bundled here so counsel can split them
 * during review:
 *
 *   1. PROHIBITED phrases under § 1026.24(i) — e.g. calling a variable
 *      rate "fixed", claiming "government loan program" when not, using
 *      "counselor" by a for-profit broker, claiming "debt elimination".
 *      Sentinel firing on these would flag a probable-per-se violation.
 *
 *   2. TRIGGERING phrases under § 1026.24(d)(1) — amount/percentage of
 *      down payment, number of payments, amount of any payment, finance
 *      charge. These phrases are NOT prohibited; their presence triggers
 *      the additional-disclosure requirement of § 1026.24(d)(2). Sentinel
 *      firing on these would flag "confirm § 1026.24(d)(2) disclosures
 *      are in the surrounding copy."
 *
 * Counsel should consider splitting this into two rules (one per match
 * class) before flipping verified.
 */
export const rule: ComplianceRule = {
  ruleId: "reg-z-mortgage-advertising-candidates",
  title: "Regulation Z § 1026.24 + MAP Rule — candidate mortgage advertising triggers (DRAFT)",
  summary:
    "Candidate literal phrases drafted from § 1026.24(i) (prohibited representations) and § 1026.24(d)(1) (triggering terms that require additional disclosure). Sentinel does NOT fire on these until counsel red-lines and splits per match class.",
  jurisdiction: "federal-regulation",
  scope: { kind: "federal" },
  citation: {
    source: "12 CFR § 1026.24(d) and § 1026.24(i); 12 CFR Part 1014 (MAP Rule, Regulation N)",
    url: "https://www.ecfr.gov/current/title-12/chapter-X/part-1026/subpart-C/section-1026.24",
    accessedAt: "2026-05-25",
  },
  literalText:
    "[DRAFT — needs counsel] 12 CFR § 1026.24(d)(1) — Triggering terms: If any of the following terms is set forth in an advertisement, the advertisement shall meet the requirements of paragraph (d)(2) of this section: (i) The amount or percentage of any downpayment. (ii) The number of payments or period of repayment. (iii) The amount of any payment. (iv) The amount of any finance charge.\n\n12 CFR § 1026.24(i) — Prohibited acts or practices in advertisements for credit secured by a dwelling: (1) Misleading advertising of 'fixed' rates and payments. (2) Misleading comparisons in advertisements. (3) Misrepresentations about government endorsement — e.g. 'Government loan program', 'Government-supported loan'. (4) Misleading use of the current lender's name. (5) Misleading claims of debt elimination. (6) Misleading use of the term 'counselor' by a for-profit mortgage broker or creditor. (7) Misleading foreign-language advertisements.\n\n12 CFR § 1014.3 (MAP Rule) prohibits material misrepresentations in any commercial communication regarding any term of a mortgage credit product, including (but not limited to) interest rates, fees and costs, the amounts of payments, the term, and the existence of any guarantee or insurance.\n\nCandidate trigger phrases below are nominated from these prohibitions but have NOT been counsel-verified.",
  purpose: "literal-match",
  unverified: true,
  category: "advertising",
  triggers: [
    // § 1026.24(i) — prohibited representations
    "government loan program",
    "government-supported loan",
    "government supported loan",
    "government-endorsed loan",
    "endorsed by hud",
    "endorsed by fha",
    "eliminate your mortgage",
    "eliminate your debt",
    "wipe out your mortgage",
    "wipe out your debt",
    // § 1026.24(d)(1) — triggering terms (trigger additional disclosure,
    // not prohibited outright)
    "no down payment",
    "zero down",
    "$0 down",
    "no closing costs",
    "no money down",
    // MAP Rule / FTC misrepresentation
    "guaranteed approval",
    "guaranteed loan",
    "guaranteed mortgage",
    "lowest rate guaranteed",
    "lowest rates guaranteed",
  ],
  drafterNotes:
    "Drafted 2026-05-25. The 'government loan program' phrase is a § 1026.24(i)(3) per-se prohibition unless the ad actually is for a government-supported loan; counsel may want to scope by lender type. 'Eliminate your mortgage/debt' targets the § 1026.24(i)(5) debt-elimination prohibition. The triggering-term group ('no down payment', '$0 down', etc.) requires additional § 1026.24(d)(2) disclosures — the sentinel flag here should say 'verify required disclosures are present' rather than 'remove'. Phrases intentionally held back for counsel: 'fixed rate' (only prohibited in the variable-rate context per § 1026.24(i)(1) — context-sensitive, recommend counsel-reference); 'counselor' (only prohibited when used by a for-profit broker per § 1026.24(i)(6) — entity-context-sensitive); specific APR / payment dollar amounts (require structured parsing, not literal-match).",
};
