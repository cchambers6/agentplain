# Counsel handoff packet — Title & Escrow compliance corpus

> **DRAFT — not legal advice.** This packet is a fleet-drafted compliance corpus for attorney review. No rule fires on customer drafts until counsel red-lines it AND the vertical is enabled via `COMPLIANCE_CORPUS_COUNSEL_REVIEWED`. Sentinel ADVISES; it never blocks a send.

## Status

- **Vertical:** `title-escrow`
- **Corpus status:** DRAFT
- **Last reviewed:** 2026-05-25
- **Counsel reviewer:** _none yet_
- **Packet generated:** 2026-05-25

### Coverage at a glance

| Bucket | Count |
| --- | --- |
| Live literal triggers (firing today) | 0 |
| Candidate literal triggers (to red-line) | 14 |
| Candidate regex triggers (to red-line) | 0 |
| Counsel-reference rules | 4 |
| Open questions | 7 |

## 1. Live literal triggers (firing on drafts today)

_None. This corpus is DRAFT — no rule is counsel-verified, so the scanner fires on nothing yet. Phrases below are candidates for review._

## 2. Candidate literal triggers — counsel red-line, phrase by phrase

_Sentinel does NOT fire on these. Check a box to approve a phrase as a literal-match trigger; strike, reword, or demote to counsel-reference otherwise._

#### RESPA § 8 — candidate title/escrow referral-fee triggers (DRAFT) (`respa-section-8-title-escrow-candidates`)
- **Severity:** 🟡 advisory
- **Category:** referral-arrangements
- **Citation:** 12 USC § 2607 (RESPA § 8); 12 CFR § 1024.14 and § 1024.15
  — https://www.ecfr.gov/current/title-12/chapter-X/part-1024/subpart-B/section-1024.14 (read 2026-05-25)
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

## 3. Candidate regex triggers — counsel red-line

_Deterministic patterns for cases a literal phrase list can't express. Each shows the string it must match and a near-miss it must not._

_None._

## 4. Counsel-reference rules — substantive law, never auto-flagged

#### RESPA Section 9 — seller may not require particular title insurer (`respa-section-9-seller-title-insurance`)
- **Severity:** 🟡 advisory · **Status:** draft
- **Citation:** 12 USC § 2608
  — https://www.law.cornell.edu/uscode/text/12/2608 (read 2026-05-12)
- **Summary:** No seller of property that will be purchased with the assistance of a federally related mortgage loan may require directly or indirectly, as a condition to selling the property, that title insurance covering the property be purchased by the buyer from any particular title company.

> (a) Imposition of condition prohibited
> No seller of property that will be purchased with the assistance of a federally related mortgage loan shall require directly or indirectly, as a condition to selling the property, that title insurance covering the property be purchased by the buyer from any particular title company.
> 
> (b) Liability of seller for violation
> Any seller who violates the provisions of subsection (a) shall be liable to the buyer in an amount equal to three times all charges made for such title insurance.

#### RESPA Section 8 — anti-kickback (cross-reference to mortgage corpus) (`title-escrow-respa-section-8-crossref`)
- **Severity:** 🟡 advisory · **Status:** draft
- **Citation:** 12 USC § 2607(a)–(b); see also 12 CFR § 1024.14
  — https://www.law.cornell.edu/uscode/text/12/2607 (read 2026-05-12)
- **Summary:** RESPA Section 8 anti-kickback prohibition applies to title and escrow settlement service providers. Single literal lives in the mortgage corpus.
- **Drafter notes:** Counsel: title/escrow agents often face Section 8 exposure on marketing arrangements with referring brokers — confirm cross-corpus loading semantics are acceptable, otherwise duplicate the literal in this file.

> [CROSS-REFERENCE] Title and escrow drafts (closing protection letter language, lender-instructions exchanges, marketing co-arrangements with realtors and lenders) are evaluated against the RESPA Section 8 anti-kickback literal in the mortgage corpus. See:
> 
>   lib/agents/sentinel/corpus/mortgage/respa-section-8-literal.ts
> 
> That file is the single source of truth. Sentinel automatically loads it when scanning a title-escrow workspace; no duplicate text lives here.

#### Georgia title insurance — Title 33 regulation (`ga-title-insurance-regulation`)
- **Severity:** 🟡 advisory · **Status:** draft
- **Citation:** O.C.G.A. § 33-7-8 (title insurance); Rules of the Department of Insurance, Chapter 120
  — https://law.justia.com/codes/georgia/title-33/chapter-7/ (read 2026-05-12)
- **Summary:** Title insurance in Georgia is regulated by the Commissioner of Insurance under O.C.G.A. § 33-7-8 and related Title 33 provisions; title insurers must be licensed and rates and forms are subject to filing/review.
- **Drafter notes:** Counsel: please pull the operative text of O.C.G.A. § 33-7-8 and replace placeholder. Confirm whether the Title Insurance Agents licensing structure (separate from the title insurer itself) is captured at a different citation that should also be added.

> [UNVERIFIED — needs counsel] Substance: O.C.G.A. § 33-7-8 places title insurance under the Title 33 (Insurance) regulatory umbrella. Title insurance is one of the kinds of insurance authorized under the Code. Title insurers must obtain a certificate of authority from the Commissioner, file rates and forms, and comply with the Unfair Trade Practices provisions (O.C.G.A. § 33-6) that apply to all insurers. The Department of Insurance has further rulemaking authority over title insurers via Chapter 120 of the Department rules.

#### ALTA Best Practices — Pillar 2: escrow trust accounting (`alta-best-practices-pillar-2-escrow`)
- **Severity:** 🟡 advisory · **Status:** draft
- **Citation:** ALTA Title Insurance and Settlement Company Best Practices, Pillar 2 (Escrow Trust Accounting)
  — https://www.alta.org/best-practices/ (read 2026-05-12)
- **Summary:** ALTA Best Practices framework requires segregated trust accounts, monthly three-way reconciliation, and positive pay (or comparable fraud-prevention controls) on escrow accounts handled by title and settlement agents.
- **Drafter notes:** Counsel: please pull the canonical ALTA Pillar 2 text (current version) and replace the substance summary. The full ALTA framework has seven pillars — counsel may want sentinel to also load Pillar 3 (consumer/lender info security) and Pillar 4 (settlement processes).

> [UNVERIFIED — needs counsel] Substance of ALTA Best Practices Pillar 2: Title and settlement companies shall (a) maintain appropriate written controls for escrow trust accounts; (b) perform monthly three-way reconciliation of escrow trust accounts (bank statement balance, book balance, and trial balance of open files); (c) limit escrow trust account access to authorized employees; (d) ensure escrow trust accounts are appropriately named and segregated from operating funds; (e) require background checks for employees with access to escrow funds; and (f) maintain fraud-prevention controls such as positive pay, ACH blocking, and wire-fraud prevention training.

## 5. Questions for counsel

**Corpus open questions (drafter → counsel):**

- [ ] Confirm RESPA Section 9 (seller designation of title company) wording — 12 USC § 2608.
- [ ] GA title insurance regulator citations (O.C.G.A. § 33-7-8 and Title 33 generally) flagged unverified.
- [ ] ALTA Best Practices Pillar #2 (escrow trust accounting) referenced from ALTA's published framework — please confirm the current version (drafter referenced what is believed to be the active framework as of accessed date).
- [ ] Per-state expansion deferred: GA-only initial scope.
- [ ] CANDIDATE TRIGGERS (2026-05-25 wave): `respa-section-8-candidates-literal.ts` ships 14 candidate referral-arrangement phrases drafted from RESPA § 8(a)/(b) and 12 CFR § 1024.14/.15 — e.g. 'referral fee', 'kickback', 'thing of value', 'marketing services agreement', 'co-marketing agreement', 'desk rental'. Sentinel does NOT fire on these — counsel to red-line phrase-by-phrase.
- [ ] CANDIDATE TRIGGERS — counsel decision: 'marketing services agreement' (MSA), 'co-marketing agreement', and 'desk rental' are NOT per-se illegal but are the primary CFPB enforcement vehicles for § 8(a)/(b) violations (PHH Corp., Wells Fargo). Counsel to advise whether literal-match firing on these phrases (with operator-review routing to confirm § 8(c)(2) bona-fide-services + FMV compliance) is the right shape — or whether they should be demoted to counsel-reference.
- [ ] CANDIDATE TRIGGERS — held back for counsel: 'affiliated business arrangement' (legitimate term-of-art with required Form RESPA-1 disclosure — recommend a separate counsel-reference rule that verifies disclosure attachment, not a literal-match alarm); literal dollar amounts (require structured parsing).

**Per-rule drafter notes (most ambiguous first):**

- **Georgia title insurance — Title 33 regulation** (`ga-title-insurance-regulation`): Counsel: please pull the operative text of O.C.G.A. § 33-7-8 and replace placeholder. Confirm whether the Title Insurance Agents licensing structure (separate from the title insurer itself) is captured at a different citation that should also be added.
- **RESPA § 8 — candidate title/escrow referral-fee triggers (DRAFT)** (`respa-section-8-title-escrow-candidates`): Drafted 2026-05-25. 'Referral fee', 'kickback', and 'thing of value' are direct § 8(a) statutory-text triggers — any literal use of these phrases in title/escrow outreach is a flag. 'Marketing services agreement' (MSA) and 'co-marketing agreement' are NOT per-se illegal but are the CFPB's primary RESPA-§ 8 enforcement vehicle (see PHH Corp. and Wells Fargo MSA actions, 2014–2015) — flagging them prompts the operator to confirm the arrangement meets the § 8(c)(2) bona-fide-services and fair-market-value standards. 'Desk rental' similarly: legitimate per CFPB FAQ if rent is at FMV for actual desk usage; literal-match flag prompts confirmation. Phrases intentionally held back for counsel: 'affiliated business arrangement' (legitimate term of art with required disclosure form — recommend counsel-reference rule to verify Form RESPA-1 is attached, not a literal-match alarm); specific dollar amounts (require structured parsing).
- **ALTA Best Practices — Pillar 2: escrow trust accounting** (`alta-best-practices-pillar-2-escrow`): Counsel: please pull the canonical ALTA Pillar 2 text (current version) and replace the substance summary. The full ALTA framework has seven pillars — counsel may want sentinel to also load Pillar 3 (consumer/lender info security) and Pillar 4 (settlement processes).
- **RESPA Section 8 — anti-kickback (cross-reference to mortgage corpus)** (`title-escrow-respa-section-8-crossref`): Counsel: title/escrow agents often face Section 8 exposure on marketing arrangements with referring brokers — confirm cross-corpus loading semantics are acceptable, otherwise duplicate the literal in this file.
