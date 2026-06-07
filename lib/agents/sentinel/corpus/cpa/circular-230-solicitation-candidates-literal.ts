import type { ComplianceRule } from "../../types";

/**
 * Circular 230 § 10.30 — solicitation / advertising candidate triggers.
 *
 * DRAFT, UNVERIFIED. Sentinel WILL NOT fire on these — the scanner skips
 * `unverified: true` rules. This file exists so the counsel-handoff packet
 * surfaces a concrete trigger list counsel can red-line phrase-by-phrase
 * before the rule flips to verified literal-match.
 *
 * § 10.30(a)(1) prohibits any public communication or private solicitation
 * "containing a false, fraudulent, or coercive statement or claim; or a
 * misleading or deceptive statement or claim" — including statements that
 * have "the effect of intimating that the practitioner is able to obtain
 * special consideration or action from the Internal Revenue Service or
 * any officer or employee thereof."
 *
 * Every phrase below is nominated as a literal trigger because it, on its
 * face, intimates the prohibited special-IRS-consideration or guarantees a
 * tax outcome. Counsel: accept / reword / demote to counsel-reference.
 */
export const rule: ComplianceRule = {
  ruleId: "circular-230-solicitation-candidates",
  title: "Circular 230 § 10.30 — candidate advertising/solicitation triggers (DRAFT)",
  summary:
    "Candidate literal phrases that on their face intimate special IRS consideration or guarantee a tax outcome — drafted from § 10.30(a)(1) for counsel review. Sentinel does NOT fire on these until counsel red-lines and unsets the unverified flag.",
  jurisdiction: "federal-regulation",
  scope: { kind: "federal" },
  citation: {
    source: "31 CFR § 10.30(a)(1)",
    url: "https://www.law.cornell.edu/cfr/text/31/10.30",
    accessedAt: "2026-06-06",
  },
  literalText:
    "[DRAFT — needs counsel] § 10.30(a)(1): A practitioner may not, with respect to any Internal Revenue Service matter, in any way use or participate in the use of any form of public communication or private solicitation containing a false, fraudulent, or coercive statement or claim; or a misleading or deceptive statement or claim. Enumerated examples include statements pertaining to the practitioner's qualifications or quality of services, or that have the effect of intimating that the practitioner is able to obtain special consideration or action from the Internal Revenue Service or any officer or employee thereof.\n\nCandidate trigger phrases below are drafted from this prohibition but have NOT been counsel-verified.",
  purpose: "literal-match",
  severity: "blocking",
  counselReviewStatus: "draft",
  unverified: true,
  category: "advertising",
  triggers: [
    "guaranteed refund",
    "guaranteed irs approval",
    "guaranteed audit protection",
    "irs approved",
    "irs endorsed",
    "official irs approved",
    "special access to the irs",
    "inside connections at the irs",
    "we can get you out of any audit",
    "audit-proof",
  ],
  triggerRegexes: [
    {
      pattern: "guaranteed[^.!?\\n]{0,30}\\b(refund|approval|outcome|result)\\b",
      flags: "i",
      description:
        "Catches 'guaranteed … refund/approval/outcome' variants the literal list misses (intervening words), e.g. 'guaranteed maximum refund' or 'guaranteed IRS approval of your claim' — a § 10.30(a)(1) outcome-guarantee / misleading claim.",
      example: "We promise you a guaranteed maximum refund every year.",
      counterExample: "We work hard to maximize your refund every year.",
    },
    {
      pattern: "special[^.!?\\n]{0,30}\\b(access|connection|connections)\\b[^.!?\\n]{0,20}\\birs\\b",
      flags: "i",
      description:
        "Catches claims of 'special … (access|connection) … IRS' that intimate the practitioner can obtain special consideration from the Service — a per-se § 10.30(a)(1) prohibition — e.g. 'special insider connection at the IRS'.",
      example: "Our firm has special insider connections inside the IRS.",
      counterExample: "Our firm has special expertise in multi-state filings.",
    },
  ],
  safeRewrite:
    "Strike any claim that guarantees a tax outcome (refund, approval, audit result) or intimates special access to or influence over the IRS — both are per-se prohibited solicitation content under § 10.30(a)(1). Do not state or imply IRS approval/endorsement of the practitioner. Replace with substantiable, non-absolute language describing the service ('we prepare and review your return for accuracy') rather than promising a result.",
  drafterNotes:
    "Drafted 2026-05-25 from § 10.30(a)(1)'s prohibition on (a) misleading claims about qualifications and (b) intimating special IRS consideration. Phrases like 'guaranteed refund' double as classic AICPA Code 1.400 'false, misleading, or deceptive' targets — counsel should consider whether to anchor the rule to BOTH § 10.30 and AICPA 1.400 or split into two rules. Borderline omissions: 'tax expert', 'tax specialist', 'former IRS' (all context-dependent — recommend counsel-reference).",
};
