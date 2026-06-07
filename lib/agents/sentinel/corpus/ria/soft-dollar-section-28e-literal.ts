import type { ComplianceRule } from "../../types";

/**
 * Soft dollars — Section 28(e) safe harbor of the Securities Exchange Act
 * of 1934, plus the adviser's Form ADV brochure obligation to disclose
 * soft-dollar arrangements.
 *
 * Section 28(e) gives an adviser exercising investment discretion a safe
 * harbor when it pays more than the lowest available commission, IF the
 * adviser determined in good faith that the commission was reasonable in
 * relation to the value of the "brokerage and research services" received.
 * Using client commissions for products/services outside that definition,
 * or failing to disclose the arrangement and its conflicts in Form ADV
 * Part 2A (Item 12), falls outside the safe harbor.
 */
export const rule: ComplianceRule = {
  ruleId: "ria-soft-dollar-section-28e",
  title: "Soft dollars — Securities Exchange Act § 28(e) safe harbor + Form ADV disclosure",
  summary:
    "An adviser with investment discretion may pay a broker more than the lowest available commission only within the Section 28(e) safe harbor — i.e. on a good-faith determination that the commission is reasonable relative to the value of the 'brokerage and research services' the broker provides — and must disclose its soft-dollar arrangements and the resulting conflicts of interest in Form ADV Part 2A (Item 12). Using client commissions for items outside the § 28(e) definition, or omitting the disclosure, falls outside the safe harbor and implicates the adviser's § 206 fiduciary duty.",
  jurisdiction: "federal-statute",
  scope: { kind: "federal" },
  citation: {
    source: "15 USC § 78bb(e) (Section 28(e) of the Securities Exchange Act of 1934); Form ADV Part 2A Item 12 (brokerage practices / soft dollars)",
    url: "https://www.law.cornell.edu/uscode/text/15/78bb",
    accessedAt: "2026-06-06",
  },
  literalText: `15 USC § 78bb(e) — Effect on existing law (Section 28(e) safe harbor):

(1) No person using the mails, or any means or instrumentality of interstate commerce, in the exercise of investment discretion with respect to an account shall be deemed to have acted unlawfully or to have breached a fiduciary duty under State or Federal law unless expressly provided to the contrary by a law enacted by the Congress or any State subsequent to June 4, 1975, solely by reason of his having caused the account to pay a member of an exchange, broker, or dealer an amount of commission for effecting a securities transaction in excess of the amount of commission another member of an exchange, broker, or dealer would have charged for effecting that transaction, if such person determined in good faith that such amount of commission was reasonable in relation to the value of the brokerage and research services provided by such member, broker, or dealer, viewed in terms of either that particular transaction or his overall responsibilities with respect to the accounts as to which he exercises investment discretion.

(3) For purposes of this subsection a person provides brokerage and research services insofar as he—
(A) furnishes advice, either directly or through publications or writings, as to the value of securities, the advisability of investing in, purchasing, or selling securities, and the availability of securities or purchasers or sellers of securities;
(B) furnishes analyses and reports concerning issuers, industries, securities, economic factors and trends, portfolio strategy, and the performance of accounts; or
(C) effects securities transactions and performs functions incidental thereto (such as clearance, settlement, and custody) or required in connection therewith by rules of the Commission or a self-regulatory organization of which such person is a member or person associated with a member or in which such person is a participant.

Form ADV Part 2A, Item 12 (Brokerage Practices): The adviser must disclose its soft-dollar practices — the research and other products/services it receives in exchange for client brokerage, the conflicts of interest those arrangements create (an incentive to select a broker based on the adviser's interest in receiving research rather than the client's interest in best execution), and whether the benefits are used for all or only some client accounts.`,
  purpose: "counsel-reference",
  severity: "advisory",
  counselReviewStatus: "draft",
  category: "soft-dollar",
  safeRewrite:
    "Do not describe any product or service paid for with client commissions as 'free' or cost-free — it is paid with client brokerage and creates a best-execution conflict. If a draft references research, data, or services obtained through client commissions, confirm the item falls within the § 28(e) 'brokerage and research services' definition and that the arrangement and its conflicts are disclosed in the firm's Form ADV Part 2A, Item 12.",
  drafterNotes:
    "Verified the § 28(e)(1) safe-harbor text and the (e)(3)(A)-(C) brokerage-and-research-services definition against Cornell LII 2026-06-06. The Form ADV Part 2A Item 12 obligation is summarized from the Form ADV Part 2 instructions — counsel to confirm the canonical Item 12 wording. Counsel: consider whether 'mixed-use' allocations (a product serving both research and non-research functions) need a dedicated companion rule; the SEC's 2006 interpretive release (Rel. No. 34-54165) is the governing soft-dollar guidance and may warrant citation alongside § 28(e).",
};
