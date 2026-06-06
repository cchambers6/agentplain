import type { ComplianceRule } from "../../types";

/**
 * NAIC Unfair Trade Practices Act (Model #880) § 4 — advertising candidate
 * triggers. Most U.S. states have adopted Model #880 in substantially the
 * NAIC form (Georgia at O.C.G.A. § 33-6-1 et seq.).
 *
 * DRAFT, UNVERIFIED. Sentinel WILL NOT fire on these — the scanner skips
 * `unverified: true` rules. Candidate list for counsel red-line.
 *
 * Model #880 § 4(A) "Misrepresentations and false advertising of insurance
 * policies" — prohibits any "estimate, illustration, circular or statement
 * ... misrepresenting the terms ... benefits or advantages" of a policy.
 *
 * Model #880 § 4(B) "False information and advertising generally" —
 * prohibits any advertisement "containing any assertion, representation or
 * statement with respect to the business of insurance ... which is untrue,
 * deceptive or misleading."
 *
 * Model #880 § 4(H) "Unfair discrimination" + § 4(I) "Rebates" — bar most
 * forms of rebating, gifts, or special inducements.
 */
export const rule: ComplianceRule = {
  ruleId: "insurance-utpa-candidates",
  title: "NAIC Model #880 § 4 — candidate insurance advertising triggers (DRAFT)",
  summary:
    "Candidate literal phrases drafted from NAIC Model Unfair Trade Practices Act § 4 (misrepresentation / false advertising / rebating) and the state-level equivalents most carriers operate under. Sentinel does NOT fire on these until counsel red-lines for the producer's state(s).",
  jurisdiction: "model-rule",
  scope: { kind: "professional-body", body: "NAIC" },
  citation: {
    source: "NAIC Model Unfair Trade Practices Act (Model #880) § 4 — implemented in GA at O.C.G.A. § 33-6-4",
    url: "https://content.naic.org/sites/default/files/MO880.pdf",
    accessedAt: "2026-05-25",
  },
  literalText:
    "[DRAFT — needs counsel] Model #880 § 4(A): No person shall make, issue, circulate, or cause to be made, issued or circulated, any estimate, illustration, circular or statement misrepresenting the terms of any policy issued or to be issued or the benefits or advantages promised thereby or the dividends or share of the surplus to be received thereon.\n\n§ 4(B): No person shall make, publish, disseminate, circulate or place before the public ... an advertisement, announcement or statement containing any assertion, representation or statement with respect to the business of insurance or with respect to any person in the conduct of his insurance business, which is untrue, deceptive or misleading.\n\n§ 4(I): No person shall ... knowingly permit or offer to make or make any contract of life insurance, life annuity or accident and health insurance, or agreement as to such contract other than as plainly expressed in the insurance contract issued thereon ... or pay ... any rebate of premiums payable on the contract.\n\nCandidate trigger phrases below are nominated from these prohibitions but have NOT been counsel-verified.",
  purpose: "literal-match",
  severity: "blocking",
  counselReviewStatus: "draft",
  unverified: true,
  category: "advertising",
  triggers: [
    "guaranteed approval",
    "guaranteed issue",
    "guaranteed acceptance",
    "everyone qualifies",
    "everyone is approved",
    "no medical questions",
    "no health questions",
    "free insurance",
    "free policy",
    "lowest rates guaranteed",
    "lowest premium guaranteed",
    "approved by the insurance department",
    "endorsed by the insurance department",
    "endorsed by the insurance commissioner",
    "we'll rebate your premium",
    "premium rebate",
    "cash back on your premium",
  ],
  triggerRegexes: [
    {
      pattern: "endorsed\\b[^.!?\\n]{0,30}\\b(insurance (department|commissioner)|state insurance)",
      flags: "i",
      description:
        "Catches claims of state insurance-regulator endorsement (a § 4(B) per-se violation everywhere) the literal list misses, e.g. 'endorsed by your state insurance regulator'.",
      example: "This plan is endorsed by the state insurance department.",
      counterExample: "This plan is endorsed by leading financial advisors.",
    },
  ],
  safeRewrite:
    "Remove the absolute or endorsement claim. Do not promise guaranteed approval/issue/acceptance unless the specific product is genuinely guaranteed-issue (then state the product line). Never claim endorsement or approval by a state insurance department/commissioner. Replace 'lowest rates guaranteed' with comparative language you can substantiate. Strike rebate/cash-back offers (see `ga-anti-rebating`).",
  drafterNotes:
    "Drafted 2026-05-25. 'Guaranteed approval/issue/acceptance' phrases are direct Model #880 § 4(A) misrepresentation targets EXCEPT where the policy is genuinely guaranteed-issue (some final-expense / Medigap products). Counsel should consider whether to scope this rule to non-guaranteed-issue product lines via category metadata or a follow-on counsel-reference rule. Rebating phrases are direct § 4(I) targets; many states permit modest 'value-added services' (NAIC Model #880 was amended 2020 to allow up to a state-set cap), so counsel should overlay state-specific dollar thresholds. Endorsement claims about a state insurance department are direct § 4(B) violations everywhere. Borderline omissions: 'A++ rated' / 'A.M. Best A-rated' (true claims are typically OK but format requirements vary — counsel-reference).",
};
