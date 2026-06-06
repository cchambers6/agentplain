# Counsel handoff packet — Insurance compliance corpus

> **DRAFT — not legal advice.** This packet is a fleet-drafted compliance corpus for attorney review. No rule fires on customer drafts until counsel red-lines it AND the vertical is enabled via `COMPLIANCE_CORPUS_COUNSEL_REVIEWED`. Sentinel ADVISES; it never blocks a send.

## Status

- **Vertical:** `insurance`
- **Corpus status:** DRAFT
- **Last reviewed:** 2026-06-03
- **Counsel reviewer:** _none yet_
- **Packet generated:** 2026-06-03

### Coverage at a glance

| Bucket | Count |
| --- | --- |
| Live literal triggers (firing today) | 0 |
| Candidate literal triggers (to red-line) | 36 |
| Candidate regex triggers (to red-line) | 4 |
| Counsel-reference rules | 5 |
| Open questions | 8 |

## 1. Live literal triggers (firing on drafts today)

_None. This corpus is DRAFT — no rule is counsel-verified, so the scanner fires on nothing yet. Phrases below are candidates for review._

## 2. Candidate literal triggers — counsel red-line, phrase by phrase

_Sentinel does NOT fire on these. Check a box to approve a phrase as a literal-match trigger; strike, reword, or demote to counsel-reference otherwise._

#### NAIC Model #880 § 4 — candidate insurance advertising triggers (DRAFT) (`insurance-utpa-candidates`)
- **Severity:** 🔴 blocking
- **Category:** advertising
- **Citation:** NAIC Model Unfair Trade Practices Act (Model #880) § 4 — implemented in GA at O.C.G.A. § 33-6-4
  — https://content.naic.org/sites/default/files/MO880.pdf (read 2026-05-25)
- **Safe rewrite:** Remove the absolute or endorsement claim. Do not promise guaranteed approval/issue/acceptance unless the specific product is genuinely guaranteed-issue (then state the product line). Never claim endorsement or approval by a state insurance department/commissioner. Replace 'lowest rates guaranteed' with comparative language you can substantiate. Strike rebate/cash-back offers (see `ga-anti-rebating`).
- **Drafter notes:** Drafted 2026-05-25. 'Guaranteed approval/issue/acceptance' phrases are direct Model #880 § 4(A) misrepresentation targets EXCEPT where the policy is genuinely guaranteed-issue (some final-expense / Medigap products). Counsel should consider whether to scope this rule to non-guaranteed-issue product lines via category metadata or a follow-on counsel-reference rule. Rebating phrases are direct § 4(I) targets; many states permit modest 'value-added services' (NAIC Model #880 was amended 2020 to allow up to a state-set cap), so counsel should overlay state-specific dollar thresholds. Endorsement claims about a state insurance department are direct § 4(B) violations everywhere. Borderline omissions: 'A++ rated' / 'A.M. Best A-rated' (true claims are typically OK but format requirements vary — counsel-reference).
- **Candidate phrases to red-line (17):**
  - [ ] `guaranteed approval`
  - [ ] `guaranteed issue`
  - [ ] `guaranteed acceptance`
  - [ ] `everyone qualifies`
  - [ ] `everyone is approved`
  - [ ] `no medical questions`
  - [ ] `no health questions`
  - [ ] `free insurance`
  - [ ] `free policy`
  - [ ] `lowest rates guaranteed`
  - [ ] `lowest premium guaranteed`
  - [ ] `approved by the insurance department`
  - [ ] `endorsed by the insurance department`
  - [ ] `endorsed by the insurance commissioner`
  - [ ] `we'll rebate your premium`
  - [ ] `premium rebate`
  - [ ] `cash back on your premium`

#### Unfair Claims Settlement Practices — NAIC Model #900 / O.C.G.A. § 33-6-34 (DRAFT) (`unfair-claims-settlement-practices`)
- **Severity:** 🔴 blocking
- **Category:** claims-handling
- **Citation:** NAIC Unfair Claims Settlement Practices Act (Model #900) § 4; adopted in GA at O.C.G.A. § 33-6-34 (Unfair claim settlement practices)
  — https://law.justia.com/codes/georgia/title-33/chapter-6/article-1/section-33-6-34/ (read 2026-06-03)
- **Safe rewrite:** Re-frame claim communications to meet the prompt, good-faith, explained-basis standard: acknowledge the claim promptly, state that you will investigate based on available information, and — for any denial or reduced offer — give a specific, reasonable explanation tied to the policy provisions and facts. Never present an offer as 'take it or leave it,' refuse to explain, or invite the insured to sue rather than settle a reasonably clear claim.
- **Drafter notes:** GA text could not be machine-fetched 2026-06-03 (state mirrors return 403); substance is the NAIC Model #900 § 4 paraphrase — counsel MUST replace with the canonical O.C.G.A. § 33-6-34 wording and confirm the 'general business practice' threshold language, which materially affects whether a single draft phrase is actionable. MOST AMBIGUOUS rule in this corpus: many of these phrases are context-sensitive (a producer relaying a carrier's denial is not itself the violator). Counsel to decide which, if any, are safe as literal-match vs counsel-reference. Companion: per-state claim-handling timelines in `ga-claim-handling-timelines-literal.ts`.
- **Candidate phrases to red-line (10):**
  - [ ] `take it or leave it`
  - [ ] `this is our final offer`
  - [ ] `we don't have to explain`
  - [ ] `we do not have to explain`
  - [ ] `we are not required to explain`
  - [ ] `your claim is denied`
  - [ ] `claim denied, no appeal`
  - [ ] `we won't investigate`
  - [ ] `we will not investigate`
  - [ ] `sue us if you want`

#### Replacement cost vs. actual cash value (ACV) — coverage representation (DRAFT) (`replacement-cost-vs-acv`)
- **Severity:** 🔴 blocking
- **Category:** coverage-representation
- **Citation:** NAIC Model #880 § 4(A) (misrepresentation of policy terms); GA O.C.G.A. § 33-6-4; unfair-claims overlay O.C.G.A. § 33-6-34
  — https://content.naic.org/sites/default/files/MO880.pdf (read 2026-06-03)
- **Safe rewrite:** State the loss-settlement basis exactly as the policy provides it. If the policy is ACV, say settlement is 'actual cash value (replacement cost less depreciation).' If it is replacement cost, note whether recoverable depreciation is paid only after repair/replacement and any coverage cap. Do not use absolute words ('full', 'guaranteed', 'brand new', '100%') unless the policy is a true guaranteed-replacement-cost form. When unsure of the basis, point the insured to the declarations page rather than characterizing it.
- **Drafter notes:** Drafted 2026-06-03. Directly addresses the corpus task's named gap (replacement-cost vs ACV phrasing). Counsel: confirm whether 'guaranteed replacement cost' should be allowed when the policy genuinely carries a GRC endorsement (true positive vs. false positive depends on the form). Consider a companion counsel-reference rule for ACV-misuse in the OTHER direction (describing RCV coverage as paying only depreciated value, which under-promises). These are candidates — sentinel does not fire.
- **Candidate phrases to red-line (9):**
  - [ ] `full replacement cost`
  - [ ] `guaranteed replacement cost`
  - [ ] `we'll replace it brand new`
  - [ ] `we will replace it brand new`
  - [ ] `brand new for old`
  - [ ] `no depreciation taken`
  - [ ] `we pay to rebuild no matter the cost`
  - [ ] `you're covered for the full cost to rebuild`
  - [ ] `100% replacement`

## 3. Candidate regex triggers — counsel red-line

_Deterministic patterns for cases a literal phrase list can't express. Each shows the string it must match and a near-miss it must not._

#### NAIC Model #880 § 4 — candidate insurance advertising triggers (DRAFT) (`insurance-utpa-candidates`)
- [ ] **Pattern:** `/endorsed\b[^.!?\n]{0,30}\b(insurance (department|commissioner)|state insurance)/i` — 🔴 blocking
  - Catches claims of state insurance-regulator endorsement (a § 4(B) per-se violation everywhere) the literal list misses, e.g. 'endorsed by your state insurance regulator'.
  - **Matches (intended):** "This plan is endorsed by the state insurance department."
  - **Does NOT match (guard):** "This plan is endorsed by leading financial advisors."

#### Unfair Claims Settlement Practices — NAIC Model #900 / O.C.G.A. § 33-6-34 (DRAFT) (`unfair-claims-settlement-practices`)
- [ ] **Pattern:** `/deny\w*\b[^.!?\n]{0,40}\b(without|no)\b[^.!?\n]{0,20}\b(reason|explanation|basis)/i` — 🔴 blocking
  - Catches denial-without-explanation phrasing (§ 4(8) / § 33-6-34 violation) the literal list misses, e.g. 'denying the claim with no explanation given'.
  - **Matches (intended):** "We are denying the claim with no explanation required."
  - **Does NOT match (guard):** "We approved the claim without any further documentation."

#### Georgia claim-handling timelines — prompt acknowledgment / payment (DRAFT) (`ga-claim-handling-timelines`)
- [ ] **Pattern:** `/(pay|payment|settle|acknowledge|decide|claim)[^.!?\n]{0,40}within\s+\d{1,3}\s+(business\s+)?days?|within\s+\d{1,3}\s+(business\s+)?days?[^.!?\n]{0,40}(pay|payment|settle|acknowledge|decide|claim)/i` — 🟡 advisory
  - Catches a stated claim timeline in either order ('pay your claim within 90 days' or 'within 90 days we will pay') so the operator can confirm it matches the governing GA rule — flag is 'verify accuracy', not 'remove'.
  - **Matches (intended):** "We will pay your claim within 90 days of approval."
  - **Does NOT match (guard):** "Please respond within 5 days to confirm your appointment."

#### Replacement cost vs. actual cash value (ACV) — coverage representation (DRAFT) (`replacement-cost-vs-acv`)
- [ ] **Pattern:** `/\b(full|guaranteed|100%?)\b[^.!?\n]{0,15}\breplacement\b/i` — 🔴 blocking
  - Catches absolute replacement-cost promises ('full replacement', 'guaranteed replacement', '100% replacement') that must be confirmed against the policy's valuation basis.
  - **Matches (intended):** "Your home has full replacement coverage with no limit."
  - **Does NOT match (guard):** "We offer a full range of coverage options to compare."

## 4. Counsel-reference rules — substantive law, never auto-flagged

#### Georgia anti-rebating — Unfair Insurance Trade Practices Act (`ga-anti-rebating`)
- **Severity:** 🔴 blocking · **Status:** draft
- **Citation:** O.C.G.A. § 33-6-4 (Unfair Trade Practices Act — rebating subsection)
  — https://law.justia.com/codes/georgia/title-33/chapter-6/article-1/section-33-6-4/ (read 2026-05-12)
- **Summary:** Insurance producer may not offer any rebate of premium, special favor or advantage, or any valuable consideration not specified in the policy as an inducement to insure.
- **Safe rewrite / guidance:** Strike any offer of value not specified in the policy as an inducement to buy — premium rebates, gift cards, 'cash back,' or special favors. Permissible value-added services are narrow and state-capped (NAIC Model #880 was amended 2020); describe only services that fall under Georgia's allowance and never frame them as a reward for purchasing.
- **Drafter notes:** Counsel: please confirm whether the operative subsection is (b)(7) or (b)(8) of O.C.G.A. § 33-6-4 (rendering differs across published copies) and replace placeholder with the canonical statutory text.

> [UNVERIFIED — needs counsel] Substance: under the Georgia Unfair Trade Practices Act (O.C.G.A. § 33-6-4), it is an unfair trade practice for an insurer, producer, or other licensee, knowingly, to permit or offer to make or make any insurance contract or agreement as to such contract other than as plainly expressed in the contract issued thereon, or to pay, allow, give, or offer to pay, allow, or give, directly or indirectly, as an inducement to such insurance contract, any rebate of premiums, any special favor or advantage in the dividends or other benefits, or any valuable consideration or inducement whatever not specified in the contract.

#### Georgia producer licensing — license required to sell or solicit insurance (`ga-producer-licensing`)
- **Severity:** ⚪ info · **Status:** draft
- **Citation:** O.C.G.A. Title 33, Chapter 23 (Agents, Subagents, Counselors, and Adjusters)
  — https://law.justia.com/codes/georgia/title-33/chapter-23/ (read 2026-05-12)
- **Summary:** A person may not sell, solicit, or negotiate insurance in Georgia for any class of insurance unless that person is licensed by the Commissioner for that line of authority.
- **Safe rewrite / guidance:** Do not solicit, sell, or negotiate insurance in a state, or for a line of authority, the producer is not licensed and appointed for. Marketing copy should not imply coverage the producer cannot place; quote only lines/states within the active license.
- **Drafter notes:** Counsel: please replace placeholder with the canonical 'license required' provision (commonly O.C.G.A. § 33-23-1 or § 33-23-4) and confirm whether the corpus should track each line-of-authority subsection separately.

> [UNVERIFIED — needs counsel] Substance: under O.C.G.A. Title 33, Chapter 23, a person may not sell, solicit, or negotiate insurance in this state for any class or classes of insurance unless the person is licensed for that line of authority in accordance with the chapter. The chapter sets standards for examination, appointment, continuing education, license suspension/revocation, and reciprocal licensing under the NAIC Producer Licensing Model Act.

#### Office of Commissioner of Insurance and Safety Fire — Georgia regulator (`ga-commissioner-of-insurance`)
- **Severity:** ⚪ info · **Status:** draft
- **Citation:** O.C.G.A. Title 33, Chapter 2 (Office of Commissioner of Insurance)
  — https://oci.georgia.gov/ (read 2026-05-12)
- **Summary:** The Georgia Office of Commissioner of Insurance and Safety Fire administers Title 33 (the Insurance Code), licenses producers, examines insurers, and adopts regulations under O.C.G.A. § 33-2.
- **Safe rewrite / guidance:** No draft rewrite — scope/routing rule only. Sentinel uses it to direct flagged Georgia insurance drafts to the correct regulator (Office of Commissioner of Insurance and Safety Fire).
- **Drafter notes:** This rule is scope/routing only — sentinel uses it to direct flags to the GA Commissioner's office. Counsel: please confirm rulemaking citation.

> [UNVERIFIED — needs counsel] Substance: O.C.G.A. § 33-2-1 establishes the office of Commissioner of Insurance and vests the Commissioner with authority to administer the Insurance Code (Title 33). The Commissioner has rulemaking authority (O.C.G.A. § 33-2-9), examination authority over insurers (O.C.G.A. § 33-2-11), and authority to license producers under Chapter 23. Regulations are codified at Rules of the Department of Insurance, Chapter 120.

#### NAIC Producer Licensing Model Act — grounds for discipline (`producer-ethics-naic-model`)
- **Severity:** ⚪ info · **Status:** draft
- **Citation:** NAIC Producer Licensing Model Act (Model #218), Section 12 (Grounds for Discipline)
  — https://content.naic.org/sites/default/files/model-laws.pdf (read 2026-05-12)
- **Summary:** States adopting the NAIC Producer Licensing Model Act may revoke or refuse to renew a producer's license for fraudulent, coercive, or dishonest practices, including using fraudulent or coercive practices in conducting business and demonstrating untrustworthiness or financial irresponsibility.
- **Safe rewrite / guidance:** No draft rewrite — this is a producer-conduct/discipline reference, not a content rule. Use it as context when a draft suggests misrepresentation, coercion, or mishandling of client funds, which independently implicate the misrepresentation and unfair-claims rules.
- **Drafter notes:** Counsel: please pull the NAIC Model #218 Section 12 text directly and replace placeholder. GA's adoption sits in O.C.G.A. § 33-23-21 — recommend adding a state-specific companion rule citing the GA section.

> [UNVERIFIED — needs counsel] Substance: NAIC Producer Licensing Model Act Section 12 enumerates grounds on which the insurance regulator may place on probation, suspend, revoke, or refuse to issue or renew a producer license, or levy a civil penalty. Listed grounds include: providing incorrect, misleading, incomplete, or materially untrue information in the license application; violating insurance laws or regulations of any other state; obtaining or attempting to obtain a license through misrepresentation or fraud; improperly withholding, misappropriating, or converting any moneys received in the course of doing insurance business; intentionally misrepresenting the terms of an actual or proposed insurance contract or application for insurance; having been convicted of a felony; having admitted or been found to have committed any insurance unfair trade practice or fraud; using fraudulent, coercive, or dishonest practices, or demonstrating incompetence, untrustworthiness, or financial irresponsibility.

#### Georgia claim-handling timelines — prompt acknowledgment / payment (DRAFT) (`ga-claim-handling-timelines`)
- **Severity:** 🟡 advisory · **Status:** draft
- **Citation:** O.C.G.A. § 33-6-34 (prompt acknowledgment/decision duties); O.C.G.A. § 33-4-6 (bad-faith failure to pay; penalty + attorney fees); Rules of the GA Dept. of Insurance, Chapter 120-2
  — https://oci.georgia.gov/ (read 2026-06-03)
- **Summary:** Georgia requires reasonably prompt acknowledgment of, investigation of, and decision on insurance claims, with bad-faith failure-to-pay exposure under O.C.G.A. § 33-4-6. Drafts that state a claim timeline (which must be accurate) or imply there is no deadline are flagged for confirmation. Timelines are state-specific; this rule is Georgia-only.
- **Safe rewrite / guidance:** State a claim timeline only if it matches the governing Georgia rule for that line of insurance; otherwise say 'within the time required by Georgia law.' Never imply there is no deadline or that the insurer may take unlimited time — that contradicts O.C.G.A. § 33-6-34 and the § 33-4-6 bad-faith standard. When relaying a carrier decision, attribute the timeline to the carrier/policy, not to the producer.
- **Drafter notes:** Day-counts NOT verified 2026-06-03 (GA regulation text not machine-fetchable). Counsel MUST supply the operative Chapter 120-2 acknowledgment/investigation/payment day-counts per line, and confirm the § 33-4-6 60-day demand window and penalty figures. This rule is STATE-SCOPED to GA — `feedback`/portability note: add a sibling `<state>-claim-handling-timelines-literal.ts` for each new launch state rather than parameterizing one rule, so each state's citation stands alone for audit. The timeline regex is 'verify accuracy' severity 'advisory', not a prohibition.

> [UNVERIFIED — needs counsel] Substance: Georgia law requires insurers to acknowledge and act reasonably promptly upon claim communications and to affirm or deny coverage within a reasonable time after proof of loss (O.C.G.A. § 33-6-34). O.C.G.A. § 33-4-6 imposes a penalty (up to 50% of the liability or $5,000, whichever is greater) plus reasonable attorney's fees when an insurer in bad faith refuses to pay a covered loss within 60 days after a demand. Specific acknowledgment / investigation / payment day-counts are set by the Commissioner's regulations (Chapter 120-2) and vary by line of insurance. Counsel to confirm the operative day-counts for each line before sentinel surfaces a timeline-accuracy flag.

## 5. Questions for counsel

**Corpus open questions (drafter → counsel):**

- [ ] Confirm O.C.G.A. § 33-6-4 subsection numbering for the rebating prohibition (some sources put it at (b)(7), others (b)(8)) — citation marked unverified pending counsel; severity 'blocking'.
- [ ] GA producer licensing scope and CE requirements (O.C.G.A. § 33-23) flagged unverified — counsel to confirm exact prohibition wording and whether to track each line-of-authority subsection separately.
- [ ] NAIC Producer Licensing Model Act (Model #218 § 12) references are summarized — not direct excerpts. Counsel to pull NAIC text and add the GA adoption (O.C.G.A. § 33-23-21) as a companion.
- [ ] CLAIMS HANDLING (new 2026-06-03): `unfair-claims-settlement-practices-literal.ts` ships NAIC Model #900 § 4 / O.C.G.A. § 33-6-34 (severity 'blocking') with candidate triggers for denial-without-explanation and lowball framing. The GA statutory text could NOT be machine-fetched (state mirrors return 403) — substance is the Model #900 paraphrase. MOST AMBIGUOUS rule in the corpus: counsel MUST replace with canonical O.C.G.A. § 33-6-34 wording, confirm the 'general business practice' threshold (which determines whether a single phrase is actionable), and decide which phrases are safe as literal-match vs counsel-reference given that a producer relaying a carrier's denial is not necessarily the violator.
- [ ] CLAIM TIMELINES (new 2026-06-03): `ga-claim-handling-timelines-literal.ts` (counsel-reference, severity 'advisory') cites O.C.G.A. § 33-6-34 + § 33-4-6 (bad-faith failure to pay, 60-day demand, penalty up to 50%/$5,000 + fees) + Dept. of Insurance Chapter 120-2. Day-counts NOT verified — counsel MUST supply the operative acknowledgment/investigation/payment day-counts PER LINE. Timelines are STATE-SPECIFIC: corpus covers GA only; add a sibling `<state>-claim-handling-timelines-literal.ts` per launch state rather than parameterizing one rule.
- [ ] REPLACEMENT COST vs ACV (new 2026-06-03): `replacement-cost-vs-acv-literal.ts` (severity 'blocking') flags absolute replacement-cost promises ('full replacement', 'guaranteed replacement cost', '100% replacement', 'brand new for old') that may misstate the policy's valuation basis under O.C.G.A. § 33-6-4 / § 33-6-34. Counsel: confirm whether 'guaranteed replacement cost' is permissible when a genuine GRC endorsement is in force, and whether to add the reverse-direction rule (describing RCV coverage as paying only depreciated value).
- [ ] CANDIDATE ADVERTISING TRIGGERS (2026-05-25 wave): `unfair-trade-practices-candidates-literal.ts` ships phrases from NAIC Model #880 § 4(A)/(B)/(I) — e.g. 'guaranteed approval', 'free insurance', 'endorsed by the insurance commissioner'. Counsel decision: 'guaranteed approval'/'guaranteed issue' are legitimate for genuinely guaranteed-issue products (final expense, Medigap) — advise whether to scope to non-GI product lines.
- [ ] REBATING: NAIC Model #880 was amended 2020 to allow modest value-added services with state-set dollar caps. Counsel to overlay per-state thresholds before flipping the rebating phrases ('premium rebate', 'cash back on your premium') to verified.

**Per-rule drafter notes (most ambiguous first):**

- **Unfair Claims Settlement Practices — NAIC Model #900 / O.C.G.A. § 33-6-34 (DRAFT)** (`unfair-claims-settlement-practices`): GA text could not be machine-fetched 2026-06-03 (state mirrors return 403); substance is the NAIC Model #900 § 4 paraphrase — counsel MUST replace with the canonical O.C.G.A. § 33-6-34 wording and confirm the 'general business practice' threshold language, which materially affects whether a single draft phrase is actionable. MOST AMBIGUOUS rule in this corpus: many of these phrases are context-sensitive (a producer relaying a carrier's denial is not itself the violator). Counsel to decide which, if any, are safe as literal-match vs counsel-reference. Companion: per-state claim-handling timelines in `ga-claim-handling-timelines-literal.ts`.
- **Georgia anti-rebating — Unfair Insurance Trade Practices Act** (`ga-anti-rebating`): Counsel: please confirm whether the operative subsection is (b)(7) or (b)(8) of O.C.G.A. § 33-6-4 (rendering differs across published copies) and replace placeholder with the canonical statutory text.
- **Georgia producer licensing — license required to sell or solicit insurance** (`ga-producer-licensing`): Counsel: please replace placeholder with the canonical 'license required' provision (commonly O.C.G.A. § 33-23-1 or § 33-23-4) and confirm whether the corpus should track each line-of-authority subsection separately.
- **NAIC Producer Licensing Model Act — grounds for discipline** (`producer-ethics-naic-model`): Counsel: please pull the NAIC Model #218 Section 12 text directly and replace placeholder. GA's adoption sits in O.C.G.A. § 33-23-21 — recommend adding a state-specific companion rule citing the GA section.
- **NAIC Model #880 § 4 — candidate insurance advertising triggers (DRAFT)** (`insurance-utpa-candidates`): Drafted 2026-05-25. 'Guaranteed approval/issue/acceptance' phrases are direct Model #880 § 4(A) misrepresentation targets EXCEPT where the policy is genuinely guaranteed-issue (some final-expense / Medigap products). Counsel should consider whether to scope this rule to non-guaranteed-issue product lines via category metadata or a follow-on counsel-reference rule. Rebating phrases are direct § 4(I) targets; many states permit modest 'value-added services' (NAIC Model #880 was amended 2020 to allow up to a state-set cap), so counsel should overlay state-specific dollar thresholds. Endorsement claims about a state insurance department are direct § 4(B) violations everywhere. Borderline omissions: 'A++ rated' / 'A.M. Best A-rated' (true claims are typically OK but format requirements vary — counsel-reference).
- **Replacement cost vs. actual cash value (ACV) — coverage representation (DRAFT)** (`replacement-cost-vs-acv`): Drafted 2026-06-03. Directly addresses the corpus task's named gap (replacement-cost vs ACV phrasing). Counsel: confirm whether 'guaranteed replacement cost' should be allowed when the policy genuinely carries a GRC endorsement (true positive vs. false positive depends on the form). Consider a companion counsel-reference rule for ACV-misuse in the OTHER direction (describing RCV coverage as paying only depreciated value, which under-promises). These are candidates — sentinel does not fire.
- **Office of Commissioner of Insurance and Safety Fire — Georgia regulator** (`ga-commissioner-of-insurance`): This rule is scope/routing only — sentinel uses it to direct flags to the GA Commissioner's office. Counsel: please confirm rulemaking citation.
- **Georgia claim-handling timelines — prompt acknowledgment / payment (DRAFT)** (`ga-claim-handling-timelines`): Day-counts NOT verified 2026-06-03 (GA regulation text not machine-fetchable). Counsel MUST supply the operative Chapter 120-2 acknowledgment/investigation/payment day-counts per line, and confirm the § 33-4-6 60-day demand window and penalty figures. This rule is STATE-SCOPED to GA — `feedback`/portability note: add a sibling `<state>-claim-handling-timelines-literal.ts` for each new launch state rather than parameterizing one rule, so each state's citation stands alone for audit. The timeline regex is 'verify accuracy' severity 'advisory', not a prohibition.
