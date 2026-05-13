import type { ComplianceRule } from "../../types";

/**
 * Georgia security deposit handling — escrow account + return timeline.
 *
 * Two load-bearing rules: (1) deposits must be held in escrow at a
 * federally insured banking institution licensed to do business in
 * Georgia, segregated from the landlord's own funds; (2) deposit (or
 * itemized list of damages) must be returned within one month of
 * termination of the lease.
 */
export const rule: ComplianceRule = {
  ruleId: "ga-security-deposit-handling",
  title: "Georgia security deposit — escrow handling and one-month return",
  summary:
    "Security deposits must be held in an escrow account in a federally insured bank in Georgia; the landlord must return the deposit (or an itemized list of damages with the balance) within one month after the tenant surrenders the premises.",
  jurisdiction: "state-statute",
  scope: { kind: "state", state: "GA" },
  citation: {
    source: "O.C.G.A. § 44-7-31 (escrow); O.C.G.A. § 44-7-34 (return); O.C.G.A. § 44-7-33 (move-out inspection list)",
    url: "https://law.justia.com/codes/georgia/title-44/chapter-7/article-2/",
    accessedAt: "2026-05-12",
  },
  literalText: `[UNVERIFIED — needs counsel] Substance, drawn from O.C.G.A. § 44-7-31 and § 44-7-34:

§ 44-7-31 (escrow): Whenever a security deposit is held by a landlord or such landlord's agent on behalf of a tenant, the deposit shall be held in escrow in a trust account used only for that purpose in any bank or lending institution subject to regulation by this state or any agency of the United States. The tenant shall be informed in writing of the location and account number of the escrow account.

§ 44-7-34 (return): Within one month after the termination of the residential lease or the surrender and acceptance of the premises, whichever last occurs, the landlord shall return to the tenant the full security deposit which was deposited with the landlord by the tenant. No security deposit shall be retained to cover ordinary wear and tear which occurred as a result of the use of the premises for the purposes for which the premises were intended, provided that there was no negligence, carelessness, accident, or abuse of the premises by the tenant or members of the tenant's household or their guests or invitees. If the landlord retains any portion of the security deposit, the landlord shall provide the tenant with a written statement listing the exact reasons for the retention.`,
  unverified: true,
  drafterNotes:
    "Counsel: please confirm the literal wording — the above is drafted from drafter recollection of the statutory text and is functionally close but may differ in punctuation/clause order from the canonical O.C.G.A. rendering. Treat as substantive-but-unverified.",
};
