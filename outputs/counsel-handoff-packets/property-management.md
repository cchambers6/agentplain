# Counsel handoff packet — Property Management compliance corpus

> **DRAFT — not legal advice.** This packet is a fleet-drafted compliance corpus for attorney review. No rule fires on customer drafts until counsel red-lines it AND the vertical is enabled via `COMPLIANCE_CORPUS_COUNSEL_REVIEWED`. Sentinel ADVISES; it never blocks a send.

## Status

- **Vertical:** `property-management`
- **Corpus status:** DRAFT
- **Last reviewed:** 2026-05-25
- **Counsel reviewer:** _none yet_
- **Packet generated:** 2026-05-25

### Coverage at a glance

| Bucket | Count |
| --- | --- |
| Live literal triggers (firing today) | 0 |
| Candidate literal triggers (to red-line) | 54 |
| Candidate regex triggers (to red-line) | 0 |
| Counsel-reference rules | 4 |
| Open questions | 7 |

## 1. Live literal triggers (firing on drafts today)

_None. This corpus is DRAFT — no rule is counsel-verified, so the scanner fires on nothing yet. Phrases below are candidates for review._

## 2. Candidate literal triggers — counsel red-line, phrase by phrase

_Sentinel does NOT fire on these. Check a box to approve a phrase as a literal-match trigger; strike, reword, or demote to counsel-reference otherwise._

#### Property management rental advertising — candidate triggers (DRAFT) (`property-management-rental-advertising-candidates`)
- **Severity:** 🟡 advisory
- **Category:** rental-advertising
- **Citation:** 42 USC § 3604(c); 24 CFR § 100.75; state source-of-income statutes (varies)
  — https://www.ecfr.gov/current/title-24/subtitle-B/chapter-I/subchapter-A/part-100/subpart-B/section-100.75 (read 2026-05-25)
- **Drafter notes:** Drafted 2026-05-25. The 46 HUD-list phrases are ported VERBATIM from `lib/agents/sentinel/corpus/real-estate/fair-housing-hud-literal.ts` — counsel should review whether duplicating the list is acceptable or whether the loader should be extended to cross-load (which would avoid the drift risk between the two files). The source-of-income block ('no section 8', 'no vouchers', 'no DSS', 'no welfare') is genuinely jurisdiction-dependent: federally legal, illegal in 19+ states and many cities. Counsel: confirm operating jurisdiction(s) before flipping verified, and consider state-scoped category metadata so the rule fires only for PM workspaces operating in source-of-income-protected jurisdictions.
- **Candidate phrases to red-line (54):**
  - [ ] `no children`
  - [ ] `no kids`
  - [ ] `adults only`
  - [ ] `adult building`
  - [ ] `adult community`
  - [ ] `mature persons`
  - [ ] `mature adults`
  - [ ] `mature couple`
  - [ ] `empty nesters`
  - [ ] `singles only`
  - [ ] `one child`
  - [ ] `great for families`
  - [ ] `perfect for families`
  - [ ] `family-oriented`
  - [ ] `family neighborhood`
  - [ ] `bachelor`
  - [ ] `bachelorette`
  - [ ] `bachelor pad`
  - [ ] `christian home`
  - [ ] `christian community`
  - [ ] `christian family`
  - [ ] `jewish home`
  - [ ] `muslim home`
  - [ ] `catholic family`
  - [ ] `no blacks`
  - [ ] `whites only`
  - [ ] `white only`
  - [ ] `caucasian preferred`
  - [ ] `caucasian only`
  - [ ] `no hispanics`
  - [ ] `no latinos`
  - [ ] `no asians`
  - [ ] `no foreigners`
  - [ ] `english speaking`
  - [ ] `english speaking only`
  - [ ] `no women`
  - [ ] `no men`
  - [ ] `female only`
  - [ ] `male only`
  - [ ] `ladies only`
  - [ ] `gentlemen only`
  - [ ] `no wheelchairs`
  - [ ] `able-bodied`
  - [ ] `must be able-bodied`
  - [ ] `no mentally ill`
  - [ ] `no handicapped`
  - [ ] `no disabled`
  - [ ] `no section 8`
  - [ ] `no section-8`
  - [ ] `no vouchers`
  - [ ] `no housing voucher`
  - [ ] `no dss`
  - [ ] `no welfare`
  - [ ] `no government assistance`

## 3. Candidate regex triggers — counsel red-line

_Deterministic patterns for cases a literal phrase list can't express. Each shows the string it must match and a near-miss it must not._

_None._

## 4. Counsel-reference rules — substantive law, never auto-flagged

#### Fair Housing — applies to rental advertising and tenant selection (see real-estate corpus) (`property-mgmt-fair-housing-crossref`)
- **Severity:** 🟡 advisory · **Status:** draft
- **Citation:** 42 USC §§ 3601–3619 (Fair Housing Act); 24 CFR Part 100
  — https://www.law.cornell.edu/uscode/text/42/chapter-45 (read 2026-05-12)
- **Summary:** Fair Housing Act and HUD advertising guidance apply equally to rental listings, tenant screening, and reasonable-accommodation requests. The literal trigger list lives in the real-estate corpus.
- **Drafter notes:** Counsel: confirm cross-corpus loading semantics are acceptable — the alternative is duplicating the HUD trigger list, which creates a drift risk between the two corpora.

> [CROSS-REFERENCE] Property-management drafts (rental listings, tenant communications, application screening, reasonable-accommodation responses) are evaluated against the Fair Housing trigger list in the real-estate corpus. See:
> 
>   lib/agents/sentinel/corpus/real-estate/fair-housing-hud-literal.ts
> 
> That file is the single source of truth for HUD-literal triggers across the protected classes (race, color, national origin, religion, sex, familial status, disability). Sentinel automatically loads it when scanning a property-management workspace; no duplicate phrase list lives here.

#### Georgia landlord — duty to repair and warranty against waiver (`ga-landlord-duty-to-repair`)
- **Severity:** 🟡 advisory · **Status:** draft
- **Citation:** O.C.G.A. § 44-7-13 (duty to repair); O.C.G.A. § 44-7-2 (no waiver of statutory duties in residential leases)
  — https://law.justia.com/codes/georgia/title-44/chapter-7/article-1/ (read 2026-05-12)
- **Summary:** The landlord is bound to keep the premises in repair and is liable for damages arising from defective construction or failure to keep the premises in repair. In residential leases, the landlord may not by contract waive or transfer this duty.
- **Drafter notes:** Counsel: please verify literal wording. § 44-7-13 is short and well-known; § 44-7-2(b) subsection numbering should be confirmed against the current code.

> [UNVERIFIED — needs counsel] Substance from O.C.G.A. § 44-7-13 and § 44-7-2:
> 
> § 44-7-13: The landlord must keep the premises in repair. He shall be liable for all substantial improvements placed upon the premises by his consent.
> 
> § 44-7-2(b): In any contract, lease, license agreement, or similar agreement, oral or written, for the use or rental of real property as a dwelling place, the landlord or the tenant may not waive, assign, transfer, or otherwise avoid any of the rights, duties, or remedies contained in the following provisions of law:
>   (1) Article 2 of this chapter, relating to security deposits;
>   (2) Code Section 44-7-13, relating to the duties of a landlord as to repairs and improvements;
>   (3) Code Section 44-7-14, relating to the liability of a landlord for damages from defective construction and for damages from failure to keep the premises in repair;
>   (4) Article 3 of this chapter, relating to proceedings against tenants holding over.

#### Georgia security deposit — escrow handling and one-month return (`ga-security-deposit-handling`)
- **Severity:** 🟡 advisory · **Status:** draft
- **Citation:** O.C.G.A. § 44-7-31 (escrow); O.C.G.A. § 44-7-34 (return); O.C.G.A. § 44-7-33 (move-out inspection list)
  — https://law.justia.com/codes/georgia/title-44/chapter-7/article-2/ (read 2026-05-12)
- **Summary:** Security deposits must be held in an escrow account in a federally insured bank in Georgia; the landlord must return the deposit (or an itemized list of damages with the balance) within one month after the tenant surrenders the premises.
- **Drafter notes:** Counsel: please confirm the literal wording — the above is drafted from drafter recollection of the statutory text and is functionally close but may differ in punctuation/clause order from the canonical O.C.G.A. rendering. Treat as substantive-but-unverified.

> [UNVERIFIED — needs counsel] Substance, drawn from O.C.G.A. § 44-7-31 and § 44-7-34:
> 
> § 44-7-31 (escrow): Whenever a security deposit is held by a landlord or such landlord's agent on behalf of a tenant, the deposit shall be held in escrow in a trust account used only for that purpose in any bank or lending institution subject to regulation by this state or any agency of the United States. The tenant shall be informed in writing of the location and account number of the escrow account.
> 
> § 44-7-34 (return): Within one month after the termination of the residential lease or the surrender and acceptance of the premises, whichever last occurs, the landlord shall return to the tenant the full security deposit which was deposited with the landlord by the tenant. No security deposit shall be retained to cover ordinary wear and tear which occurred as a result of the use of the premises for the purposes for which the premises were intended, provided that there was no negligence, carelessness, accident, or abuse of the premises by the tenant or members of the tenant's household or their guests or invitees. If the landlord retains any portion of the security deposit, the landlord shall provide the tenant with a written statement listing the exact reasons for the retention.

#### Georgia dispossessory — demand for possession required; self-help eviction forbidden (`ga-dispossessory-procedure`)
- **Severity:** 🟡 advisory · **Status:** draft
- **Citation:** O.C.G.A. § 44-7-50 (demand for possession); O.C.G.A. § 44-7-51 (affidavit and summons); O.C.G.A. § 44-7-55 (judgment and writ of possession)
  — https://law.justia.com/codes/georgia/title-44/chapter-7/article-3/ (read 2026-05-12)
- **Summary:** Before filing a dispossessory action, the landlord must demand possession from the tenant. Self-help eviction (changing locks, removing belongings, cutting utilities) is not permitted; possession is recovered only by court order.
- **Drafter notes:** Counsel: this is a long subsection — please verify the literal text matches the current O.C.G.A. § 44-7-50 rendering. Sentinel routing should also flag any draft proposing self-help eviction (lockout, utility shutoff) — that prohibition is from case law, not from the statute itself; consider whether to add a companion case-law citation.

> [UNVERIFIED — needs counsel] Substance from O.C.G.A. § 44-7-50:
> 
> In all cases when a tenant holds possession of lands or tenements over and beyond the term for which they were rented or leased to such tenant, or fails to pay the rent when it becomes due, and in all cases when lands or tenements are held and occupied by any tenant at will or sufferance, whether under contract of rent or not, when the owner of such lands or tenements desires possession of the same, such owner may, individually or by an agent or attorney at law or attorney in fact, demand the possession of the property so rented, leased, held, or occupied. If the tenant refuses or fails to deliver possession when so demanded, the owner or the agent or attorney at law or attorney in fact of such owner may immediately go before the judge of the superior court, the judge of the state court, or the clerk or deputy clerk of either court, or before the judge or the clerk or deputy clerk of any other court with jurisdiction over the subject matter, or a magistrate in the district where the land lies, and make an affidavit under oath to the facts.

## 5. Questions for counsel

**Corpus open questions (drafter → counsel):**

- [ ] Fair Housing rules are shared with the real-estate corpus and referenced (not duplicated). Counsel to confirm shared-corpus access semantics.
- [ ] GA security deposit holding-period and return-timeline literal (O.C.G.A. § 44-7-31, § 44-7-34) should be verified against the current code edition.
- [ ] Dispossessory procedure (O.C.G.A. § 44-7-50 et seq.) — drafter quoted the demand-for-possession requirement; counsel to confirm the seven-day answer window has not changed.
- [ ] Per-state expansion deferred: corpus currently covers GA only. Hooks present for adding additional states.
- [ ] CANDIDATE TRIGGERS (2026-05-25 wave): `rental-advertising-candidates-literal.ts` ships 53 candidate rental-ad phrases — 46 ported VERBATIM from the real-estate HUD § 804(c) literal list (because `loadCorpusFor()` keys on verticalSlug only and does not cross-load real-estate's corpus for property-management workspaces) plus 7 source-of-income phrases ('no section 8', 'no vouchers', 'no DSS', 'no welfare'). Sentinel does NOT fire on these — counsel to red-line phrase-by-phrase.
- [ ] CANDIDATE TRIGGERS — counsel decision: should the PM corpus literally duplicate the HUD trigger list (drift risk between two files) or should `loadCorpusFor()` be extended to cross-load real-estate's corpus when scanning a PM workspace? Engineering can implement either — load-bearing call.
- [ ] CANDIDATE TRIGGERS — counsel decision: source-of-income phrases ('no section 8', 'no vouchers', 'no DSS', 'no welfare') are federally legal but illegal in 19+ states / many cities. Counsel to advise per operating jurisdiction; rule should likely carry per-state scope metadata before flipping verified.

**Per-rule drafter notes (most ambiguous first):**

- **Georgia security deposit — escrow handling and one-month return** (`ga-security-deposit-handling`): Counsel: please confirm the literal wording — the above is drafted from drafter recollection of the statutory text and is functionally close but may differ in punctuation/clause order from the canonical O.C.G.A. rendering. Treat as substantive-but-unverified.
- **Property management rental advertising — candidate triggers (DRAFT)** (`property-management-rental-advertising-candidates`): Drafted 2026-05-25. The 46 HUD-list phrases are ported VERBATIM from `lib/agents/sentinel/corpus/real-estate/fair-housing-hud-literal.ts` — counsel should review whether duplicating the list is acceptable or whether the loader should be extended to cross-load (which would avoid the drift risk between the two files). The source-of-income block ('no section 8', 'no vouchers', 'no DSS', 'no welfare') is genuinely jurisdiction-dependent: federally legal, illegal in 19+ states and many cities. Counsel: confirm operating jurisdiction(s) before flipping verified, and consider state-scoped category metadata so the rule fires only for PM workspaces operating in source-of-income-protected jurisdictions.
- **Fair Housing — applies to rental advertising and tenant selection (see real-estate corpus)** (`property-mgmt-fair-housing-crossref`): Counsel: confirm cross-corpus loading semantics are acceptable — the alternative is duplicating the HUD trigger list, which creates a drift risk between the two corpora.
- **Georgia landlord — duty to repair and warranty against waiver** (`ga-landlord-duty-to-repair`): Counsel: please verify literal wording. § 44-7-13 is short and well-known; § 44-7-2(b) subsection numbering should be confirmed against the current code.
- **Georgia dispossessory — demand for possession required; self-help eviction forbidden** (`ga-dispossessory-procedure`): Counsel: this is a long subsection — please verify the literal text matches the current O.C.G.A. § 44-7-50 rendering. Sentinel routing should also flag any draft proposing self-help eviction (lockout, utility shutoff) — that prohibition is from case law, not from the statute itself; consider whether to add a companion case-law citation.
