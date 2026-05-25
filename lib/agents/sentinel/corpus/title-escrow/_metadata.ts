import type { CorpusMetadata } from "../../types";

export const metadata: CorpusMetadata = {
  verticalSlug: "title-escrow",
  lastReviewedAt: "2026-05-25",
  counselReviewer: null,
  status: "DRAFT",
  openQuestions: [
    "Confirm RESPA Section 9 (seller designation of title company) wording — 12 USC § 2608.",
    "GA title insurance regulator citations (O.C.G.A. § 33-7-8 and Title 33 generally) flagged unverified.",
    "ALTA Best Practices Pillar #2 (escrow trust accounting) referenced from ALTA's published framework — please confirm the current version (drafter referenced what is believed to be the active framework as of accessed date).",
    "Per-state expansion deferred: GA-only initial scope.",
    "CANDIDATE TRIGGERS (2026-05-25 wave): `respa-section-8-candidates-literal.ts` ships 14 candidate referral-arrangement phrases drafted from RESPA § 8(a)/(b) and 12 CFR § 1024.14/.15 — e.g. 'referral fee', 'kickback', 'thing of value', 'marketing services agreement', 'co-marketing agreement', 'desk rental'. Sentinel does NOT fire on these — counsel to red-line phrase-by-phrase.",
    "CANDIDATE TRIGGERS — counsel decision: 'marketing services agreement' (MSA), 'co-marketing agreement', and 'desk rental' are NOT per-se illegal but are the primary CFPB enforcement vehicles for § 8(a)/(b) violations (PHH Corp., Wells Fargo). Counsel to advise whether literal-match firing on these phrases (with operator-review routing to confirm § 8(c)(2) bona-fide-services + FMV compliance) is the right shape — or whether they should be demoted to counsel-reference.",
    "CANDIDATE TRIGGERS — held back for counsel: 'affiliated business arrangement' (legitimate term-of-art with required Form RESPA-1 disclosure — recommend a separate counsel-reference rule that verifies disclosure attachment, not a literal-match alarm); literal dollar amounts (require structured parsing).",
  ],
};
