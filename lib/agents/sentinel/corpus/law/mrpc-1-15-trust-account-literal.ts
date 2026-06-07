import type { ComplianceRule } from "../../types";

/**
 * ABA Model Rule 1.15 — Safekeeping Property (client trust account / IOLTA).
 *
 * Load-bearing for any draft touching client funds, retainers, advance
 * fees, settlement proceeds, or third-party funds. Commingling client funds
 * with the lawyer's own operating account, or borrowing from / "floating"
 * client trust money, is among the most common per-se discipline triggers.
 *
 * Sentinel use: COUNSEL-REFERENCE. Whether a specific funds-handling
 * instruction commingles or misappropriates is a fact-and-law judgment, so
 * this never auto-flags; it surfaces in the counsel-handoff packet for any
 * draft that proposes moving, holding, or disbursing client / third-party
 * money.
 */
export const rule: ComplianceRule = {
  ruleId: "mrpc-1-15-trust-account",
  title: "ABA Model Rule 1.15 — Safekeeping Property (client trust account / IOLTA)",
  summary:
    "A lawyer must hold client and third-person property separate from the lawyer's own property; client funds go in a separate trust account, advance fees and expenses are deposited to trust and withdrawn only as earned/incurred, the lawyer must promptly notify and deliver funds the client or a third person is entitled to receive, and disputed funds must be kept separate until the dispute is resolved. Commingling or misappropriation is per-se prohibited.",
  jurisdiction: "model-rule",
  scope: { kind: "professional-body", body: "ABA" },
  citation: {
    source: "ABA Model Rules of Professional Conduct, Rule 1.15",
    url: "https://www.americanbar.org/groups/professional_responsibility/publications/model_rules_of_professional_conduct/rule_1_15_safekeeping_property/",
    accessedAt: "2026-06-06",
  },
  literalText: `Rule 1.15: Safekeeping Property

(a) A lawyer shall hold property of clients or third persons that is in a lawyer's possession in connection with a representation separate from the lawyer's own property. Funds shall be kept in a separate account maintained in the state where the lawyer's office is situated, or elsewhere with the consent of the client or third person. Other property shall be identified as such and appropriately safeguarded. Complete records of such account funds and other property shall be kept by the lawyer and shall be preserved for a period of [five years] after termination of the representation.

(b) A lawyer may deposit the lawyer's own funds in a client trust account for the sole purpose of paying bank service charges on that account, but only in an amount necessary for that purpose.

(c) A lawyer shall deposit into a client trust account legal fees and expenses that have been paid in advance, to be withdrawn by the lawyer only as fees are earned or expenses incurred.

(d) Upon receiving funds or other property in which a client or third person has an interest, a lawyer shall promptly notify the client or third person. Except as stated in this Rule or otherwise permitted by law or by agreement with the client, a lawyer shall promptly deliver to the client or third person any funds or other property that the client or third person is entitled to receive and, upon request by the client or third person, shall promptly render a full accounting regarding such property.

(e) When in the course of representation a lawyer is in possession of property in which two or more persons (one of whom may be the lawyer) claim interests, the property shall be kept separate by the lawyer until the dispute is resolved. The lawyer shall promptly distribute all portions of the property as to which the interests are not in dispute.`,
  purpose: "counsel-reference",
  severity: "blocking",
  counselReviewStatus: "draft",
  category: "trust-account",
  safeRewrite:
    "Never instruct that client funds, retainers, advance fees, or settlement proceeds be deposited to, held in, or paid from the firm's operating/general account — advance fees and unearned funds go to the client trust (IOLTA) account and are withdrawn only as earned or as expenses are incurred. Do not propose 'borrowing' from or temporarily floating trust funds. For funds a client or third person is entitled to, draft prompt notice and delivery; keep disputed funds segregated until resolved. Route any funds-movement instruction to a human for trust-accounting review.",
  drafterNotes:
    "Counsel-reference: whether a particular instruction commingles or misappropriates is fact-specific, so this never auto-flags — it anchors the counsel-handoff packet for any draft that moves client/third-party money. ABA Model Rule text pulled 2026-06-06 from americanbar.org. The '[five years]' bracket is the ABA's own bracketed placeholder (states set their own retention period — GA, e.g., sets its own). Companion: ABA Model Rules on Client Trust Account Records. Counsel to confirm GA's trust-account record-retention period and IOLTA participation requirement (O.C.G.A. / GA Bar Rule 1.15(I)–1.15(III)) as a GA-specific follow-on.",
};
