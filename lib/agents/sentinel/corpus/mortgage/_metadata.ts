import type { CorpusMetadata } from "../../types";

export const metadata: CorpusMetadata = {
  verticalSlug: "mortgage",
  lastReviewedAt: "2026-05-25",
  counselReviewer: null,
  status: "DRAFT",
  openQuestions: [
    "Confirm 12 USC § 2607(a) excerpt against the current eCFR rendering — anti-kickback wording is the load-bearing literal for sentinel matching.",
    "Verify TRID three-business-day closing disclosure rule against the 2024 CFPB amendments (12 CFR § 1026.19(f)(1)(ii)(A)).",
    "GA Residential Mortgage Act citations (O.C.G.A. Title 7, Chapter 1, Article 13) are marked unverified — counsel to confirm the canonical citation form and scope before sentinel uses them.",
    "NMLS / SAFE Act summary is a non-literal scope note; flagged unverified because exact statutory wording was not pulled in this draft pass.",
    "CANDIDATE TRIGGERS (2026-05-25 wave): `reg-z-advertising-candidates-literal.ts` ships 20 candidate advertising phrases drafted from § 1026.24(i) (prohibitions) and § 1026.24(d)(1) (triggering terms) plus MAP Rule (Reg N) § 1014.3 — e.g. 'government loan program', 'eliminate your mortgage', 'no down payment', 'guaranteed approval'. Sentinel does NOT fire on these — counsel to red-line phrase-by-phrase.",
    "CANDIDATE TRIGGERS — counsel decision: the candidate rule bundles two match classes (per-se prohibited under § 1026.24(i) and triggering-term-requires-additional-disclosure under § 1026.24(d)(1)). Counsel to advise whether to split into two rules so the operator-facing flag wording can differ ('remove' vs 'confirm required disclosures present').",
    "CANDIDATE TRIGGERS — held back for counsel: 'fixed rate' (only prohibited in variable-rate context — recommend counsel-reference); 'counselor' (only prohibited when used by for-profit broker — recommend counsel-reference); literal APR / payment dollar amounts (require structured parsing).",
  ],
};
