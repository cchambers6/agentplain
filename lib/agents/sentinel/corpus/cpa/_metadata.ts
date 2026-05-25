import type { CorpusMetadata } from "../../types";

export const metadata: CorpusMetadata = {
  verticalSlug: "cpa",
  lastReviewedAt: "2026-05-25",
  counselReviewer: null,
  status: "DRAFT",
  openQuestions: [
    "Circular 230 conflict-of-interest (§ 10.29), contingent-fee (§ 10.27), and diligence (§ 10.22) excerpts — counsel to verify against current Treasury rendering.",
    "AICPA Code of Professional Conduct excerpts (1.700.001 Confidential Client Information; 1.300.060 Due Professional Care) reference the 2014-restructured numbering — counsel to confirm currency.",
    "IRC § 7216 (criminal prohibition on disclosure of tax return information) drafted at scope level — counsel: confirm whether sentinel needs the literal § 7216 statutory text or only the FTC-style routing summary.",
    "GA State Board of Accountancy citations (O.C.G.A. § 43-3) flagged unverified.",
    "CANDIDATE TRIGGERS (2026-05-25 wave): `circular-230-solicitation-candidates-literal.ts` ships 10 candidate advertising phrases drafted from § 10.30(a)(1) (e.g. 'guaranteed refund', 'irs approved', 'special access to the irs'). Sentinel does NOT fire on these — counsel to red-line phrase-by-phrase before flipping `unverified: false`. Held-back borderline phrases ('tax expert', 'tax specialist', 'former IRS') listed in the rule's drafterNotes.",
    "CANDIDATE TRIGGERS — counsel decision: should the rule be split into (a) § 10.30(a)(1) Treasury triggers and (b) AICPA Code 1.400 'false, misleading, or deceptive' triggers, or kept as one rule citing both authorities?",
  ],
};
