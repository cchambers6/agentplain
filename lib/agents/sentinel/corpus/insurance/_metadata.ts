import type { CorpusMetadata } from "../../types";

export const metadata: CorpusMetadata = {
  verticalSlug: "insurance",
  lastReviewedAt: "2026-05-25",
  counselReviewer: null,
  status: "DRAFT",
  openQuestions: [
    "Confirm O.C.G.A. § 33-6-4 subsection numbering for rebating prohibition (some sources put it at (b)(7), others (b)(8)) — citation marked unverified pending counsel.",
    "GA producer licensing scope and CE requirements (O.C.G.A. § 33-23) flagged unverified — counsel to confirm exact prohibition wording.",
    "NAIC Producer Licensing Model Act references are summarized — not direct excerpts. Counsel to pull NAIC text and replace placeholders.",
    "Per-state expansion deferred: corpus currently covers GA only. State-portable hooks should be added when the second state is launched.",
    "CANDIDATE TRIGGERS (2026-05-25 wave): `unfair-trade-practices-candidates-literal.ts` ships 17 candidate advertising phrases drafted from NAIC Model #880 § 4(A) (misrepresentation), § 4(B) (false advertising), and § 4(I) (rebating) — e.g. 'guaranteed approval', 'free insurance', 'endorsed by the insurance commissioner'. Sentinel does NOT fire on these — counsel to red-line phrase-by-phrase before flipping `unverified: false`.",
    "CANDIDATE TRIGGERS — counsel decision: 'guaranteed approval' / 'guaranteed issue' are legitimate descriptions for genuinely-guaranteed-issue products (final expense, Medigap). Counsel to advise whether the rule should be scoped to non-GI product lines or whether the literal-match is acceptable with operator-review routing.",
    "CANDIDATE TRIGGERS — rebating: NAIC Model #880 was amended 2020 to allow modest value-added services with state-set dollar caps. Counsel to overlay per-state thresholds before flipping the rebating phrases ('premium rebate', 'cash back on your premium') to verified.",
  ],
};
