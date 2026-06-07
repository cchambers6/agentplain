# Counsel handoff packet — Home Services compliance corpus

> **DRAFT — not legal advice.** This packet is a fleet-drafted compliance corpus for attorney review. No rule fires on customer drafts until counsel red-lines it AND the vertical is enabled via `COMPLIANCE_CORPUS_COUNSEL_REVIEWED`. Sentinel ADVISES; it never blocks a send.

## Status

- **Vertical:** `home-services`
- **Corpus status:** DRAFT
- **Last reviewed:** 2026-05-25
- **Counsel reviewer:** _none yet_
- **Packet generated:** 2026-05-25

### Coverage at a glance

| Bucket | Count |
| --- | --- |
| Live literal triggers (firing today) | 0 |
| Candidate literal triggers (to red-line) | 22 |
| Candidate regex triggers (to red-line) | 0 |
| Counsel-reference rules | 4 |
| Open questions | 8 |

## 1. Live literal triggers (firing on drafts today)

_None. This corpus is DRAFT — no rule is counsel-verified, so the scanner fires on nothing yet. Phrases below are candidates for review._

## 2. Candidate literal triggers — counsel red-line, phrase by phrase

_Sentinel does NOT fire on these. Check a box to approve a phrase as a literal-match trigger; strike, reword, or demote to counsel-reference otherwise._

#### FTC § 5 + 16 CFR § 251.1 + Magnuson-Moss § 2303 — candidate home-services advertising triggers (DRAFT) (`home-services-deceptive-advertising-candidates`)
- **Severity:** 🟡 advisory
- **Category:** advertising
- **Citation:** FTC Act § 5(a)(1) (15 USC § 45(a)(1)); 16 CFR § 251.1 (Guide Concerning Use of the Word 'Free' and Similar Representations); 15 USC § 2303(a) (Magnuson-Moss designation of written warranties)
  — https://www.ecfr.gov/current/title-16/chapter-I/subchapter-B/part-251 (read 2026-05-25)
- **Drafter notes:** Drafted 2026-05-25. Phrases fall into four buckets: (1) absolute price claims ('guaranteed lowest price', 'we beat any competitor') — FTC § 5 treats unqualified superlatives as presumptively deceptive without substantiation; (2) 'free' offers ('free estimate', 'free inspection') — 16 CFR § 251.1 requires conspicuous disclosure of any conditions, and many state AGs treat unconditioned 'free' claims as per-se deceptive when the offer is contingent on purchase; (3) warranty puffery ('lifetime warranty', 'no questions asked refund') — Magnuson-Moss § 2303 requires 'full' or 'limited' designation, so unqualified 'lifetime warranty' advertising is the most common federal warranty-advertising trap; (4) endorsement / authority claims ('factory authorized', 'epa approved', 'government endorsed') — FTC § 5 + 16 CFR Part 255 (Endorsement Guides) treat these as deceptive unless substantiated. Borderline omissions: 'family-owned' / 'locally owned' (factually verifiable, not per-se deceptive); 'A+ BBB rating' (true claims OK but format conventions matter — recommend counsel-reference); 'voted #1' (depends entirely on the underlying poll — counsel-reference); 'no money down' / 'zero down financing' (TILA Reg Z advertising rules govern these — out of scope for home-services corpus, would land in a separate consumer-credit rule). State contractor-board advertising rules (e.g. GA Rule chapter 553 requiring license number in advertising) intentionally not literal-matched here — license number formats vary per state and require workspace context the scanner does not have at corpus-load time; counsel: open question on whether a workspace-scoped rule belongs in a follow-on PR.
- **Candidate phrases to red-line (22):**
  - [ ] `guaranteed lowest price`
  - [ ] `lowest price guaranteed`
  - [ ] `lowest price in town`
  - [ ] `we will beat any price`
  - [ ] `we beat any competitor`
  - [ ] `100% satisfaction guaranteed`
  - [ ] `satisfaction guaranteed or your money back`
  - [ ] `lifetime warranty`
  - [ ] `lifetime guarantee`
  - [ ] `no questions asked refund`
  - [ ] `free estimate`
  - [ ] `free inspection`
  - [ ] `free quote`
  - [ ] `factory authorized`
  - [ ] `factory certified`
  - [ ] `manufacturer endorsed`
  - [ ] `manufacturer authorized`
  - [ ] `licensed and bonded in all 50 states`
  - [ ] `epa approved`
  - [ ] `epa endorsed`
  - [ ] `government approved`
  - [ ] `government endorsed`

## 3. Candidate regex triggers — counsel red-line

_Deterministic patterns for cases a literal phrase list can't express. Each shows the string it must match and a near-miss it must not._

_None._

## 4. Counsel-reference rules — substantive law, never auto-flagged

#### Georgia residential / general contractor licensure (`ga-contractor-licensing`)
- **Severity:** 🟡 advisory · **Status:** draft
- **Citation:** O.C.G.A. § 43-41 (State Licensing Board for Residential and General Contractors); specifically § 43-41-17 (license required)
  — https://law.justia.com/codes/georgia/title-43/chapter-41/ (read 2026-05-12)
- **Summary:** Georgia requires a residential or general contractor license issued by the State Licensing Board for Residential and General Contractors before a person may hold themselves out as a contractor for projects above the statutory threshold.
- **Drafter notes:** Counsel: please pull current O.C.G.A. § 43-41-17 text and verify the dollar threshold + carve-outs. Specialty trades (electrical, plumbing, HVAC) are licensed under separate chapters (O.C.G.A. § 43-14, § 43-25, etc.) — counsel should advise whether sentinel needs separate companion rules per specialty trade.

> [UNVERIFIED — needs counsel] Substance: O.C.G.A. § 43-41-17 provides that no person shall hold himself or herself out to the public as a residential contractor or general contractor or engage in residential contracting or general contracting in Georgia without a current valid license issued by the State Licensing Board for Residential and General Contractors, except for work below the statutory threshold (commonly cited as $2,500 for residential work, with additional carve-outs for owner-occupant work, specialty trades regulated under separate chapters, and qualifying agricultural / municipal work). Penalties include misdemeanor liability and a private right of action for unjustified loss.

#### FTC Cooling-Off Rule — three-business-day right to cancel door-to-door sales (`ftc-cooling-off-rule`)
- **Severity:** 🟡 advisory · **Status:** draft
- **Citation:** 16 CFR § 429.1 (FTC Cooling-Off Rule); 80 Fed. Reg. 12,756 (Mar. 10, 2015) (raising thresholds to $25/$130)
  — https://www.ecfr.gov/current/title-16/chapter-I/subchapter-D/part-429 (read 2026-05-12)
- **Summary:** For consumer-goods or services sales of $25+ made at the buyer's residence (or $130+ at other locations off the seller's main place of business), the seller must give the buyer a three-business-day right to cancel, a contract notice of that right, and two copies of a completed cancellation form.
- **Drafter notes:** Drafter recalls 16 CFR § 429.1 wording with reasonable confidence — flagged unverified pending counsel pulling the canonical eCFR text. The 2015 threshold change ($25 / $130) is the most-likely-stale detail; counsel verifies.

> [UNVERIFIED — needs counsel] Substance of 16 CFR § 429.1: It constitutes an unfair and deceptive act or practice for any seller engaged in the door-to-door sale of consumer goods or services with a purchase price of $25 or more if the sale is made at the buyer's residence, or $130 or more if the sale is made at locations other than the buyer's residence, to:
> 
> (a) Fail to furnish the buyer with a fully completed receipt or copy of any contract pertaining to such sale at the time of its execution, which is in the same language (e.g., Spanish) as that principally used in the oral sales presentation and which shows the date of the transaction and contains the name and address of the seller, and in immediate proximity to the space reserved for the buyer's signature or on the front page of the receipt or contract if a contract is used, a statement in a type size no smaller than ten point bold face type, as follows: "You, the buyer, may cancel this transaction at any time prior to midnight of the third business day after the date of this transaction. See the attached notice of cancellation form for an explanation of this right."
> 
> (b) Fail to furnish each buyer, at the time the buyer signs the door-to-door sales contract or otherwise agrees to buy consumer goods or services from the seller, a completed form in duplicate, captioned either "NOTICE OF RIGHT TO CANCEL" or "NOTICE OF CANCELLATION," which shall be attached to the contract or receipt and easily detachable, and which shall contain in ten point bold face type the following information and statements in the same language, e.g., Spanish, as that used in the contract.
> 
> (c) Fail to inform each buyer orally, at the time the buyer signs the contract or purchases the goods or services, of his or her right to cancel.
> 
> (Cancellation period: prior to midnight of the third business day after the date of the transaction.)

#### Georgia mechanic's / materialman's lien — filing and notice rules (`ga-mechanics-lien`)
- **Severity:** 🟡 advisory · **Status:** draft
- **Citation:** O.C.G.A. § 44-14-361 (right of lien); O.C.G.A. § 44-14-361.1 (perfection); O.C.G.A. § 44-14-368 (notice of contest of lien)
  — https://law.justia.com/codes/georgia/title-44/chapter-14/article-8/part-3/ (read 2026-05-12)
- **Summary:** A contractor, subcontractor, materialman, or laborer who improves real estate may claim a lien on the property; the claim must be filed in the superior court of the county where the property is located within 90 days after the material is furnished or labor performed, with statutory notice to the owner.
- **Drafter notes:** Counsel: please verify the 90-day filing window, the two-business-day service requirement, and the 60-day post-contest action window — these are the load-bearing dates sentinel needs to flag against.

> [UNVERIFIED — needs counsel] Substance: O.C.G.A. § 44-14-361 grants a lien on real estate to enumerated parties (mechanics, contractors, subcontractors, materialmen, laborers) for work performed or material furnished. O.C.G.A. § 44-14-361.1 establishes perfection requirements:
> 
> (1) Substantial compliance with the contract;
> (2) Filing of a claim of lien within 90 days after the completion of the work, or within 90 days after the material was furnished, in the office of the clerk of the superior court of the county where the property is located;
> (3) Service of a copy of the claim of lien on the owner or contractor within two business days of filing;
> (4) Commencement of an action for recovery within 365 days from the date the claim of lien was filed.
> 
> O.C.G.A. § 44-14-368 allows the property owner or contractor to file a notice of contest of lien, which shortens the lien claimant's window to commence suit to 60 days after the notice of contest is filed.

#### Magnuson-Moss Warranty Act — written warranty disclosure (`magnuson-moss-warranty-disclosure`)
- **Severity:** 🟡 advisory · **Status:** draft
- **Citation:** 15 USC § 2302 (Magnuson-Moss); 15 USC § 2303 (full vs. limited designation); implementing rules at 16 CFR Parts 700–703
  — https://www.law.cornell.edu/uscode/text/15/2302 (read 2026-05-12)
- **Summary:** Any warrantor warranting a consumer product to a consumer by means of a written warranty must fully and conspicuously disclose in simple and readily understood language the terms and conditions of such warranty, as required by FTC rules, and must clearly and conspicuously designate the warranty as 'full' or 'limited.'
- **Drafter notes:** FTC implementing rules at 16 CFR Parts 700 (interpretation), 701 (disclosure), 702 (pre-sale availability), and 703 (informal dispute settlement procedures) are the operational layer — counsel: please advise whether sentinel needs a companion literal for 16 CFR § 701.3 (the specific written-warranty disclosure rule).

> 15 USC § 2302(a):
> In order to improve the adequacy of information available to consumers, prevent deception, and improve competition in the marketing of consumer products, any warrantor warranting a consumer product to a consumer by means of a written warranty shall, to the extent required by rules of the Commission, fully and conspicuously disclose in simple and readily understood language the terms and conditions of such warranty. Such rules may require inclusion in the written warranty of any of the following items among others:
> (1) The clear identification of the names and addresses of the warrantors.
> (2) The identity of the party or parties to whom the warranty is extended.
> (3) The products or parts covered.
> (4) A statement of what the warrantor will do in the event of a defect, malfunction, or failure to conform with such written warranty—at whose expense—and for what period of time.
> (5) A statement of what the consumer must do and expenses he must bear.
> (6) Exceptions and exclusions from the terms of the warranty.
> (7) The step-by-step procedure which the consumer should take in order to obtain performance of any obligation under the warranty, including the identification of any person or class of persons authorized to perform the obligations set forth in the warranty.
> (8) Information respecting the availability of any informal dispute settlement procedure offered by the warrantor and a recital, where the warranty so provides, that the purchaser may be required to resort to such procedure before pursuing any legal remedies in the courts.
> (9) A brief, general description of the legal remedies available to the consumer.
> (10) The time at which the warrantor will perform any obligations under the warranty.
> (11) The period of time within which, after notice of a defect, malfunction, or failure to conform with the warranty, the warrantor will perform any obligations under the warranty.
> (12) The characteristics or properties of the products, or parts thereof, that are not covered by the warranty.
> (13) The elements of the warranty in words or phrases which would not mislead a reasonable, average consumer as to the nature or scope of the warranty.
> 
> 15 USC § 2303(a):
> Any warrantor warranting a consumer product by means of a written warranty shall clearly and conspicuously designate such warranty in the following manner, as applicable:
> (1) If the written warranty meets the Federal minimum standards for warranty set forth in section 2304 of this title, then it shall be conspicuously designated a "full (statement of duration) warranty."
> (2) If the written warranty does not meet the Federal minimum standards for warranty set forth in section 2304 of this title, then it shall be conspicuously designated a "limited warranty."

## 5. Questions for counsel

**Corpus open questions (drafter → counsel):**

- [ ] GA residential contractor licensing thresholds — drafter cited the >$2,500 trigger; counsel to confirm against current O.C.G.A. § 43-41-2/§ 43-41-17 wording.
- [ ] FTC Cooling-Off Rule thresholds ($25 at-residence / $130 elsewhere) reflect the 2015 amendment — counsel: confirm no further amendment has issued.
- [ ] Magnuson-Moss disclosure requirements (15 USC § 2302) summarized; full FTC implementing rules at 16 CFR Part 700–703 not pulled in this draft pass.
- [ ] Mechanic's lien rules vary substantially across states; GA citation is initial scope.
- [ ] CANDIDATE TRIGGERS (2026-05-25 wave): `ftc-deceptive-advertising-candidates-literal.ts` ships 22 candidate advertising phrases drafted from FTC Act § 5 (15 USC § 45), 16 CFR § 251.1 (Use of the Word 'Free'), and Magnuson-Moss § 2303 (warranty designation) — e.g. 'guaranteed lowest price', 'free estimate', 'lifetime warranty', 'factory authorized', 'epa approved'. Sentinel does NOT fire on these — counsel to red-line phrase-by-phrase before flipping `unverified: false`.
- [ ] CANDIDATE TRIGGERS — counsel decision: state contractor-board advertising rules (e.g. requirement to include the license number in print + online advertising under O.C.G.A. § 43-41 implementing regulations) were intentionally NOT literal-matched in this draft because license-number formats are workspace-scoped and would false-positive without context. Counsel: should a follow-on workspace-scoped rule be added, and if so, what's the canonical Georgia rule cite for license-number-in-advertising? Same question applies to any other state the brokerage / trades shop operates in.
- [ ] CANDIDATE TRIGGERS — counsel decision: 'free estimate' / 'free inspection' is industry-standard language for trade shops. 16 CFR § 251.1 only treats it as deceptive when the offer is conditioned on a purchase the consumer is not adequately told about. Counsel: should sentinel literal-match the bare phrase (and rely on the customer to ignore the flag when the estimate is genuinely free), or should the rule be tightened with proximity-required disclaimer language (e.g. only flag 'free estimate' when adjacent to 'with purchase')? The proximity path requires scanner work beyond literal-match.
- [ ] CANDIDATE TRIGGERS — counsel decision: 'lifetime warranty' / 'lifetime guarantee' phrases require a Magnuson-Moss 'full (statement of duration) warranty' or 'limited warranty' designation under 15 USC § 2303. Counsel: confirm sentinel should flag these as literal triggers (counting on the customer to add the designation), or whether the rule should be scoped to flag only when the designation is absent within N characters — again, beyond pure literal-match.

**Per-rule drafter notes (most ambiguous first):**

- **FTC Cooling-Off Rule — three-business-day right to cancel door-to-door sales** (`ftc-cooling-off-rule`): Drafter recalls 16 CFR § 429.1 wording with reasonable confidence — flagged unverified pending counsel pulling the canonical eCFR text. The 2015 threshold change ($25 / $130) is the most-likely-stale detail; counsel verifies.
- **FTC § 5 + 16 CFR § 251.1 + Magnuson-Moss § 2303 — candidate home-services advertising triggers (DRAFT)** (`home-services-deceptive-advertising-candidates`): Drafted 2026-05-25. Phrases fall into four buckets: (1) absolute price claims ('guaranteed lowest price', 'we beat any competitor') — FTC § 5 treats unqualified superlatives as presumptively deceptive without substantiation; (2) 'free' offers ('free estimate', 'free inspection') — 16 CFR § 251.1 requires conspicuous disclosure of any conditions, and many state AGs treat unconditioned 'free' claims as per-se deceptive when the offer is contingent on purchase; (3) warranty puffery ('lifetime warranty', 'no questions asked refund') — Magnuson-Moss § 2303 requires 'full' or 'limited' designation, so unqualified 'lifetime warranty' advertising is the most common federal warranty-advertising trap; (4) endorsement / authority claims ('factory authorized', 'epa approved', 'government endorsed') — FTC § 5 + 16 CFR Part 255 (Endorsement Guides) treat these as deceptive unless substantiated. Borderline omissions: 'family-owned' / 'locally owned' (factually verifiable, not per-se deceptive); 'A+ BBB rating' (true claims OK but format conventions matter — recommend counsel-reference); 'voted #1' (depends entirely on the underlying poll — counsel-reference); 'no money down' / 'zero down financing' (TILA Reg Z advertising rules govern these — out of scope for home-services corpus, would land in a separate consumer-credit rule). State contractor-board advertising rules (e.g. GA Rule chapter 553 requiring license number in advertising) intentionally not literal-matched here — license number formats vary per state and require workspace context the scanner does not have at corpus-load time; counsel: open question on whether a workspace-scoped rule belongs in a follow-on PR.
- **Georgia residential / general contractor licensure** (`ga-contractor-licensing`): Counsel: please pull current O.C.G.A. § 43-41-17 text and verify the dollar threshold + carve-outs. Specialty trades (electrical, plumbing, HVAC) are licensed under separate chapters (O.C.G.A. § 43-14, § 43-25, etc.) — counsel should advise whether sentinel needs separate companion rules per specialty trade.
- **Georgia mechanic's / materialman's lien — filing and notice rules** (`ga-mechanics-lien`): Counsel: please verify the 90-day filing window, the two-business-day service requirement, and the 60-day post-contest action window — these are the load-bearing dates sentinel needs to flag against.
- **Magnuson-Moss Warranty Act — written warranty disclosure** (`magnuson-moss-warranty-disclosure`): FTC implementing rules at 16 CFR Parts 700 (interpretation), 701 (disclosure), 702 (pre-sale availability), and 703 (informal dispute settlement procedures) are the operational layer — counsel: please advise whether sentinel needs a companion literal for 16 CFR § 701.3 (the specific written-warranty disclosure rule).
