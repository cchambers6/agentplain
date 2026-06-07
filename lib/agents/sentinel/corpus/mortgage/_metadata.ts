import type { CorpusMetadata } from "../../types";

export const metadata: CorpusMetadata = {
  verticalSlug: "mortgage",
  lastReviewedAt: "2026-06-03",
  counselReviewer: null,
  status: "DRAFT",
  openQuestions: [
    "Confirm 12 USC § 2607(a) (RESPA § 8) excerpt against the current eCFR rendering — anti-kickback wording is the load-bearing literal for sentinel matching; severity is set to 'blocking'.",
    "Verify the TRID three-business-day closing disclosure rule against the 2024 CFPB amendments (12 CFR § 1026.19(f)(1)(ii)(A)).",
    "TRID REDISCLOSURE (new 2026-06-03): `trid-redisclosure-literal.ts` ships § 1026.19(f)(2)(ii) (APR change > tolerance / loan-product change / prepayment-penalty addition restart the 3-day clock) plus candidate triggers targeting 'waive the waiting period' / 'close early' language. Counsel: confirm the § 1026.22 APR-tolerance cross-reference and whether 'close early' / 'no waiting period' are too broad for literal-match (recommend counsel-reference if false-positive rate is a concern).",
    "GA Residential Mortgage Act citation (O.C.G.A. Title 7, Chapter 1, Article 13) is marked unverified — counsel to confirm the canonical citation form (some sources cite O.C.G.A. § 7-1-1000 et seq.) and scope before sentinel uses it.",
    "NMLS / SAFE Act (12 USC § 5103) literal text is an unverified placeholder — counsel to replace with statutory text; rule is scope-only (severity 'info') until then.",
    "FAIR LENDING (new 2026-06-03): added ECOA / Regulation B § 1002.4 (`ecoa-reg-b-fair-lending-literal.ts`, reference text pulled from eCFR/Cornell, counsel-reference, severity 'blocking') and HMDA / Regulation C § 1003.1 (`hmda-reg-c-literal.ts`, reference text pulled from CFPB, counsel-reference, severity 'info'). MOST AMBIGUOUS: the single ECOA discouragement candidate regex — counsel must decide whether ANY steering phrase ('perfect for young families') is safe to fire on literally, or whether the entire fair-lending discouragement surface stays in the LLM-classifier path. Also: confirm the workspace meets HMDA § 1003.2(g)/§ 1003.3(c) coverage thresholds before any HMDA messaging surfaces.",
    "REG Z ADVERTISING SPLIT (resolved 2026-06-03): the former combined `reg-z-advertising-candidates` rule is split into `reg-z-advertising-prohibited-literal.ts` (§ 1026.24(i) + MAP Rule § 1014.3 per-se prohibited claims, severity 'blocking', flag = 'remove') and `reg-z-advertising-triggering-terms-literal.ts` (§ 1026.24(d)(1) triggering terms, severity 'advisory', flag = 'confirm § 1026.24(d)(2) disclosures present'). Counsel to red-line each phrase list separately now that the match classes are separated.",
    "REG Z — held back for counsel-reference (NOT in either literal list): 'fixed rate' (only prohibited in a variable-rate context, § 1026.24(i)(1)); 'counselor' (only prohibited when used by a for-profit broker, § 1026.24(i)(6)); literal APR / payment dollar amounts (require structured parsing). Counsel to advise whether to commission an LLM-classifier path for these.",
    "REG Z — 'government loan program' fires unconditionally in the prohibited list, but § 1026.24(i)(3) only bars it when the advertised loan is NOT a government-supported loan. Counsel to advise whether to scope by lender/product type before flipping to verified.",
  ],
};
