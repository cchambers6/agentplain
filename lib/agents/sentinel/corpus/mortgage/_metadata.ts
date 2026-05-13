import type { CorpusMetadata } from "../../types";

export const metadata: CorpusMetadata = {
  verticalSlug: "mortgage",
  lastReviewedAt: "2026-05-12",
  counselReviewer: null,
  status: "DRAFT",
  openQuestions: [
    "Confirm 12 USC § 2607(a) excerpt against the current eCFR rendering — anti-kickback wording is the load-bearing literal for sentinel matching.",
    "Verify TRID three-business-day closing disclosure rule against the 2024 CFPB amendments (12 CFR § 1026.19(f)(1)(ii)(A)).",
    "GA Residential Mortgage Act citations (O.C.G.A. Title 7, Chapter 1, Article 13) are marked unverified — counsel to confirm the canonical citation form and scope before sentinel uses them.",
    "NMLS / SAFE Act summary is a non-literal scope note; flagged unverified because exact statutory wording was not pulled in this draft pass.",
  ],
};
