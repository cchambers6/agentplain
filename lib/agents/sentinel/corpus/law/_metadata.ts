import type { CorpusMetadata } from "../../types";

export const metadata: CorpusMetadata = {
  verticalSlug: "law",
  lastReviewedAt: "2026-05-25",
  counselReviewer: null,
  status: "DRAFT",
  openQuestions: [
    "ABA Model Rules 1.1 / 1.6 / 1.18 / 5.5 / 7.1 quoted from drafter recollection of the canonical text — counsel to verify against current ABA published version (Model Rules text may differ slightly from drafted version).",
    "GA Rules of Professional Conduct adopt the Model Rules with state-specific modifications — drafter included the GA reference at scope level only; counsel to confirm which GA-specific deviations need standalone literals.",
    "Attorney-client privilege summary draws on common-law principles and the Restatement (Third) of the Law Governing Lawyers; this is a routing entry only, not a literal statute.",
    "Counsel: please advise whether sentinel should also load MRPC 8.4 (misconduct) and 1.7/1.9 (conflicts) — drafter omitted these from initial pass to keep scope contained.",
    "CANDIDATE TRIGGERS (2026-05-25 wave): `mrpc-7-1-advertising-candidates-literal.ts` ships 17 candidate advertising phrases drafted from Model Rule 7.1 (misleading) and Rule 7.2(c) (specialist claims) — e.g. 'guaranteed result', 'best lawyer in', 'specialist in', 'expert in'. Sentinel does NOT fire on these — counsel to red-line phrase-by-phrase before flipping `unverified: false`.",
    "CANDIDATE TRIGGERS — counsel decision: state bar rules diverge substantially on advertising; counsel to overlay GA-specific bar rules (and any other jurisdictions the firm operates in) before flipping verified. Held-back borderline phrases ('no recovery, no fee', 'aggressive', 'experienced') noted in the candidate rule's drafterNotes.",
  ],
};
