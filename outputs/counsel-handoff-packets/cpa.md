# Counsel handoff packet — CPA compliance corpus

> **DRAFT — not legal advice.** This packet is a fleet-drafted compliance corpus for attorney review. No rule fires on customer drafts until counsel red-lines it AND the vertical is enabled via `COMPLIANCE_CORPUS_COUNSEL_REVIEWED`. Sentinel ADVISES; it never blocks a send.

## Status

- **Vertical:** `cpa`
- **Corpus status:** DRAFT
- **Last reviewed:** 2026-05-25
- **Counsel reviewer:** _none yet_
- **Packet generated:** 2026-05-25

### Coverage at a glance

| Bucket | Count |
| --- | --- |
| Live literal triggers (firing today) | 0 |
| Candidate literal triggers (to red-line) | 10 |
| Candidate regex triggers (to red-line) | 0 |
| Counsel-reference rules | 6 |
| Open questions | 6 |

## 1. Live literal triggers (firing on drafts today)

_None. This corpus is DRAFT — no rule is counsel-verified, so the scanner fires on nothing yet. Phrases below are candidates for review._

## 2. Candidate literal triggers — counsel red-line, phrase by phrase

_Sentinel does NOT fire on these. Check a box to approve a phrase as a literal-match trigger; strike, reword, or demote to counsel-reference otherwise._

#### Circular 230 § 10.30 — candidate advertising/solicitation triggers (DRAFT) (`circular-230-solicitation-candidates`)
- **Severity:** 🟡 advisory
- **Category:** advertising
- **Citation:** 31 CFR § 10.30(a)(1)
  — https://www.ecfr.gov/current/title-31/subtitle-A/chapter-I/subpart-B/section-10.30 (read 2026-05-25)
- **Drafter notes:** Drafted 2026-05-25 from § 10.30(a)(1)'s prohibition on (a) misleading claims about qualifications and (b) intimating special IRS consideration. Phrases like 'guaranteed refund' double as classic AICPA Code 1.400 'false, misleading, or deceptive' targets — counsel should consider whether to anchor the rule to BOTH § 10.30 and AICPA 1.400 or split into two rules. Borderline omissions: 'tax expert', 'tax specialist', 'former IRS' (all context-dependent — recommend counsel-reference).
- **Candidate phrases to red-line (10):**
  - [ ] `guaranteed refund`
  - [ ] `guaranteed irs approval`
  - [ ] `guaranteed audit protection`
  - [ ] `irs approved`
  - [ ] `irs endorsed`
  - [ ] `official irs approved`
  - [ ] `special access to the irs`
  - [ ] `inside connections at the irs`
  - [ ] `we can get you out of any audit`
  - [ ] `audit-proof`

## 3. Candidate regex triggers — counsel red-line

_Deterministic patterns for cases a literal phrase list can't express. Each shows the string it must match and a near-miss it must not._

_None._

## 4. Counsel-reference rules — substantive law, never auto-flagged

#### Circular 230 § 10.29 — conflicting interests (`circular-230-conflicts-10-29`)
- **Severity:** 🟡 advisory · **Status:** draft
- **Citation:** 31 CFR § 10.29
  — https://www.ecfr.gov/current/title-31/subtitle-A/part-10/subpart-B/section-10.29 (read 2026-05-12)
- **Summary:** A practitioner may not represent a client before the IRS if the representation involves a concurrent conflict of interest, unless the practitioner reasonably believes adequate representation can be provided, the representation is not prohibited by law, and each affected client gives informed written consent.
- **Drafter notes:** Counsel: please verify the 36-month retention requirement and 30-day confirmation window — these are the operationally load-bearing details sentinel would flag against.

> [UNVERIFIED — needs counsel] Substance of 31 CFR § 10.29:
> 
> (a) Except as provided by paragraph (b) of this section, a practitioner shall not represent a client before the Internal Revenue Service if the representation involves a conflict of interest. A conflict of interest exists if—
>   (1) The representation of one client will be directly adverse to another client; or
>   (2) There is a significant risk that the representation of one or more clients will be materially limited by the practitioner's responsibilities to another client, a former client or a third person, or by a personal interest of the practitioner.
> (b) Notwithstanding the existence of a conflict of interest under paragraph (a) of this section, the practitioner may represent a client if—
>   (1) The practitioner reasonably believes that the practitioner will be able to provide competent and diligent representation to each affected client;
>   (2) The representation is not prohibited by law; and
>   (3) Each affected client waives the conflict of interest and gives informed consent, confirmed in writing by each affected client, at the time the existence of the conflict of interest is known by the practitioner. The confirmation may be made within a reasonable period after the informed consent, but in no event later than 30 days.
> (c) Copies of the written consents must be retained by the practitioner for at least 36 months from the date of the conclusion of the representation of the affected clients, and the written consents must be provided to any officer or employee of the Internal Revenue Service on request.

#### Circular 230 § 10.27 — fees (contingent-fee restriction) (`circular-230-fees-10-27`)
- **Severity:** 🟡 advisory · **Status:** draft
- **Citation:** 31 CFR § 10.27
  — https://www.ecfr.gov/current/title-31/subtitle-A/part-10/subpart-B/section-10.27 (read 2026-05-12)
- **Summary:** A practitioner may not charge an unconscionable fee, and may not charge a contingent fee for services rendered in connection with any matter before the IRS except in three narrow situations (representation in connection with an examination of an original return, claims for refund filed solely in connection with the determination of statutory interest or penalties, or judicial proceedings under the Internal Revenue Code).
- **Drafter notes:** Counsel: please verify the 120-day window in (b)(2)(ii) and the contingent-fee definition in (c)(1) — these are the load-bearing details for sentinel pattern matching on fee-arrangement drafts.

> [UNVERIFIED — needs counsel] Substance of 31 CFR § 10.27:
> 
> (a) In general. A practitioner may not charge an unconscionable fee in connection with any matter before the Internal Revenue Service.
> (b) Contingent fees—
>   (1) Except as provided in paragraphs (b)(2), (3), and (4) of this section, a practitioner may not charge a contingent fee for services rendered in connection with any matter before the Internal Revenue Service.
>   (2) A practitioner may charge a contingent fee for services rendered in connection with the Service's examination of, or challenge to—
>     (i) An original tax return; or
>     (ii) An amended return or claim for refund or credit where the amended return or claim for refund or credit was filed within 120 days of the taxpayer receiving a written notice of the examination of, or a written challenge to, the original tax return.
>   (3) A practitioner may charge a contingent fee for services rendered in connection with a claim for credit or refund filed solely in connection with the determination of statutory interest or penalties assessed by the Internal Revenue Service.
>   (4) A practitioner may charge a contingent fee for services rendered in connection with any judicial proceeding arising under the Internal Revenue Code.
> 
> (c) Definitions. For purposes of this section—
>   (1) Contingent fee is any fee that is based, in whole or in part, on whether or not a position taken on a tax return or other filing avoids challenge by the Internal Revenue Service or is sustained either by the Internal Revenue Service or in litigation. A contingent fee includes a fee that is based on a percentage of the refund reported on a return, that is based on a percentage of the taxes saved, or that otherwise depends on the specific result attained.

#### Circular 230 § 10.22 — diligence as to accuracy (`circular-230-diligence-10-22`)
- **Severity:** 🟡 advisory · **Status:** draft
- **Citation:** 31 CFR § 10.22
  — https://www.ecfr.gov/current/title-31/subtitle-A/part-10/subpart-B/section-10.22 (read 2026-05-12)
- **Summary:** A practitioner must exercise due diligence in preparing, approving, and filing returns and other papers relating to IRS matters; in determining the correctness of oral or written representations made to the Department of the Treasury; and in determining the correctness of oral or written representations made to clients.

> [UNVERIFIED — needs counsel] Substance of 31 CFR § 10.22:
> 
> (a) In general. A practitioner must exercise due diligence—
>   (1) In preparing or assisting in the preparation of, approving, and filing tax returns, documents, affidavits, and other papers relating to Internal Revenue Service matters;
>   (2) In determining the correctness of oral or written representations made by the practitioner to the Department of the Treasury; and
>   (3) In determining the correctness of oral or written representations made by the practitioner to clients with reference to any matter administered by the Internal Revenue Service.
> 
> (b) Reliance on others. Except as modified by §§ 10.34 and 10.37, a practitioner will be presumed to have exercised due diligence for purposes of this section if the practitioner relies on the work product of another person and the practitioner used reasonable care in engaging, supervising, training, and evaluating the person, taking proper account of the nature of the relationship between the practitioner and the person.

#### AICPA Code — Confidential Client Information Rule (`aicpa-confidential-client-information`)
- **Severity:** 🟡 advisory · **Status:** draft
- **Citation:** AICPA Code of Professional Conduct § 1.700.001 (Confidential Client Information Rule)
  — https://us.aicpa.org/research/standards/codeofconduct (read 2026-05-12)
- **Summary:** An AICPA member in public practice may not disclose any confidential client information without the specific consent of the client, subject to limited exceptions for compulsory legal process, ethics investigations, peer review, and similar circumstances.
- **Drafter notes:** Counsel: confirm 2014-restructured AICPA Code numbering (1.700.001) is still the current locator.

> [UNVERIFIED — needs counsel] Substance of AICPA Code § 1.700.001:
> 
> A member in public practice shall not disclose any confidential client information without the specific consent of the client. This rule shall not be construed (1) to relieve a member of his or her professional obligations of the Compliance With Standards Rule [1.310.001] or the Accounting Principles Rule [1.320.001], (2) to affect in any way the member's obligation to comply with a validly issued and enforceable subpoena or summons, or to prohibit a member's compliance with applicable laws and government regulations, (3) to prohibit review of a member's professional practice under AICPA or state CPA society or Board of Accountancy authorization, or (4) to preclude a member from initiating a complaint with, or responding to any inquiry made by, the professional ethics division or trial board of the Institute or a duly constituted investigative or disciplinary body of a state CPA society or Board of Accountancy.
> 
> Members of any of the bodies identified in (4) above and members involved with professional practice reviews identified in (3) above shall not use to their own advantage or disclose any member's confidential client information that comes to their attention in carrying out those activities. This prohibition shall not restrict members' exchange of information in connection with the investigative or disciplinary proceedings described in (4) above or the professional practice reviews described in (3) above.

#### AICPA Code — Due Care Principle (Article V) (`aicpa-due-care-principle`)
- **Severity:** 🟡 advisory · **Status:** draft
- **Citation:** AICPA Code of Professional Conduct § 0.300.060 (Due Care Principle, Article V)
  — https://us.aicpa.org/research/standards/codeofconduct (read 2026-05-12)
- **Summary:** A member should observe the profession's technical and ethical standards, strive continually to improve competence and the quality of services, and discharge professional responsibility to the best of the member's ability.

> [UNVERIFIED — needs counsel] Substance of AICPA Code § 0.300.060 (Due Care):
> 
> .01 The quest for excellence is the essence of due care. Due care requires a member to discharge professional responsibilities with competence and diligence. It imposes the obligation to perform professional services to the best of a member's ability with concern for the best interest of those for whom the services are performed and consistent with the profession's responsibility to the public.
> 
> .02 Competence is derived from a synthesis of education and experience. It begins with a mastery of the common body of knowledge required for designation as a certified public accountant. The maintenance of competence requires a commitment to learning and professional improvement that must continue throughout a member's professional life. It is a member's individual responsibility. In all engagements and in all responsibilities, each member should undertake to achieve a level of competence that will assure that the quality of the member's services meets the high level of professionalism required by these Principles.
> 
> .03 Competence represents the attainment and maintenance of a level of understanding and knowledge that enables a member to render services with facility and acumen. It also establishes the limitations of a member's capabilities by dictating that consultation or referral may be required when a professional engagement exceeds the personal competence of a member or a member's firm. Each member is responsible for assessing his or her own competence—of evaluating whether education, experience, and judgment are adequate for the responsibility to be assumed.
> 
> .04 Members should be diligent in discharging responsibilities to clients, employers, and the public. Diligence imposes the responsibility to render services promptly and carefully, to be thorough, and to observe applicable technical and ethical standards.
> 
> .05 Due care requires a member to plan and supervise adequately any professional activity for which he or she is responsible.

#### Georgia State Board of Accountancy — licensure and discipline (`ga-board-accountancy`)
- **Severity:** 🟡 advisory · **Status:** draft
- **Citation:** O.C.G.A. Title 43, Chapter 3 (Public Accountancy); Rules of the Georgia State Board of Accountancy, Chapter 20
  — https://gsba.georgia.gov/ (read 2026-05-12)
- **Summary:** The Georgia State Board of Accountancy regulates CPAs in Georgia under O.C.G.A. Title 43, Chapter 3 — sets exam requirements, continuing professional education, and grounds for disciplinary action including dishonest practice and incompetence.
- **Drafter notes:** Counsel: please pull canonical text of the grounds-for-discipline section (likely O.C.G.A. § 43-3-19) and replace placeholder. Confirm the current Rules-of-the-Board chapter numbering.

> [UNVERIFIED — needs counsel] Substance: O.C.G.A. Title 43, Chapter 3 establishes the Georgia State Board of Accountancy and vests it with authority to license certified public accountants and registered firms practicing in Georgia. Grounds for disciplinary action enumerated in the chapter include: practice without a valid license; conviction of any felony or crime involving moral turpitude; fraud or deceit in obtaining a license; dishonesty, fraud, or gross negligence in the performance of professional services; violation of any rule of professional conduct promulgated by the Board; failure to comply with continuing professional education requirements; and conduct discreditable to the public accounting profession. Implementing rules at Rules of the Georgia State Board of Accountancy (Chapter 20-X) elaborate on professional standards, peer review, and CPE.

## 5. Questions for counsel

**Corpus open questions (drafter → counsel):**

- [ ] Circular 230 conflict-of-interest (§ 10.29), contingent-fee (§ 10.27), and diligence (§ 10.22) excerpts — counsel to verify against current Treasury rendering.
- [ ] AICPA Code of Professional Conduct excerpts (1.700.001 Confidential Client Information; 1.300.060 Due Professional Care) reference the 2014-restructured numbering — counsel to confirm currency.
- [ ] IRC § 7216 (criminal prohibition on disclosure of tax return information) drafted at scope level — counsel: confirm whether sentinel needs the literal § 7216 statutory text or only the FTC-style routing summary.
- [ ] GA State Board of Accountancy citations (O.C.G.A. § 43-3) flagged unverified.
- [ ] CANDIDATE TRIGGERS (2026-05-25 wave): `circular-230-solicitation-candidates-literal.ts` ships 10 candidate advertising phrases drafted from § 10.30(a)(1) (e.g. 'guaranteed refund', 'irs approved', 'special access to the irs'). Sentinel does NOT fire on these — counsel to red-line phrase-by-phrase before flipping `unverified: false`. Held-back borderline phrases ('tax expert', 'tax specialist', 'former IRS') listed in the rule's drafterNotes.
- [ ] CANDIDATE TRIGGERS — counsel decision: should the rule be split into (a) § 10.30(a)(1) Treasury triggers and (b) AICPA Code 1.400 'false, misleading, or deceptive' triggers, or kept as one rule citing both authorities?

**Per-rule drafter notes (most ambiguous first):**

- **Georgia State Board of Accountancy — licensure and discipline** (`ga-board-accountancy`): Counsel: please pull canonical text of the grounds-for-discipline section (likely O.C.G.A. § 43-3-19) and replace placeholder. Confirm the current Rules-of-the-Board chapter numbering.
- **Circular 230 § 10.30 — candidate advertising/solicitation triggers (DRAFT)** (`circular-230-solicitation-candidates`): Drafted 2026-05-25 from § 10.30(a)(1)'s prohibition on (a) misleading claims about qualifications and (b) intimating special IRS consideration. Phrases like 'guaranteed refund' double as classic AICPA Code 1.400 'false, misleading, or deceptive' targets — counsel should consider whether to anchor the rule to BOTH § 10.30 and AICPA 1.400 or split into two rules. Borderline omissions: 'tax expert', 'tax specialist', 'former IRS' (all context-dependent — recommend counsel-reference).
- **Circular 230 § 10.29 — conflicting interests** (`circular-230-conflicts-10-29`): Counsel: please verify the 36-month retention requirement and 30-day confirmation window — these are the operationally load-bearing details sentinel would flag against.
- **Circular 230 § 10.27 — fees (contingent-fee restriction)** (`circular-230-fees-10-27`): Counsel: please verify the 120-day window in (b)(2)(ii) and the contingent-fee definition in (c)(1) — these are the load-bearing details for sentinel pattern matching on fee-arrangement drafts.
- **AICPA Code — Confidential Client Information Rule** (`aicpa-confidential-client-information`): Counsel: confirm 2014-restructured AICPA Code numbering (1.700.001) is still the current locator.
