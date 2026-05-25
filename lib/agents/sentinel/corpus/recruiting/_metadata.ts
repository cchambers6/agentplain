import type { CorpusMetadata } from "../../types";

export const metadata: CorpusMetadata = {
  verticalSlug: "recruiting",
  lastReviewedAt: "2026-05-25",
  counselReviewer: null,
  status: "DRAFT",
  openQuestions: [
    "Title VII / ADA / ADEA quoted directly from US Code — counsel to confirm current wording against latest amendments (PWFA 2023 may interact with Title VII coverage).",
    "FCRA § 1681b(b)(2)(A) wording is load-bearing for background-check workflows — please verify literal.",
    "FLSA exemption categories (executive, administrative, professional, outside sales, computer) are summarized via the test in 29 USC § 213(a)(1); the operative duties tests sit in 29 CFR Part 541. Counsel: confirm whether sentinel needs Part 541 duties-test text in addition.",
    "Georgia right-to-work statute (O.C.G.A. § 34-6-21) drafted from substance recollection; counsel verifies wording.",
    "CANDIDATE TRIGGERS (2026-05-25 wave): `eeoc-job-posting-candidates-literal.ts` ships 27 candidate job-ad phrases drafted from ADEA § 4(e), Title VII § 704(b), and ADA § 102 — age proxies ('young', 'recent grad', 'digital native'), gender-coded titles ('salesman', 'waitress'), national-origin restrictions ('native english speaker', 'u.s. citizens only'), and disability proxies ('able-bodied'). Sentinel does NOT fire on these — counsel to red-line phrase-by-phrase.",
    "CANDIDATE TRIGGERS — counsel decision: 'must be a U.S. citizen' has a narrow IRCA exception for federal contracts / classified positions. Counsel to advise whether the rule should be scoped or whether the literal-match is acceptable with operator-review routing.",
    "CANDIDATE TRIGGERS — held back for counsel: 'Christian environment' (religious-employer exception under Title VII § 702(a)); 'no felons' (state-level ban-the-box variation). Both recommended as counsel-reference rather than literal-match.",
  ],
};
