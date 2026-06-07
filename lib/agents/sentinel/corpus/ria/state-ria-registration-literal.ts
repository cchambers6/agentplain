import type { ComplianceRule } from "../../types";

/**
 * State vs. SEC RIA registration — AUM threshold.
 *
 * Dodd-Frank Wall Street Reform Act allocated regulatory jurisdiction
 * between the SEC and state securities regulators. Below $100 million
 * AUM ($110 million switch-up trigger), advisers register at the state
 * level; SEC registration is generally required at $100M+.
 */
export const rule: ComplianceRule = {
  ruleId: "ria-state-vs-sec-registration",
  title: "RIA state vs. SEC registration — AUM thresholds",
  summary:
    "Dodd-Frank Act amendments to the Investment Advisers Act allocated jurisdiction: 'mid-sized advisers' (between $25M and $100M AUM) are generally state-registered; advisers above $100M ($110M to trigger an upward switch) are generally SEC-registered, subject to multistate, internet-adviser, and other federal exemptions.",
  jurisdiction: "federal-statute",
  scope: { kind: "federal" },
  citation: {
    source: "15 USC § 80b-3a (Section 203A — state and federal responsibilities); 17 CFR § 275.203A-1 (mid-sized adviser threshold)",
    url: "https://www.law.cornell.edu/uscode/text/15/80b-3a",
    accessedAt: "2026-06-06",
  },
  literalText: `[UNVERIFIED — needs counsel] Substance of 15 USC § 80b-3a (Section 203A) as amended by Dodd-Frank:

(a) Advisers subject to state authorities.
(1) In general. No investment adviser that is regulated or required to be regulated as an investment adviser in the State in which it maintains its principal office and place of business shall register under section 203, unless the investment adviser—
  (A) has assets under management of not less than—
    (i) $25,000,000, or such higher amount as the Commission may, by rule, deem appropriate in accordance with the purposes of this title; or
    (ii) $100,000,000, in the case of an investment adviser described in subsection (a)(2); or
  (B) is an adviser to an investment company registered under the Investment Company Act of 1940.

(2) Treatment of mid-sized investment advisers.
No investment adviser described in subparagraph (A) shall register under section 203, unless the investment adviser—
  (A) is required to be registered as an investment adviser with the securities commissioner (or any agency or officer performing like functions) of 15 or more States; or
  (B) is exempt from registration with the securities commissioner of the State in which it maintains its principal office and place of business.

Implementing rule (17 CFR § 275.203A-1) provides a $100M/$110M buffer that requires advisers crossing the threshold to switch to SEC registration only after their AUM has exceeded $110M on the most recent annual updating amendment.`,
  purpose: "counsel-reference",
  severity: "info",
  counselReviewStatus: "draft",
  category: "registration",
  unverified: true,
  safeRewrite:
    "Routing/scope rule — no client-facing draft text to rewrite. Use it to confirm a draft does not misstate the adviser's registration status (e.g. calling a state-registered adviser 'SEC-registered' or implying SEC registration confers approval — see `ria-marketing-candidates` and § 208(a)).",
  drafterNotes:
    "Counsel: please verify the $100M / $110M buffer and the 15-state multistate exception in 15 USC § 80b-3a(a)(2)(A). The internet-adviser exemption (17 CFR § 275.203A-2(e)) is a common SEC-registration path; counsel: should sentinel include a companion literal?",
};
