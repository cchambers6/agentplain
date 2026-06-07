# Counsel handoff packet — CPA compliance corpus

> **DRAFT — not legal advice.** This packet is a fleet-drafted compliance corpus for attorney review. No rule fires on customer drafts until counsel red-lines it AND the vertical is enabled via `COMPLIANCE_CORPUS_COUNSEL_REVIEWED`. Sentinel ADVISES; it never blocks a send.

## Status

- **Vertical:** `cpa`
- **Corpus status:** DRAFT
- **Last reviewed:** 2026-06-06
- **Counsel reviewer:** _none yet_
- **Packet generated:** 2026-06-06

### Coverage at a glance

| Bucket | Count |
| --- | --- |
| Live literal triggers (firing today) | 0 |
| Candidate literal triggers (to red-line) | 10 |
| Candidate regex triggers (to red-line) | 2 |
| Counsel-reference rules | 9 |
| Open questions | 5 |

## 1. Live literal triggers (firing on drafts today)

_None. This corpus is DRAFT — no rule is counsel-verified, so the scanner fires on nothing yet. Phrases below are candidates for review._

## 2. Candidate literal triggers — counsel red-line, phrase by phrase

_Sentinel does NOT fire on these. Check a box to approve a phrase as a literal-match trigger; strike, reword, or demote to counsel-reference otherwise._

#### Circular 230 § 10.30 — candidate advertising/solicitation triggers (DRAFT) (`circular-230-solicitation-candidates`)
- **Severity:** 🔴 blocking
- **Category:** advertising
- **Citation:** 31 CFR § 10.30(a)(1)
  — https://www.law.cornell.edu/cfr/text/31/10.30 (read 2026-06-06)
- **Safe rewrite:** Strike any claim that guarantees a tax outcome (refund, approval, audit result) or intimates special access to or influence over the IRS — both are per-se prohibited solicitation content under § 10.30(a)(1). Do not state or imply IRS approval/endorsement of the practitioner. Replace with substantiable, non-absolute language describing the service ('we prepare and review your return for accuracy') rather than promising a result.
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

#### Circular 230 § 10.30 — candidate advertising/solicitation triggers (DRAFT) (`circular-230-solicitation-candidates`)
- [ ] **Pattern:** `/guaranteed[^.!?\n]{0,30}\b(refund|approval|outcome|result)\b/i` — 🔴 blocking
  - Catches 'guaranteed … refund/approval/outcome' variants the literal list misses (intervening words), e.g. 'guaranteed maximum refund' or 'guaranteed IRS approval of your claim' — a § 10.30(a)(1) outcome-guarantee / misleading claim.
  - **Matches (intended):** "We promise you a guaranteed maximum refund every year."
  - **Does NOT match (guard):** "We work hard to maximize your refund every year."
- [ ] **Pattern:** `/special[^.!?\n]{0,30}\b(access|connection|connections)\b[^.!?\n]{0,20}\birs\b/i` — 🔴 blocking
  - Catches claims of 'special … (access|connection) … IRS' that intimate the practitioner can obtain special consideration from the Service — a per-se § 10.30(a)(1) prohibition — e.g. 'special insider connection at the IRS'.
  - **Matches (intended):** "Our firm has special insider connections inside the IRS."
  - **Does NOT match (guard):** "Our firm has special expertise in multi-state filings."

## 4. Counsel-reference rules — substantive law, never auto-flagged

#### Circular 230 § 10.29 — conflicting interests (`circular-230-conflicts-10-29`)
- **Severity:** 🟡 advisory · **Status:** draft
- **Citation:** 31 CFR § 10.29
  — https://www.law.cornell.edu/cfr/text/31/10.29 (read 2026-06-06)
- **Summary:** A practitioner may not represent a client before the IRS if the representation involves a concurrent conflict of interest, unless the practitioner reasonably believes adequate representation can be provided, the representation is not prohibited by law, and each affected client gives informed written consent.
- **Safe rewrite / guidance:** When a draft proposes representing two parties with adverse or potentially competing interests (e.g. both spouses in a contested matter, a business and a departing partner, buyer and seller), do not imply the engagement can proceed without the § 10.29(b)(3) informed written consent of each affected client. Strike language promising to act for 'both sides' or to keep one client's information from another. Confirm written consents are obtained and retained 36 months before the engagement proceeds.
- **Drafter notes:** Verified 2026-06-06 against Cornell LII mirror of 31 CFR § 10.29 — the (a)/(b)/(c) wording, the 30-day confirmation window in (b)(3), and the 36-month retention in (c) all match the published text. Counsel-reference: conflict detection requires judgment about the parties' interests, so sentinel does not auto-match it.

> 31 CFR § 10.29 — Conflicting interests.
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
  — https://www.law.cornell.edu/cfr/text/31/10.27 (read 2026-06-06)
- **Summary:** A practitioner may not charge an unconscionable fee, and may not charge a contingent fee for services rendered in connection with any matter before the IRS except in three narrow situations (representation in connection with an examination of an original return, claims for refund filed solely in connection with the determination of statutory interest or penalties, or judicial proceedings under the Internal Revenue Code).
- **Safe rewrite / guidance:** When a fee-arrangement draft offers to bill 'a percentage of your refund', 'a cut of the taxes we save you', or 'no fee unless we win', flag it: a contingent fee tied to a return position is barred under § 10.27(b)(1) outside the three narrow exceptions (original-return exam/challenge, statutory interest/penalty refund claims, judicial proceedings). Rewrite to a flat or hourly fee disclosed up front, or confirm the matter falls within a § 10.27(b)(2)-(4) exception before proposing a contingent fee.
- **Drafter notes:** Verified 2026-06-06 against Cornell LII mirror of 31 CFR § 10.27 — the unconscionable-fee bar in (a), the contingent-fee prohibition and (b)(2)-(4) exceptions, and the (c)(1) contingent-fee definition all match the published text. Counsel-reference: deciding whether a fee is 'contingent' or 'unconscionable' requires judgment, so sentinel does not auto-match; the candidate advertising rule carries the literal triggers.

> 31 CFR § 10.27 — Fees.
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
- **Severity:** ⚪ info · **Status:** draft
- **Citation:** 31 CFR § 10.22
  — https://www.law.cornell.edu/cfr/text/31/10.22 (read 2026-06-06)
- **Summary:** A practitioner must exercise due diligence in preparing, approving, and filing returns and other papers relating to IRS matters; in determining the correctness of oral or written representations made to the Department of the Treasury; and in determining the correctness of oral or written representations made to clients.
- **Safe rewrite / guidance:** When a draft promises a return, filing, or representation will be delivered without review (e.g. 'we'll file it as-is', 'no need to double-check your numbers', 'same-day filing, no questions asked'), surface § 10.22's due-diligence duty: the practitioner must exercise due diligence in preparing/approving/filing and in confirming the correctness of representations to Treasury and to the client. Rewrite to preserve a review/verification step rather than waiving it.
- **Drafter notes:** Verified 2026-06-06 against Cornell LII mirror of 31 CFR § 10.22 — both (a)(1)-(3) and the (b) reliance-on-others presumption (including the §§ 10.34/10.37 cross-reference) match the published text. Severity 'info': this is a duty-of-care/routing rule, not a draft-text per-se violation; counsel-reference because diligence is judgment-based.

> 31 CFR § 10.22 — Diligence as to accuracy.
> 
> (a) In general. A practitioner must exercise due diligence—
>   (1) In preparing or assisting in the preparation of, approving, and filing tax returns, documents, affidavits, and other papers relating to Internal Revenue Service matters;
>   (2) In determining the correctness of oral or written representations made by the practitioner to the Department of the Treasury; and
>   (3) In determining the correctness of oral or written representations made by the practitioner to clients with reference to any matter administered by the Internal Revenue Service.
> 
> (b) Reliance on others. Except as modified by §§ 10.34 and 10.37, a practitioner will be presumed to have exercised due diligence for purposes of this section if the practitioner relies on the work product of another person and the practitioner used reasonable care in engaging, supervising, training, and evaluating the person, taking proper account of the nature of the relationship between the practitioner and the person.

#### AICPA Code — Confidential Client Information Rule (`aicpa-confidential-client-information`)
- **Severity:** 🟡 advisory · **Status:** draft
- **Citation:** AICPA Code of Professional Conduct § 1.700.001 (Confidential Client Information Rule), effective December 15, 2014
  — https://pub.aicpa.org/codeofconduct/ethicsresources/et-cod.pdf (read 2026-06-06)
- **Summary:** An AICPA member in public practice may not disclose any confidential client information without the specific consent of the client, subject to limited exceptions for compulsory legal process, ethics investigations, peer review, and similar circumstances.
- **Safe rewrite / guidance:** When a draft would share client financials, identity, return data, or engagement details with a third party (a lender, a prospective buyer, a referral partner, a testimonial), confirm specific client consent first or strike the disclosure. Do not include identifiable client information in marketing, case studies, or references without written consent. Note the § 7216 criminal overlay for tax-return information (see `irc-7216-disclosure`).
- **Drafter notes:** Left unverified: 2026-06-06 web research confirmed the rule number (1.700.001), its 'shall not disclose any confidential client information without the specific consent of the client' core, and the Dec 15 2014 effective date (Journal of Accountancy; PwC Viewpoint), but the AICPA Code is a copyrighted pronouncement and the verbatim full text could not be machine-pulled from a stable authoritative URL. The citation URL points at AICPA's published et-cod.pdf. Counsel: confirm the exact (1)-(4) exception wording against the current et-cod.pdf.

> [UNVERIFIED — needs counsel] Substance of AICPA Code § 1.700.001:
> 
> A member in public practice shall not disclose any confidential client information without the specific consent of the client. This rule shall not be construed (1) to relieve a member of his or her professional obligations of the Compliance With Standards Rule [1.310.001] or the Accounting Principles Rule [1.320.001], (2) to affect in any way the member's obligation to comply with a validly issued and enforceable subpoena or summons, or to prohibit a member's compliance with applicable laws and government regulations, (3) to prohibit review of a member's professional practice under AICPA or state CPA society or Board of Accountancy authorization, or (4) to preclude a member from initiating a complaint with, or responding to any inquiry made by, the professional ethics division or trial board of the Institute or a duly constituted investigative or disciplinary body of a state CPA society or Board of Accountancy.
> 
> Members of any of the bodies identified in (4) above and members involved with professional practice reviews identified in (3) above shall not use to their own advantage or disclose any member's confidential client information that comes to their attention in carrying out those activities. This prohibition shall not restrict members' exchange of information in connection with the investigative or disciplinary proceedings described in (4) above or the professional practice reviews described in (3) above.

#### AICPA Code — Due Care Principle (Article V) (`aicpa-due-care-principle`)
- **Severity:** ⚪ info · **Status:** draft
- **Citation:** AICPA Code of Professional Conduct § 0.300.060 (Due Care Principle, Article V), effective December 15, 2014
  — https://pub.aicpa.org/codeofconduct/ethicsresources/et-cod.pdf (read 2026-06-06)
- **Summary:** A member should observe the profession's technical and ethical standards, strive continually to improve competence and the quality of services, and discharge professional responsibility to the best of the member's ability.
- **Safe rewrite / guidance:** When a draft promises services outside the member's demonstrated competence ('we handle every kind of tax matter', 'no engagement too complex') or implies work will be delivered without adequate planning/supervision, surface the Due Care principle: competence has limits, and consultation or referral may be required when an engagement exceeds personal competence. Rewrite to scope the offer to the firm's actual competencies.
- **Drafter notes:** Left unverified: 2026-06-06 — the Due Care Principle is published in the AICPA Code (Article V, 0.300.060 in the post-2014 codification; 1.300.060 is the related Due Professional Care interpretation under the General Standards Rule). Verbatim text could not be machine-pulled from a stable authoritative URL (copyrighted pronouncement); citation points at AICPA's et-cod.pdf. Counsel: confirm whether sentinel should anchor to the 0.300.060 Principle or the 1.300.060 interpretation (or both).

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
- **Severity:** ⚪ info · **Status:** draft
- **Citation:** O.C.G.A. Title 43, Chapter 3 (Public Accountancy); Rules of the Georgia State Board of Accountancy, Chapter 20
  — https://gsba.georgia.gov/ (read 2026-06-06)
- **Summary:** The Georgia State Board of Accountancy regulates CPAs in Georgia under O.C.G.A. Title 43, Chapter 3 — sets exam requirements, continuing professional education, and grounds for disciplinary action including dishonest practice and incompetence.
- **Safe rewrite / guidance:** When a draft implies a person may 'practice as a CPA', 'provide CPA / attest services', or hold themselves out as licensed in Georgia, confirm the workspace holds a current Georgia license and firm registration before the language goes out — unlicensed practice and holding out are grounds for discipline under O.C.G.A. Title 43, Chapter 3. Route licensure/CPE-status questions to the operator rather than asserting them in a draft.
- **Drafter notes:** Left unverified 2026-06-06: O.C.G.A. is hosted on LexisNexis/state portals that block automated fetch, so the grounds-for-discipline wording (likely O.C.G.A. § 43-3-19) could not be machine-verified this wave. Per the corpus convention literalText keeps the [UNVERIFIED] placeholder. Counsel: pull the canonical grounds-for-discipline section and confirm the current Rules-of-the-Board (Chapter 20-X) numbering.

> [UNVERIFIED — needs counsel] Substance: O.C.G.A. Title 43, Chapter 3 establishes the Georgia State Board of Accountancy and vests it with authority to license certified public accountants and registered firms practicing in Georgia. Grounds for disciplinary action enumerated in the chapter include: practice without a valid license; conviction of any felony or crime involving moral turpitude; fraud or deceit in obtaining a license; dishonesty, fraud, or gross negligence in the performance of professional services; violation of any rule of professional conduct promulgated by the Board; failure to comply with continuing professional education requirements; and conduct discreditable to the public accounting profession. Implementing rules at Rules of the Georgia State Board of Accountancy (Chapter 20-X) elaborate on professional standards, peer review, and CPE.

#### IRC § 6694 — tax return preparer penalty (understatement of liability) (`irc-6694-preparer-penalty`)
- **Severity:** 🟡 advisory · **Status:** draft
- **Citation:** 26 USC § 6694(a)–(b)
  — https://www.law.cornell.edu/uscode/text/26/6694 (read 2026-06-06)
- **Summary:** A tax return preparer is liable for a per-return penalty when an understatement of the taxpayer's liability is due to an unreasonable position the preparer knew or should have known of (§ 6694(a): greater of $1,000 or 50% of income derived), and a larger penalty for willful or reckless conduct (§ 6694(b): greater of $5,000 or 75% of income derived).
- **Safe rewrite / guidance:** When a draft proposes taking a return position to reduce a client's liability, do not promise a result or characterize an aggressive position as safe. Confirm the position has at least substantial authority (or a reasonable basis with adequate § 6662 disclosure) before the engagement proceeds, and never adopt a position that disregards a rule or regulation. Frame aggressive positions as requiring disclosure and client sign-off, not as a guaranteed saving.
- **Drafter notes:** Verified 2026-06-06: § 6694(a)(1), (a)(2)(A)-(C), (b)(1), and (b)(2) pulled from Cornell LII (26 USC § 6694) and the dollar/percentage thresholds cross-checked against the govinfo USCODE rendering. Counsel-reference: whether a position is 'unreasonable' / lacks 'substantial authority' is a judgment the scanner cannot make; this rule arms the counsel-handoff packet and the LLM-classifier path, not literal matching.

> 26 USC § 6694 — Understatement of taxpayer's liability by tax return preparer.
> 
> (a) Understatement due to unreasonable positions.
> (1) In general. If a tax return preparer prepares any return or claim of refund with respect to which any part of an understatement of liability is due to a position described in paragraph (2), and knew (or reasonably should have known) of the position, such tax return preparer shall pay a penalty with respect to each such return or claim in an amount equal to the greater of $1,000 or 50 percent of the income derived (or to be derived) by the tax return preparer with respect to the return or claim.
> 
> (2) Unreasonable position.
> (A) In general. Except as otherwise provided in this paragraph, a position is described in this paragraph unless there is or was substantial authority for the position.
> (B) Disclosed positions. If the position was disclosed as provided in section 6662(d)(2)(B)(ii)(I) and is not a position to which subparagraph (C) applies, the position is described in this paragraph unless there is a reasonable basis for the tax treatment of the position.
> (C) Tax shelters and reportable transactions. If the position is with respect to a tax shelter (as defined in section 6662(d)(2)(C)(ii)) or a reportable transaction to which section 6662A applies, the position is described in this paragraph unless it is reasonable to believe that the position would more likely than not be sustained on its merits.
> 
> (b) Understatement due to willful or reckless conduct.
> (1) In general. Any tax return preparer who prepares any return or claim for refund with respect to which any part of an understatement of liability is due to a conduct described in paragraph (2) shall pay a penalty with respect to each such return or claim in an amount equal to the greater of—(A) $5,000, or (B) 75 percent of the income derived (or to be derived) by the tax return preparer with respect to the return or claim.
> 
> (2) Willful or reckless conduct. Conduct described in this paragraph is conduct by the tax return preparer which is—(A) a willful attempt in any manner to understate the liability for tax on the return or claim, or (B) a reckless or intentional disregard of rules or regulations.

#### IRC § 7216 — criminal prohibition on disclosure/use of taxpayer information (`irc-7216-disclosure`)
- **Severity:** 🔴 blocking · **Status:** draft
- **Citation:** 26 USC § 7216; implementing regulations 26 CFR §§ 301.7216-1 through 301.7216-3
  — https://www.law.cornell.edu/uscode/text/26/7216 (read 2026-06-06)
- **Summary:** It is a federal misdemeanor for a tax return preparer to knowingly or recklessly disclose, or use for any purpose other than preparing the return, information furnished in connection with preparing a return — punishable by up to a $1,000 fine and 1 year imprisonment — subject to narrow exceptions and to the taxpayer-consent regime in the § 301.7216 regulations.
- **Safe rewrite / guidance:** Never include or propose to share taxpayer return information — figures, identity, the fact of a filing, anything furnished for the return — outside preparing that return, unless the taxpayer's § 301.7216-3 written consent (or a § 7216(b) / § 301.7216-2 exception) is in hand. Strike any draft that would route return data to a marketing list, a lender, a financial-product cross-sell, a testimonial, or an affiliate. Disclosure or use without consent is a criminal violation, not just an ethics breach.
- **Drafter notes:** Verified 2026-06-06: § 7216(a)(1)-(2) and (b)(1)-(3) pulled verbatim from Cornell LII (26 USC § 7216). The implementing 26 CFR § 301.7216-1/-2/-3 regulations (which carry the consent-form mechanics and the § 6713 civil-penalty overlay) are cited but could not be machine-pulled this wave (eCFR blocks automated fetch). Counsel-reference: whether a disclosure is consented/excepted is fact-specific judgment; sentinel surfaces the prohibition rather than literal-matching. Pairs with `aicpa-confidential-client-information` (the professional-standard layer).

> 26 USC § 7216 — Disclosure or use of information by preparers of returns.
> 
> (a) General rule. Any person who is engaged in the business of preparing, or providing services in connection with the preparation of, returns of the tax imposed by chapter 1, or any person who for compensation prepares any such return for any other person, and who knowingly or recklessly—
> (1) discloses any information furnished to him for, or in connection with, the preparation of any such return, or
> (2) uses any such information for any purpose other than to prepare, or assist in preparing, any such return,
> shall be guilty of a misdemeanor, and, upon conviction thereof, shall be fined not more than $1,000 ($100,000 in the case of a disclosure or use to which section 6713(b) applies), or imprisoned not more than 1 year, or both, together with the costs of prosecution.
> 
> (b) Exceptions.
> (1) Disclosure. Subsection (a) shall not apply to a disclosure of information if such disclosure is made—(A) pursuant to any other provision of this title, or (B) pursuant to an order of a court.
> (2) Use. Subsection (a) shall not apply to the use of information in the preparation of, or in connection with the preparation of, State and local tax returns and declarations of estimated tax of the person to whom the information relates.
> (3) Regulations. Subsection (a) shall not apply to a disclosure or use of information which is permitted by regulations prescribed by the Secretary under this section. Such regulations shall permit (subject to such conditions as such regulations shall provide) the disclosure or use of information for quality or peer reviews.

#### PCAOB AS 1015 — Due Professional Care / professional skepticism (`pcaob-as-1015-due-professional-care`)
- **Severity:** ⚪ info · **Status:** draft
- **Citation:** PCAOB AS 1015 — Due Professional Care in the Performance of Work (¶¶ .07–.09, professional skepticism)
  — https://pcaobus.org/oversight/standards/auditing-standards/details/AS1015 (read 2026-06-06)
- **Summary:** In an audit of an issuer, the auditor must exercise due professional care in planning and performing the audit and preparing the report, which requires professional skepticism — an attitude that includes a questioning mind and a critical assessment of audit evidence, neither assuming management dishonesty nor unquestioned honesty.
- **Safe rewrite / guidance:** When an audit-engagement draft implies the opinion is pre-decided, that management's representations will be accepted at face value, or that the audit is a formality ('we'll sign off quickly', 'no need to test, we trust the numbers'), surface AS 1015's professional-skepticism duty: due professional care requires a questioning mind and a critical assessment of evidence, neither presuming dishonesty nor unquestioned honesty. Rewrite to preserve the testing/evidence step.
- **Drafter notes:** Left unverified 2026-06-06: the authoritative pcaobus.org AS 1015 page is a JS-rendered SPA that returned 404 to automated fetch, so the EXACT paragraph wording (¶¶ .07–.09) could not be machine-verified. The literalText above is reconstructed from corroborating secondary sources (Global Relay rule mirror grip.globalrelay.com; PCAOB skepticism Spotlight PDF) and carries the [UNVERIFIED] placeholder per corpus convention. Counsel: confirm the verbatim ¶ .07/.08/.09 text and whether AS 1015 has been superseded/amended under the 2024 AS 1000 rulemaking (PCAOB-2024-01) before flipping unverified. Severity 'info' — duty-of-care/scope rule, only fires for issuer-audit workspaces.

> [UNVERIFIED — needs counsel] Substance of PCAOB AS 1015 (Due Professional Care in the Performance of Work):
> 
> .01 Due professional care is to be exercised in the planning and performance of the audit and the preparation of the report.
> 
> .07 Due professional care requires the auditor to exercise professional skepticism. Professional skepticism is an attitude that includes a questioning mind and a critical assessment of audit evidence.
> 
> .08 Gathering and objectively evaluating audit evidence requires the auditor to consider the competency and sufficiency of the evidence. In exercising professional skepticism, the auditor should not be satisfied with less than persuasive evidence because of a belief that management is honest.
> 
> .09 In exercising professional skepticism, the auditor should neither assume that management is dishonest nor assume unquestioned honesty. In developing an opinion, the auditor neither assumes that management is dishonest nor assumes that management is of unquestioned honesty.

## 5. Questions for counsel

**Corpus open questions (drafter → counsel):**

- [ ] MOST AMBIGUOUS: `circular-230-solicitation-candidates-literal.ts` — should the candidate advertising phrases + the two new triggerRegexes ('guaranteed … refund/approval/outcome'; 'special … (access|connection) … irs') fire literally, or stay in a counsel-reference/LLM-classifier path? Some phrases are context-dependent ('guaranteed maximum refund' may be defensible as a software feature reference; 'special access' is borderline if describing a legitimate e-Services account). Counsel must red-line phrase-by-phrase AND rule on the regexes before `unverified: false`. Also decide: split into (a) § 10.30(a)(1) Treasury triggers vs. (b) AICPA Code 1.400 'false, misleading, or deceptive' triggers, or keep one rule citing both? Held-back borderline phrases ('tax expert', 'tax specialist', 'former IRS') are in the rule's drafterNotes.
- [ ] NEW RULES (2026-06-06 wave): added IRC § 6694 preparer-penalty (`irc-6694-preparer-penalty-literal.ts`, counsel-reference, severity 'advisory', verbatim text pulled from Cornell LII + govinfo, unverified dropped); IRC § 7216 criminal disclosure/use prohibition (`irc-7216-disclosure-literal.ts`, counsel-reference, severity 'blocking', § 7216(a)/(b) pulled verbatim from Cornell LII, unverified dropped — § 301.7216 regs cited but eCFR-blocked); and PCAOB AS 1015 Due Professional Care / professional skepticism (`pcaob-as-1015-skepticism-literal.ts`, counsel-reference, severity 'info', UNVERIFIED — pcaobus.org SPA 404'd automated fetch). Counsel: confirm § 7216(b) exception scope and § 301.7216 consent mechanics; confirm AS 1015 verbatim ¶¶ .07–.09 and whether the 2024 AS 1000 rulemaking superseded/amended it.
- [ ] AICPA Code excerpts (1.700.001 Confidential Client Information; 0.300.060 Due Care Principle / 1.300.060 Due Professional Care interpretation) stay UNVERIFIED — the Code is a copyrighted pronouncement and verbatim text could not be machine-pulled from a stable authoritative URL; citation now points at AICPA's published et-cod.pdf. Counsel: confirm the exact exception wording and whether to anchor due-care to the 0.300.060 Principle or the 1.300.060 interpretation (or both).
- [ ] Circular 230 conflict-of-interest (§ 10.29), contingent-fee (§ 10.27), and diligence (§ 10.22) excerpts were re-verified 2026-06-06 against the Cornell LII CFR mirror (unverified dropped, severity + safeRewrite added, all counsel-reference). Counsel to confirm the Cornell mirror tracks the current eCFR rendering, especially the § 10.29 30-day confirmation / 36-month retention details and the § 10.27(b)(2)-(4) contingent-fee exceptions.
- [ ] GA State Board of Accountancy citation (O.C.G.A. § 43-3) stays UNVERIFIED — the O.C.G.A. host blocks automated fetch, so the grounds-for-discipline section (likely O.C.G.A. § 43-3-19) could not be machine-verified. Counsel to pull canonical text and confirm the current Rules-of-the-Board (Chapter 20-X) numbering.

**Per-rule drafter notes (most ambiguous first):**

- **AICPA Code — Confidential Client Information Rule** (`aicpa-confidential-client-information`): Left unverified: 2026-06-06 web research confirmed the rule number (1.700.001), its 'shall not disclose any confidential client information without the specific consent of the client' core, and the Dec 15 2014 effective date (Journal of Accountancy; PwC Viewpoint), but the AICPA Code is a copyrighted pronouncement and the verbatim full text could not be machine-pulled from a stable authoritative URL. The citation URL points at AICPA's published et-cod.pdf. Counsel: confirm the exact (1)-(4) exception wording against the current et-cod.pdf.
- **AICPA Code — Due Care Principle (Article V)** (`aicpa-due-care-principle`): Left unverified: 2026-06-06 — the Due Care Principle is published in the AICPA Code (Article V, 0.300.060 in the post-2014 codification; 1.300.060 is the related Due Professional Care interpretation under the General Standards Rule). Verbatim text could not be machine-pulled from a stable authoritative URL (copyrighted pronouncement); citation points at AICPA's et-cod.pdf. Counsel: confirm whether sentinel should anchor to the 0.300.060 Principle or the 1.300.060 interpretation (or both).
- **Georgia State Board of Accountancy — licensure and discipline** (`ga-board-accountancy`): Left unverified 2026-06-06: O.C.G.A. is hosted on LexisNexis/state portals that block automated fetch, so the grounds-for-discipline wording (likely O.C.G.A. § 43-3-19) could not be machine-verified this wave. Per the corpus convention literalText keeps the [UNVERIFIED] placeholder. Counsel: pull the canonical grounds-for-discipline section and confirm the current Rules-of-the-Board (Chapter 20-X) numbering.
- **IRC § 7216 — criminal prohibition on disclosure/use of taxpayer information** (`irc-7216-disclosure`): Verified 2026-06-06: § 7216(a)(1)-(2) and (b)(1)-(3) pulled verbatim from Cornell LII (26 USC § 7216). The implementing 26 CFR § 301.7216-1/-2/-3 regulations (which carry the consent-form mechanics and the § 6713 civil-penalty overlay) are cited but could not be machine-pulled this wave (eCFR blocks automated fetch). Counsel-reference: whether a disclosure is consented/excepted is fact-specific judgment; sentinel surfaces the prohibition rather than literal-matching. Pairs with `aicpa-confidential-client-information` (the professional-standard layer).
- **PCAOB AS 1015 — Due Professional Care / professional skepticism** (`pcaob-as-1015-due-professional-care`): Left unverified 2026-06-06: the authoritative pcaobus.org AS 1015 page is a JS-rendered SPA that returned 404 to automated fetch, so the EXACT paragraph wording (¶¶ .07–.09) could not be machine-verified. The literalText above is reconstructed from corroborating secondary sources (Global Relay rule mirror grip.globalrelay.com; PCAOB skepticism Spotlight PDF) and carries the [UNVERIFIED] placeholder per corpus convention. Counsel: confirm the verbatim ¶ .07/.08/.09 text and whether AS 1015 has been superseded/amended under the 2024 AS 1000 rulemaking (PCAOB-2024-01) before flipping unverified. Severity 'info' — duty-of-care/scope rule, only fires for issuer-audit workspaces.
- **Circular 230 § 10.30 — candidate advertising/solicitation triggers (DRAFT)** (`circular-230-solicitation-candidates`): Drafted 2026-05-25 from § 10.30(a)(1)'s prohibition on (a) misleading claims about qualifications and (b) intimating special IRS consideration. Phrases like 'guaranteed refund' double as classic AICPA Code 1.400 'false, misleading, or deceptive' targets — counsel should consider whether to anchor the rule to BOTH § 10.30 and AICPA 1.400 or split into two rules. Borderline omissions: 'tax expert', 'tax specialist', 'former IRS' (all context-dependent — recommend counsel-reference).
- **IRC § 6694 — tax return preparer penalty (understatement of liability)** (`irc-6694-preparer-penalty`): Verified 2026-06-06: § 6694(a)(1), (a)(2)(A)-(C), (b)(1), and (b)(2) pulled from Cornell LII (26 USC § 6694) and the dollar/percentage thresholds cross-checked against the govinfo USCODE rendering. Counsel-reference: whether a position is 'unreasonable' / lacks 'substantial authority' is a judgment the scanner cannot make; this rule arms the counsel-handoff packet and the LLM-classifier path, not literal matching.
- **Circular 230 § 10.29 — conflicting interests** (`circular-230-conflicts-10-29`): Verified 2026-06-06 against Cornell LII mirror of 31 CFR § 10.29 — the (a)/(b)/(c) wording, the 30-day confirmation window in (b)(3), and the 36-month retention in (c) all match the published text. Counsel-reference: conflict detection requires judgment about the parties' interests, so sentinel does not auto-match it.
- **Circular 230 § 10.27 — fees (contingent-fee restriction)** (`circular-230-fees-10-27`): Verified 2026-06-06 against Cornell LII mirror of 31 CFR § 10.27 — the unconscionable-fee bar in (a), the contingent-fee prohibition and (b)(2)-(4) exceptions, and the (c)(1) contingent-fee definition all match the published text. Counsel-reference: deciding whether a fee is 'contingent' or 'unconscionable' requires judgment, so sentinel does not auto-match; the candidate advertising rule carries the literal triggers.
- **Circular 230 § 10.22 — diligence as to accuracy** (`circular-230-diligence-10-22`): Verified 2026-06-06 against Cornell LII mirror of 31 CFR § 10.22 — both (a)(1)-(3) and the (b) reliance-on-others presumption (including the §§ 10.34/10.37 cross-reference) match the published text. Severity 'info': this is a duty-of-care/routing rule, not a draft-text per-se violation; counsel-reference because diligence is judgment-based.
