import type { ComplianceRule } from "../../types";

/**
 * Custody Rule — Rule 206(4)-2.
 *
 * Sentinel anchor for any draft that implies the adviser is taking
 * possession of client assets (other than for fee deduction under
 * specified safeguards).
 */
export const rule: ComplianceRule = {
  ruleId: "advisers-act-custody-rule-206-4-2",
  title: "Custody Rule — 17 CFR § 275.206(4)-2",
  summary:
    "An adviser with custody of client funds or securities is required to maintain those assets with a qualified custodian, provide clients with quarterly account statements from the qualified custodian, and undergo an annual surprise examination by an independent public accountant (subject to a pooled-investment-vehicle audit exception).",
  jurisdiction: "federal-regulation",
  scope: { kind: "federal" },
  citation: {
    source: "17 CFR § 275.206(4)-2 (Custody of funds or securities of clients)",
    url: "https://www.law.cornell.edu/cfr/text/17/275.206(4)-2",
    accessedAt: "2026-06-06",
  },
  literalText: `[UNVERIFIED — needs counsel] Substance of 17 CFR § 275.206(4)-2:

(a) Safekeeping required. If you are an investment adviser registered or required to be registered under section 203 of the Act (15 U.S.C. 80b-3), it is a fraudulent, deceptive, or manipulative act, practice, or course of business within the meaning of section 206(4) of the Act (15 U.S.C. 80b-6(4)) for you to have custody of client funds or securities unless:

(1) Qualified custodian. A qualified custodian maintains those funds and securities:
  (i) In a separate account for each client under that client's name; or
  (ii) In accounts that contain only your clients' funds and securities, under your name as agent or trustee for the clients.

(2) Notice to clients. If you open an account with a qualified custodian on your client's behalf, either under the client's name or under your name as agent, you notify the client in writing of the qualified custodian's name, address, and the manner in which the funds or securities are maintained, promptly when the account is opened and following any changes to this information.

(3) Account statements to clients. You have a reasonable basis, after due inquiry, for believing that the qualified custodian sends an account statement, at least quarterly, to each of your clients for which it maintains funds or securities, identifying the amount of funds and of each security in the account at the end of the period and setting forth all transactions in the account during that period.

(4) Independent verification. The client funds and securities of which you have custody are verified by actual examination at least once during each calendar year, except as provided below, by an independent public accountant, pursuant to a written agreement between you and the accountant, at a time that is chosen by the accountant without prior notice or announcement to you and that is irregular from year to year.`,
  purpose: "counsel-reference",
  severity: "advisory",
  counselReviewStatus: "draft",
  category: "custody",
  unverified: true,
  safeRewrite:
    "Do not imply the adviser holds, takes possession of, or directly controls client funds or securities (beyond authorized fee deduction). If a draft references custody, qualified custodians, or account statements, confirm the qualified-custodian, written-notice, quarterly-statement, and annual-surprise-exam safeguards are actually in place before the statement goes out.",
  drafterNotes:
    "literalText is paraphrased from the rule structure and could not be confirmed word-for-word against eCFR (eCFR 302-redirects automated fetch); kept `unverified: true` and the [UNVERIFIED] placeholder per the corpus convention. Counsel to pull the canonical 17 CFR § 275.206(4)-2(a)(1)-(6) text. SEC's proposed Safeguarding Rule (Release No. IA-6240, Feb 2023) would substantially expand the current Custody Rule — was not finalized as of 2026-06-06. Please advise on whether sentinel should track the proposal as a planned-amendment companion entry.",
};
