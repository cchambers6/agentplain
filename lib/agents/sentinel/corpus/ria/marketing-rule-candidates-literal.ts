import type { ComplianceRule } from "../../types";

/**
 * SEC Marketing Rule (Advisers Act Rule 206(4)-1) + FINRA Rule 2210 —
 * advertising candidate triggers.
 *
 * DRAFT, UNVERIFIED. Sentinel WILL NOT fire on these — the scanner skips
 * `unverified: true` rules. Candidate list for counsel red-line.
 *
 * Marketing Rule § 206(4)-1(a) prohibits an investment adviser from
 * disseminating any "advertisement" that includes (among other things)
 * an "untrue statement of a material fact" or "a material statement of
 * fact that the adviser does not have a reasonable basis for believing
 * it will be able to substantiate."
 *
 * FINRA Rule 2210(d)(1)(B) requires that communications "may not predict
 * or project performance, imply that past performance will recur or make
 * any exaggerated or unwarranted claim, opinion or forecast" and prohibits
 * "false, exaggerated, unwarranted, promissory or misleading" statements.
 *
 * Investment Advisers Act § 208(a) (15 USC § 80b-8(a)) separately
 * prohibits any representation or implication that an adviser has been
 * "sponsored, recommended, or approved" by the SEC.
 */
export const rule: ComplianceRule = {
  ruleId: "ria-marketing-candidates",
  title: "SEC Marketing Rule + FINRA 2210 — candidate advertising triggers (DRAFT)",
  summary:
    "Candidate literal phrases drafted from Rule 206(4)-1's untrue-material-fact prohibition, FINRA 2210's promissory-language ban, and Advisers Act § 208(a)'s prohibition on representing SEC endorsement. Sentinel does NOT fire on these until counsel red-lines.",
  jurisdiction: "federal-regulation",
  scope: { kind: "federal" },
  citation: {
    source: "17 CFR § 275.206(4)-1 (Marketing Rule); FINRA Rule 2210(d)(1)(B); 15 USC § 80b-8(a) (Advisers Act § 208(a))",
    url: "https://www.law.cornell.edu/cfr/text/17/275.206(4)-1",
    accessedAt: "2026-06-06",
  },
  literalText:
    "[DRAFT — needs counsel] Rule 206(4)-1(a)(1): An investment adviser may not disseminate any advertisement that includes any untrue statement of a material fact, or that omits to state a material fact necessary in order to make the statement made, in the light of the circumstances under which it was made, not misleading.\n\nFINRA Rule 2210(d)(1)(B): Communications may not predict or project performance, imply that past performance will recur or make any exaggerated or unwarranted claim, opinion or forecast.\n\nAdvisers Act § 208(a) (15 USC § 80b-8(a)): It shall be unlawful for any person registered under section 203 of this title to represent or imply in any manner whatsoever that such person has been sponsored, recommended, or approved, or that his abilities or qualifications have in any respect been passed upon by the United States or any agency or any officer thereof.\n\nCandidate trigger phrases below are nominated from these prohibitions but have NOT been counsel-verified.",
  purpose: "literal-match",
  severity: "blocking",
  counselReviewStatus: "draft",
  unverified: true,
  category: "advertising",
  triggers: [
    "guaranteed return",
    "guaranteed returns",
    "guaranteed profit",
    "guaranteed profits",
    "risk-free investment",
    "risk free investment",
    "no risk",
    "zero risk",
    "no-risk",
    "can't lose",
    "cannot lose",
    "beat the market",
    "outperform the market",
    "double your money",
    "sec approved",
    "approved by the sec",
    "sec endorsed",
    "endorsed by the sec",
    "sec sponsored",
    "fdic insured",
    "fdic-insured",
  ],
  triggerRegexes: [
    {
      pattern: "guaranteed[^.!?\\n]{0,40}returns?\\b",
      flags: "i",
      description:
        "Catches 'guaranteed … return(s)' performance promises the flat literal list misses when a figure or qualifier sits between the words, e.g. 'guaranteed 8% annual returns' — a FINRA 2210 promissory / Marketing Rule § 206(4)-1(a)(1) unsubstantiated-material-fact target.",
      example: "We offer a guaranteed 8% annual return on this strategy.",
      counterExample: "Your guaranteed delivery window is two business days.",
    },
    {
      pattern: "risk[- ]free\\b[^.!?\\n]{0,30}\\b(investment|return|returns|portfolio|strategy|account)",
      flags: "i",
      description:
        "Catches 'risk-free' applied to an investment claim (e.g. 'risk-free investment opportunity', 'risk free portfolio') without false-positiving on unrelated 'risk-free trial' marketing.",
      example: "Get into this risk-free investment today.",
      counterExample: "Start your risk-free trial of our newsletter.",
    },
  ],
  safeRewrite:
    "Strike absolute performance and safety claims. Never promise guaranteed/risk-free/can't-lose returns or 'beat the market' — replace with substantiated, fair-and-balanced language that discloses material risks. Never represent or imply SEC approval/endorsement/sponsorship (registration is not endorsement — Advisers Act § 208(a)). Use 'FDIC insured' only for genuine deposit products and make the non-deposit, may-lose-value nature of advisory products explicit.",
  drafterNotes:
    "Drafted 2026-05-25. Guarantee/risk-free/can't-lose phrases are FINRA 2210 'promissory' core targets and the SEC has issued enforcement actions citing each in advisory advertising. 'SEC approved/endorsed/sponsored' phrases are direct § 208(a) targets — registration with SEC is NOT endorsement and that representation is a per-se violation. 'FDIC insured' is included because misuse on non-deposit investment products (e.g. money-market funds, sweep accounts) is a recurring exam finding; counsel should consider whether the phrase needs a context modifier so it doesn't false-positive on legitimate references to sweep-deposit FDIC coverage at affiliated banks.",
};
