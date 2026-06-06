import type { ComplianceRule } from "../../types";

/**
 * Office of Commissioner of Insurance — Georgia regulator overview.
 *
 * Sentinel uses this rule to route flagged drafts to the right state
 * authority. Substance only — not used for text matching.
 */
export const rule: ComplianceRule = {
  ruleId: "ga-commissioner-of-insurance",
  title: "Office of Commissioner of Insurance and Safety Fire — Georgia regulator",
  summary:
    "The Georgia Office of Commissioner of Insurance and Safety Fire administers Title 33 (the Insurance Code), licenses producers, examines insurers, and adopts regulations under O.C.G.A. § 33-2.",
  jurisdiction: "state-regulation",
  scope: { kind: "state", state: "GA" },
  citation: {
    source: "O.C.G.A. Title 33, Chapter 2 (Office of Commissioner of Insurance)",
    url: "https://oci.georgia.gov/",
    accessedAt: "2026-05-12",
  },
  literalText: `[UNVERIFIED — needs counsel] Substance: O.C.G.A. § 33-2-1 establishes the office of Commissioner of Insurance and vests the Commissioner with authority to administer the Insurance Code (Title 33). The Commissioner has rulemaking authority (O.C.G.A. § 33-2-9), examination authority over insurers (O.C.G.A. § 33-2-11), and authority to license producers under Chapter 23. Regulations are codified at Rules of the Department of Insurance, Chapter 120.`,
  purpose: "counsel-reference",
  severity: "info",
  counselReviewStatus: "draft",
  unverified: true,
  safeRewrite:
    "No draft rewrite — scope/routing rule only. Sentinel uses it to direct flagged Georgia insurance drafts to the correct regulator (Office of Commissioner of Insurance and Safety Fire).",
  drafterNotes:
    "This rule is scope/routing only — sentinel uses it to direct flags to the GA Commissioner's office. Counsel: please confirm rulemaking citation.",
};
