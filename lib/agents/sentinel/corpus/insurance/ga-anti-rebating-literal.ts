import type { ComplianceRule } from "../../types";

/**
 * Georgia anti-rebating statute — prohibits offering inducements beyond
 * what is specified in the policy.
 *
 * NOTE: anti-rebating is a near-universal state insurance prohibition; the
 * GA version sits in the Unfair Trade Practices statute. Exact subsection
 * numbering varies between published renderings — drafter flags this as
 * unverified, counsel to confirm.
 */
export const rule: ComplianceRule = {
  ruleId: "ga-anti-rebating",
  title: "Georgia anti-rebating — Unfair Insurance Trade Practices Act",
  summary:
    "Insurance producer may not offer any rebate of premium, special favor or advantage, or any valuable consideration not specified in the policy as an inducement to insure.",
  jurisdiction: "state-statute",
  scope: { kind: "state", state: "GA" },
  citation: {
    source: "O.C.G.A. § 33-6-4 (Unfair Trade Practices Act — rebating subsection)",
    url: "https://law.justia.com/codes/georgia/title-33/chapter-6/article-1/section-33-6-4/",
    accessedAt: "2026-05-12",
  },
  literalText: `[UNVERIFIED — needs counsel] Substance: under the Georgia Unfair Trade Practices Act (O.C.G.A. § 33-6-4), it is an unfair trade practice for an insurer, producer, or other licensee, knowingly, to permit or offer to make or make any insurance contract or agreement as to such contract other than as plainly expressed in the contract issued thereon, or to pay, allow, give, or offer to pay, allow, or give, directly or indirectly, as an inducement to such insurance contract, any rebate of premiums, any special favor or advantage in the dividends or other benefits, or any valuable consideration or inducement whatever not specified in the contract.`,
  purpose: "counsel-reference",
  severity: "blocking",
  counselReviewStatus: "draft",
  unverified: true,
  safeRewrite:
    "Strike any offer of value not specified in the policy as an inducement to buy — premium rebates, gift cards, 'cash back,' or special favors. Permissible value-added services are narrow and state-capped (NAIC Model #880 was amended 2020); describe only services that fall under Georgia's allowance and never frame them as a reward for purchasing.",
  drafterNotes:
    "Counsel: please confirm whether the operative subsection is (b)(7) or (b)(8) of O.C.G.A. § 33-6-4 (rendering differs across published copies) and replace placeholder with the canonical statutory text.",
};
