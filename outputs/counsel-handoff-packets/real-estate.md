# Counsel handoff packet — Real Estate compliance corpus

> **DRAFT — not legal advice.** This packet is a fleet-drafted compliance corpus for attorney review. No rule fires on customer drafts until counsel red-lines it AND the vertical is enabled via `COMPLIANCE_CORPUS_COUNSEL_REVIEWED`. Sentinel ADVISES; it never blocks a send.

## Status

- **Vertical:** `real-estate`
- **Corpus status:** DRAFT
- **Last reviewed:** 2026-05-22
- **Counsel reviewer:** _none yet_
- **Packet generated:** 2026-05-22

### Coverage at a glance

| Bucket | Count |
| --- | --- |
| Live literal triggers (firing today) | 47 |
| Candidate literal triggers (to red-line) | 0 |
| Candidate regex triggers (to red-line) | 0 |
| Counsel-reference rules | 1 |
| Open questions | 3 |

## 1. Live literal triggers (firing on drafts today)

#### Fair Housing Act — HUD-literal advertising trigger phrases (`fha-hud-literal-triggers`)
- **Severity:** 🟡 advisory
- **Citation:** 24 CFR § 100.75 (implementing 42 USC § 3604(c))
  — https://www.ecfr.gov/current/title-24/subtitle-B/chapter-I/subchapter-A/part-100/subpart-B/section-100.75 (read 2026-05-22)
- **Phrases (47):**
  - `no children`
  - `no kids`
  - `adults only`
  - `adult building`
  - `adult community`
  - `mature persons`
  - `mature adults`
  - `mature couple`
  - `empty nesters`
  - `singles only`
  - `one child`
  - `great for families`
  - `perfect for families`
  - `family-oriented`
  - `family neighborhood`
  - `bachelor`
  - `bachelorette`
  - `bachelor pad`
  - `christian home`
  - `christian community`
  - `christian family`
  - `jewish home`
  - `muslim home`
  - `catholic family`
  - `no blacks`
  - `whites only`
  - `white only`
  - `caucasian preferred`
  - `caucasian only`
  - `no hispanics`
  - `no latinos`
  - `no asians`
  - `no foreigners`
  - `english speaking`
  - `english speaking only`
  - `no women`
  - `no men`
  - `female only`
  - `male only`
  - `ladies only`
  - `gentlemen only`
  - `no wheelchairs`
  - `able-bodied`
  - `must be able-bodied`
  - `no mentally ill`
  - `no handicapped`
  - `no disabled`

## 2. Candidate literal triggers — counsel red-line, phrase by phrase

_Sentinel does NOT fire on these. Check a box to approve a phrase as a literal-match trigger; strike, reword, or demote to counsel-reference otherwise._

_None._

## 3. Candidate regex triggers — counsel red-line

_Deterministic patterns for cases a literal phrase list can't express. Each shows the string it must match and a near-miss it must not._

_None._

## 4. Counsel-reference rules — substantive law, never auto-flagged

#### Fair Housing Act § 804(c) — prohibition on discriminatory advertising (`fha-section-804-c-advertising`)
- **Severity:** 🟡 advisory · **Status:** draft
- **Citation:** 42 USC § 3604(c); implementing regulation 24 CFR § 100.75
  — https://www.law.cornell.edu/uscode/text/42/3604 (read 2026-05-12)
- **Summary:** It is unlawful to make, print, or publish (or cause to be made, printed, or published) any notice, statement, or advertisement, with respect to the sale or rental of a dwelling, that indicates any preference, limitation, or discrimination based on race, color, religion, sex, handicap, familial status, or national origin, or an intention to make any such preference, limitation, or discrimination.
- **Drafter notes:** Substantive statutory anchor — the long-form excerpt of 42 USC § 3604(c) + 24 CFR § 100.75(c). The deterministic trigger phrases that sentinel matches against live in the sibling `fair-housing-hud-literal.ts` rule. This rule itself is counsel-reference only because the statutory text requires generative judgment to evaluate (it's the law itself, not a phrase list).

> 42 USC § 3604(c):
> [As made applicable by section 3603 of this title and except as exempted by sections 3603(b) and 3607 of this title, it shall be unlawful—]
> (c) To make, print, or publish, or cause to be made, printed, or published any notice, statement, or advertisement, with respect to the sale or rental of a dwelling that indicates any preference, limitation, or discrimination based on race, color, religion, sex, handicap, familial status, or national origin, or an intention to make any such preference, limitation, or discrimination.
> 
> 24 CFR § 100.75(c) (examples; non-exhaustive):
> The prohibitions of this section shall apply to:
> (1) Using words, phrases, photographs, illustrations, symbols or forms which convey that dwellings are available or not available to a particular group of persons because of race, color, religion, sex, handicap, familial status, or national origin.
> (2) Expressing to agents, brokers, employees, prospective sellers or renters or any other persons a preference for or limitation on any purchaser or renter because of race, color, religion, sex, handicap, familial status, or national origin of such persons.
> (3) Selecting media or locations for advertising the sale or rental of dwellings which deny particular segments of the housing market information about housing opportunities because of race, color, religion, sex, handicap, familial status, or national origin.
> (4) Refusing to publish advertising for the sale or rental of dwellings or requiring different charges or terms for such advertising because of race, color, religion, sex, handicap, familial status, or national origin.

## 5. Questions for counsel

**Corpus open questions (drafter → counsel):**

- [ ] The HUD-literal trigger list (`fair-housing-hud-literal.ts`) now ships ~46 phrases ported from flatsbo. Counsel should red-line the full list before flipping `status: COUNSEL_REVIEWED`.
- [ ] Borderline phrases intentionally excluded from the literal-match list (e.g. 'walking distance to church', 'quiet street', 'family-friendly') need a counsel decision on whether to route through a future LLM-classifier path or stay out entirely.
- [ ] The substantive § 804(c) rule is `purpose: counsel-reference` — counsel should confirm the statutory excerpt is the version the firm wants on customer-facing flags.

**Per-rule drafter notes (most ambiguous first):**

- **Fair Housing Act § 804(c) — prohibition on discriminatory advertising** (`fha-section-804-c-advertising`): Substantive statutory anchor — the long-form excerpt of 42 USC § 3604(c) + 24 CFR § 100.75(c). The deterministic trigger phrases that sentinel matches against live in the sibling `fair-housing-hud-literal.ts` rule. This rule itself is counsel-reference only because the statutory text requires generative judgment to evaluate (it's the law itself, not a phrase list).
