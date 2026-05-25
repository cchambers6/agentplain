import type { CorpusMetadata } from "../../types";

export const metadata: CorpusMetadata = {
  verticalSlug: "home-services",
  lastReviewedAt: "2026-05-25",
  counselReviewer: null,
  status: "DRAFT",
  openQuestions: [
    "GA residential contractor licensing thresholds — drafter cited the >$2,500 trigger; counsel to confirm against current O.C.G.A. § 43-41-2/§ 43-41-17 wording.",
    "FTC Cooling-Off Rule thresholds ($25 at-residence / $130 elsewhere) reflect the 2015 amendment — counsel: confirm no further amendment has issued.",
    "Magnuson-Moss disclosure requirements (15 USC § 2302) summarized; full FTC implementing rules at 16 CFR Part 700–703 not pulled in this draft pass.",
    "Mechanic's lien rules vary substantially across states; GA citation is initial scope.",
    "CANDIDATE TRIGGERS (2026-05-25 wave): `ftc-deceptive-advertising-candidates-literal.ts` ships 22 candidate advertising phrases drafted from FTC Act § 5 (15 USC § 45), 16 CFR § 251.1 (Use of the Word 'Free'), and Magnuson-Moss § 2303 (warranty designation) — e.g. 'guaranteed lowest price', 'free estimate', 'lifetime warranty', 'factory authorized', 'epa approved'. Sentinel does NOT fire on these — counsel to red-line phrase-by-phrase before flipping `unverified: false`.",
    "CANDIDATE TRIGGERS — counsel decision: state contractor-board advertising rules (e.g. requirement to include the license number in print + online advertising under O.C.G.A. § 43-41 implementing regulations) were intentionally NOT literal-matched in this draft because license-number formats are workspace-scoped and would false-positive without context. Counsel: should a follow-on workspace-scoped rule be added, and if so, what's the canonical Georgia rule cite for license-number-in-advertising? Same question applies to any other state the brokerage / trades shop operates in.",
    "CANDIDATE TRIGGERS — counsel decision: 'free estimate' / 'free inspection' is industry-standard language for trade shops. 16 CFR § 251.1 only treats it as deceptive when the offer is conditioned on a purchase the consumer is not adequately told about. Counsel: should sentinel literal-match the bare phrase (and rely on the customer to ignore the flag when the estimate is genuinely free), or should the rule be tightened with proximity-required disclaimer language (e.g. only flag 'free estimate' when adjacent to 'with purchase')? The proximity path requires scanner work beyond literal-match.",
    "CANDIDATE TRIGGERS — counsel decision: 'lifetime warranty' / 'lifetime guarantee' phrases require a Magnuson-Moss 'full (statement of duration) warranty' or 'limited warranty' designation under 15 USC § 2303. Counsel: confirm sentinel should flag these as literal triggers (counting on the customer to add the designation), or whether the rule should be scoped to flag only when the designation is absent within N characters — again, beyond pure literal-match.",
  ],
};
