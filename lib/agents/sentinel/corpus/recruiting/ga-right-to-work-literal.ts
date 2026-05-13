import type { ComplianceRule } from "../../types";

/**
 * Georgia right-to-work — employment may not be conditioned on union
 * membership or non-membership.
 */
export const rule: ComplianceRule = {
  ruleId: "ga-right-to-work",
  title: "Georgia right-to-work — no compulsory union membership",
  summary:
    "Membership or non-membership in a labor organization shall not be made a condition of employment or continuation of employment by any employer; and no individual shall be required to pay any fee, assessment, or other charge of any kind to any labor organization as a condition of employment.",
  jurisdiction: "state-statute",
  scope: { kind: "state", state: "GA" },
  citation: {
    source: "O.C.G.A. § 34-6-21 (right-to-work); see also § 34-6-20 to § 34-6-25",
    url: "https://law.justia.com/codes/georgia/title-34/chapter-6/article-2/",
    accessedAt: "2026-05-12",
  },
  literalText: `[UNVERIFIED — needs counsel] Substance: O.C.G.A. § 34-6-21: No individual shall be required as a condition of employment or continuance of employment to be or remain a member or an affiliate of a labor organization or to resign from or to refrain from membership in or affiliation with a labor organization. Any contract or agreement made or entered into in violation of this Code section is declared to be null and void and against public policy.`,
  unverified: true,
  drafterNotes:
    "Counsel: please verify literal wording of O.C.G.A. § 34-6-21 — drafter substance is high-confidence but should be confirmed against current code.",
};
