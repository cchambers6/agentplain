import type { ComplianceRule } from "../../types";

/**
 * Form ADV Part 2 (brochure) — delivery & disclosure.
 *
 * Form ADV is a form, not a rule — the obligation to deliver Part 2A/2B
 * comes from the brochure rule, 17 CFR § 275.204-3. This rule anchors any
 * draft that makes representations the brochure must also disclose (fees,
 * conflicts, disciplinary history, custody, soft-dollar/brokerage
 * practices) so the draft is checked against the delivered brochure.
 */
export const rule: ComplianceRule = {
  ruleId: "form-adv-part-2-brochure-disclosure",
  title: "Form ADV Part 2 (brochure) — delivery & disclosure",
  summary:
    "The brochure rule (17 CFR § 275.204-3) requires a registered adviser to deliver its current Form ADV Part 2A ('brochure') before or at the time it enters into an advisory contract, and to deliver — annually within 120 days of fiscal year end and free of charge — either a current brochure or a summary of material changes when there have been material changes. Part 2A must disclose, in plain English, advisory business, fees and compensation, conflicts of interest, disciplinary information, code of ethics, brokerage practices (including soft dollars), and custody; Part 2B brochure supplements cover individual supervised persons.",
  jurisdiction: "federal-regulation",
  scope: { kind: "federal" },
  citation: {
    source: "17 CFR § 275.204-3 (brochure rule) + Form ADV Part 2 instructions (17 CFR § 279.1)",
    url: "https://www.law.cornell.edu/cfr/text/17/275.204-3",
    accessedAt: "2026-06-06",
  },
  literalText: `17 CFR § 275.204-3 — Delivery of brochures and brochure supplements:

(b) Delivery.
(1) General requirement. You must deliver to a client or prospective client your current brochure and one or more current brochure supplements before or at the time you enter into an investment advisory contract with that client.

(2) Updates. You must deliver to each client, annually within 120 days after the end of your fiscal year and without charge, if there are material changes in your brochure since your last annual updating amendment:
  (i) A current brochure; or
  (ii) The summary of material changes to the brochure (as required by Item 2 of Part 2A of Form ADV) that includes an offer to provide a copy of the current brochure and information on how a client may obtain the brochure.

Form ADV Part 2A (the "brochure") is the disclosure statement delivered to clients and must address, in plain English, among other items: advisory business; fees and compensation; performance-based fees; types of clients; methods of analysis and investment strategies; disciplinary information; other financial industry activities and affiliations; code of ethics, participation in client transactions and personal trading; brokerage practices (including soft-dollar arrangements); review of accounts; client referrals and other compensation; custody; investment discretion; voting client securities; and financial information. Part 2B (brochure supplement) covers the individual supervised persons who provide advisory services to the client.`,
  purpose: "counsel-reference",
  severity: "advisory",
  counselReviewStatus: "draft",
  category: "disclosure",
  safeRewrite:
    "Whenever a draft makes representations about the adviser's fees, conflicts, disciplinary history, custody, or brokerage/soft-dollar practices, confirm those representations match the firm's current Form ADV Part 2A brochure and that the brochure was delivered before/at contracting and offered/updated annually. Do not state or imply terms that contradict or are not disclosed in the delivered brochure.",
  drafterNotes:
    "Verified the § 275.204-3(b) delivery text (initial before/at contract; annual within 120 days; current brochure OR summary of material changes) against Cornell LII 2026-06-06. The Part 2A item enumeration is paraphrased from the Form ADV Part 2 instructions — counsel to confirm the canonical item list and consider separate literal entries for the most-violated items (Item 9 disciplinary; Item 11 code of ethics/personal trading; Item 12 brokerage/soft dollars — see companion `ria-soft-dollar-section-28e`). Renamed from the former `form-adv-disclosure-framework` routing entry to make Part 2 disclosure coverage explicit per the 2026-06-06 wave.",
};
