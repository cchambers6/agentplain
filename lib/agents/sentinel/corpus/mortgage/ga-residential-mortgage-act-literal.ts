import type { ComplianceRule } from "../../types";

/**
 * Georgia Residential Mortgage Act — state-level lender / broker licensing.
 *
 * NOTE: drafter is confident about the substance of state mortgage licensure
 * under O.C.G.A. Title 7, Chapter 1, Article 13 (the GRMA), but did not pull
 * the canonical published text in this draft pass. Marked unverified —
 * counsel verifies citation form and confirms the load-bearing prohibition
 * before sentinel matches on this rule.
 */
export const rule: ComplianceRule = {
  ruleId: "ga-residential-mortgage-act",
  title: "Georgia Residential Mortgage Act — state licensure",
  summary:
    "Georgia requires a state license to act as a mortgage broker, mortgage lender, or mortgage loan originator with respect to residential mortgage loans on Georgia property.",
  jurisdiction: "state-statute",
  scope: { kind: "state", state: "GA" },
  citation: {
    source: "O.C.G.A. Title 7, Chapter 1, Article 13 (Georgia Residential Mortgage Act)",
    url: "https://law.justia.com/codes/georgia/title-7/chapter-1/article-13/",
    accessedAt: "2026-05-12",
  },
  literalText: `[UNVERIFIED — needs counsel] Substance: the Georgia Residential Mortgage Act (O.C.G.A. Title 7, Chapter 1, Article 13) requires a license from the Department of Banking and Finance to act as a mortgage broker, mortgage lender, or mortgage loan originator with respect to a residential mortgage loan on Georgia real property; specifies licensing standards, examinations, and bonding; and prohibits unlicensed activity. Implementing regulations at Rules of the Department of Banking and Finance, Chapter 80-11.`,
  unverified: true,
  drafterNotes:
    "Counsel: please confirm citation form (some sources cite as O.C.G.A. § 7-1-1000 et seq.) and replace placeholder with the operative prohibition language. Sentinel will not match on this rule until literal is filled in.",
};
