# Counsel handoff packet — Mortgage compliance corpus

> **DRAFT — not legal advice.** This packet is a fleet-drafted compliance corpus for attorney review. No rule fires on customer drafts until counsel red-lines it AND the vertical is enabled via `COMPLIANCE_CORPUS_COUNSEL_REVIEWED`. Sentinel ADVISES; it never blocks a send.

## Status

- **Vertical:** `mortgage`
- **Corpus status:** DRAFT
- **Last reviewed:** 2026-06-03
- **Counsel reviewer:** _none yet_
- **Packet generated:** 2026-06-03

### Coverage at a glance

| Bucket | Count |
| --- | --- |
| Live literal triggers (firing today) | 0 |
| Candidate literal triggers (to red-line) | 30 |
| Candidate regex triggers (to red-line) | 5 |
| Counsel-reference rules | 7 |
| Open questions | 9 |

## 1. Live literal triggers (firing on drafts today)

_None. This corpus is DRAFT — no rule is counsel-verified, so the scanner fires on nothing yet. Phrases below are candidates for review._

## 2. Candidate literal triggers — counsel red-line, phrase by phrase

_Sentinel does NOT fire on these. Check a box to approve a phrase as a literal-match trigger; strike, reword, or demote to counsel-reference otherwise._

#### TRID § 1026.19(f)(2)(ii) — redisclosure resets the three-day clock (DRAFT) (`trid-redisclosure-three-day-reset`)
- **Severity:** 🔴 blocking
- **Category:** closing-timing
- **Citation:** 12 CFR § 1026.19(f)(2)(ii) (corrected disclosures; new three-business-day waiting period)
  — https://www.consumerfinance.gov/rules-policy/regulations/1026/19/ (read 2026-06-03)
- **Safe rewrite:** Do not offer, promise, or imply that the borrower can waive, skip, or compress the three-business-day Closing Disclosure waiting period. The waiting period is waivable ONLY for a documented bona fide personal financial emergency under § 1026.19(f)(1)(iv) (dated written, consumer-signed statement) — never as a marketing convenience. Frame closing dates as 'on or after the third business day following receipt of your Closing Disclosure.'
- **Drafter notes:** Drafted 2026-06-03 to close the companion-rule gap noted on `trid-closing-disclosure-literal.ts`. Counsel: confirm the § 1026.22 APR-tolerance cross-reference and whether 'close early'/'no waiting period' are too broad (they could appear in benign non-mortgage contexts) — candidates only; sentinel does not fire. Consider scoping 'close early' to counsel-reference if false-positive rate is a concern.
- **Candidate phrases to red-line (9):**
  - [ ] `waive your three-day`
  - [ ] `waive the three-day`
  - [ ] `waive your three day`
  - [ ] `waive the waiting period`
  - [ ] `waive the three-day waiting period`
  - [ ] `skip the waiting period`
  - [ ] `close early`
  - [ ] `close before the three days`
  - [ ] `no waiting period`

#### Regulation Z § 1026.24(i) + MAP Rule — prohibited mortgage advertising claims (DRAFT) (`reg-z-mortgage-advertising-prohibited`)
- **Severity:** 🔴 blocking
- **Category:** advertising
- **Citation:** 12 CFR § 1026.24(i); 12 CFR § 1014.3 (MAP Rule, Regulation N)
  — https://www.ecfr.gov/current/title-12/chapter-X/part-1026/subpart-C/section-1026.24 (read 2026-05-25)
- **Safe rewrite:** Remove the claim. Do not state or imply (a) government endorsement of a loan that is not a government program, (b) that a mortgage or debt will be eliminated, or (c) any guarantee of approval, a loan, or 'the lowest rate.' Replace with factual, non-absolute language ('you may be eligible', 'rates depend on credit and market conditions') — § 1026.24(i)(3),(5); MAP Rule § 1014.3.
- **Drafter notes:** Split from the combined candidate rule on 2026-06-03. These are per-se prohibited representations — the operator-facing flag should read 'remove this claim,' distinct from the triggering-term rule's 'confirm required disclosures.' Held back for counsel-reference (context-sensitive, NOT in this literal list): 'fixed rate' (only prohibited in a variable-rate context, § 1026.24(i)(1)); 'counselor' (only prohibited when used by a for-profit broker, § 1026.24(i)(6)). The 'government loan program' phrase is prohibited only when the advertised loan is not actually a government-supported loan — counsel may want to scope by lender/product type rather than fire unconditionally.
- **Candidate phrases to red-line (15):**
  - [ ] `government loan program`
  - [ ] `government-supported loan`
  - [ ] `government supported loan`
  - [ ] `government-endorsed loan`
  - [ ] `endorsed by hud`
  - [ ] `endorsed by fha`
  - [ ] `eliminate your mortgage`
  - [ ] `eliminate your debt`
  - [ ] `wipe out your mortgage`
  - [ ] `wipe out your debt`
  - [ ] `guaranteed approval`
  - [ ] `guaranteed loan`
  - [ ] `guaranteed mortgage`
  - [ ] `lowest rate guaranteed`
  - [ ] `lowest rates guaranteed`

#### Regulation Z § 1026.24(d)(1) — mortgage advertising triggering terms (DRAFT) (`reg-z-mortgage-advertising-triggering-terms`)
- **Severity:** 🟡 advisory
- **Category:** advertising
- **Citation:** 12 CFR § 1026.24(d)(1) and § 1026.24(d)(2)
  — https://www.ecfr.gov/current/title-12/chapter-X/part-1026/subpart-C/section-1026.24 (read 2026-05-25)
- **Safe rewrite:** Keep the term only if the advertisement also clearly and conspicuously states the § 1026.24(d)(2) disclosures: the downpayment amount/percentage, the repayment terms over the full loan term, the 'annual percentage rate' (spelled out or 'APR'), and whether the rate can increase after consummation. If those cannot be included in this surface, remove the triggering term.
- **Drafter notes:** Split from the combined candidate rule on 2026-06-03. These are NOT prohibited — the flag exists to prompt a disclosure check. Counsel: confirm whether 'low monthly payment(s)' should be treated as a § 1026.24(d)(1)(iii) 'amount of any payment' triggering term (it states a payment characteristic without a figure) or held for counsel-reference. Specific APR / dollar payment figures still require structured parsing and are intentionally out of this literal/regex set.
- **Candidate phrases to red-line (6):**
  - [ ] `no down payment`
  - [ ] `zero down`
  - [ ] `no money down`
  - [ ] `no closing costs`
  - [ ] `low monthly payment`
  - [ ] `low monthly payments`

## 3. Candidate regex triggers — counsel red-line

_Deterministic patterns for cases a literal phrase list can't express. Each shows the string it must match and a near-miss it must not._

#### TRID § 1026.19(f)(2)(ii) — redisclosure resets the three-day clock (DRAFT) (`trid-redisclosure-three-day-reset`)
- [ ] **Pattern:** `/waiv\w*\b[^.!?\n]{0,30}\b(waiting period|three[\s-]?day|3[\s-]?day)/i` — 🔴 blocking
  - Catches waive/waiving/waiver phrasings aimed at the TRID waiting period that the literal list misses.
  - **Matches (intended):** "You can sign a waiver to skip the three-day wait."
  - **Does NOT match (guard):** "We waive the application fee for veterans."

#### ECOA / Regulation B § 1002.4 — fair lending + discouragement (`ecoa-reg-b-fair-lending`)
- [ ] **Pattern:** `/(perfect|ideal|great|best)\s+(for|fit for)\s+(young|christian|single|married|family|families|retired|mature)/i` — 🔴 blocking
  - Candidate: catches lending-ad phrasing that steers toward/away from a prohibited basis (age, religion, marital/familial status). § 1002.4(b) discouragement is context-sensitive — counsel decides whether any literal match is safe.
  - **Matches (intended):** "This loan is perfect for young married couples."
  - **Does NOT match (guard):** "This loan is a great fit for your budget."

#### Regulation Z § 1026.24(i) + MAP Rule — prohibited mortgage advertising claims (DRAFT) (`reg-z-mortgage-advertising-prohibited`)
- [ ] **Pattern:** `/guarantee(d|s)?\b[^.!?\n]{0,20}\b(approval|approved|loan|mortgage|rate|rates)/i` — 🔴 blocking
  - Catches guarantee-of-outcome phrasings the literal list misses, e.g. 'guarantees the lowest rate', 'guaranteed to be approved'.
  - **Matches (intended):** "We guarantee your approval regardless of credit."
  - **Does NOT match (guard):** "We guarantee your privacy is protected."

#### Regulation Z § 1026.24(d)(1) — mortgage advertising triggering terms (DRAFT) (`reg-z-mortgage-advertising-triggering-terms`)
- [ ] **Pattern:** `/\$\s?0\s+down/i` — 🟡 advisory
  - Catches '$0 down' (downpayment-amount triggering term) without firing on dollar figures like '$500 down'.
  - **Matches (intended):** "Buy now with $0 down and move in this month."
  - **Does NOT match (guard):** "A deposit of $500 down holds the rate."
- [ ] **Pattern:** `/\b0%\s*down\b/i` — 🟡 advisory
  - Catches '0% down' downpayment-percentage triggering term.
  - **Matches (intended):** "0% down for qualified veterans."
  - **Does NOT match (guard):** "Rates start at 6% on a 30-year term."

## 4. Counsel-reference rules — substantive law, never auto-flagged

#### RESPA Section 8 — anti-kickback and unearned fees (`respa-section-8-anti-kickback`)
- **Severity:** 🔴 blocking · **Status:** draft
- **Citation:** 12 USC § 2607(a)–(b); implementing regulation 12 CFR § 1024.14
  — https://www.law.cornell.edu/uscode/text/12/2607 (read 2026-05-12)
- **Summary:** Prohibits any fee, kickback, or thing of value exchanged for a referral of settlement service business on a federally related mortgage loan, and the splitting of unearned charges.
- **Safe rewrite / guidance:** Describe the referral relationship without any exchange of value tied to it. Strike language offering or soliciting gifts, fees, marketing-cost coverage, leads, or 'thank-you' payments in return for referrals; co-marketing must be paid at fair market value for services actually performed and never contingent on referral volume.
- **Drafter notes:** Implementing rule at 12 CFR § 1024.14 elaborates on what constitutes a 'thing of value' (broad — gifts, trips, opportunities, special privileges). Counsel should attach the 1024.14 elaboration as a companion rule once this draft is reviewed.

> (a) Business referrals
> No person shall give and no person shall accept any fee, kickback, or thing of value pursuant to any agreement or understanding, oral or otherwise, that business incident to or a part of a real estate settlement service involving a federally related mortgage loan shall be referred to any person.
> 
> (b) Splitting charges
> No person shall give and no person shall accept any portion, split, or percentage of any charge made or received for the rendering of a real estate settlement service in connection with a transaction involving a federally related mortgage loan other than for services actually performed.

#### TRID — Closing Disclosure three-business-day rule (`trid-closing-disclosure-three-day`)
- **Severity:** 🟡 advisory · **Status:** draft
- **Citation:** 12 CFR § 1026.19(f)(1)(ii)(A)
  — https://www.consumerfinance.gov/rules-policy/regulations/1026/19/ (read 2026-05-12)
- **Summary:** Closing Disclosure must be delivered to the consumer no later than three business days before consummation; certain changes restart the three-day clock.
- **Safe rewrite / guidance:** Do not promise, imply, or pressure a closing date inside the three-business-day window after the Closing Disclosure is received. Frame timelines as 'on or after the third business day following your Closing Disclosure.' Never describe the waiting period as waivable except for a documented bona fide personal financial emergency under § 1026.19(f)(1)(iv).
- **Drafter notes:** Counsel: the corresponding redisclosure trigger in 12 CFR § 1026.19(f)(2)(ii) (APR change > 1/8%, loan product change, prepayment penalty added) should ship as a companion literal in the next pass.

> (ii) Timing.
> (A) In general. The creditor shall ensure that the consumer receives the disclosures required under paragraph (f)(1)(i) of this section no later than three business days before consummation.

#### TILA / Regulation Z — disclosure of credit terms (`tila-reg-z-disclosure-purpose`)
- **Severity:** ⚪ info · **Status:** draft
- **Citation:** 15 USC § 1601 (TILA purpose); 12 CFR § 1026.1(b) (Reg Z purpose)
  — https://www.consumerfinance.gov/rules-policy/regulations/1026/1/ (read 2026-05-12)
- **Summary:** Creditor must give the consumer accurate, clear disclosure of the cost of credit (finance charge, APR, payment schedule, total of payments) before consummation.
- **Safe rewrite / guidance:** Do not state or imply a rate, payment, APR, or 'cost of credit' figure in customer-facing copy unless the corresponding TILA/Reg Z disclosures are delivered with it. Quote terms only from the issued Loan Estimate / Closing Disclosure, not ad-hoc in correspondence.
- **Drafter notes:** Counsel: the field-by-field disclosure list (12 CFR § 1026.18 for closed-end non-mortgage; § 1026.37 for the Loan Estimate; § 1026.38 for the Closing Disclosure) is what sentinel actually needs to match against. This excerpt establishes purpose; the field-level literals are the next pass.

> (b) Purpose. The purpose of this part is to promote the informed use of consumer credit by requiring disclosures about its terms and cost, to ensure that consumers are provided with greater and more timely information on the nature and costs of the residential real estate settlement process, and to effect certain changes in the settlement process for residential real estate that will result in more effective advance disclosure to home buyers and sellers of settlement costs.

#### SAFE Act — Mortgage Loan Originator licensure / NMLS registration (`safe-act-mlo-licensure`)
- **Severity:** ⚪ info · **Status:** draft
- **Citation:** 12 USC § 5103 (SAFE Act); implementing regulation 12 CFR Part 1008
  — https://www.law.cornell.edu/uscode/text/12/5103 (read 2026-05-12)
- **Summary:** An individual may not engage in the business of a residential mortgage loan originator without first obtaining a state license or, for employees of a depository institution, federal registration through the NMLS.
- **Safe rewrite / guidance:** Do not state or imply that the workspace can originate, approve, or lock a residential mortgage loan unless a licensed/registered MLO (with NMLS ID) is the named originator. Marketing copy should attribute origination to the licensed individual or entity and include the NMLS ID where the originator's name appears.
- **Drafter notes:** Counsel: please replace the placeholder with the actual statutory text from 12 USC § 5103(a). Sentinel currently treats this rule as scope-only (won't fire on text match) until the literal is filled in.

> [UNVERIFIED — needs counsel] Substance: 12 USC § 5103 requires that, in addition to other requirements, an individual may not engage in the business of a loan originator without first obtaining and maintaining annually a registration as a registered loan originator (for federally chartered/regulated depositories) or a state license and registration as a state-licensed loan originator. Implementing rules at 12 CFR Part 1008 set minimum standards for state licensing; the corresponding federal registration rule sits at 12 CFR Part 1007.

#### Georgia Residential Mortgage Act — state licensure (`ga-residential-mortgage-act`)
- **Severity:** ⚪ info · **Status:** draft
- **Citation:** O.C.G.A. Title 7, Chapter 1, Article 13 (Georgia Residential Mortgage Act)
  — https://law.justia.com/codes/georgia/title-7/chapter-1/article-13/ (read 2026-05-12)
- **Summary:** Georgia requires a state license to act as a mortgage broker, mortgage lender, or mortgage loan originator with respect to residential mortgage loans on Georgia property.
- **Safe rewrite / guidance:** Confirm the workspace's Georgia mortgage-broker/lender license (and each MLO's GA license) is active before any customer-facing copy solicits, advertises, or negotiates a residential mortgage loan on Georgia property. Do not imply Georgia lending authority the licensee does not hold.
- **Drafter notes:** Counsel: please confirm citation form (some sources cite as O.C.G.A. § 7-1-1000 et seq.) and replace placeholder with the operative prohibition language. Sentinel will not match on this rule until literal is filled in.

> [UNVERIFIED — needs counsel] Substance: the Georgia Residential Mortgage Act (O.C.G.A. Title 7, Chapter 1, Article 13) requires a license from the Department of Banking and Finance to act as a mortgage broker, mortgage lender, or mortgage loan originator with respect to a residential mortgage loan on Georgia real property; specifies licensing standards, examinations, and bonding; and prohibits unlicensed activity. Implementing regulations at Rules of the Department of Banking and Finance, Chapter 80-11.

#### ECOA / Regulation B § 1002.4 — fair lending + discouragement (`ecoa-reg-b-fair-lending`)
- **Severity:** 🔴 blocking · **Status:** draft
- **Citation:** 15 USC § 1691 et seq. (ECOA); 12 CFR § 1002.4 (Regulation B, General rules)
  — https://www.law.cornell.edu/cfr/text/12/1002.4 (read 2026-06-03)
- **Summary:** A creditor shall not discriminate against an applicant on a prohibited basis in any aspect of a credit transaction, and shall not make any oral or written statement (in advertising or otherwise) that would discourage a reasonable person, on a prohibited basis, from making or pursuing an application.
- **Safe rewrite / guidance:** Describe the loan PRODUCT and its objective qualification criteria, never the applicant's protected characteristics. Remove references to age, race, religion, national origin, sex, marital/familial status, or receipt of public assistance. Replace 'ideal for young families' with 'available to qualified applicants' and state the actual underwriting criteria.
- **Drafter notes:** § 1002.4 reference text pulled from eCFR/Cornell 2026-06-03 (authentic). Rule is counsel-reference: discouragement is fact-specific. The single candidate regex is a nominee only — counsel to decide whether ANY steering phrase is safe to fire on literally, or whether the whole fair-lending surface stays in the LLM-classifier path. Companion: add the § 1002.9 adverse-action notice timing (30 days) as a separate rule next pass. ECOA pairs with HMDA (`hmda-reg-c-literal.ts`) on the fair-lending side.

> 12 CFR § 1002.4 — General rules.
> 
> (a) Discrimination. A creditor shall not discriminate against an applicant on a prohibited basis regarding any aspect of a credit transaction.
> 
> (b) Discouragement. A creditor shall not make any oral or written statement, in advertising or otherwise, to applicants or prospective applicants that would discourage on a prohibited basis a reasonable person from making or pursuing an application.
> 
> (c) Written applications. A creditor shall take written applications for the dwelling-related types of credit covered by § 1002.13(a).
> 
> [Prohibited basis under § 1002.2(z): race, color, religion, national origin, sex, marital status, age (provided the applicant has capacity to contract); the applicant's receipt of income from a public assistance program; or the applicant's good-faith exercise of any right under the Consumer Credit Protection Act.]

#### HMDA / Regulation C § 1003.1 — mortgage data reporting (fair-lending) (`hmda-reg-c-reporting`)
- **Severity:** ⚪ info · **Status:** draft
- **Citation:** 12 USC § 2801 et seq. (HMDA); 12 CFR § 1003.1 (Regulation C, Authority, purpose, and scope)
  — https://www.consumerfinance.gov/rules-policy/regulations/1003/1/ (read 2026-06-03)
- **Summary:** Covered financial institutions must collect, record, and report data about mortgage applications, originations, and purchases so the public and regulators can assess whether institutions serve community housing needs and identify possible discriminatory lending patterns.
- **Safe rewrite / guidance:** No draft rewrite — HMDA is a data-collection/reporting duty, not a content rule. Surface as context so the operator confirms HMDA loan/application register (LAR) data is captured for reportable transactions; do not rely on sentinel text matching for HMDA compliance.
- **Drafter notes:** § 1003.1(b) purpose text pulled from CFPB 2026-06-03 (authentic). Counsel: confirm whether the workspace's institution meets the § 1003.2(g) 'financial institution' coverage test and the § 1003.3(c) loan-volume thresholds before any HMDA messaging is surfaced; that determination is institution-specific and out of corpus scope. Carried as counsel-reference + info severity — never fires.

> 12 CFR § 1003.1 — Authority, purpose, and scope.
> 
> (b) Purpose. (1) This part implements the Home Mortgage Disclosure Act, which is intended to provide the public with loan data that can be used:
> 
> (i) To help determine whether financial institutions are serving the housing needs of their communities;
> 
> (ii) To assist public officials in distributing public-sector investment so as to attract private investment to areas where it is needed; and
> 
> (iii) To assist in identifying possible discriminatory lending patterns and enforcing antidiscrimination statutes.
> 
> (2) Neither the act nor this part is intended to encourage unsound lending practices or the allocation of credit.

## 5. Questions for counsel

**Corpus open questions (drafter → counsel):**

- [ ] Confirm 12 USC § 2607(a) (RESPA § 8) excerpt against the current eCFR rendering — anti-kickback wording is the load-bearing literal for sentinel matching; severity is set to 'blocking'.
- [ ] Verify the TRID three-business-day closing disclosure rule against the 2024 CFPB amendments (12 CFR § 1026.19(f)(1)(ii)(A)).
- [ ] TRID REDISCLOSURE (new 2026-06-03): `trid-redisclosure-literal.ts` ships § 1026.19(f)(2)(ii) (APR change > tolerance / loan-product change / prepayment-penalty addition restart the 3-day clock) plus candidate triggers targeting 'waive the waiting period' / 'close early' language. Counsel: confirm the § 1026.22 APR-tolerance cross-reference and whether 'close early' / 'no waiting period' are too broad for literal-match (recommend counsel-reference if false-positive rate is a concern).
- [ ] GA Residential Mortgage Act citation (O.C.G.A. Title 7, Chapter 1, Article 13) is marked unverified — counsel to confirm the canonical citation form (some sources cite O.C.G.A. § 7-1-1000 et seq.) and scope before sentinel uses it.
- [ ] NMLS / SAFE Act (12 USC § 5103) literal text is an unverified placeholder — counsel to replace with statutory text; rule is scope-only (severity 'info') until then.
- [ ] FAIR LENDING (new 2026-06-03): added ECOA / Regulation B § 1002.4 (`ecoa-reg-b-fair-lending-literal.ts`, reference text pulled from eCFR/Cornell, counsel-reference, severity 'blocking') and HMDA / Regulation C § 1003.1 (`hmda-reg-c-literal.ts`, reference text pulled from CFPB, counsel-reference, severity 'info'). MOST AMBIGUOUS: the single ECOA discouragement candidate regex — counsel must decide whether ANY steering phrase ('perfect for young families') is safe to fire on literally, or whether the entire fair-lending discouragement surface stays in the LLM-classifier path. Also: confirm the workspace meets HMDA § 1003.2(g)/§ 1003.3(c) coverage thresholds before any HMDA messaging surfaces.
- [ ] REG Z ADVERTISING SPLIT (resolved 2026-06-03): the former combined `reg-z-advertising-candidates` rule is split into `reg-z-advertising-prohibited-literal.ts` (§ 1026.24(i) + MAP Rule § 1014.3 per-se prohibited claims, severity 'blocking', flag = 'remove') and `reg-z-advertising-triggering-terms-literal.ts` (§ 1026.24(d)(1) triggering terms, severity 'advisory', flag = 'confirm § 1026.24(d)(2) disclosures present'). Counsel to red-line each phrase list separately now that the match classes are separated.
- [ ] REG Z — held back for counsel-reference (NOT in either literal list): 'fixed rate' (only prohibited in a variable-rate context, § 1026.24(i)(1)); 'counselor' (only prohibited when used by a for-profit broker, § 1026.24(i)(6)); literal APR / payment dollar amounts (require structured parsing). Counsel to advise whether to commission an LLM-classifier path for these.
- [ ] REG Z — 'government loan program' fires unconditionally in the prohibited list, but § 1026.24(i)(3) only bars it when the advertised loan is NOT a government-supported loan. Counsel to advise whether to scope by lender/product type before flipping to verified.

**Per-rule drafter notes (most ambiguous first):**

- **SAFE Act — Mortgage Loan Originator licensure / NMLS registration** (`safe-act-mlo-licensure`): Counsel: please replace the placeholder with the actual statutory text from 12 USC § 5103(a). Sentinel currently treats this rule as scope-only (won't fire on text match) until the literal is filled in.
- **Georgia Residential Mortgage Act — state licensure** (`ga-residential-mortgage-act`): Counsel: please confirm citation form (some sources cite as O.C.G.A. § 7-1-1000 et seq.) and replace placeholder with the operative prohibition language. Sentinel will not match on this rule until literal is filled in.
- **Regulation Z § 1026.24(i) + MAP Rule — prohibited mortgage advertising claims (DRAFT)** (`reg-z-mortgage-advertising-prohibited`): Split from the combined candidate rule on 2026-06-03. These are per-se prohibited representations — the operator-facing flag should read 'remove this claim,' distinct from the triggering-term rule's 'confirm required disclosures.' Held back for counsel-reference (context-sensitive, NOT in this literal list): 'fixed rate' (only prohibited in a variable-rate context, § 1026.24(i)(1)); 'counselor' (only prohibited when used by a for-profit broker, § 1026.24(i)(6)). The 'government loan program' phrase is prohibited only when the advertised loan is not actually a government-supported loan — counsel may want to scope by lender/product type rather than fire unconditionally.
- **TRID § 1026.19(f)(2)(ii) — redisclosure resets the three-day clock (DRAFT)** (`trid-redisclosure-three-day-reset`): Drafted 2026-06-03 to close the companion-rule gap noted on `trid-closing-disclosure-literal.ts`. Counsel: confirm the § 1026.22 APR-tolerance cross-reference and whether 'close early'/'no waiting period' are too broad (they could appear in benign non-mortgage contexts) — candidates only; sentinel does not fire. Consider scoping 'close early' to counsel-reference if false-positive rate is a concern.
- **Regulation Z § 1026.24(d)(1) — mortgage advertising triggering terms (DRAFT)** (`reg-z-mortgage-advertising-triggering-terms`): Split from the combined candidate rule on 2026-06-03. These are NOT prohibited — the flag exists to prompt a disclosure check. Counsel: confirm whether 'low monthly payment(s)' should be treated as a § 1026.24(d)(1)(iii) 'amount of any payment' triggering term (it states a payment characteristic without a figure) or held for counsel-reference. Specific APR / dollar payment figures still require structured parsing and are intentionally out of this literal/regex set.
- **ECOA / Regulation B § 1002.4 — fair lending + discouragement** (`ecoa-reg-b-fair-lending`): § 1002.4 reference text pulled from eCFR/Cornell 2026-06-03 (authentic). Rule is counsel-reference: discouragement is fact-specific. The single candidate regex is a nominee only — counsel to decide whether ANY steering phrase is safe to fire on literally, or whether the whole fair-lending surface stays in the LLM-classifier path. Companion: add the § 1002.9 adverse-action notice timing (30 days) as a separate rule next pass. ECOA pairs with HMDA (`hmda-reg-c-literal.ts`) on the fair-lending side.
- **HMDA / Regulation C § 1003.1 — mortgage data reporting (fair-lending)** (`hmda-reg-c-reporting`): § 1003.1(b) purpose text pulled from CFPB 2026-06-03 (authentic). Counsel: confirm whether the workspace's institution meets the § 1003.2(g) 'financial institution' coverage test and the § 1003.3(c) loan-volume thresholds before any HMDA messaging is surfaced; that determination is institution-specific and out of corpus scope. Carried as counsel-reference + info severity — never fires.
- **RESPA Section 8 — anti-kickback and unearned fees** (`respa-section-8-anti-kickback`): Implementing rule at 12 CFR § 1024.14 elaborates on what constitutes a 'thing of value' (broad — gifts, trips, opportunities, special privileges). Counsel should attach the 1024.14 elaboration as a companion rule once this draft is reviewed.
- **TRID — Closing Disclosure three-business-day rule** (`trid-closing-disclosure-three-day`): Counsel: the corresponding redisclosure trigger in 12 CFR § 1026.19(f)(2)(ii) (APR change > 1/8%, loan product change, prepayment penalty added) should ship as a companion literal in the next pass.
- **TILA / Regulation Z — disclosure of credit terms** (`tila-reg-z-disclosure-purpose`): Counsel: the field-by-field disclosure list (12 CFR § 1026.18 for closed-end non-mortgage; § 1026.37 for the Loan Estimate; § 1026.38 for the Closing Disclosure) is what sentinel actually needs to match against. This excerpt establishes purpose; the field-level literals are the next pass.
