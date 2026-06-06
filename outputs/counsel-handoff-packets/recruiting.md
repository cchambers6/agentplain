# Counsel handoff packet — Recruiting compliance corpus

> **DRAFT — not legal advice.** This packet is a fleet-drafted compliance corpus for attorney review. No rule fires on customer drafts until counsel red-lines it AND the vertical is enabled via `COMPLIANCE_CORPUS_COUNSEL_REVIEWED`. Sentinel ADVISES; it never blocks a send.

## Status

- **Vertical:** `recruiting`
- **Corpus status:** DRAFT
- **Last reviewed:** 2026-05-25
- **Counsel reviewer:** _none yet_
- **Packet generated:** 2026-05-25

### Coverage at a glance

| Bucket | Count |
| --- | --- |
| Live literal triggers (firing today) | 0 |
| Candidate literal triggers (to red-line) | 27 |
| Candidate regex triggers (to red-line) | 0 |
| Counsel-reference rules | 6 |
| Open questions | 7 |

## 1. Live literal triggers (firing on drafts today)

_None. This corpus is DRAFT — no rule is counsel-verified, so the scanner fires on nothing yet. Phrases below are candidates for review._

## 2. Candidate literal triggers — counsel red-line, phrase by phrase

_Sentinel does NOT fire on these. Check a box to approve a phrase as a literal-match trigger; strike, reword, or demote to counsel-reference otherwise._

#### EEOC / ADEA / Title VII / ADA — candidate job-posting triggers (DRAFT) (`eeoc-job-posting-candidates`)
- **Severity:** 🟡 advisory
- **Category:** job-advertising
- **Citation:** 29 USC § 623(e) (ADEA); 42 USC § 2000e-3(b) (Title VII); 42 USC § 12112 (ADA); EEOC Compliance Manual
  — https://www.eeoc.gov/laws/guidance/section-12-religious-discrimination (read 2026-05-25)
- **Drafter notes:** Drafted 2026-05-25. Age proxies ('young', 'energetic', 'recent grad', 'digital native') are the most commonly cited ADEA § 4(e) phrases in EEOC complaints (see EEOC v. iGate, EEOC v. Texas Roadhouse). Gender-coded job titles ('salesman', 'waitress', etc.) are the canonical Title VII § 704(b) targets — most employers now use the neutral form ('salesperson', 'server'). 'Must be a U.S. citizen' has a narrow legitimate exception under IRCA for positions where citizenship is legally required (federal contracts, some classified work), so counsel should consider scoping. 'Able-bodied' is a near-per-se ADA violation in job postings absent a bona-fide essential-functions justification. Phrases intentionally held back for counsel: 'Christian environment' / 'Christian workplace' (religious-employer exception under Title VII § 702(a) makes this context-sensitive); 'no felons' (state-level ban-the-box laws differ widely — recommend counsel-reference + state-specific overlay).
- **Candidate phrases to red-line (27):**
  - [ ] `young`
  - [ ] `youthful`
  - [ ] `energetic`
  - [ ] `recent graduate`
  - [ ] `recent college graduate`
  - [ ] `recent grad`
  - [ ] `digital native`
  - [ ] `mature applicant`
  - [ ] `salesman`
  - [ ] `saleswoman`
  - [ ] `waitress`
  - [ ] `stewardess`
  - [ ] `businessman`
  - [ ] `girl friday`
  - [ ] `handyman`
  - [ ] `policeman`
  - [ ] `fireman`
  - [ ] `draftsman`
  - [ ] `manpower`
  - [ ] `native english speaker`
  - [ ] `must be a u.s. citizen`
  - [ ] `u.s. citizens only`
  - [ ] `no foreigners`
  - [ ] `able-bodied`
  - [ ] `able bodied`
  - [ ] `must be physically fit`
  - [ ] `no disabilities`

## 3. Candidate regex triggers — counsel red-line

_Deterministic patterns for cases a literal phrase list can't express. Each shows the string it must match and a near-miss it must not._

_None._

## 4. Counsel-reference rules — substantive law, never auto-flagged

#### Title VII — unlawful employment practices (`title-vii-prohibition`)
- **Severity:** 🟡 advisory · **Status:** draft
- **Citation:** 42 USC § 2000e-2(a)
  — https://www.law.cornell.edu/uscode/text/42/2000e-2 (read 2026-05-12)
- **Summary:** It is unlawful for a covered employer to refuse to hire, discharge, or otherwise discriminate against any individual with respect to compensation, terms, conditions, or privileges of employment because of race, color, religion, sex, or national origin.
- **Drafter notes:** Bostock v. Clayton County (2020) clarified that 'sex' in Title VII covers sexual orientation and gender identity. Counsel: confirm whether sentinel should surface a Bostock-anchored companion entry explicitly.

> (a) Employer practices
> It shall be an unlawful employment practice for an employer—
> (1) to fail or refuse to hire or to discharge any individual, or otherwise to discriminate against any individual with respect to his compensation, terms, conditions, or privileges of employment, because of such individual's race, color, religion, sex, or national origin; or
> (2) to limit, segregate, or classify his employees or applicants for employment in any way which would deprive or tend to deprive any individual of employment opportunities or otherwise adversely affect his status as an employee, because of such individual's race, color, religion, sex, or national origin.

#### ADA Title I — disability discrimination in employment (`ada-title-i-prohibition`)
- **Severity:** 🟡 advisory · **Status:** draft
- **Citation:** 42 USC § 12112(a)
  — https://www.law.cornell.edu/uscode/text/42/12112 (read 2026-05-12)
- **Summary:** No covered entity shall discriminate against a qualified individual on the basis of disability in regard to job application procedures, hiring, advancement, discharge, compensation, training, and other terms, conditions, and privileges of employment.
- **Drafter notes:** Sentinel should pair this with the 'reasonable accommodation' requirement at 42 USC § 12112(b)(5)(A); recommend a companion literal in counsel's next pass.

> (a) General rule
> No covered entity shall discriminate against a qualified individual on the basis of disability in regard to job application procedures, the hiring, advancement, or discharge of employees, employee compensation, job training, and other terms, conditions, and privileges of employment.

#### ADEA — prohibition on age discrimination (40 and over) (`adea-prohibition`)
- **Severity:** 🟡 advisory · **Status:** draft
- **Citation:** 29 USC § 623(a); 29 USC § 631(a) (age 40+ coverage)
  — https://www.law.cornell.edu/uscode/text/29/623 (read 2026-05-12)
- **Summary:** It is unlawful for a covered employer to refuse to hire or discriminate against any individual with respect to compensation, terms, conditions, or privileges of employment because of such individual's age, where the individual is at least 40 years of age.

> (a) Employer practices
> It shall be unlawful for an employer—
> (1) to fail or refuse to hire or to discharge any individual or otherwise discriminate against any individual with respect to his compensation, terms, conditions, or privileges of employment, because of such individual's age;
> (2) to limit, segregate, or classify his employees in any way which would deprive or tend to deprive any individual of employment opportunities or otherwise adversely affect his status as an employee, because of such individual's age; or
> (3) to reduce the wage rate of any employee in order to comply with this chapter.
> 
> (See also 29 USC § 631(a) limiting coverage to individuals who are at least 40 years of age.)

#### FCRA — pre-employment consumer report disclosure and authorization (`fcra-pre-employment-disclosure`)
- **Severity:** 🟡 advisory · **Status:** draft
- **Citation:** 15 USC § 1681b(b)(2)(A)
  — https://www.law.cornell.edu/uscode/text/15/1681b (read 2026-05-12)
- **Summary:** Before procuring a consumer report on a job applicant for employment purposes, the user must (1) make a clear and conspicuous disclosure in writing in a document that consists solely of the disclosure that a consumer report may be obtained, and (2) obtain the applicant's written authorization.
- **Drafter notes:** Pre-adverse / adverse action requirements at 15 USC § 1681b(b)(3) are the companion rule sentinel should also load; recommend counsel pass adds that literal.

> (2) Disclosure to consumer
> (A) In general
> Except as provided in subparagraph (B), a person may not procure a consumer report, or cause a consumer report to be procured, for employment purposes with respect to any consumer, unless—
> (i) a clear and conspicuous disclosure has been made in writing to the consumer at any time before the report is procured or caused to be procured, in a document that consists solely of the disclosure, that a consumer report may be obtained for employment purposes; and
> (ii) the consumer has authorized in writing (which authorization may be made on the document referred to in clause (i)) the procurement of the report by that person.

#### FLSA — executive, administrative, professional, outside-sales, computer exemptions (`flsa-white-collar-exemptions`)
- **Severity:** 🟡 advisory · **Status:** draft
- **Citation:** 29 USC § 213(a)(1); implementing regulations 29 CFR Part 541
  — https://www.law.cornell.edu/uscode/text/29/213 (read 2026-05-12)
- **Summary:** The FLSA minimum wage and overtime requirements do not apply to employees who satisfy the white-collar (executive, administrative, professional), outside-sales, or computer-employee exemptions; eligibility is determined by salary basis, salary level, and duties tests at 29 CFR Part 541.
- **Drafter notes:** 29 CFR Part 541 carries the operative duties tests + the salary-level threshold (currently $684/week and subject to DOL rulemaking — counsel: check the current threshold at time of review).

> (a) Minimum wage and maximum hour requirements
> The provisions of sections 206 (except subsection (d) in the case of paragraph (1) of this subsection) and 207 of this title shall not apply with respect to—
> (1) any employee employed in a bona fide executive, administrative, or professional capacity (including any employee employed in the capacity of academic administrative personnel or teacher in elementary or secondary schools), or in the capacity of outside salesman (as such terms are defined and delimited from time to time by regulations of the Secretary, subject to the provisions of subchapter II of chapter 5 of title 5, except that an employee of a retail or service establishment shall not be excluded from the definition of employee employed in a bona fide executive or administrative capacity because of the number of hours in his workweek which he devotes to activities not directly or closely related to the performance of executive or administrative activities, if less than 50 per centum of such employee's hours worked in the workweek are devoted to such activities)…

#### Georgia right-to-work — no compulsory union membership (`ga-right-to-work`)
- **Severity:** 🟡 advisory · **Status:** draft
- **Citation:** O.C.G.A. § 34-6-21 (right-to-work); see also § 34-6-20 to § 34-6-25
  — https://law.justia.com/codes/georgia/title-34/chapter-6/article-2/ (read 2026-05-12)
- **Summary:** Membership or non-membership in a labor organization shall not be made a condition of employment or continuation of employment by any employer; and no individual shall be required to pay any fee, assessment, or other charge of any kind to any labor organization as a condition of employment.
- **Drafter notes:** Counsel: please verify literal wording of O.C.G.A. § 34-6-21 — drafter substance is high-confidence but should be confirmed against current code.

> [UNVERIFIED — needs counsel] Substance: O.C.G.A. § 34-6-21: No individual shall be required as a condition of employment or continuance of employment to be or remain a member or an affiliate of a labor organization or to resign from or to refrain from membership in or affiliation with a labor organization. Any contract or agreement made or entered into in violation of this Code section is declared to be null and void and against public policy.

## 5. Questions for counsel

**Corpus open questions (drafter → counsel):**

- [ ] Title VII / ADA / ADEA quoted directly from US Code — counsel to confirm current wording against latest amendments (PWFA 2023 may interact with Title VII coverage).
- [ ] FCRA § 1681b(b)(2)(A) wording is load-bearing for background-check workflows — please verify literal.
- [ ] FLSA exemption categories (executive, administrative, professional, outside sales, computer) are summarized via the test in 29 USC § 213(a)(1); the operative duties tests sit in 29 CFR Part 541. Counsel: confirm whether sentinel needs Part 541 duties-test text in addition.
- [ ] Georgia right-to-work statute (O.C.G.A. § 34-6-21) drafted from substance recollection; counsel verifies wording.
- [ ] CANDIDATE TRIGGERS (2026-05-25 wave): `eeoc-job-posting-candidates-literal.ts` ships 27 candidate job-ad phrases drafted from ADEA § 4(e), Title VII § 704(b), and ADA § 102 — age proxies ('young', 'recent grad', 'digital native'), gender-coded titles ('salesman', 'waitress'), national-origin restrictions ('native english speaker', 'u.s. citizens only'), and disability proxies ('able-bodied'). Sentinel does NOT fire on these — counsel to red-line phrase-by-phrase.
- [ ] CANDIDATE TRIGGERS — counsel decision: 'must be a U.S. citizen' has a narrow IRCA exception for federal contracts / classified positions. Counsel to advise whether the rule should be scoped or whether the literal-match is acceptable with operator-review routing.
- [ ] CANDIDATE TRIGGERS — held back for counsel: 'Christian environment' (religious-employer exception under Title VII § 702(a)); 'no felons' (state-level ban-the-box variation). Both recommended as counsel-reference rather than literal-match.

**Per-rule drafter notes (most ambiguous first):**

- **EEOC / ADEA / Title VII / ADA — candidate job-posting triggers (DRAFT)** (`eeoc-job-posting-candidates`): Drafted 2026-05-25. Age proxies ('young', 'energetic', 'recent grad', 'digital native') are the most commonly cited ADEA § 4(e) phrases in EEOC complaints (see EEOC v. iGate, EEOC v. Texas Roadhouse). Gender-coded job titles ('salesman', 'waitress', etc.) are the canonical Title VII § 704(b) targets — most employers now use the neutral form ('salesperson', 'server'). 'Must be a U.S. citizen' has a narrow legitimate exception under IRCA for positions where citizenship is legally required (federal contracts, some classified work), so counsel should consider scoping. 'Able-bodied' is a near-per-se ADA violation in job postings absent a bona-fide essential-functions justification. Phrases intentionally held back for counsel: 'Christian environment' / 'Christian workplace' (religious-employer exception under Title VII § 702(a) makes this context-sensitive); 'no felons' (state-level ban-the-box laws differ widely — recommend counsel-reference + state-specific overlay).
- **Title VII — unlawful employment practices** (`title-vii-prohibition`): Bostock v. Clayton County (2020) clarified that 'sex' in Title VII covers sexual orientation and gender identity. Counsel: confirm whether sentinel should surface a Bostock-anchored companion entry explicitly.
- **ADA Title I — disability discrimination in employment** (`ada-title-i-prohibition`): Sentinel should pair this with the 'reasonable accommodation' requirement at 42 USC § 12112(b)(5)(A); recommend a companion literal in counsel's next pass.
- **FCRA — pre-employment consumer report disclosure and authorization** (`fcra-pre-employment-disclosure`): Pre-adverse / adverse action requirements at 15 USC § 1681b(b)(3) are the companion rule sentinel should also load; recommend counsel pass adds that literal.
- **FLSA — executive, administrative, professional, outside-sales, computer exemptions** (`flsa-white-collar-exemptions`): 29 CFR Part 541 carries the operative duties tests + the salary-level threshold (currently $684/week and subject to DOL rulemaking — counsel: check the current threshold at time of review).
- **Georgia right-to-work — no compulsory union membership** (`ga-right-to-work`): Counsel: please verify literal wording of O.C.G.A. § 34-6-21 — drafter substance is high-confidence but should be confirmed against current code.
