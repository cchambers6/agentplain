import type { ComplianceRule } from "../../types";

/**
 * CFPB RESPA § 8 enforcement against title insurers and settlement-service
 * providers — reference / routing rule.
 *
 * counsel-reference, severity "info": this rule carries NO triggers. It
 * grounds the § 8 candidate triggers (`respa-section-8-title-escrow-
 * candidates`) in real published enforcement so the operator and counsel
 * understand WHY 'marketing services agreement', 'desk rental', and
 * affiliated-business-arrangement language is high-risk — the CFPB has
 * actually penalized title/settlement providers for exactly those
 * arrangements.
 *
 * All actions below are published on consumerfinance.gov; pulled live on
 * 2026-06-06, so `unverified` is left unset.
 */
export const rule: ComplianceRule = {
  ruleId: "cfpb-title-respa-enforcement",
  title: "CFPB RESPA § 8 enforcement against title/settlement providers (reference)",
  summary:
    "Reference rule grounding the title/escrow RESPA § 8 candidate triggers in published CFPB enforcement against title insurers and settlement-service providers (Lighthouse Title, Borders & Borders, PHH, the 2015 Wells Fargo / JPMorgan marketing-services actions). No draft-text match — routing/context only.",
  jurisdiction: "federal-regulation",
  scope: { kind: "federal" },
  citation: {
    source:
      "CFPB enforcement actions under RESPA § 8 (12 USC § 2607): Lighthouse Title (2014 consent order, marketing services agreements); Borders & Borders, PLC (2013, sham affiliated business arrangements); PHH Corp. (2015); CFPB Takes Action Against Mortgage Kickback Agreements (2015, Wells Fargo / JPMorgan loan officers via title-company MSAs)",
    url: "https://www.consumerfinance.gov/about-us/newsroom/cfpb-takes-action-against-mortgage-kickback-agreements/",
    accessedAt: "2026-06-06",
  },
  literalText: `Published CFPB RESPA § 8 enforcement against title/settlement providers (consumerfinance.gov, accessed 2026-06-06):

• Lighthouse Title, Inc. (Sept. 2014 consent order): a Michigan title insurance agency paid $200,000 for illegal mortgage kickbacks. Lighthouse entered marketing services agreements (MSAs) with real estate brokers and others, but set the MSA fees in part by reference to the number of referrals received or expected — converting the "marketing" payment into a § 8(a) referral fee. The action prompted much of the industry to abandon MSAs and the CFPB's 2015 bulletin "RESPA Compliance and Marketing Services Agreements."

• Borders & Borders, PLC (complaint filed Oct. 24, 2013, W.D. Ky.): the CFPB alleged the law firm used a network of sham affiliated business arrangements (ABAs) — title companies jointly owned with referring real estate and mortgage brokers — to disguise referral kickbacks as profit distributions.

• PHH Corporation (2015): consent order addressing referral payments and endorsements treated as RESPA § 8 violations (later contested on constitutional grounds in PHH v. CFPB, but the § 8 theory grounds the enforcement posture).

• CFPB "Takes Action Against Mortgage Kickback Agreements" (Jan. 2015): actions against lenders and loan officers who funneled referrals through title-company marketing-services and desk-rental arrangements.

Sentinel does not fire on this rule — it is the enforcement backdrop for the § 8 candidate triggers, surfaced in the counsel-handoff packet.`,
  purpose: "counsel-reference",
  severity: "info",
  counselReviewStatus: "draft",
  safeRewrite:
    "Reference/routing rule — no draft-text fix. Use this enforcement history when reviewing any flagged § 8 candidate phrase: an MSA, co-marketing, or desk-rental arrangement is lawful ONLY if it pays fair market value for services actually performed and is not priced on referral volume. When a draft references such an arrangement, confirm the underlying agreement would survive the Lighthouse/Borders analysis before sending.",
  drafterNotes:
    "Pulled live 2026-06-06 from consumerfinance.gov (newsroom 'CFPB Takes Action Against Mortgage Kickback Agreements'; Borders complaint at files.consumerfinance.gov/f/201310_cfpb_complaint_borders.pdf). Authentic published enforcement, so `unverified` is left unset; the rule is counsel-reference and never fires regardless. Counsel may want to add the exact docket numbers and the 2015 RESPA-MSA bulletin URL as companion citations.",
};
