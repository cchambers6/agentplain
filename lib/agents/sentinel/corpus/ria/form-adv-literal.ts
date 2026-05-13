import type { ComplianceRule } from "../../types";

/**
 * Form ADV — adviser registration and disclosure requirements.
 *
 * Form ADV is itself a form, not a rule — the obligation to file and
 * deliver it comes from Rule 203-1 (registration), Rule 204-3 (brochure
 * delivery), and Rule 204-1 (annual updating amendment). This entry
 * routes drafts that touch ADV content to the right rule.
 */
export const rule: ComplianceRule = {
  ruleId: "form-adv-disclosure-framework",
  title: "Form ADV — registration, brochure delivery, annual updates",
  summary:
    "An investment adviser must file Form ADV Part 1 (and Part 1B for state-registered advisers) to register; deliver Form ADV Part 2A ('brochure') and Part 2B ('brochure supplement') to each client and prospective client, with annual updates; and amend Form ADV at least annually and promptly on material changes.",
  jurisdiction: "federal-regulation",
  scope: { kind: "federal" },
  citation: {
    source: "17 CFR § 275.203-1 (registration); 17 CFR § 275.204-1 (annual updates); 17 CFR § 275.204-3 (delivery of brochure)",
    url: "https://www.sec.gov/about/forms/formadv.pdf",
    accessedAt: "2026-05-12",
  },
  literalText: `[ROUTING / SUMMARY — needs counsel for literal] Substance:

Rule 203-1 (17 CFR § 275.203-1): A person required to be registered with the Commission as an investment adviser under section 203 of the Investment Advisers Act of 1940 must apply for registration on Form ADV (17 CFR § 279.1).

Rule 204-1 (17 CFR § 275.204-1): Each registered investment adviser must amend its Form ADV at least annually, within 90 days of the end of its fiscal year, by filing an annual updating amendment; and more frequently as required if information becomes materially inaccurate.

Rule 204-3 (17 CFR § 275.204-3 — the "brochure rule"): A registered investment adviser must deliver to each client and prospective client a written disclosure statement (Form ADV Part 2A and applicable Part 2B brochure supplements) before or at the time of entering into an investment advisory contract; thereafter, the adviser must deliver an updated brochure or summary of material changes at least annually, free of charge.

Form ADV Part 2A specifically requires disclosure of (among other items) advisory business, fees and compensation, types of clients, methods of analysis, disciplinary information, other financial industry activities and affiliations, code of ethics / personal trading, brokerage practices, review of accounts, client referrals and other compensation, custody, investment discretion, voting client securities, and financial information.`,
  drafterNotes:
    "Counsel: this routing entry covers the framework. For sentinel pattern matching, recommend separate literal entries for the most-violated ADV items — particularly Item 9 (disciplinary information), Item 11 (Code of Ethics / participation in client transactions / personal trading), and Item 12 (brokerage practices / soft dollars).",
};
