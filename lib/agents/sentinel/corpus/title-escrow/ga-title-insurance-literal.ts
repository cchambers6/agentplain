import type { ComplianceRule } from "../../types";

/**
 * Georgia title insurance — regulation under Title 33.
 *
 * Title insurers in GA are regulated under the general Insurance Code; the
 * specific title-insurance article is O.C.G.A. § 33-7-8 with related rules
 * at Chapter 120 of the Rules of the Department of Insurance.
 *
 * NOTE: drafter did not pull exact statutory text. Marked unverified.
 */
export const rule: ComplianceRule = {
  ruleId: "ga-title-insurance-regulation",
  title: "Georgia title insurance — Title 33 regulation",
  summary:
    "Title insurance in Georgia is regulated by the Commissioner of Insurance under O.C.G.A. § 33-7-8 and related Title 33 provisions; title insurers must be licensed and rates and forms are subject to filing/review.",
  jurisdiction: "state-statute",
  scope: { kind: "state", state: "GA" },
  citation: {
    source: "O.C.G.A. § 33-7-8 (title insurance); Rules of the Department of Insurance, Chapter 120",
    url: "https://law.justia.com/codes/georgia/title-33/chapter-7/",
    accessedAt: "2026-05-12",
  },
  literalText: `[UNVERIFIED — needs counsel] Substance: O.C.G.A. § 33-7-8 places title insurance under the Title 33 (Insurance) regulatory umbrella. Title insurance is one of the kinds of insurance authorized under the Code. Title insurers must obtain a certificate of authority from the Commissioner, file rates and forms, and comply with the Unfair Trade Practices provisions (O.C.G.A. § 33-6) that apply to all insurers. The Department of Insurance has further rulemaking authority over title insurers via Chapter 120 of the Department rules.`,
  unverified: true,
  drafterNotes:
    "Counsel: please pull the operative text of O.C.G.A. § 33-7-8 and replace placeholder. Confirm whether the Title Insurance Agents licensing structure (separate from the title insurer itself) is captured at a different citation that should also be added.",
};
