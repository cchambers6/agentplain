import type { CorpusMetadata } from "../../types";

export const metadata: CorpusMetadata = {
  verticalSlug: "insurance",
  lastReviewedAt: "2026-06-03",
  counselReviewer: null,
  status: "DRAFT",
  openQuestions: [
    "Confirm O.C.G.A. § 33-6-4 subsection numbering for the rebating prohibition (some sources put it at (b)(7), others (b)(8)) — citation marked unverified pending counsel; severity 'blocking'.",
    "GA producer licensing scope and CE requirements (O.C.G.A. § 33-23) flagged unverified — counsel to confirm exact prohibition wording and whether to track each line-of-authority subsection separately.",
    "NAIC Producer Licensing Model Act (Model #218 § 12) references are summarized — not direct excerpts. Counsel to pull NAIC text and add the GA adoption (O.C.G.A. § 33-23-21) as a companion.",
    "CLAIMS HANDLING (new 2026-06-03): `unfair-claims-settlement-practices-literal.ts` ships NAIC Model #900 § 4 / O.C.G.A. § 33-6-34 (severity 'blocking') with candidate triggers for denial-without-explanation and lowball framing. The GA statutory text could NOT be machine-fetched (state mirrors return 403) — substance is the Model #900 paraphrase. MOST AMBIGUOUS rule in the corpus: counsel MUST replace with canonical O.C.G.A. § 33-6-34 wording, confirm the 'general business practice' threshold (which determines whether a single phrase is actionable), and decide which phrases are safe as literal-match vs counsel-reference given that a producer relaying a carrier's denial is not necessarily the violator.",
    "CLAIM TIMELINES (new 2026-06-03): `ga-claim-handling-timelines-literal.ts` (counsel-reference, severity 'advisory') cites O.C.G.A. § 33-6-34 + § 33-4-6 (bad-faith failure to pay, 60-day demand, penalty up to 50%/$5,000 + fees) + Dept. of Insurance Chapter 120-2. Day-counts NOT verified — counsel MUST supply the operative acknowledgment/investigation/payment day-counts PER LINE. Timelines are STATE-SPECIFIC: corpus covers GA only; add a sibling `<state>-claim-handling-timelines-literal.ts` per launch state rather than parameterizing one rule.",
    "REPLACEMENT COST vs ACV (new 2026-06-03): `replacement-cost-vs-acv-literal.ts` (severity 'blocking') flags absolute replacement-cost promises ('full replacement', 'guaranteed replacement cost', '100% replacement', 'brand new for old') that may misstate the policy's valuation basis under O.C.G.A. § 33-6-4 / § 33-6-34. Counsel: confirm whether 'guaranteed replacement cost' is permissible when a genuine GRC endorsement is in force, and whether to add the reverse-direction rule (describing RCV coverage as paying only depreciated value).",
    "CANDIDATE ADVERTISING TRIGGERS (2026-05-25 wave): `unfair-trade-practices-candidates-literal.ts` ships phrases from NAIC Model #880 § 4(A)/(B)/(I) — e.g. 'guaranteed approval', 'free insurance', 'endorsed by the insurance commissioner'. Counsel decision: 'guaranteed approval'/'guaranteed issue' are legitimate for genuinely guaranteed-issue products (final expense, Medigap) — advise whether to scope to non-GI product lines.",
    "REBATING: NAIC Model #880 was amended 2020 to allow modest value-added services with state-set dollar caps. Counsel to overlay per-state thresholds before flipping the rebating phrases ('premium rebate', 'cash back on your premium') to verified.",
  ],
};
