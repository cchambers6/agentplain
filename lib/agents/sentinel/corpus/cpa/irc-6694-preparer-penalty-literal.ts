import type { ComplianceRule } from "../../types";

/**
 * IRC § 6694 — tax return preparer penalty for understatement of liability.
 *
 * The core federal civil-penalty exposure for the preparation work the CPA
 * vertical's drafts describe: taking a return position that lacks substantial
 * authority (or, worse, willful/reckless conduct) exposes the preparer to a
 * per-return penalty. Counsel-reference — whether a position is "unreasonable"
 * is judgment, so sentinel surfaces the duty rather than auto-matching it.
 */
export const rule: ComplianceRule = {
  ruleId: "irc-6694-preparer-penalty",
  title: "IRC § 6694 — tax return preparer penalty (understatement of liability)",
  summary:
    "A tax return preparer is liable for a per-return penalty when an understatement of the taxpayer's liability is due to an unreasonable position the preparer knew or should have known of (§ 6694(a): greater of $1,000 or 50% of income derived), and a larger penalty for willful or reckless conduct (§ 6694(b): greater of $5,000 or 75% of income derived).",
  jurisdiction: "federal-statute",
  scope: { kind: "federal" },
  citation: {
    source: "26 USC § 6694(a)–(b)",
    url: "https://www.law.cornell.edu/uscode/text/26/6694",
    accessedAt: "2026-06-06",
  },
  literalText: `26 USC § 6694 — Understatement of taxpayer's liability by tax return preparer.

(a) Understatement due to unreasonable positions.
(1) In general. If a tax return preparer prepares any return or claim of refund with respect to which any part of an understatement of liability is due to a position described in paragraph (2), and knew (or reasonably should have known) of the position, such tax return preparer shall pay a penalty with respect to each such return or claim in an amount equal to the greater of $1,000 or 50 percent of the income derived (or to be derived) by the tax return preparer with respect to the return or claim.

(2) Unreasonable position.
(A) In general. Except as otherwise provided in this paragraph, a position is described in this paragraph unless there is or was substantial authority for the position.
(B) Disclosed positions. If the position was disclosed as provided in section 6662(d)(2)(B)(ii)(I) and is not a position to which subparagraph (C) applies, the position is described in this paragraph unless there is a reasonable basis for the tax treatment of the position.
(C) Tax shelters and reportable transactions. If the position is with respect to a tax shelter (as defined in section 6662(d)(2)(C)(ii)) or a reportable transaction to which section 6662A applies, the position is described in this paragraph unless it is reasonable to believe that the position would more likely than not be sustained on its merits.

(b) Understatement due to willful or reckless conduct.
(1) In general. Any tax return preparer who prepares any return or claim for refund with respect to which any part of an understatement of liability is due to a conduct described in paragraph (2) shall pay a penalty with respect to each such return or claim in an amount equal to the greater of—(A) $5,000, or (B) 75 percent of the income derived (or to be derived) by the tax return preparer with respect to the return or claim.

(2) Willful or reckless conduct. Conduct described in this paragraph is conduct by the tax return preparer which is—(A) a willful attempt in any manner to understate the liability for tax on the return or claim, or (B) a reckless or intentional disregard of rules or regulations.`,
  purpose: "counsel-reference",
  severity: "advisory",
  counselReviewStatus: "draft",
  safeRewrite:
    "When a draft proposes taking a return position to reduce a client's liability, do not promise a result or characterize an aggressive position as safe. Confirm the position has at least substantial authority (or a reasonable basis with adequate § 6662 disclosure) before the engagement proceeds, and never adopt a position that disregards a rule or regulation. Frame aggressive positions as requiring disclosure and client sign-off, not as a guaranteed saving.",
  drafterNotes:
    "Verified 2026-06-06: § 6694(a)(1), (a)(2)(A)-(C), (b)(1), and (b)(2) pulled from Cornell LII (26 USC § 6694) and the dollar/percentage thresholds cross-checked against the govinfo USCODE rendering. Counsel-reference: whether a position is 'unreasonable' / lacks 'substantial authority' is a judgment the scanner cannot make; this rule arms the counsel-handoff packet and the LLM-classifier path, not literal matching.",
};
