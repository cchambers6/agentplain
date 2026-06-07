# Counsel handoff packet — Title & Escrow compliance corpus

> **DRAFT — not legal advice.** This packet is a fleet-drafted compliance corpus for attorney review. No rule fires on customer drafts until counsel red-lines it AND the vertical is enabled via `COMPLIANCE_CORPUS_COUNSEL_REVIEWED`. Sentinel ADVISES; it never blocks a send.

## Status

- **Vertical:** `title-escrow`
- **Corpus status:** DRAFT
- **Last reviewed:** 2026-06-06
- **Counsel reviewer:** _none yet_
- **Packet generated:** 2026-06-06

### Coverage at a glance

| Bucket | Count |
| --- | --- |
| Live literal triggers (firing today) | 0 |
| Candidate literal triggers (to red-line) | 22 |
| Candidate regex triggers (to red-line) | 4 |
| Counsel-reference rules | 5 |
| Open questions | 8 |

## 1. Live literal triggers (firing on drafts today)

_None. This corpus is DRAFT — no rule is counsel-verified, so the scanner fires on nothing yet. Phrases below are candidates for review._

## 2. Candidate literal triggers — counsel red-line, phrase by phrase

_Sentinel does NOT fire on these. Check a box to approve a phrase as a literal-match trigger; strike, reword, or demote to counsel-reference otherwise._

#### RESPA § 8 — candidate title/escrow referral-fee triggers (DRAFT) (`respa-section-8-title-escrow-candidates`)
- **Severity:** 🔴 blocking
- **Category:** referral-arrangements
- **Citation:** 12 USC § 2607 (RESPA § 8); 12 CFR § 1024.14 and § 1024.15
  — https://www.consumerfinance.gov/rules-policy/regulations/1024/14/ (read 2026-06-06)
- **Safe rewrite:** Strike any compensation tied to a referral. 'Referral fee', 'kickback', 'thing of value', and 'pay you per closing' in title/escrow outreach are per-se § 8(a) exposure — remove them entirely. 'Marketing services agreement', 'co-marketing agreement', and 'desk rental' are NOT per-se illegal but are the CFPB's primary § 8 enforcement vehicles; route these to operator review to confirm the arrangement pays only fair market value for services actually performed (§ 8(c)(2)) and is not priced on referral volume. Use a Form RESPA-1 affiliated-business-arrangement disclosure for any ownership-based referral relationship.
- **Drafter notes:** Drafted 2026-05-25. 'Referral fee', 'kickback', and 'thing of value' are direct § 8(a) statutory-text triggers — any literal use of these phrases in title/escrow outreach is a flag. 'Marketing services agreement' (MSA) and 'co-marketing agreement' are NOT per-se illegal but are the CFPB's primary RESPA-§ 8 enforcement vehicle (see PHH Corp. and Wells Fargo MSA actions, 2014–2015) — flagging them prompts the operator to confirm the arrangement meets the § 8(c)(2) bona-fide-services and fair-market-value standards. 'Desk rental' similarly: legitimate per CFPB FAQ if rent is at FMV for actual desk usage; literal-match flag prompts confirmation. Phrases intentionally held back for counsel: 'affiliated business arrangement' (legitimate term of art with required disclosure form — recommend counsel-reference rule to verify Form RESPA-1 is attached, not a literal-match alarm); specific dollar amounts (require structured parsing).
- **Candidate phrases to red-line (14):**
  - [ ] `referral fee`
  - [ ] `referral bonus`
  - [ ] `kickback`
  - [ ] `thing of value`
  - [ ] `we'll pay you for the referral`
  - [ ] `we will pay you for referrals`
  - [ ] `pay you per closing`
  - [ ] `pay per closing`
  - [ ] `split the fee`
  - [ ] `fee split`
  - [ ] `marketing services agreement`
  - [ ] `co-marketing agreement`
  - [ ] `desk rental`
  - [ ] `lead purchase agreement`

#### Wire-fraud risk — wiring-instruction language in closing comms (`wire-fraud-instructions`)
- **Severity:** 🟡 advisory
- **Category:** wire-fraud
- **Citation:** ALTA Rapid Response Plan for Wire Fraud Incidents + ALTA Sample Wire Fraud Warnings (verify wiring instructions by phone to a known number before transmitting funds)
  — https://www.alta.org/topics/wire-fraud (read 2026-06-06)
- **Safe rewrite:** Never transmit or change wiring instructions by email. Route any draft touching wire instructions to operator review to confirm (1) the instructions were verified by an outbound phone call to a KNOWN, trusted number for the settlement office — not a number from the email — and (2) the standard ALTA wire-fraud warning is included. Tell recipients to independently call your office to confirm any instructions and to treat any 'updated/changed' instructions as suspicious until verbally verified.
- **Drafter notes:** Drafted 2026-06-06. Anchor authority verified live: ALTA Rapid Response Plan + Sample Wire Fraud Warnings (alta.org/topics/wire-fraud) — instruct verbal verification to a known number before transmitting funds. The GA state-statute mirror is intentionally [UNVERIFIED]: a live search found NO Georgia statute mandating a wire-fraud disclosure (GA is caveat-emptor); the related GA 'good funds' >$5,000 wire rule is a control, not a disclosure mandate. Counsel decision: 'wire the funds to' style phrases are advisory (lawful, but condition the phone-verification + warning duty), not blocking — severity is 'advisory' accordingly. Consider tightening the second regex if benign 'bring the funds' / 'send the documents to' copy false-positives in practice.
- **Candidate phrases to red-line (8):**
  - [ ] `wire your funds to`
  - [ ] `updated wiring instructions`
  - [ ] `change in wiring instructions`
  - [ ] `new wire instructions`
  - [ ] `send the wire to`
  - [ ] `updated wire instructions`
  - [ ] `revised wiring instructions`
  - [ ] `please wire the funds to`

## 3. Candidate regex triggers — counsel red-line

_Deterministic patterns for cases a literal phrase list can't express. Each shows the string it must match and a near-miss it must not._

#### RESPA § 8 — candidate title/escrow referral-fee triggers (DRAFT) (`respa-section-8-title-escrow-candidates`)
- [ ] **Pattern:** `/\$?\d+[^.!?\n]{0,20}\bfor (each|every|the)?\s*referr/i` — 🔴 blocking
  - Catches a dollar/number amount tied to referrals that the fixed phrase list misses — e.g. '$50 for each referral', '100 for every referral' — a § 8(a) thing-of-value-for-referral pattern.
  - **Matches (intended):** "We pay $50 for each referral you send our way."
  - **Does NOT match (guard):** "We answer every question you have about the closing process."
- [ ] **Pattern:** `/(thing|things|something) of value[^.!?\n]{0,40}\bfor[^.!?\n]{0,20}\brefer/i` — 🔴 blocking
  - Catches the § 8(a) statutory construction 'thing of value ... for ... referral' even when split across words the literal 'thing of value' phrase would still match but this pins the for-referral linkage counsel cares about.
  - **Matches (intended):** "We can offer a thing of value in exchange for every closing you refer to us."
  - **Does NOT match (guard):** "We place great value on the trust our clients refer to throughout the deal."

#### Wire-fraud risk — wiring-instruction language in closing comms (`wire-fraud-instructions`)
- [ ] **Pattern:** `/(updated|revised|changed|new)\s+(wire|wiring)\s+(instructions|details|info)/i` — 🟡 advisory
  - Catches any 'updated/revised/changed/new wire(ing) instructions/details/info' construction — the classic BEC lure — beyond the fixed phrase list.
  - **Matches (intended):** "Per our last call, here are the revised wire details for closing."
  - **Does NOT match (guard):** "Here are the revised closing details and the meeting time."
- [ ] **Pattern:** `/(wire|send)\s+(your |the )?(funds|money|payment|balance)\s+to\b/i` — 🟡 advisory
  - Catches a direct instruction to wire/send funds to an account — should never go out without independent phone verification and the wire-fraud warning.
  - **Matches (intended):** "Please wire the funds to the account on the attached form today."
  - **Does NOT match (guard):** "Please bring the funds to the closing table on Friday."

## 4. Counsel-reference rules — substantive law, never auto-flagged

#### RESPA Section 9 — seller may not require particular title insurer (`respa-section-9-seller-title-insurance`)
- **Severity:** 🔴 blocking · **Status:** draft
- **Citation:** 12 USC § 2608
  — https://www.law.cornell.edu/uscode/text/12/2608 (read 2026-06-06)
- **Summary:** No seller of property that will be purchased with the assistance of a federally related mortgage loan may require directly or indirectly, as a condition to selling the property, that title insurance covering the property be purchased by the buyer from any particular title company.
- **Safe rewrite / guidance:** Never condition the sale on the buyer using a particular title company. Strike any 'buyer must use [title company]' or 'closing must go through [our title agency]' language from seller-side drafts. State that the buyer is free to select their own title insurer; you may recommend providers but cannot require one. Violation exposes the seller to treble damages on all title charges.
- **Drafter notes:** Verified against Cornell LII 12 USC § 2608 on 2026-06-06; subsections (a) and (b) match the published text verbatim. counsel-reference (not literal-match): a violation is conduct ('require ... as a condition to selling'), not a fixed phrase, so a literal trigger list would over- or under-fire. Counsel may later authorize a narrow regex on 'must use our title' / 'required to close with' patterns if false-positive rate is acceptable.

> (a) Imposition of condition prohibited
> No seller of property that will be purchased with the assistance of a federally related mortgage loan shall require directly or indirectly, as a condition to selling the property, that title insurance covering the property be purchased by the buyer from any particular title company.
> 
> (b) Liability of seller for violation
> Any seller who violates the provisions of subsection (a) shall be liable to the buyer in an amount equal to three times all charges made for such title insurance.

#### RESPA Section 8 — anti-kickback (cross-reference to mortgage corpus) (`title-escrow-respa-section-8-crossref`)
- **Severity:** 🔴 blocking · **Status:** draft
- **Citation:** 12 USC § 2607(a)–(b); see also 12 CFR § 1024.14
  — https://www.law.cornell.edu/uscode/text/12/2607 (read 2026-06-06)
- **Summary:** RESPA Section 8 anti-kickback prohibition applies to title and escrow settlement service providers. Single literal lives in the mortgage corpus.
- **Safe rewrite / guidance:** Apply the same anti-kickback fix as the mortgage RESPA § 8 rule: strike any exchange of value tied to a referral of settlement-service business. Title/escrow marketing arrangements with referring brokers or lenders must pay only fair market value for services actually performed and never be contingent on referral volume.
- **Drafter notes:** Counsel: title/escrow agents often face Section 8 exposure on marketing arrangements with referring brokers — confirm cross-corpus loading semantics are acceptable, otherwise duplicate the literal in this file.

> [CROSS-REFERENCE] Title and escrow drafts (closing protection letter language, lender-instructions exchanges, marketing co-arrangements with realtors and lenders) are evaluated against the RESPA Section 8 anti-kickback literal in the mortgage corpus. See:
> 
>   lib/agents/sentinel/corpus/mortgage/respa-section-8-literal.ts
> 
> That file is the single source of truth. Sentinel automatically loads it when scanning a title-escrow workspace; no duplicate text lives here.

#### Georgia title insurance — Title 33 regulation (`ga-title-insurance-regulation`)
- **Severity:** ⚪ info · **Status:** draft
- **Citation:** O.C.G.A. § 33-7-8 (title insurance); Rules of the Department of Insurance, Chapter 120
  — https://law.justia.com/codes/georgia/title-33/chapter-7/ (read 2026-06-06)
- **Summary:** Title insurance in Georgia is regulated by the Commissioner of Insurance under O.C.G.A. § 33-7-8 and related Title 33 provisions; title insurers must be licensed and rates and forms are subject to filing/review.
- **Safe rewrite / guidance:** Scope/licensure rule — no draft-text fix. Confirm the title insurer/agent holds a current GA certificate of authority and that any rate or form referenced is on file with the Commissioner before drafts reference GA title-insurance pricing or coverage.
- **Drafter notes:** Counsel: please pull the operative text of O.C.G.A. § 33-7-8 and replace placeholder. Confirm whether the Title Insurance Agents licensing structure (separate from the title insurer itself) is captured at a different citation that should also be added.

> [UNVERIFIED — needs counsel] Substance: O.C.G.A. § 33-7-8 places title insurance under the Title 33 (Insurance) regulatory umbrella. Title insurance is one of the kinds of insurance authorized under the Code. Title insurers must obtain a certificate of authority from the Commissioner, file rates and forms, and comply with the Unfair Trade Practices provisions (O.C.G.A. § 33-6) that apply to all insurers. The Department of Insurance has further rulemaking authority over title insurers via Chapter 120 of the Department rules.

#### ALTA Best Practices — seven-pillar framework (4.2) (`alta-best-practices-seven-pillars`)
- **Severity:** 🟡 advisory · **Status:** draft
- **Citation:** ALTA Title Insurance and Settlement Company Best Practices, Framework 4.2 (effective 2025-08-19), Pillars 1–7
  — https://www.alta.org/best-practices/ (read 2026-06-06)
- **Summary:** ALTA's Title Insurance and Settlement Company Best Practices framework enumerates seven pillars (licensing; escrow trust accounting; protecting NPI; settlement processes; policy production; insurance & fidelity coverage; consumer complaints). Drafts that contradict a pillar — implying commingled escrow, missed three-way reconciliation, NPI disclosure, or no complaint process — are counsel-grade exposures even though the framework is an industry standard, not a statute.
- **Safe rewrite / guidance:** Confirm the draft does not contradict any pillar before it goes out: never imply escrow funds are commingled with operating funds or that reconciliation is skipped (Pillar 2); never transmit a consumer's NPI by unsecured channel (Pillar 3); route any consumer complaint through the documented complaint process (Pillar 7). When in doubt, attach the operational control that satisfies the pillar rather than describing a shortcut.
- **Drafter notes:** Pillar set verified live against alta.org on 2026-06-06: the current framework is version 4.2, effective 2025-08-19, with seven pillars (Licensing; Escrow Trust Accounting; Protecting NPI; Settlement Processes; Policy Production; Insurance & Fidelity Coverage; Consumer Complaints). Pillar NAMES are authentic published headings; the substance summaries under each are drafter paraphrase — counsel should pull the canonical ALTA Best Practices 4.2 PDF and confirm each summary, especially the Pillar 2 three-way-reconciliation cadence and the Pillar 3 NPI safeguards which intersect the wire-fraud rule (`wire-fraud-instructions`).

> ALTA Best Practices 4.2 — the seven pillars (pillar names per alta.org, accessed 2026-06-06; substance summaries below are drafter paraphrase pending counsel pull of the canonical framework PDF):
> 
> Pillar 1 — Licensing: Establish and maintain current license(s) as required to conduct the business of title insurance and settlement services.
> 
> Pillar 2 — Escrow Trust Accounting: Adopt and maintain appropriate written procedures and controls for escrow trust accounts allowing for electronic verification of reconciliation — including segregated trust accounts, monthly three-way reconciliation (bank balance, book balance, trial balance of open files), and restricted, authorized-only access.
> 
> Pillar 3 — Protecting NPI (Non-Public Personal Information): Adopt and maintain a written privacy and information security plan to protect Non-Public Personal Information as required by local, state and federal law.
> 
> Pillar 4 — Settlement Processes: Adopt standard real estate settlement procedures and policies that help ensure compliance with Federal and State Consumer Financial Laws as applicable to the settlement process.
> 
> Pillar 5 — Policy Production: Adopt and maintain written procedures related to title policy production, delivery, reporting and premium remittance.
> 
> Pillar 6 — Insurance & Fidelity Coverage: Maintain appropriate professional liability (errors & omissions) insurance and fidelity coverage.
> 
> Pillar 7 — Consumer Complaints: Adopt and maintain written procedures for receiving and resolving consumer complaints.

#### CFPB RESPA § 8 enforcement against title/settlement providers (reference) (`cfpb-title-respa-enforcement`)
- **Severity:** ⚪ info · **Status:** draft
- **Citation:** CFPB enforcement actions under RESPA § 8 (12 USC § 2607): Lighthouse Title (2014 consent order, marketing services agreements); Borders & Borders, PLC (2013, sham affiliated business arrangements); PHH Corp. (2015); CFPB Takes Action Against Mortgage Kickback Agreements (2015, Wells Fargo / JPMorgan loan officers via title-company MSAs)
  — https://www.consumerfinance.gov/about-us/newsroom/cfpb-takes-action-against-mortgage-kickback-agreements/ (read 2026-06-06)
- **Summary:** Reference rule grounding the title/escrow RESPA § 8 candidate triggers in published CFPB enforcement against title insurers and settlement-service providers (Lighthouse Title, Borders & Borders, PHH, the 2015 Wells Fargo / JPMorgan marketing-services actions). No draft-text match — routing/context only.
- **Safe rewrite / guidance:** Reference/routing rule — no draft-text fix. Use this enforcement history when reviewing any flagged § 8 candidate phrase: an MSA, co-marketing, or desk-rental arrangement is lawful ONLY if it pays fair market value for services actually performed and is not priced on referral volume. When a draft references such an arrangement, confirm the underlying agreement would survive the Lighthouse/Borders analysis before sending.
- **Drafter notes:** Pulled live 2026-06-06 from consumerfinance.gov (newsroom 'CFPB Takes Action Against Mortgage Kickback Agreements'; Borders complaint at files.consumerfinance.gov/f/201310_cfpb_complaint_borders.pdf). Authentic published enforcement, so `unverified` is left unset; the rule is counsel-reference and never fires regardless. Counsel may want to add the exact docket numbers and the 2015 RESPA-MSA bulletin URL as companion citations.

> Published CFPB RESPA § 8 enforcement against title/settlement providers (consumerfinance.gov, accessed 2026-06-06):
> 
> • Lighthouse Title, Inc. (Sept. 2014 consent order): a Michigan title insurance agency paid $200,000 for illegal mortgage kickbacks. Lighthouse entered marketing services agreements (MSAs) with real estate brokers and others, but set the MSA fees in part by reference to the number of referrals received or expected — converting the "marketing" payment into a § 8(a) referral fee. The action prompted much of the industry to abandon MSAs and the CFPB's 2015 bulletin "RESPA Compliance and Marketing Services Agreements."
> 
> • Borders & Borders, PLC (complaint filed Oct. 24, 2013, W.D. Ky.): the CFPB alleged the law firm used a network of sham affiliated business arrangements (ABAs) — title companies jointly owned with referring real estate and mortgage brokers — to disguise referral kickbacks as profit distributions.
> 
> • PHH Corporation (2015): consent order addressing referral payments and endorsements treated as RESPA § 8 violations (later contested on constitutional grounds in PHH v. CFPB, but the § 8 theory grounds the enforcement posture).
> 
> • CFPB "Takes Action Against Mortgage Kickback Agreements" (Jan. 2015): actions against lenders and loan officers who funneled referrals through title-company marketing-services and desk-rental arrangements.
> 
> Sentinel does not fire on this rule — it is the enforcement backdrop for the § 8 candidate triggers, surfaced in the counsel-handoff packet.

## 5. Questions for counsel

**Corpus open questions (drafter → counsel):**

- [ ] MOST AMBIGUOUS: 'marketing services agreement' (MSA), 'co-marketing agreement', and 'desk rental' are NOT per-se illegal but are the CFPB's primary § 8(a)/(b) enforcement vehicles (Lighthouse Title 2014; Borders & Borders 2013; the 2015 Wells Fargo / JPMorgan MSA actions — now grounded in `cfpb-title-respa-enforcement`). The `respa-section-8-title-escrow-candidates` rule fires LITERAL-MATCH on these phrases with severity 'blocking', routing the operator to confirm § 8(c)(2) bona-fide-services + fair-market-value compliance. Counsel must decide whether literal-match firing (with operator-review routing) is the right shape — or whether these three lawful-term-of-art phrases should be DEMOTED to a counsel-reference rule so they never appear as a 'blocking' alarm on a legitimate FMV arrangement.
- [ ] NEW THIS WAVE (2026-06-06): `wire-fraud-instructions-literal.ts` (literal-match, severity 'advisory', unverified) flags risky wiring-instruction language — 'updated wiring instructions', 'wire your funds to', etc. — routing to operator review to confirm phone-verified instructions + the ALTA wire-fraud warning. Anchor is ALTA Rapid Response / Sample Wire Fraud Warnings (verified live). The Georgia state-statute mirror is [UNVERIFIED]: a live search found NO GA statute mandating a wire-fraud disclosure (GA is caveat-emptor; the 'good funds' >$5,000 wire rule is a control, not a disclosure mandate). Counsel to confirm whether any GA DOI bulletin or Bar guidance imposes a wire-fraud-notice obligation and supply the citation.
- [ ] NEW THIS WAVE (2026-06-06): `cfpb-title-respa-enforcement-literal.ts` (counsel-reference, severity 'info', verified from consumerfinance.gov) grounds the § 8 candidate triggers in published enforcement. Counsel to add exact docket numbers and the 2015 RESPA-MSA compliance bulletin URL as companion citations.
- [ ] GA title insurance regulator citations (O.C.G.A. § 33-7-8 and Title 33 generally) flagged [UNVERIFIED] — counsel to pull the operative text and confirm whether the Title Insurance Agents licensing structure sits at a different citation that should also be added. Rule is scope-only (severity 'info') until then.
- [ ] ALTA Best Practices: `alta-best-practices-literal.ts` now enumerates ALL SEVEN pillars of the current 4.2 framework (effective 2025-08-19) — pillar NAMES verified live against alta.org 2026-06-06 (Licensing; Escrow Trust Accounting; Protecting NPI; Settlement Processes; Policy Production; Insurance & Fidelity Coverage; Consumer Complaints). The per-pillar SUBSTANCE summaries are drafter paraphrase — counsel to confirm against the canonical framework PDF, especially the Pillar 2 three-way-reconciliation cadence and Pillar 3 NPI safeguards.
- [ ] Confirm RESPA Section 9 (seller designation of title company) wording — 12 USC § 2608 — verified verbatim against Cornell LII 2026-06-06; rule is counsel-reference, severity 'blocking'. Counsel to advise whether to authorize a narrow regex on 'must use our title' / 'required to close with' patterns.
- [ ] Held back for counsel: 'affiliated business arrangement' (legitimate term-of-art with required Form RESPA-1 disclosure — recommend a separate counsel-reference rule that verifies disclosure attachment, not a literal-match alarm); literal dollar amounts (require structured parsing).
- [ ] Per-state expansion deferred: GA-only initial scope.

**Per-rule drafter notes (most ambiguous first):**

- **CFPB RESPA § 8 enforcement against title/settlement providers (reference)** (`cfpb-title-respa-enforcement`): Pulled live 2026-06-06 from consumerfinance.gov (newsroom 'CFPB Takes Action Against Mortgage Kickback Agreements'; Borders complaint at files.consumerfinance.gov/f/201310_cfpb_complaint_borders.pdf). Authentic published enforcement, so `unverified` is left unset; the rule is counsel-reference and never fires regardless. Counsel may want to add the exact docket numbers and the 2015 RESPA-MSA bulletin URL as companion citations.
- **Wire-fraud risk — wiring-instruction language in closing comms** (`wire-fraud-instructions`): Drafted 2026-06-06. Anchor authority verified live: ALTA Rapid Response Plan + Sample Wire Fraud Warnings (alta.org/topics/wire-fraud) — instruct verbal verification to a known number before transmitting funds. The GA state-statute mirror is intentionally [UNVERIFIED]: a live search found NO Georgia statute mandating a wire-fraud disclosure (GA is caveat-emptor); the related GA 'good funds' >$5,000 wire rule is a control, not a disclosure mandate. Counsel decision: 'wire the funds to' style phrases are advisory (lawful, but condition the phone-verification + warning duty), not blocking — severity is 'advisory' accordingly. Consider tightening the second regex if benign 'bring the funds' / 'send the documents to' copy false-positives in practice.
- **Georgia title insurance — Title 33 regulation** (`ga-title-insurance-regulation`): Counsel: please pull the operative text of O.C.G.A. § 33-7-8 and replace placeholder. Confirm whether the Title Insurance Agents licensing structure (separate from the title insurer itself) is captured at a different citation that should also be added.
- **RESPA § 8 — candidate title/escrow referral-fee triggers (DRAFT)** (`respa-section-8-title-escrow-candidates`): Drafted 2026-05-25. 'Referral fee', 'kickback', and 'thing of value' are direct § 8(a) statutory-text triggers — any literal use of these phrases in title/escrow outreach is a flag. 'Marketing services agreement' (MSA) and 'co-marketing agreement' are NOT per-se illegal but are the CFPB's primary RESPA-§ 8 enforcement vehicle (see PHH Corp. and Wells Fargo MSA actions, 2014–2015) — flagging them prompts the operator to confirm the arrangement meets the § 8(c)(2) bona-fide-services and fair-market-value standards. 'Desk rental' similarly: legitimate per CFPB FAQ if rent is at FMV for actual desk usage; literal-match flag prompts confirmation. Phrases intentionally held back for counsel: 'affiliated business arrangement' (legitimate term of art with required disclosure form — recommend counsel-reference rule to verify Form RESPA-1 is attached, not a literal-match alarm); specific dollar amounts (require structured parsing).
- **RESPA Section 9 — seller may not require particular title insurer** (`respa-section-9-seller-title-insurance`): Verified against Cornell LII 12 USC § 2608 on 2026-06-06; subsections (a) and (b) match the published text verbatim. counsel-reference (not literal-match): a violation is conduct ('require ... as a condition to selling'), not a fixed phrase, so a literal trigger list would over- or under-fire. Counsel may later authorize a narrow regex on 'must use our title' / 'required to close with' patterns if false-positive rate is acceptable.
- **RESPA Section 8 — anti-kickback (cross-reference to mortgage corpus)** (`title-escrow-respa-section-8-crossref`): Counsel: title/escrow agents often face Section 8 exposure on marketing arrangements with referring brokers — confirm cross-corpus loading semantics are acceptable, otherwise duplicate the literal in this file.
- **ALTA Best Practices — seven-pillar framework (4.2)** (`alta-best-practices-seven-pillars`): Pillar set verified live against alta.org on 2026-06-06: the current framework is version 4.2, effective 2025-08-19, with seven pillars (Licensing; Escrow Trust Accounting; Protecting NPI; Settlement Processes; Policy Production; Insurance & Fidelity Coverage; Consumer Complaints). Pillar NAMES are authentic published headings; the substance summaries under each are drafter paraphrase — counsel should pull the canonical ALTA Best Practices 4.2 PDF and confirm each summary, especially the Pillar 2 three-way-reconciliation cadence and the Pillar 3 NPI safeguards which intersect the wire-fraud rule (`wire-fraud-instructions`).
