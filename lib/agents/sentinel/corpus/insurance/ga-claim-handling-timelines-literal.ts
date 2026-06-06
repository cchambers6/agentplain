import type { ComplianceRule } from "../../types";

/**
 * Georgia claim-handling timelines — the prompt-acknowledgment and
 * prompt-payment deadlines that put numbers on the Unfair Claims
 * Settlement Practices Act's "reasonably prompt" standard.
 *
 * Insurance claim-handling timelines are STATE-SPECIFIC — this is the
 * Georgia entry; the corpus needs a sibling rule per launch state. Georgia
 * sources the acknowledgment/decision duties from O.C.G.A. § 33-6-34 and the
 * Commissioner's regulations (Rules of the Department of Insurance,
 * Chapter 120-2), with statutory prompt-pay interest under O.C.G.A.
 * § 33-4-6 for bad-faith failure to pay.
 *
 * The exact day-counts vary by line and by regulation version and could not
 * be machine-verified on 2026-06-03, so the rule is `unverified` /
 * counsel-reference. The candidate triggers target draft language that
 * STATES a timeline (which must match the governing rule) or disclaims any
 * deadline. DRAFT — sentinel does NOT fire until counsel red-lines.
 */
export const rule: ComplianceRule = {
  ruleId: "ga-claim-handling-timelines",
  title: "Georgia claim-handling timelines — prompt acknowledgment / payment (DRAFT)",
  summary:
    "Georgia requires reasonably prompt acknowledgment of, investigation of, and decision on insurance claims, with bad-faith failure-to-pay exposure under O.C.G.A. § 33-4-6. Drafts that state a claim timeline (which must be accurate) or imply there is no deadline are flagged for confirmation. Timelines are state-specific; this rule is Georgia-only.",
  jurisdiction: "state-regulation",
  scope: { kind: "state", state: "GA" },
  citation: {
    source:
      "O.C.G.A. § 33-6-34 (prompt acknowledgment/decision duties); O.C.G.A. § 33-4-6 (bad-faith failure to pay; penalty + attorney fees); Rules of the GA Dept. of Insurance, Chapter 120-2",
    url: "https://oci.georgia.gov/",
    accessedAt: "2026-06-03",
  },
  literalText:
    "[UNVERIFIED — needs counsel] Substance: Georgia law requires insurers to acknowledge and act reasonably promptly upon claim communications and to affirm or deny coverage within a reasonable time after proof of loss (O.C.G.A. § 33-6-34). O.C.G.A. § 33-4-6 imposes a penalty (up to 50% of the liability or $5,000, whichever is greater) plus reasonable attorney's fees when an insurer in bad faith refuses to pay a covered loss within 60 days after a demand. Specific acknowledgment / investigation / payment day-counts are set by the Commissioner's regulations (Chapter 120-2) and vary by line of insurance. Counsel to confirm the operative day-counts for each line before sentinel surfaces a timeline-accuracy flag.",
  purpose: "counsel-reference",
  severity: "advisory",
  counselReviewStatus: "draft",
  unverified: true,
  category: "claims-timeline",
  triggers: [
    "no deadline to pay",
    "no time limit to pay",
    "we can take as long as we want",
    "there is no deadline",
    "whenever we get to it",
  ],
  triggerRegexes: [
    {
      pattern: "(pay|payment|settle|acknowledge|decide|claim)[^.!?\\n]{0,40}within\\s+\\d{1,3}\\s+(business\\s+)?days?|within\\s+\\d{1,3}\\s+(business\\s+)?days?[^.!?\\n]{0,40}(pay|payment|settle|acknowledge|decide|claim)",
      flags: "i",
      description:
        "Catches a stated claim timeline in either order ('pay your claim within 90 days' or 'within 90 days we will pay') so the operator can confirm it matches the governing GA rule — flag is 'verify accuracy', not 'remove'.",
      example: "We will pay your claim within 90 days of approval.",
      counterExample: "Please respond within 5 days to confirm your appointment.",
    },
  ],
  safeRewrite:
    "State a claim timeline only if it matches the governing Georgia rule for that line of insurance; otherwise say 'within the time required by Georgia law.' Never imply there is no deadline or that the insurer may take unlimited time — that contradicts O.C.G.A. § 33-6-34 and the § 33-4-6 bad-faith standard. When relaying a carrier decision, attribute the timeline to the carrier/policy, not to the producer.",
  drafterNotes:
    "Day-counts NOT verified 2026-06-03 (GA regulation text not machine-fetchable). Counsel MUST supply the operative Chapter 120-2 acknowledgment/investigation/payment day-counts per line, and confirm the § 33-4-6 60-day demand window and penalty figures. This rule is STATE-SCOPED to GA — `feedback`/portability note: add a sibling `<state>-claim-handling-timelines-literal.ts` for each new launch state rather than parameterizing one rule, so each state's citation stands alone for audit. The timeline regex is 'verify accuracy' severity 'advisory', not a prohibition.",
};
