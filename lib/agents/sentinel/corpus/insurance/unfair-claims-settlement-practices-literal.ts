import type { ComplianceRule } from "../../types";

/**
 * Unfair Claims Settlement Practices — NAIC Model #900, adopted in Georgia
 * at O.C.G.A. § 33-6-34. This is the claim-HANDLING side of insurance
 * compliance (distinct from the advertising/rebating rules): it governs how
 * an insurer or producer communicates about, investigates, and settles a
 * claim.
 *
 * The published GA statutory text could not be machine-fetched on
 * 2026-06-03 (the state code mirrors block automated requests), so the
 * substance below is a paraphrase of the NAIC Model #900 § 4 enumerated
 * practices, flagged `unverified` for counsel to replace with the canonical
 * O.C.G.A. § 33-6-34 wording. The candidate triggers target draft language
 * that itself constitutes a prohibited practice — flat denials without
 * basis, lowball framing, refusal to explain. DRAFT, UNVERIFIED — sentinel
 * does NOT fire until counsel red-lines.
 */
export const rule: ComplianceRule = {
  ruleId: "unfair-claims-settlement-practices",
  title: "Unfair Claims Settlement Practices — NAIC Model #900 / O.C.G.A. § 33-6-34 (DRAFT)",
  summary:
    "Prohibits unfair claim-settlement practices: misrepresenting policy provisions, failing to acknowledge and act reasonably promptly on claim communications, failing to adopt reasonable investigation standards, not attempting in good faith a prompt and equitable settlement once liability is clear, and denying a claim without a reasonable explanation of the basis. Sentinel does NOT fire until counsel red-lines.",
  jurisdiction: "state-statute",
  scope: { kind: "state", state: "GA" },
  citation: {
    source:
      "NAIC Unfair Claims Settlement Practices Act (Model #900) § 4; adopted in GA at O.C.G.A. § 33-6-34 (Unfair claim settlement practices)",
    url: "https://law.justia.com/codes/georgia/title-33/chapter-6/article-1/section-33-6-34/",
    accessedAt: "2026-06-03",
  },
  literalText:
    "[UNVERIFIED — needs counsel] Substance (paraphrased from NAIC Model #900 § 4 / O.C.G.A. § 33-6-34): it is an unfair claim settlement practice, when committed flagrantly and in conscious disregard, or with such frequency as to indicate a general business practice, to: (1) misrepresent pertinent facts or policy provisions relating to coverages at issue; (2) fail to acknowledge and act reasonably promptly upon communications with respect to claims; (3) fail to adopt and implement reasonable standards for the prompt investigation of claims; (4) refuse to pay claims without conducting a reasonable investigation based upon all available information; (5) fail to affirm or deny coverage of claims within a reasonable time after proof-of-loss statements have been completed; (6) not attempt in good faith to effectuate prompt, fair, and equitable settlements of claims in which liability has become reasonably clear; (7) compel insureds to institute litigation to recover amounts due by offering substantially less than the amounts ultimately recovered; and (8) fail to promptly provide a reasonable explanation of the basis in the policy in relation to the facts or applicable law for denial of a claim or for the offer of a compromise settlement. Counsel to replace with the canonical O.C.G.A. § 33-6-34 enumeration.",
  purpose: "literal-match",
  severity: "blocking",
  counselReviewStatus: "draft",
  unverified: true,
  category: "claims-handling",
  triggers: [
    "take it or leave it",
    "this is our final offer",
    "we don't have to explain",
    "we do not have to explain",
    "we are not required to explain",
    "your claim is denied",
    "claim denied, no appeal",
    "we won't investigate",
    "we will not investigate",
    "sue us if you want",
  ],
  triggerRegexes: [
    {
      pattern: "deny\\w*\\b[^.!?\\n]{0,40}\\b(without|no)\\b[^.!?\\n]{0,20}\\b(reason|explanation|basis)",
      flags: "i",
      description:
        "Catches denial-without-explanation phrasing (§ 4(8) / § 33-6-34 violation) the literal list misses, e.g. 'denying the claim with no explanation given'.",
      example: "We are denying the claim with no explanation required.",
      counterExample: "We approved the claim without any further documentation.",
    },
  ],
  safeRewrite:
    "Re-frame claim communications to meet the prompt, good-faith, explained-basis standard: acknowledge the claim promptly, state that you will investigate based on available information, and — for any denial or reduced offer — give a specific, reasonable explanation tied to the policy provisions and facts. Never present an offer as 'take it or leave it,' refuse to explain, or invite the insured to sue rather than settle a reasonably clear claim.",
  drafterNotes:
    "GA text could not be machine-fetched 2026-06-03 (state mirrors return 403); substance is the NAIC Model #900 § 4 paraphrase — counsel MUST replace with the canonical O.C.G.A. § 33-6-34 wording and confirm the 'general business practice' threshold language, which materially affects whether a single draft phrase is actionable. MOST AMBIGUOUS rule in this corpus: many of these phrases are context-sensitive (a producer relaying a carrier's denial is not itself the violator). Counsel to decide which, if any, are safe as literal-match vs counsel-reference. Companion: per-state claim-handling timelines in `ga-claim-handling-timelines-literal.ts`.",
};
