import type { ComplianceRule } from "../../types";

/**
 * Georgia residential / general contractor licensing — required for work
 * above a statutory dollar threshold.
 */
export const rule: ComplianceRule = {
  ruleId: "ga-contractor-licensing",
  title: "Georgia residential / general contractor licensure",
  summary:
    "Georgia requires a residential or general contractor license issued by the State Licensing Board for Residential and General Contractors before a person may hold themselves out as a contractor for projects above the statutory threshold.",
  jurisdiction: "state-statute",
  scope: { kind: "state", state: "GA" },
  citation: {
    source: "O.C.G.A. § 43-41 (State Licensing Board for Residential and General Contractors); specifically § 43-41-17 (license required)",
    url: "https://law.justia.com/codes/georgia/title-43/chapter-41/",
    accessedAt: "2026-05-12",
  },
  literalText: `[UNVERIFIED — needs counsel] Substance: O.C.G.A. § 43-41-17 provides that no person shall hold himself or herself out to the public as a residential contractor or general contractor or engage in residential contracting or general contracting in Georgia without a current valid license issued by the State Licensing Board for Residential and General Contractors, except for work below the statutory threshold (commonly cited as $2,500 for residential work, with additional carve-outs for owner-occupant work, specialty trades regulated under separate chapters, and qualifying agricultural / municipal work). Penalties include misdemeanor liability and a private right of action for unjustified loss.`,
  unverified: true,
  drafterNotes:
    "Counsel: please pull current O.C.G.A. § 43-41-17 text and verify the dollar threshold + carve-outs. Specialty trades (electrical, plumbing, HVAC) are licensed under separate chapters (O.C.G.A. § 43-14, § 43-25, etc.) — counsel should advise whether sentinel needs separate companion rules per specialty trade.",
};
