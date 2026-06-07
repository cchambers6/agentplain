import type { CorpusMetadata } from "../../types";

export const metadata: CorpusMetadata = {
  verticalSlug: "ria",
  lastReviewedAt: "2026-06-06",
  counselReviewer: null,
  status: "DRAFT",
  openQuestions: [
    "MOST AMBIGUOUS: 'fdic insured' / 'fdic-insured' in `marketing-rule-candidates-literal.ts` fires unconditionally, but the phrase is legitimate for genuine sweep-deposit coverage at an affiliated bank and a per-se misrepresentation only on a non-deposit advisory product. Counsel must decide whether the literal-match is acceptable as-is given the recurring exam-finding risk, or whether it needs a context modifier / move to the counsel-reference path so it does not false-positive on lawful FDIC references.",
    "Marketing Rule § 206(4)-1(b) testimonials/endorsements now ship in TWO places — the paragraph-(a)+(b) overview (`advisers-act-marketing-rule-206-4-1`) and the dedicated (b) rule (`ria-marketing-testimonials-endorsements`). Counsel to confirm the deliberate overlap is acceptable, verify the (b)(2) de minimis written-agreement dollar threshold, and supply the full 'ineligible person' disqualification definition.",
    "Soft dollars (new 2026-06-06): `soft-dollar-section-28e-literal.ts` quotes 15 USC § 78bb(e)(1) safe harbor and (e)(3) brokerage-and-research-services definition (verified Cornell LII) plus a summarized Form ADV Part 2A Item 12 disclosure obligation. Counsel to confirm the Item 12 wording and advise whether the SEC 2006 interpretive release (Rel. No. 34-54165) and a 'mixed-use' allocation companion rule are needed.",
    "Form ADV Part 2 (re-scoped 2026-06-06): the former scope-only `form-adv-disclosure-framework` is now `form-adv-part-2-brochure-disclosure` with verified 17 CFR § 275.204-3(b) delivery text (initial before/at contract; annual within 120 days). The Part 2A item enumeration is paraphrased — counsel to confirm the canonical item list and whether dedicated literals for Item 9 (disciplinary), Item 11 (code of ethics / personal trading), and Item 12 (brokerage / soft dollars) are warranted.",
    "Marketing-rule candidate triggers: counsel to red-line the 21 literal phrases AND the two new regexes ('guaranteed … return(s)', 'risk[- ]free … investment') phrase-by-phrase before any `unverified: false` flip. 'Guaranteed return' phrases are FINRA 2210 promissory core; 'SEC approved/endorsed/sponsored' are direct § 208(a) violations.",
    "Custody Rule (17 CFR § 275.206(4)-2): literalText remains an [UNVERIFIED] paraphrase because eCFR 302-redirects automated fetch — counsel to pull canonical (a)(1)-(6) text. Also confirm the status of the SEC proposed Safeguarding Rule (Rel. No. IA-6240, Feb 2023), unfinalized as of 2026-06-06.",
    "Code of Ethics (17 CFR § 275.204A-1): paragraph (a) five elements verified against Cornell LII; the (b) holdings/transaction-report detail is drafted from the rule structure and not independently re-verified word-for-word — counsel to confirm (b)(1)-(2), (c) IPO/limited-offering pre-approval, and (d) recordkeeping.",
    "Investment Advisers Act § 206 (15 USC § 80b-6) and § 208(a) (15 USC § 80b-8(a)) quoted from Cornell LII — counsel to confirm against the current US Code rendering.",
    "State vs. SEC registration: $100M/$110M buffer and 15-state multistate exception (15 USC § 80b-3a / 17 CFR § 275.203A-1) carried from Dodd-Frank; scope-only (severity 'info'). Counsel to verify the buffer and the internet-adviser exemption path (17 CFR § 275.203A-2(e)).",
  ],
};
