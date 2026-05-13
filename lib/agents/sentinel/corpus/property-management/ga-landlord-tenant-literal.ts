import type { ComplianceRule } from "../../types";

/**
 * Georgia landlord-tenant — landlord's duty to repair.
 *
 * Codified at O.C.G.A. § 44-7-13. This is the load-bearing premises-
 * liability rule sentinel uses to flag drafts that imply a landlord
 * has waived or contracted around the duty (which Georgia law forbids
 * for residential leases — see § 44-7-2(b)).
 */
export const rule: ComplianceRule = {
  ruleId: "ga-landlord-duty-to-repair",
  title: "Georgia landlord — duty to repair and warranty against waiver",
  summary:
    "The landlord is bound to keep the premises in repair and is liable for damages arising from defective construction or failure to keep the premises in repair. In residential leases, the landlord may not by contract waive or transfer this duty.",
  jurisdiction: "state-statute",
  scope: { kind: "state", state: "GA" },
  citation: {
    source: "O.C.G.A. § 44-7-13 (duty to repair); O.C.G.A. § 44-7-2 (no waiver of statutory duties in residential leases)",
    url: "https://law.justia.com/codes/georgia/title-44/chapter-7/article-1/",
    accessedAt: "2026-05-12",
  },
  literalText: `[UNVERIFIED — needs counsel] Substance from O.C.G.A. § 44-7-13 and § 44-7-2:

§ 44-7-13: The landlord must keep the premises in repair. He shall be liable for all substantial improvements placed upon the premises by his consent.

§ 44-7-2(b): In any contract, lease, license agreement, or similar agreement, oral or written, for the use or rental of real property as a dwelling place, the landlord or the tenant may not waive, assign, transfer, or otherwise avoid any of the rights, duties, or remedies contained in the following provisions of law:
  (1) Article 2 of this chapter, relating to security deposits;
  (2) Code Section 44-7-13, relating to the duties of a landlord as to repairs and improvements;
  (3) Code Section 44-7-14, relating to the liability of a landlord for damages from defective construction and for damages from failure to keep the premises in repair;
  (4) Article 3 of this chapter, relating to proceedings against tenants holding over.`,
  unverified: true,
  drafterNotes:
    "Counsel: please verify literal wording. § 44-7-13 is short and well-known; § 44-7-2(b) subsection numbering should be confirmed against the current code.",
};
