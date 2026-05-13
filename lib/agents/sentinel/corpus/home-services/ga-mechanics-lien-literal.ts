import type { ComplianceRule } from "../../types";

/**
 * Georgia mechanic's / materialman's lien — perfection requirements and
 * notice of contest of lien.
 *
 * Sentinel flags drafts that propose lien filings or releases — getting
 * the notice-and-claim windows wrong is the most common contractor
 * compliance failure.
 */
export const rule: ComplianceRule = {
  ruleId: "ga-mechanics-lien",
  title: "Georgia mechanic's / materialman's lien — filing and notice rules",
  summary:
    "A contractor, subcontractor, materialman, or laborer who improves real estate may claim a lien on the property; the claim must be filed in the superior court of the county where the property is located within 90 days after the material is furnished or labor performed, with statutory notice to the owner.",
  jurisdiction: "state-statute",
  scope: { kind: "state", state: "GA" },
  citation: {
    source: "O.C.G.A. § 44-14-361 (right of lien); O.C.G.A. § 44-14-361.1 (perfection); O.C.G.A. § 44-14-368 (notice of contest of lien)",
    url: "https://law.justia.com/codes/georgia/title-44/chapter-14/article-8/part-3/",
    accessedAt: "2026-05-12",
  },
  literalText: `[UNVERIFIED — needs counsel] Substance: O.C.G.A. § 44-14-361 grants a lien on real estate to enumerated parties (mechanics, contractors, subcontractors, materialmen, laborers) for work performed or material furnished. O.C.G.A. § 44-14-361.1 establishes perfection requirements:

(1) Substantial compliance with the contract;
(2) Filing of a claim of lien within 90 days after the completion of the work, or within 90 days after the material was furnished, in the office of the clerk of the superior court of the county where the property is located;
(3) Service of a copy of the claim of lien on the owner or contractor within two business days of filing;
(4) Commencement of an action for recovery within 365 days from the date the claim of lien was filed.

O.C.G.A. § 44-14-368 allows the property owner or contractor to file a notice of contest of lien, which shortens the lien claimant's window to commence suit to 60 days after the notice of contest is filed.`,
  unverified: true,
  drafterNotes:
    "Counsel: please verify the 90-day filing window, the two-business-day service requirement, and the 60-day post-contest action window — these are the load-bearing dates sentinel needs to flag against.",
};
