import type { ComplianceRule } from "../../types";

/**
 * Replacement cost vs. actual cash value (ACV) phrasing — coverage-
 * representation risk under the misrepresentation prohibition of the
 * Unfair Trade Practices Act (NAIC Model #880 § 4(A); GA O.C.G.A.
 * § 33-6-4) and the unfair-claims standard (O.C.G.A. § 33-6-34).
 *
 * Property policies pay losses on one of two bases:
 *   - Replacement Cost Value (RCV) — cost to repair/replace with like
 *     kind and quality, WITHOUT deduction for depreciation (often paid in
 *     two parts: ACV first, then recoverable depreciation on completion).
 *   - Actual Cash Value (ACV) — replacement cost MINUS depreciation.
 *
 * Telling an insured they have "full replacement" when the policy settles
 * on ACV — or vice versa — misrepresents a coverage term. The candidate
 * triggers flag absolute replacement-cost promises so the operator can
 * confirm they match the actual valuation basis on the policy. DRAFT —
 * sentinel does NOT fire until counsel red-lines.
 */
export const rule: ComplianceRule = {
  ruleId: "replacement-cost-vs-acv",
  title: "Replacement cost vs. actual cash value (ACV) — coverage representation (DRAFT)",
  summary:
    "Representing the loss-settlement basis (replacement cost vs. actual cash value) inaccurately misstates a coverage term — an unfair trade practice under NAIC Model #880 § 4(A) / O.C.G.A. § 33-6-4 and an unfair claim practice under § 33-6-34. Drafts promising 'full replacement' or 'brand new' must match the policy's actual valuation basis. Sentinel does NOT fire until counsel red-lines.",
  jurisdiction: "state-statute",
  scope: { kind: "state", state: "GA" },
  citation: {
    source:
      "NAIC Model #880 § 4(A) (misrepresentation of policy terms); GA O.C.G.A. § 33-6-4; unfair-claims overlay O.C.G.A. § 33-6-34",
    url: "https://content.naic.org/sites/default/files/MO880.pdf",
    accessedAt: "2026-06-03",
  },
  literalText:
    "[DRAFT — needs counsel] Coverage-representation principle: under the misrepresentation prohibition (NAIC Model #880 § 4(A), adopted in GA at O.C.G.A. § 33-6-4) and the unfair-claims standard (O.C.G.A. § 33-6-34, which bars misrepresenting pertinent policy provisions relating to the coverage at issue), a producer or insurer must not state or imply a loss-settlement basis the policy does not provide. 'Replacement cost' coverage repairs or replaces with like kind and quality without deduction for depreciation (recoverable depreciation typically paid on completion); 'actual cash value' equals replacement cost minus depreciation. Promising 'full replacement,' 'brand new,' or 'we pay to rebuild' on an ACV policy — or describing an RCV policy as paying only 'depreciated value' — misrepresents the coverage. Candidate trigger phrases below have NOT been counsel-verified.",
  purpose: "literal-match",
  severity: "blocking",
  counselReviewStatus: "draft",
  unverified: true,
  category: "coverage-representation",
  triggers: [
    "full replacement cost",
    "guaranteed replacement cost",
    "we'll replace it brand new",
    "we will replace it brand new",
    "brand new for old",
    "no depreciation taken",
    "we pay to rebuild no matter the cost",
    "you're covered for the full cost to rebuild",
    "100% replacement",
  ],
  triggerRegexes: [
    {
      pattern: "\\b(full|guaranteed|100%?)\\b[^.!?\\n]{0,15}\\breplacement\\b",
      flags: "i",
      description:
        "Catches absolute replacement-cost promises ('full replacement', 'guaranteed replacement', '100% replacement') that must be confirmed against the policy's valuation basis.",
      example: "Your home has full replacement coverage with no limit.",
      counterExample: "We offer a full range of coverage options to compare.",
    },
  ],
  safeRewrite:
    "State the loss-settlement basis exactly as the policy provides it. If the policy is ACV, say settlement is 'actual cash value (replacement cost less depreciation).' If it is replacement cost, note whether recoverable depreciation is paid only after repair/replacement and any coverage cap. Do not use absolute words ('full', 'guaranteed', 'brand new', '100%') unless the policy is a true guaranteed-replacement-cost form. When unsure of the basis, point the insured to the declarations page rather than characterizing it.",
  drafterNotes:
    "Drafted 2026-06-03. Directly addresses the corpus task's named gap (replacement-cost vs ACV phrasing). Counsel: confirm whether 'guaranteed replacement cost' should be allowed when the policy genuinely carries a GRC endorsement (true positive vs. false positive depends on the form). Consider a companion counsel-reference rule for ACV-misuse in the OTHER direction (describing RCV coverage as paying only depreciated value, which under-promises). These are candidates — sentinel does not fire.",
};
