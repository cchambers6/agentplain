import type { ComplianceRule } from "../../types";

/**
 * IRC § 7216 — criminal prohibition on disclosure or use of tax return
 * information by return preparers.
 *
 * The hardest-edged confidentiality rule in the CPA vertical: a knowing or
 * reckless disclosure or use of taxpayer return information for any purpose
 * other than preparing the return is a MISDEMEANOR. This is the statutory
 * floor under the AICPA Confidential Client Information Rule. Counsel-
 * reference — whether a disclosure falls inside a § 7216(b) / 26 CFR
 * § 301.7216-2/-3 exception or consent is judgment, so sentinel surfaces the
 * duty rather than auto-matching draft text.
 */
export const rule: ComplianceRule = {
  ruleId: "irc-7216-disclosure",
  title: "IRC § 7216 — criminal prohibition on disclosure/use of taxpayer information",
  summary:
    "It is a federal misdemeanor for a tax return preparer to knowingly or recklessly disclose, or use for any purpose other than preparing the return, information furnished in connection with preparing a return — punishable by up to a $1,000 fine and 1 year imprisonment — subject to narrow exceptions and to the taxpayer-consent regime in the § 301.7216 regulations.",
  jurisdiction: "federal-statute",
  scope: { kind: "federal" },
  citation: {
    source: "26 USC § 7216; implementing regulations 26 CFR §§ 301.7216-1 through 301.7216-3",
    url: "https://www.law.cornell.edu/uscode/text/26/7216",
    accessedAt: "2026-06-06",
  },
  literalText: `26 USC § 7216 — Disclosure or use of information by preparers of returns.

(a) General rule. Any person who is engaged in the business of preparing, or providing services in connection with the preparation of, returns of the tax imposed by chapter 1, or any person who for compensation prepares any such return for any other person, and who knowingly or recklessly—
(1) discloses any information furnished to him for, or in connection with, the preparation of any such return, or
(2) uses any such information for any purpose other than to prepare, or assist in preparing, any such return,
shall be guilty of a misdemeanor, and, upon conviction thereof, shall be fined not more than $1,000 ($100,000 in the case of a disclosure or use to which section 6713(b) applies), or imprisoned not more than 1 year, or both, together with the costs of prosecution.

(b) Exceptions.
(1) Disclosure. Subsection (a) shall not apply to a disclosure of information if such disclosure is made—(A) pursuant to any other provision of this title, or (B) pursuant to an order of a court.
(2) Use. Subsection (a) shall not apply to the use of information in the preparation of, or in connection with the preparation of, State and local tax returns and declarations of estimated tax of the person to whom the information relates.
(3) Regulations. Subsection (a) shall not apply to a disclosure or use of information which is permitted by regulations prescribed by the Secretary under this section. Such regulations shall permit (subject to such conditions as such regulations shall provide) the disclosure or use of information for quality or peer reviews.`,
  purpose: "counsel-reference",
  severity: "blocking",
  counselReviewStatus: "draft",
  safeRewrite:
    "Never include or propose to share taxpayer return information — figures, identity, the fact of a filing, anything furnished for the return — outside preparing that return, unless the taxpayer's § 301.7216-3 written consent (or a § 7216(b) / § 301.7216-2 exception) is in hand. Strike any draft that would route return data to a marketing list, a lender, a financial-product cross-sell, a testimonial, or an affiliate. Disclosure or use without consent is a criminal violation, not just an ethics breach.",
  drafterNotes:
    "Verified 2026-06-06: § 7216(a)(1)-(2) and (b)(1)-(3) pulled verbatim from Cornell LII (26 USC § 7216). The implementing 26 CFR § 301.7216-1/-2/-3 regulations (which carry the consent-form mechanics and the § 6713 civil-penalty overlay) are cited but could not be machine-pulled this wave (eCFR blocks automated fetch). Counsel-reference: whether a disclosure is consented/excepted is fact-specific judgment; sentinel surfaces the prohibition rather than literal-matching. Pairs with `aicpa-confidential-client-information` (the professional-standard layer).",
};
