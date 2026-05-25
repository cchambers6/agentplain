import type { CorpusMetadata } from "../../types";

export const metadata: CorpusMetadata = {
  verticalSlug: "ria",
  lastReviewedAt: "2026-05-25",
  counselReviewer: null,
  status: "DRAFT",
  openQuestions: [
    "Investment Advisers Act Section 206 quoted directly from 15 USC § 80b-6 — counsel to verify literal against current US Code.",
    "Marketing Rule (17 CFR § 275.206(4)-1) replaced the old Advertising Rule on 2022-11-04 — drafted excerpt reflects the Marketing Rule; counsel to confirm no further amendments.",
    "Code of Ethics rule (17 CFR § 275.204A-1) summarized via the required content elements; counsel verifies literal.",
    "Custody Rule (17 CFR § 275.206(4)-2) summarized; SEC's 2023 Safeguarding Rule proposal had not been finalized as of 2026-05-12 drafting — counsel to confirm rule status.",
    "Form ADV reference is scope-only; ADV is a form, not a literal rule. Counsel to advise whether sentinel needs Item-by-Item literals for Form ADV disclosure obligations.",
    "State RIA registration threshold ($100M / $110M switch) reflects the standard cited in Dodd-Frank; counsel to verify.",
    "CANDIDATE TRIGGERS (2026-05-25 wave): `marketing-rule-candidates-literal.ts` ships 21 candidate advertising phrases drafted from Marketing Rule § 206(4)-1(a)(1), FINRA 2210(d)(1)(B), and Advisers Act § 208(a) — e.g. 'guaranteed return', 'risk-free investment', 'sec approved', 'fdic insured'. Sentinel does NOT fire on these — counsel to red-line phrase-by-phrase before flipping `unverified: false`.",
    "CANDIDATE TRIGGERS — counsel decision: 'fdic insured' has legitimate uses (sweep deposits at affiliated bank); counsel to advise whether a context modifier is needed to avoid false-positives or whether the literal-match is acceptable as-is given exam-finding risk.",
  ],
};
