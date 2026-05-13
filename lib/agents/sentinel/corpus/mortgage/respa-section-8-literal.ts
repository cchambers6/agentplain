import type { ComplianceRule } from "../../types";

/**
 * RESPA Section 8 — anti-kickback and unearned-fee prohibition.
 *
 * Single most load-bearing federal rule for mortgage workflow drafts:
 * any referral incentive (gifts, marketing services, co-marketing) that
 * could be characterized as compensation for steering business is at risk.
 * Sentinel uses the literal text as its match anchor.
 */
export const rule: ComplianceRule = {
  ruleId: "respa-section-8-anti-kickback",
  title: "RESPA Section 8 — anti-kickback and unearned fees",
  summary:
    "Prohibits any fee, kickback, or thing of value exchanged for a referral of settlement service business on a federally related mortgage loan, and the splitting of unearned charges.",
  jurisdiction: "federal-statute",
  scope: { kind: "federal" },
  citation: {
    source: "12 USC § 2607(a)–(b); implementing regulation 12 CFR § 1024.14",
    url: "https://www.law.cornell.edu/uscode/text/12/2607",
    accessedAt: "2026-05-12",
  },
  literalText: `(a) Business referrals
No person shall give and no person shall accept any fee, kickback, or thing of value pursuant to any agreement or understanding, oral or otherwise, that business incident to or a part of a real estate settlement service involving a federally related mortgage loan shall be referred to any person.

(b) Splitting charges
No person shall give and no person shall accept any portion, split, or percentage of any charge made or received for the rendering of a real estate settlement service in connection with a transaction involving a federally related mortgage loan other than for services actually performed.`,
  drafterNotes:
    "Implementing rule at 12 CFR § 1024.14 elaborates on what constitutes a 'thing of value' (broad — gifts, trips, opportunities, special privileges). Counsel should attach the 1024.14 elaboration as a companion rule once this draft is reviewed.",
};
