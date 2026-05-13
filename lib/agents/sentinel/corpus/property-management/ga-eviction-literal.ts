import type { ComplianceRule } from "../../types";

/**
 * Georgia dispossessory (eviction) procedure — landlord must demand
 * possession before filing.
 *
 * Sentinel matches against drafts that propose self-help eviction or
 * lockouts, which Georgia law forbids (only court-ordered dispossessory
 * is permitted).
 */
export const rule: ComplianceRule = {
  ruleId: "ga-dispossessory-procedure",
  title: "Georgia dispossessory — demand for possession required; self-help eviction forbidden",
  summary:
    "Before filing a dispossessory action, the landlord must demand possession from the tenant. Self-help eviction (changing locks, removing belongings, cutting utilities) is not permitted; possession is recovered only by court order.",
  jurisdiction: "state-statute",
  scope: { kind: "state", state: "GA" },
  citation: {
    source: "O.C.G.A. § 44-7-50 (demand for possession); O.C.G.A. § 44-7-51 (affidavit and summons); O.C.G.A. § 44-7-55 (judgment and writ of possession)",
    url: "https://law.justia.com/codes/georgia/title-44/chapter-7/article-3/",
    accessedAt: "2026-05-12",
  },
  literalText: `[UNVERIFIED — needs counsel] Substance from O.C.G.A. § 44-7-50:

In all cases when a tenant holds possession of lands or tenements over and beyond the term for which they were rented or leased to such tenant, or fails to pay the rent when it becomes due, and in all cases when lands or tenements are held and occupied by any tenant at will or sufferance, whether under contract of rent or not, when the owner of such lands or tenements desires possession of the same, such owner may, individually or by an agent or attorney at law or attorney in fact, demand the possession of the property so rented, leased, held, or occupied. If the tenant refuses or fails to deliver possession when so demanded, the owner or the agent or attorney at law or attorney in fact of such owner may immediately go before the judge of the superior court, the judge of the state court, or the clerk or deputy clerk of either court, or before the judge or the clerk or deputy clerk of any other court with jurisdiction over the subject matter, or a magistrate in the district where the land lies, and make an affidavit under oath to the facts.`,
  unverified: true,
  drafterNotes:
    "Counsel: this is a long subsection — please verify the literal text matches the current O.C.G.A. § 44-7-50 rendering. Sentinel routing should also flag any draft proposing self-help eviction (lockout, utility shutoff) — that prohibition is from case law, not from the statute itself; consider whether to add a companion case-law citation.",
};
