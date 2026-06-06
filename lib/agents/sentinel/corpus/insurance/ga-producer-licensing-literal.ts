import type { ComplianceRule } from "../../types";

/**
 * GA producer licensing — required to sell, solicit, or negotiate insurance
 * in Georgia. Sentinel matches against drafts that imply unlicensed activity
 * (e.g. quoting from a state where the producer isn't appointed).
 */
export const rule: ComplianceRule = {
  ruleId: "ga-producer-licensing",
  title: "Georgia producer licensing — license required to sell or solicit insurance",
  summary:
    "A person may not sell, solicit, or negotiate insurance in Georgia for any class of insurance unless that person is licensed by the Commissioner for that line of authority.",
  jurisdiction: "state-statute",
  scope: { kind: "state", state: "GA" },
  citation: {
    source: "O.C.G.A. Title 33, Chapter 23 (Agents, Subagents, Counselors, and Adjusters)",
    url: "https://law.justia.com/codes/georgia/title-33/chapter-23/",
    accessedAt: "2026-05-12",
  },
  literalText: `[UNVERIFIED — needs counsel] Substance: under O.C.G.A. Title 33, Chapter 23, a person may not sell, solicit, or negotiate insurance in this state for any class or classes of insurance unless the person is licensed for that line of authority in accordance with the chapter. The chapter sets standards for examination, appointment, continuing education, license suspension/revocation, and reciprocal licensing under the NAIC Producer Licensing Model Act.`,
  purpose: "counsel-reference",
  severity: "info",
  counselReviewStatus: "draft",
  unverified: true,
  safeRewrite:
    "Do not solicit, sell, or negotiate insurance in a state, or for a line of authority, the producer is not licensed and appointed for. Marketing copy should not imply coverage the producer cannot place; quote only lines/states within the active license.",
  drafterNotes:
    "Counsel: please replace placeholder with the canonical 'license required' provision (commonly O.C.G.A. § 33-23-1 or § 33-23-4) and confirm whether the corpus should track each line-of-authority subsection separately.",
};
