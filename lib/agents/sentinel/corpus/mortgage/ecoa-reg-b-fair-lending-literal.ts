import type { ComplianceRule } from "../../types";

/**
 * Equal Credit Opportunity Act (ECOA) / Regulation B § 1002.4 — fair-lending
 * general rule + the § 1002.4(b) DISCOURAGEMENT prohibition that reaches
 * advertising and informal statements.
 *
 * The § 1002.4 text below is quoted from the eCFR/Cornell rendering read
 * 2026-06-03 (so `unverified: false` on the reference text). The rule runs
 * as `counsel-reference`: whether a given draft "discourages on a
 * prohibited basis" requires generative judgment, so sentinel does NOT
 * auto-flag it. The candidate trigger phrases are nominated steering-style
 * advertising terms and are gated `unverified` for the counsel red-line.
 */
export const rule: ComplianceRule = {
  ruleId: "ecoa-reg-b-fair-lending",
  title: "ECOA / Regulation B § 1002.4 — fair lending + discouragement",
  summary:
    "A creditor shall not discriminate against an applicant on a prohibited basis in any aspect of a credit transaction, and shall not make any oral or written statement (in advertising or otherwise) that would discourage a reasonable person, on a prohibited basis, from making or pursuing an application.",
  jurisdiction: "federal-regulation",
  scope: { kind: "federal" },
  citation: {
    source: "15 USC § 1691 et seq. (ECOA); 12 CFR § 1002.4 (Regulation B, General rules)",
    url: "https://www.law.cornell.edu/cfr/text/12/1002.4",
    accessedAt: "2026-06-03",
  },
  literalText: `12 CFR § 1002.4 — General rules.

(a) Discrimination. A creditor shall not discriminate against an applicant on a prohibited basis regarding any aspect of a credit transaction.

(b) Discouragement. A creditor shall not make any oral or written statement, in advertising or otherwise, to applicants or prospective applicants that would discourage on a prohibited basis a reasonable person from making or pursuing an application.

(c) Written applications. A creditor shall take written applications for the dwelling-related types of credit covered by § 1002.13(a).

[Prohibited basis under § 1002.2(z): race, color, religion, national origin, sex, marital status, age (provided the applicant has capacity to contract); the applicant's receipt of income from a public assistance program; or the applicant's good-faith exercise of any right under the Consumer Credit Protection Act.]`,
  purpose: "counsel-reference",
  severity: "blocking",
  counselReviewStatus: "draft",
  category: "fair-lending",
  triggerRegexes: [
    {
      pattern: "(perfect|ideal|great|best)\\s+(for|fit for)\\s+(young|christian|single|married|family|families|retired|mature)",
      flags: "i",
      description:
        "Candidate: catches lending-ad phrasing that steers toward/away from a prohibited basis (age, religion, marital/familial status). § 1002.4(b) discouragement is context-sensitive — counsel decides whether any literal match is safe.",
      example: "This loan is perfect for young married couples.",
      counterExample: "This loan is a great fit for your budget.",
    },
  ],
  safeRewrite:
    "Describe the loan PRODUCT and its objective qualification criteria, never the applicant's protected characteristics. Remove references to age, race, religion, national origin, sex, marital/familial status, or receipt of public assistance. Replace 'ideal for young families' with 'available to qualified applicants' and state the actual underwriting criteria.",
  unverified: false,
  drafterNotes:
    "§ 1002.4 reference text pulled from eCFR/Cornell 2026-06-03 (authentic). Rule is counsel-reference: discouragement is fact-specific. The single candidate regex is a nominee only — counsel to decide whether ANY steering phrase is safe to fire on literally, or whether the whole fair-lending surface stays in the LLM-classifier path. Companion: add the § 1002.9 adverse-action notice timing (30 days) as a separate rule next pass. ECOA pairs with HMDA (`hmda-reg-c-literal.ts`) on the fair-lending side.",
};
