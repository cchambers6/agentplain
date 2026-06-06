import type { ComplianceRule } from "../../types";

/**
 * Regulation Z (TILA) § 1026.24(i) — PROHIBITED representations in
 * dwelling-secured credit advertising; plus MAP Rule (Regulation N)
 * § 1014.3 material misrepresentation overlay.
 *
 * Split out from the former combined `reg-z-advertising-candidates` rule
 * per the mortgage corpus open question (2026-05-25): counsel asked whether
 * to separate the per-se PROHIBITED phrases (§ 1026.24(i)) from the
 * TRIGGERING TERMS (§ 1026.24(d)(1)) so the operator-facing flag wording
 * can differ ("remove this claim" vs "confirm the required disclosures are
 * present"). This file carries the PROHIBITED set; the triggering-term set
 * lives in `reg-z-advertising-triggering-terms-literal.ts`.
 *
 * DRAFT, UNVERIFIED. Sentinel WILL NOT fire on these — the scanner skips
 * `unverified: true` rules. Candidate list for counsel red-line.
 */
export const rule: ComplianceRule = {
  ruleId: "reg-z-mortgage-advertising-prohibited",
  title: "Regulation Z § 1026.24(i) + MAP Rule — prohibited mortgage advertising claims (DRAFT)",
  summary:
    "Per-se prohibited dwelling-secured-credit advertising representations under § 1026.24(i) (false government endorsement, debt-elimination claims) and material misrepresentations barred by the MAP Rule (Reg N) § 1014.3 (guaranteed approval, lowest-rate guarantees). Sentinel does NOT fire until counsel red-lines.",
  jurisdiction: "federal-regulation",
  scope: { kind: "federal" },
  citation: {
    source: "12 CFR § 1026.24(i); 12 CFR § 1014.3 (MAP Rule, Regulation N)",
    url: "https://www.ecfr.gov/current/title-12/chapter-X/part-1026/subpart-C/section-1026.24",
    accessedAt: "2026-05-25",
  },
  literalText:
    "[DRAFT — needs counsel] 12 CFR § 1026.24(i) — Prohibited acts or practices in advertisements for credit secured by a dwelling: (1) Misleading advertising of 'fixed' rates and payments. (2) Misleading comparisons in advertisements. (3) Misrepresentations about government endorsement — e.g. 'Government loan program', 'Government-supported loan'. (4) Misleading use of the current lender's name. (5) Misleading claims of debt elimination. (6) Misleading use of the term 'counselor' by a for-profit mortgage broker or creditor. (7) Misleading foreign-language advertisements.\n\n12 CFR § 1014.3 (MAP Rule) prohibits material misrepresentations in any commercial communication regarding any term of a mortgage credit product, including (but not limited to) interest rates, fees and costs, the amounts of payments, the term, and the existence of any guarantee or insurance.\n\nThe phrases below are nominated as per-se prohibited candidates and have NOT been counsel-verified.",
  purpose: "literal-match",
  severity: "blocking",
  counselReviewStatus: "draft",
  unverified: true,
  category: "advertising",
  triggers: [
    // § 1026.24(i)(3) — false government endorsement
    "government loan program",
    "government-supported loan",
    "government supported loan",
    "government-endorsed loan",
    "endorsed by hud",
    "endorsed by fha",
    // § 1026.24(i)(5) — debt-elimination claims
    "eliminate your mortgage",
    "eliminate your debt",
    "wipe out your mortgage",
    "wipe out your debt",
    // MAP Rule § 1014.3 — guarantee misrepresentations
    "guaranteed approval",
    "guaranteed loan",
    "guaranteed mortgage",
    "lowest rate guaranteed",
    "lowest rates guaranteed",
  ],
  triggerRegexes: [
    {
      pattern: "guarantee(d|s)?\\b[^.!?\\n]{0,20}\\b(approval|approved|loan|mortgage|rate|rates)",
      flags: "i",
      description:
        "Catches guarantee-of-outcome phrasings the literal list misses, e.g. 'guarantees the lowest rate', 'guaranteed to be approved'.",
      example: "We guarantee your approval regardless of credit.",
      counterExample: "We guarantee your privacy is protected.",
    },
  ],
  safeRewrite:
    "Remove the claim. Do not state or imply (a) government endorsement of a loan that is not a government program, (b) that a mortgage or debt will be eliminated, or (c) any guarantee of approval, a loan, or 'the lowest rate.' Replace with factual, non-absolute language ('you may be eligible', 'rates depend on credit and market conditions') — § 1026.24(i)(3),(5); MAP Rule § 1014.3.",
  drafterNotes:
    "Split from the combined candidate rule on 2026-06-03. These are per-se prohibited representations — the operator-facing flag should read 'remove this claim,' distinct from the triggering-term rule's 'confirm required disclosures.' Held back for counsel-reference (context-sensitive, NOT in this literal list): 'fixed rate' (only prohibited in a variable-rate context, § 1026.24(i)(1)); 'counselor' (only prohibited when used by a for-profit broker, § 1026.24(i)(6)). The 'government loan program' phrase is prohibited only when the advertised loan is not actually a government-supported loan — counsel may want to scope by lender/product type rather than fire unconditionally.",
};
