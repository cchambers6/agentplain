import type { CorpusMetadata } from "../../types";

export const metadata: CorpusMetadata = {
  verticalSlug: "property-management",
  lastReviewedAt: "2026-05-25",
  counselReviewer: null,
  status: "DRAFT",
  openQuestions: [
    "Fair Housing rules are shared with the real-estate corpus and referenced (not duplicated). Counsel to confirm shared-corpus access semantics.",
    "GA security deposit holding-period and return-timeline literal (O.C.G.A. § 44-7-31, § 44-7-34) should be verified against the current code edition.",
    "Dispossessory procedure (O.C.G.A. § 44-7-50 et seq.) — drafter quoted the demand-for-possession requirement; counsel to confirm the seven-day answer window has not changed.",
    "Per-state expansion deferred: corpus currently covers GA only. Hooks present for adding additional states.",
    "CANDIDATE TRIGGERS (2026-05-25 wave): `rental-advertising-candidates-literal.ts` ships 53 candidate rental-ad phrases — 46 ported VERBATIM from the real-estate HUD § 804(c) literal list (because `loadCorpusFor()` keys on verticalSlug only and does not cross-load real-estate's corpus for property-management workspaces) plus 7 source-of-income phrases ('no section 8', 'no vouchers', 'no DSS', 'no welfare'). Sentinel does NOT fire on these — counsel to red-line phrase-by-phrase.",
    "CANDIDATE TRIGGERS — counsel decision: should the PM corpus literally duplicate the HUD trigger list (drift risk between two files) or should `loadCorpusFor()` be extended to cross-load real-estate's corpus when scanning a PM workspace? Engineering can implement either — load-bearing call.",
    "CANDIDATE TRIGGERS — counsel decision: source-of-income phrases ('no section 8', 'no vouchers', 'no DSS', 'no welfare') are federally legal but illegal in 19+ states / many cities. Counsel to advise per operating jurisdiction; rule should likely carry per-state scope metadata before flipping verified.",
  ],
};
