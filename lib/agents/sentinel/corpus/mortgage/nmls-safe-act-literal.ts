import type { ComplianceRule } from "../../types";

/**
 * SAFE Act / NMLS — mortgage loan originator licensure requirement.
 *
 * Federal floor: every individual who acts as a residential mortgage loan
 * originator must be state-licensed (or federally registered for depository
 * institutions) through the Nationwide Multistate Licensing System (NMLS).
 *
 * NOTE: drafter is confident about the substance but the precise wording
 * of 12 USC § 5103 was not pulled in this draft pass — flagged unverified.
 */
export const rule: ComplianceRule = {
  ruleId: "safe-act-mlo-licensure",
  title: "SAFE Act — Mortgage Loan Originator licensure / NMLS registration",
  summary:
    "An individual may not engage in the business of a residential mortgage loan originator without first obtaining a state license or, for employees of a depository institution, federal registration through the NMLS.",
  jurisdiction: "federal-statute",
  scope: { kind: "federal" },
  citation: {
    source: "12 USC § 5103 (SAFE Act); implementing regulation 12 CFR Part 1008",
    url: "https://www.law.cornell.edu/uscode/text/12/5103",
    accessedAt: "2026-05-12",
  },
  literalText: `[UNVERIFIED — needs counsel] Substance: 12 USC § 5103 requires that, in addition to other requirements, an individual may not engage in the business of a loan originator without first obtaining and maintaining annually a registration as a registered loan originator (for federally chartered/regulated depositories) or a state license and registration as a state-licensed loan originator. Implementing rules at 12 CFR Part 1008 set minimum standards for state licensing; the corresponding federal registration rule sits at 12 CFR Part 1007.`,
  unverified: true,
  drafterNotes:
    "Counsel: please replace the placeholder with the actual statutory text from 12 USC § 5103(a). Sentinel currently treats this rule as scope-only (won't fire on text match) until the literal is filled in.",
};
