# Counsel handoff packet — Law compliance corpus

> **DRAFT — not legal advice.** This packet is a fleet-drafted compliance corpus for attorney review. No rule fires on customer drafts until counsel red-lines it AND the vertical is enabled via `COMPLIANCE_CORPUS_COUNSEL_REVIEWED`. Sentinel ADVISES; it never blocks a send.

## Status

- **Vertical:** `law`
- **Corpus status:** DRAFT
- **Last reviewed:** 2026-06-06
- **Counsel reviewer:** _none yet_
- **Packet generated:** 2026-06-06

### Coverage at a glance

| Bucket | Count |
| --- | --- |
| Live literal triggers (firing today) | 0 |
| Candidate literal triggers (to red-line) | 17 |
| Candidate regex triggers (to red-line) | 2 |
| Counsel-reference rules | 10 |
| Open questions | 8 |

## 1. Live literal triggers (firing on drafts today)

_None. This corpus is DRAFT — no rule is counsel-verified, so the scanner fires on nothing yet. Phrases below are candidates for review._

## 2. Candidate literal triggers — counsel red-line, phrase by phrase

_Sentinel does NOT fire on these. Check a box to approve a phrase as a literal-match trigger; strike, reword, or demote to counsel-reference otherwise._

#### ABA Model Rule 7.1 / 7.2(c) — candidate advertising triggers (DRAFT) (`mrpc-7-1-advertising-candidates`)
- **Severity:** 🔴 blocking
- **Category:** advertising
- **Citation:** ABA Model Rules of Professional Conduct, Rules 7.1 and 7.2(c)
  — https://www.americanbar.org/groups/professional_responsibility/publications/model_rules_of_professional_conduct/rule_7_1_communication_concerning_a_lawyer_s_services/ (read 2026-06-06)
- **Safe rewrite:** Strike outcome guarantees and unverifiable superlatives. Replace 'guaranteed result/outcome/verdict/settlement' and 'we never lose' / '100% win rate' with truthful, non-promissory descriptions of experience or process. Do not call the lawyer a 'specialist'/'expert'/'certified specialist' in a field unless certified by a state-approved or ABA-accredited organization that is named in the same communication (Rule 7.2(c)); otherwise say 'experienced in' or 'practice focused on'. Remove '#1 / best / top … in <place>' comparative claims that cannot be factually substantiated.
- **Drafter notes:** Drafted 2026-05-25. 'Specialist' and 'expert' phrases are direct Rule 7.2(c) targets; most state bars treat them as per-se misleading unless the lawyer's certification is named in the same communication. Superlatives ('best', '#1', 'top') and guarantees are core Rule 7.1 'unjustified expectation' targets. Borderline omissions held back for counsel: 'no recovery, no fee' / 'no fee unless we win' (legitimate in most states with disclaimer — recommend counsel-reference + state-specific disclaimer rule), 'aggressive', 'experienced' (too generic to literal-match without false-positive risk).
- **Candidate phrases to red-line (17):**
  - [ ] `guaranteed result`
  - [ ] `guaranteed outcome`
  - [ ] `guaranteed verdict`
  - [ ] `guaranteed settlement`
  - [ ] `we guarantee we will win`
  - [ ] `we never lose`
  - [ ] `100% win rate`
  - [ ] `best lawyer in`
  - [ ] `best attorney in`
  - [ ] `top lawyer in`
  - [ ] `#1 lawyer`
  - [ ] `most successful lawyer`
  - [ ] `specialist in`
  - [ ] `specializing in`
  - [ ] `certified specialist`
  - [ ] `expert in`
  - [ ] `legal expert`

## 3. Candidate regex triggers — counsel red-line

_Deterministic patterns for cases a literal phrase list can't express. Each shows the string it must match and a near-miss it must not._

#### ABA Model Rule 7.1 / 7.2(c) — candidate advertising triggers (DRAFT) (`mrpc-7-1-advertising-candidates`)
- [ ] **Pattern:** `/\bbest\b[^.!?\n]{0,40}\b(lawyer|attorney|law firm|legal team)\b[^.!?\n]{0,20}\bin\b/i` — 🔴 blocking
  - Catches superlative 'best … lawyer/attorney/law firm … in <place>' claims (a Rule 7.1 'unjustified expectation' / unverifiable-comparison target) beyond the fixed 'best lawyer in' / 'best attorney in' literals — e.g. 'the best personal injury attorney in Atlanta'.
  - **Matches (intended):** "We are the best personal injury attorney in Atlanta."
  - **Does NOT match (guard):** "We do our best to serve every client across Atlanta."
- [ ] **Pattern:** `/\bguarantee[ds]?\b[^.!?\n]{0,40}\b(result|outcome|win|verdict|settlement|recovery)\b/i` — 🔴 blocking
  - Catches 'guaranteed … (result|outcome|win|verdict|settlement|recovery)' promises (a Rule 7.1 per-se misleading outcome guarantee) the fixed literal list misses, e.g. 'we guarantee a favorable outcome'.
  - **Matches (intended):** "We guarantee a favorable outcome in your case."
  - **Does NOT match (guard):** "Our retainer agreement guarantees a fixed monthly fee."

## 4. Counsel-reference rules — substantive law, never auto-flagged

#### ABA Model Rule 1.1 — Competence (`mrpc-1-1-competence`)
- **Severity:** 🟡 advisory · **Status:** draft
- **Citation:** ABA Model Rules of Professional Conduct, Rule 1.1; Comment [8] (technology competence)
  — https://www.americanbar.org/groups/professional_responsibility/publications/model_rules_of_professional_conduct/rule_1_1_competence/ (read 2026-06-06)
- **Summary:** A lawyer shall provide competent representation, requiring the legal knowledge, skill, thoroughness, and preparation reasonably necessary for the representation; competence includes keeping abreast of changes in the law and its practice, including the benefits and risks of relevant technology.
- **Safe rewrite / guidance:** Treat agent-drafted legal content as a draft requiring lawyer review, not finished work product. Do not send substantive legal analysis, filings, or advice generated by the agent without a lawyer verifying the law, the facts, and the citations. Add indicia of lawyer oversight (review, sign-off) before anything substantive leaves the firm; the technology-competence duty (Comment [8]) makes unreviewed AI output a competence exposure.
- **Drafter notes:** Counsel-reference: 'competence' is a generative judgment, not a literal phrase, so this never auto-flags. Comment [8] is the explicit 'technology competence' obligation adopted by most state bars. Sentinel uses this as the anchor when flagging law-vertical drafts that rely on agent output without indicia of lawyer review. ABA Model Rule text re-verified 2026-06-06 against americanbar.org.

> Rule 1.1: Competence
> A lawyer shall provide competent representation to a client. Competent representation requires the legal knowledge, skill, thoroughness and preparation reasonably necessary for the representation.
> 
> Comment [8] (Maintaining Competence):
> To maintain the requisite knowledge and skill, a lawyer should keep abreast of changes in the law and its practice, including the benefits and risks associated with relevant technology, engage in continuing study and education and comply with all continuing legal education requirements to which the lawyer is subject.

#### ABA Model Rule 1.6 — Confidentiality of Information (`mrpc-1-6-confidentiality`)
- **Severity:** 🔴 blocking · **Status:** draft
- **Citation:** ABA Model Rules of Professional Conduct, Rule 1.6
  — https://www.americanbar.org/groups/professional_responsibility/publications/model_rules_of_professional_conduct/rule_1_6_confidentiality_of_information/ (read 2026-06-06)
- **Summary:** A lawyer shall not reveal information relating to the representation of a client unless the client gives informed consent, the disclosure is impliedly authorized to carry out the representation, or a narrow exception in 1.6(b) applies; the lawyer shall also make reasonable efforts to prevent inadvertent or unauthorized disclosure (1.6(c)).
- **Safe rewrite / guidance:** Do not reveal information relating to a representation without the client's informed consent, implied authorization to carry out the representation, or a narrow 1.6(b) exception. Strike any draft that discloses client identity, matter facts, or strategy to a third party, CC's an outside recipient on privileged content, or routes client data to a vendor without the 1.6(c) reasonable-safeguards basis. When in doubt, redact identifying detail and route to a lawyer.
- **Drafter notes:** Counsel-reference: whether a given disclosure is 'impliedly authorized' or covered by a 1.6(b) exception is a legal judgment, so this never auto-flags. Rule 1.6(c) (safeguarding) is the technology-handling anchor sentinel uses on cross-border data-flow and vendor-disclosure flags. ABA Model Rule text re-verified 2026-06-06 against americanbar.org.

> Rule 1.6: Confidentiality of Information
> 
> (a) A lawyer shall not reveal information relating to the representation of a client unless the client gives informed consent, the disclosure is impliedly authorized in order to carry out the representation or the disclosure is permitted by paragraph (b).
> 
> (b) A lawyer may reveal information relating to the representation of a client to the extent the lawyer reasonably believes necessary:
>   (1) to prevent reasonably certain death or substantial bodily harm;
>   (2) to prevent the client from committing a crime or fraud that is reasonably certain to result in substantial injury to the financial interests or property of another and in furtherance of which the client has used or is using the lawyer's services;
>   (3) to prevent, mitigate or rectify substantial injury to the financial interests or property of another that is reasonably certain to result or has resulted from the client's commission of a crime or fraud in furtherance of which the client has used the lawyer's services;
>   (4) to secure legal advice about the lawyer's compliance with these Rules;
>   (5) to establish a claim or defense on behalf of the lawyer in a controversy between the lawyer and the client, to establish a defense to a criminal charge or civil claim against the lawyer based upon conduct in which the client was involved, or to respond to allegations in any proceeding concerning the lawyer's representation of the client;
>   (6) to comply with other law or a court order; or
>   (7) to detect and resolve conflicts of interest arising from the lawyer's change of employment or from changes in the composition or ownership of a firm, but only if the revealed information would not compromise the attorney-client privilege or otherwise prejudice the client.
> 
> (c) A lawyer shall make reasonable efforts to prevent the inadvertent or unauthorized disclosure of, or unauthorized access to, information relating to the representation of a client.

#### ABA Model Rule 1.18 — Duties to Prospective Client (`mrpc-1-18-prospective-client`)
- **Severity:** 🟡 advisory · **Status:** draft
- **Citation:** ABA Model Rules of Professional Conduct, Rule 1.18
  — https://www.americanbar.org/groups/professional_responsibility/publications/model_rules_of_professional_conduct/rule_1_18_duties_of_prospective_client/ (read 2026-06-06)
- **Summary:** Even when no client-lawyer relationship ensues, a lawyer who has had discussions with a prospective client owes that person a duty of confidentiality and may not undertake representation adverse to the prospective client in the same or a substantially related matter if information learned could be significantly harmful, subject to written consent or specified screening conditions.
- **Safe rewrite / guidance:** Treat intake conversations and consultation notes as confidential even if no engagement follows — do not use or reveal information learned from a prospective client, and do not draft work for a matter adverse to that person in the same or a substantially related matter where the information could be significantly harmful. In intake drafts, avoid soliciting more detail than needed to run the conflict check, and route a possible adverse-matter conflict to a lawyer for screening / written-consent steps before proceeding.
- **Drafter notes:** Counsel-reference: whether information 'could be significantly harmful' or matters are 'substantially related' is a legal judgment, so this never auto-flags. Sentinel anchor for intake-form processing: even a brief consultation that doesn't ripen into representation triggers limited confidentiality and conflict obligations. ABA Model Rule text re-verified 2026-06-06 against americanbar.org.

> Rule 1.18: Duties to Prospective Client
> 
> (a) A person who consults with a lawyer about the possibility of forming a client-lawyer relationship with respect to a matter is a prospective client.
> 
> (b) Even when no client-lawyer relationship ensues, a lawyer who has learned information from a prospective client shall not use or reveal that information, except as Rule 1.9 would permit with respect to information of a former client.
> 
> (c) A lawyer subject to paragraph (b) shall not represent a client with interests materially adverse to those of a prospective client in the same or a substantially related matter if the lawyer received information from the prospective client that could be significantly harmful to that person in the matter, except as provided in paragraph (d). If a lawyer is disqualified from representation under this paragraph, no lawyer in a firm with which that lawyer is associated may knowingly undertake or continue representation in such a matter, except as provided in paragraph (d).
> 
> (d) When the lawyer has received disqualifying information as defined in paragraph (c), representation is permissible if:
>   (1) both the affected client and the prospective client have given informed consent, confirmed in writing, or:
>   (2) the lawyer who received the information took reasonable measures to avoid exposure to more disqualifying information than was reasonably necessary to determine whether to represent the prospective client; and
>     (i) the disqualified lawyer is timely screened from any participation in the matter and is apportioned no part of the fee therefrom; and
>     (ii) written notice is promptly given to the prospective client.

#### ABA Model Rule 5.5 — Unauthorized Practice of Law / Multijurisdictional Practice (`mrpc-5-5-unauthorized-practice`)
- **Severity:** 🔴 blocking · **Status:** draft
- **Citation:** ABA Model Rules of Professional Conduct, Rule 5.5
  — https://www.americanbar.org/groups/professional_responsibility/publications/model_rules_of_professional_conduct/rule_5_5_unauthorized_practice_of_law_multijurisdictional_practice_of_law/ (read 2026-06-06)
- **Summary:** A lawyer shall not practice law in a jurisdiction in violation of the regulation of the legal profession in that jurisdiction or assist another in doing so; multijurisdictional temporary practice is permitted only under narrow conditions specified in 5.5(c).
- **Safe rewrite / guidance:** Do not offer, imply, or confirm legal services in a state where the responsible lawyer is not admitted, and do not hold the firm out as admitted to practice in a jurisdiction where it is not. For an out-of-state inquiry, draft a referral or a clear statement of the admitted jurisdictions rather than substantive advice on that state's law. Never let agent output stand as legal advice without an admitted, supervising lawyer — an AI agent giving legal advice standing alone is itself a UPL exposure. Confirm temporary multijurisdictional practice fits a narrow 5.5(c) basis before drafting cross-state work.
- **Drafter notes:** Counsel-reference: whether conduct is unauthorized cross-state practice or fits a 5.5(c) carve-out is a fact/law judgment, so this never auto-flags. This is the cross-state surface flagged as MOST AMBIGUOUS in metadata — a multi-state firm's admitted-jurisdiction map and each target state's UPL definition must be overlaid before any literal-match path. ABA Model Rule text re-verified 2026-06-06 against americanbar.org. GA deviates on 5.5 multijurisdictional carve-outs (see ga-rules-of-professional-conduct).

> Rule 5.5: Unauthorized Practice of Law; Multijurisdictional Practice of Law
> 
> (a) A lawyer shall not practice law in a jurisdiction in violation of the regulation of the legal profession in that jurisdiction, or assist another in doing so.
> 
> (b) A lawyer who is not admitted to practice in this jurisdiction shall not:
>   (1) except as authorized by these Rules or other law, establish an office or other systematic and continuous presence in this jurisdiction for the practice of law; or
>   (2) hold out to the public or otherwise represent that the lawyer is admitted to practice law in this jurisdiction.
> 
> (c) A lawyer admitted in another United States jurisdiction, and not disbarred or suspended from practice in any jurisdiction, may provide legal services on a temporary basis in this jurisdiction that:
>   (1) are undertaken in association with a lawyer who is admitted to practice in this jurisdiction and who actively participates in the matter;
>   (2) are in or reasonably related to a pending or potential proceeding before a tribunal in this or another jurisdiction, if the lawyer, or a person the lawyer is assisting, is authorized by law or order to appear in such proceeding or reasonably expects to be so authorized;
>   (3) are in or reasonably related to a pending or potential arbitration, mediation, or other alternative dispute resolution proceeding in this or another jurisdiction, if the services arise out of or are reasonably related to the lawyer's practice in a jurisdiction in which the lawyer is admitted to practice and are not services for which the forum requires pro hac vice admission; or
>   (4) are not within paragraphs (c)(2) or (c)(3) and arise out of or are reasonably related to the lawyer's practice in a jurisdiction in which the lawyer is admitted to practice.

#### ABA Model Rules 7.1–7.3 — Communications about services, advertising, solicitation (`mrpc-7-1-through-7-3-communications-solicitation`)
- **Severity:** 🟡 advisory · **Status:** draft
- **Citation:** ABA Model Rules of Professional Conduct, Rules 7.1, 7.2, 7.3
  — https://www.americanbar.org/groups/professional_responsibility/publications/model_rules_of_professional_conduct/rule_7_1_communication_concerning_a_lawyer_s_services/ (read 2026-06-06)
- **Summary:** A lawyer shall not make a false or misleading communication about the lawyer or the lawyer's services (Rule 7.1); communications must include identifying information (Rule 7.2); a lawyer shall not solicit professional employment by live person-to-person contact when a significant motive is the lawyer's pecuniary gain, subject to exceptions for other lawyers, family, close personal or prior professional relationships, and persons who routinely use the type of legal services involved (Rule 7.3).
- **Safe rewrite / guidance:** Keep communications about the lawyer's services truthful and non-misleading — no material misrepresentation and no omission that makes the statement as a whole misleading (Rule 7.1). Include the name and contact information of at least one responsible lawyer/firm (7.2(d)). Do not pay for referrals beyond the narrow 7.2(b) exceptions, and do not claim specialist certification unless certified by a state-approved/ABA-accredited body named in the same communication (7.2(c)). For solicitation, see mrpc-7-3-solicitation. Specific candidate trigger phrases live in mrpc-7-1-advertising-candidates.
- **Drafter notes:** Counsel-reference master rule for the 7.x advertising/solicitation family: the misleading/material-omission tests are generative judgments, so this never auto-flags. Concrete literal candidates are carried separately in mrpc-7-1-advertising-candidates (advertising) and the live-contact bar in mrpc-7-3-solicitation. ABA Model Rule text (7.1/7.2/7.3) re-verified 2026-06-06 against americanbar.org.

> Rule 7.1: Communications Concerning a Lawyer's Services
> A lawyer shall not make a false or misleading communication about the lawyer or the lawyer's services. A communication is false or misleading if it contains a material misrepresentation of fact or law, or omits a fact necessary to make the statement considered as a whole not materially misleading.
> 
> Rule 7.2: Communications Concerning a Lawyer's Services: Specific Rules
> (a) A lawyer may communicate information regarding the lawyer's services through any media.
> (b) A lawyer shall not compensate, give or promise anything of value to a person for recommending the lawyer's services except that a lawyer may:
>   (1) pay the reasonable costs of advertisements or communications permitted by this Rule;
>   (2) pay the usual charges of a legal service plan or a not-for-profit or qualifying lawyer referral service;
>   (3) pay for a law practice in accordance with Rule 1.17;
>   (4) refer clients to another lawyer or a nonlawyer professional pursuant to an agreement not otherwise prohibited under these Rules that provides for the other person to refer clients or customers to the lawyer, if:
>     (i) the reciprocal referral agreement is not exclusive; and
>     (ii) the client is informed of the existence and nature of the agreement; and
>   (5) give nominal gifts as an expression of appreciation that are neither intended nor reasonably expected to be a form of compensation for recommending a lawyer's services.
> (c) A lawyer shall not state or imply that a lawyer is certified as a specialist in a particular field of law, unless:
>   (1) the lawyer has been certified as a specialist by an organization that has been approved by an appropriate state authority or that has been accredited by the American Bar Association; and
>   (2) the name of the certifying organization is clearly identified in the communication.
> (d) Any communication made under this Rule must include the name and contact information of at least one lawyer or law firm responsible for its content.
> 
> Rule 7.3: Solicitation of Clients
> (a) "Solicitation" or "solicit" denotes a communication initiated by or on behalf of a lawyer or law firm that is directed to a specific person the lawyer knows or reasonably should know needs legal services in a particular matter and that offers to provide, or reasonably can be understood as offering to provide, legal services for that matter.
> (b) A lawyer shall not solicit professional employment by live person-to-person contact when a significant motive for the lawyer's doing so is the lawyer's or law firm's pecuniary gain, unless the contact is with a:
>   (1) lawyer;
>   (2) person who has a family, close personal, or prior business or professional relationship with the lawyer or law firm; or
>   (3) person who routinely uses for business purposes the type of legal services offered by the lawyer.
> (c) A lawyer shall not solicit professional employment even when not otherwise prohibited by paragraph (b), if:
>   (1) the target of the solicitation has made known to the lawyer a desire not to be solicited by the lawyer; or
>   (2) the solicitation involves coercion, duress or harassment.

#### Georgia Rules of Professional Conduct — state adoption of Model Rules (`ga-rules-of-professional-conduct`)
- **Severity:** ⚪ info · **Status:** draft
- **Citation:** Georgia Rules of Professional Conduct (Rules and Regulations of the State Bar of Georgia, Part IV, Chapter 1)
  — https://www.gabar.org/barrules/handbookdetail.cfm?what=rule (read 2026-06-06)
- **Summary:** Georgia adopts the ABA Model Rules of Professional Conduct as the Georgia Rules of Professional Conduct, codified in Part IV, Chapter 1 of the Rules and Regulations of the State Bar of Georgia, with state-specific modifications.
- **Safe rewrite / guidance:** Where Georgia has not deviated from the Model Rule, rely on the Model Rule literals already loaded in this corpus. Where GA diverges (advertising provisions, 5.5 multijurisdictional-practice carve-outs), do not draft state-specific compliance claims until counsel has instantiated the GA-specific text as standalone literals — flag GA-specific advertising / UPL drafts for human review in the interim.
- **Drafter notes:** Routing-only, severity info: the GA State Bar handbook (gabar.org) blocks automated fetch (HTTP 403 on 2026-06-06), so the GA-specific deviations remain [UNVERIFIED — needs counsel]. Per the corpus convention, unverified stays true and the literal is a placeholder; sentinel will not match against it. Counsel needs to either (a) confirm the Model Rule literals are acceptable substitutes, or (b) instantiate GA-specific text as new rule files. accessedAt 2026-06-06 records the date the fetch was attempted and blocked.

> [CROSS-REFERENCE + UNVERIFIED] Substance: Georgia has adopted the ABA Model Rules of Professional Conduct as the Georgia Rules of Professional Conduct, codified in Part IV, Chapter 1 of the Rules and Regulations of the State Bar of Georgia. State-specific deviations from the Model Rules include (among others) Georgia-specific advertising provisions and Rule 5.5 multijurisdictional-practice carve-outs. For rules where Georgia has not deviated from the Model Rule, sentinel should use the Model Rule literals loaded elsewhere in this corpus.
> 
> Counsel: please pull the canonical Georgia-specific deviations and instantiate them as their own standalone literals in this corpus — the routing entry alone is not sufficient for sentinel matching where the state rule differs.

#### Attorney-Client Privilege — common-law elements and waiver (`attorney-client-privilege`)
- **Severity:** 🟡 advisory · **Status:** draft
- **Citation:** FRE 501 (privilege under federal common law); Restatement (Third) of the Law Governing Lawyers §§ 68–86; Upjohn Co. v. United States, 449 U.S. 383 (1981); United States v. Kovel, 296 F.2d 918 (2d Cir. 1961)
  — https://www.law.cornell.edu/rules/fre/rule_501 (read 2026-06-06)
- **Summary:** The attorney-client privilege protects confidential communications between a client (or prospective client) and the lawyer made for the purpose of obtaining or providing legal advice. Privilege is waived by voluntary disclosure to third parties and may be inadvertently waived; certain agency-like third parties (interpreters, accountants under Kovel) may be brought within privilege.
- **Safe rewrite / guidance:** Protect against inadvertent waiver: do not CC, forward, or otherwise disclose privileged attorney-client communications to anyone outside the privileged circle, and do not route privileged content to a third-party vendor or agent outside a Kovel-type arrangement that preserves privilege. Mark privileged material as such, keep it segregated from non-privileged threads, and route any draft that would share privileged content with an outside recipient to a lawyer before it leaves the firm.
- **Drafter notes:** Counsel-reference, severity advisory: privilege/waiver turns on case law and the Restatement, not a single quotable statute, so this is a routing/summary entry that never auto-flags. FRE 501 text re-verified 2026-06-06 against law.cornell.edu. If sentinel needs a true literal anchor, FRE 501 itself is the most natural. Recommend a parallel state-law privilege literal (O.C.G.A. § 24-5-501 — Georgia's attorney-client privilege statute) be added in a follow-up.

> [ROUTING / SUMMARY — needs counsel for literal] Substance:
> 
> Federal Rule of Evidence 501 provides: "The common law — as interpreted by United States courts in the light of reason and experience — governs a claim of privilege unless any of the following provides otherwise: the United States Constitution; a federal statute; or rules prescribed by the Supreme Court. But in a civil case, state law governs privilege regarding a claim or defense for which state law supplies the rule of decision."
> 
> The attorney-client privilege requires (per the Restatement (Third) of the Law Governing Lawyers § 68): (a) a communication, (b) made between privileged persons, (c) in confidence, (d) for the purpose of obtaining or providing legal assistance for the client.
> 
> Waiver: The privilege is waived by voluntary disclosure of privileged material to non-privileged third parties (Restatement § 79). Inadvertent disclosure may also waive privilege depending on the jurisdiction's adopted test (the majority Hopson/middle-ground test considers the reasonableness of the producing party's precautions). Federal Rule of Evidence 502 provides a federal rule against subject-matter waiver from inadvertent disclosure where reasonable steps to prevent and rectify were taken.
> 
> Third-party agents under Kovel: a non-lawyer assistant (interpreter, accountant, sometimes other consultants) may be brought within privilege when the assistant is necessary or highly useful for the effective consultation between the client and the lawyer regarding which the latter has been professionally consulted (United States v. Kovel, 296 F.2d 918 (2d Cir. 1961)).

#### ABA Model Rule 1.7 — Conflict of Interest: Current Clients (`mrpc-1-7-conflict-current-clients`)
- **Severity:** 🔴 blocking · **Status:** draft
- **Citation:** ABA Model Rules of Professional Conduct, Rule 1.7
  — https://www.americanbar.org/groups/professional_responsibility/publications/model_rules_of_professional_conduct/rule_1_7_conflict_of_interest_current_clients/ (read 2026-06-06)
- **Summary:** A lawyer shall not represent a client if the representation involves a concurrent conflict of interest — direct adversity to another client, or a significant risk that the representation will be materially limited by responsibilities to another client, a former client, a third person, or the lawyer's own interest — unless every condition in 1.7(b) is satisfied, including each affected client's informed consent confirmed in writing.
- **Safe rewrite / guidance:** Do not open or commit to a matter before the conflict check clears. If the draft offers, accepts, or confirms representation, route it to a human to run the conflict screen against current and former clients first. Where a conflict exists but is consentable under 1.7(b), the engagement must obtain each affected client's informed consent confirmed in writing — do not paper over a non-consentable conflict (claim by one client against another in the same proceeding, or a representation prohibited by law).
- **Drafter notes:** Counsel-reference: determining whether interests are 'directly adverse' or 'materially limited' requires case-specific legal judgment, so this never auto-flags. It is the anchor for the counsel-handoff packet when an intake / matter-open / co-representation draft is produced. ABA Model Rule text pulled 2026-06-06 from americanbar.org (corroborated across state mirrors that adopt the Model Rule verbatim). Companion duty: Rule 1.9 (former clients) and Rule 1.10 (imputation) — counsel may want those as follow-on counsel-reference rules.

> Rule 1.7: Conflict of Interest: Current Clients
> 
> (a) Except as provided in paragraph (b), a lawyer shall not represent a client if the representation involves a concurrent conflict of interest. A concurrent conflict of interest exists if:
>   (1) the representation of one client will be directly adverse to another client; or
>   (2) there is a significant risk that the representation of one or more clients will be materially limited by the lawyer's responsibilities to another client, a former client or a third person or by a personal interest of the lawyer.
> 
> (b) Notwithstanding the existence of a concurrent conflict of interest under paragraph (a), a lawyer may represent a client if:
>   (1) the lawyer reasonably believes that the lawyer will be able to provide competent and diligent representation to each affected client;
>   (2) the representation is not prohibited by law;
>   (3) the representation does not involve the assertion of a claim by one client against another client represented by the lawyer in the same litigation or other proceeding before a tribunal; and
>   (4) each affected client gives informed consent, confirmed in writing.

#### ABA Model Rule 1.15 — Safekeeping Property (client trust account / IOLTA) (`mrpc-1-15-trust-account`)
- **Severity:** 🔴 blocking · **Status:** draft
- **Citation:** ABA Model Rules of Professional Conduct, Rule 1.15
  — https://www.americanbar.org/groups/professional_responsibility/publications/model_rules_of_professional_conduct/rule_1_15_safekeeping_property/ (read 2026-06-06)
- **Summary:** A lawyer must hold client and third-person property separate from the lawyer's own property; client funds go in a separate trust account, advance fees and expenses are deposited to trust and withdrawn only as earned/incurred, the lawyer must promptly notify and deliver funds the client or a third person is entitled to receive, and disputed funds must be kept separate until the dispute is resolved. Commingling or misappropriation is per-se prohibited.
- **Safe rewrite / guidance:** Never instruct that client funds, retainers, advance fees, or settlement proceeds be deposited to, held in, or paid from the firm's operating/general account — advance fees and unearned funds go to the client trust (IOLTA) account and are withdrawn only as earned or as expenses are incurred. Do not propose 'borrowing' from or temporarily floating trust funds. For funds a client or third person is entitled to, draft prompt notice and delivery; keep disputed funds segregated until resolved. Route any funds-movement instruction to a human for trust-accounting review.
- **Drafter notes:** Counsel-reference: whether a particular instruction commingles or misappropriates is fact-specific, so this never auto-flags — it anchors the counsel-handoff packet for any draft that moves client/third-party money. ABA Model Rule text pulled 2026-06-06 from americanbar.org. The '[five years]' bracket is the ABA's own bracketed placeholder (states set their own retention period — GA, e.g., sets its own). Companion: ABA Model Rules on Client Trust Account Records. Counsel to confirm GA's trust-account record-retention period and IOLTA participation requirement (O.C.G.A. / GA Bar Rule 1.15(I)–1.15(III)) as a GA-specific follow-on.

> Rule 1.15: Safekeeping Property
> 
> (a) A lawyer shall hold property of clients or third persons that is in a lawyer's possession in connection with a representation separate from the lawyer's own property. Funds shall be kept in a separate account maintained in the state where the lawyer's office is situated, or elsewhere with the consent of the client or third person. Other property shall be identified as such and appropriately safeguarded. Complete records of such account funds and other property shall be kept by the lawyer and shall be preserved for a period of [five years] after termination of the representation.
> 
> (b) A lawyer may deposit the lawyer's own funds in a client trust account for the sole purpose of paying bank service charges on that account, but only in an amount necessary for that purpose.
> 
> (c) A lawyer shall deposit into a client trust account legal fees and expenses that have been paid in advance, to be withdrawn by the lawyer only as fees are earned or expenses incurred.
> 
> (d) Upon receiving funds or other property in which a client or third person has an interest, a lawyer shall promptly notify the client or third person. Except as stated in this Rule or otherwise permitted by law or by agreement with the client, a lawyer shall promptly deliver to the client or third person any funds or other property that the client or third person is entitled to receive and, upon request by the client or third person, shall promptly render a full accounting regarding such property.
> 
> (e) When in the course of representation a lawyer is in possession of property in which two or more persons (one of whom may be the lawyer) claim interests, the property shall be kept separate by the lawyer until the dispute is resolved. The lawyer shall promptly distribute all portions of the property as to which the interests are not in dispute.

#### ABA Model Rule 7.3 — Solicitation of Clients (`mrpc-7-3-solicitation`)
- **Severity:** 🟡 advisory · **Status:** draft
- **Citation:** ABA Model Rules of Professional Conduct, Rule 7.3
  — https://www.americanbar.org/groups/professional_responsibility/publications/model_rules_of_professional_conduct/rule_7_3_solicitation_of_clients/ (read 2026-06-06)
- **Summary:** A lawyer shall not solicit professional employment by live person-to-person contact (in-person, face-to-face, live telephone, or other real-time visual/auditory contact) when a significant motive is the lawyer's pecuniary gain, unless the contact is with another lawyer, someone with a family / close personal / prior business or professional relationship, or someone who routinely uses the type of legal services offered; and shall not solicit at all where the target has said they do not want to be solicited or where the solicitation involves coercion, duress, or harassment.
- **Safe rewrite / guidance:** If the draft is a written communication (email or letter) to a person known to need legal services in a specific matter, confirm it is permitted written solicitation and carries any state-required 'Advertising Material' / disclosure label — written contact is not the 'live person-to-person contact' Rule 7.3(b) bars, but it remains a regulated solicitation. Never script live, real-time outreach (a call or in-person pitch) to a non-exempt prospect known to need legal services with pecuniary motive. Honor any prior 'do not solicit me' request and strike any coercive, high-pressure, or deadline-laden language.
- **Drafter notes:** Counsel-reference, severity advisory: whether a specific draft is prohibited solicitation turns on channel, motive, and recipient relationship — generative judgments, so no auto-flag. Because agentplain drafts text and never places live calls (project_no_outbound_architecture.md), the 7.3(b) live-contact bar is largely a routing concern; the residual live surface is the operator copy-pasting an agent-drafted phone script. ABA Model Rule text pulled 2026-06-06 from americanbar.org (corroborated via state mirrors). NOTE: many states overlay a written-solicitation 'Advertising Material' labeling requirement (former Model Rule 7.3(c)); counsel to add the firm's state-specific labeling literal. Conservatively kept counsel-reference rather than literal-match: a small candidate list (e.g. 'act now before the statute of limitations runs', 'sign today') risks high false-positive rate without per-state tuning.

> Rule 7.3: Solicitation of Clients
> 
> (a) "Solicitation" or "solicit" denotes a communication initiated by or on behalf of a lawyer or law firm that is directed to a specific person the lawyer knows or reasonably should know needs legal services in a particular matter and that offers to provide, or reasonably can be understood as offering to provide, legal services for that matter.
> 
> (b) A lawyer shall not solicit professional employment by live person-to-person contact when a significant motive for the lawyer's doing so is the lawyer's or law firm's pecuniary gain, unless the contact is with a:
>   (1) lawyer;
>   (2) person who has a family, close personal, or prior business or professional relationship with the lawyer or law firm; or
>   (3) person who routinely uses for business purposes the type of legal services offered by the lawyer.
> 
> (c) A lawyer shall not solicit professional employment even when not otherwise prohibited by paragraph (b), if:
>   (1) the target of the solicitation has made known to the lawyer a desire not to be solicited by the lawyer; or
>   (2) the solicitation involves coercion, duress or harassment.
> 
> (d) This Rule does not prohibit a lawyer from contacting persons who are known to routinely use, for business purposes, the type of legal services offered by the lawyer or from participating with a prepaid or group legal service plan operated by an organization not owned or directed by the lawyer that uses live person-to-person contact to enroll members or sell subscriptions for the plan from persons who are not known to need legal services in a particular matter covered by the plan.

## 5. Questions for counsel

**Corpus open questions (drafter → counsel):**

- [ ] MOST AMBIGUOUS: Rule 5.5 cross-state unauthorized-practice surface. For a multi-state firm, whether a draft constitutes UPL turns on the firm's admitted-jurisdiction map AND each target state's own UPL definition, which diverge. Counsel must decide whether ANY of this can be literal-matched (e.g. 'licensed in all 50 states') or whether the entire cross-state surface stays counsel-reference in the LLM/human-review path. State-bar advertising divergence (Rule 7.x) is the close-second ambiguity: states overlay specific disclaimer / 'Advertising Material' labeling requirements that the bare Model Rule literals do not capture.
- [ ] STATE-BAR ADVERTISING DIVERGENCE: state bars diverge substantially on advertising/solicitation. Counsel to overlay GA-specific bar rules (and any other jurisdiction the firm operates in) on `mrpc-7-1-advertising-candidates` and `mrpc-7-3-solicitation` before flipping any phrase `unverified: false`. Held-back borderline phrases ('no recovery, no fee', 'aggressive', 'experienced') are noted in the candidate rule's drafterNotes; the written-solicitation 'Advertising Material' labeling requirement is noted in mrpc-7-3-solicitation.
- [ ] NEW RULES (2026-06-06 wave): added three counsel-reference rules with ABA Model Rule text pulled live from americanbar.org — `mrpc-1-7-conflict-current-clients` (concurrent conflicts, severity 'blocking'), `mrpc-1-15-trust-account` (client trust account / IOLTA / commingling, severity 'blocking'), and `mrpc-7-3-solicitation` (live person-to-person solicitation, severity 'advisory'). All three stay counsel-reference (never auto-flag). Counsel to confirm the ABA wording against the firm's adopting jurisdiction and instantiate GA-specific deviations where they differ.
- [ ] TRUST ACCOUNT (1.15): the literalText preserves the ABA's own bracketed '[five years]' record-retention placeholder — counsel to confirm Georgia's trust-account record-retention period and IOLTA participation requirement (GA Bar Rules 1.15(I)–1.15(III)) and instantiate as a GA-specific follow-on literal.
- [ ] CONFLICTS (1.7): companion duties Rule 1.9 (former clients) and Rule 1.10 (imputation) were intentionally omitted from this pass to keep scope contained — counsel to advise whether to add them as follow-on counsel-reference rules.
- [ ] ADVERTISING CANDIDATE REGEXES (new 2026-06-06): `mrpc-7-1-advertising-candidates` now ships two regex triggers — a 'best … lawyer/attorney/firm … in <place>' superlative catcher and a 'guaranteed … (result|outcome|win|verdict|settlement|recovery)' catcher — alongside the 17 literal phrases. They ride the same `unverified: true` gate (do NOT fire live). Counsel to confirm the patterns do not over-match legitimate copy before any go-live.
- [ ] ABA Model Rules 1.1 / 1.6 / 1.7 / 1.15 / 1.18 / 5.5 / 7.1–7.3 were re-verified 2026-06-06 against the published americanbar.org Model Rules (direct WebFetch is 403-blocked by ABA's bot wall; text confirmed via ABA search-result excerpts corroborated across state mirrors that adopt the Model Rule verbatim). GA-specific deviations remain [UNVERIFIED] — gabar.org blocks automated fetch (403 on 2026-06-06) — and stay `unverified: true` per the corpus convention.
- [ ] Attorney-client privilege (`attorney-client-privilege`) is a routing/summary entry resting on FRE 501 + Restatement (Third) + Upjohn/Kovel, re-verified 2026-06-06 against law.cornell.edu; counsel to advise whether to add a GA state-law privilege literal (O.C.G.A. § 24-5-501).

**Per-rule drafter notes (most ambiguous first):**

- **ABA Model Rule 5.5 — Unauthorized Practice of Law / Multijurisdictional Practice** (`mrpc-5-5-unauthorized-practice`): Counsel-reference: whether conduct is unauthorized cross-state practice or fits a 5.5(c) carve-out is a fact/law judgment, so this never auto-flags. This is the cross-state surface flagged as MOST AMBIGUOUS in metadata — a multi-state firm's admitted-jurisdiction map and each target state's UPL definition must be overlaid before any literal-match path. ABA Model Rule text re-verified 2026-06-06 against americanbar.org. GA deviates on 5.5 multijurisdictional carve-outs (see ga-rules-of-professional-conduct).
- **ABA Model Rule 1.15 — Safekeeping Property (client trust account / IOLTA)** (`mrpc-1-15-trust-account`): Counsel-reference: whether a particular instruction commingles or misappropriates is fact-specific, so this never auto-flags — it anchors the counsel-handoff packet for any draft that moves client/third-party money. ABA Model Rule text pulled 2026-06-06 from americanbar.org. The '[five years]' bracket is the ABA's own bracketed placeholder (states set their own retention period — GA, e.g., sets its own). Companion: ABA Model Rules on Client Trust Account Records. Counsel to confirm GA's trust-account record-retention period and IOLTA participation requirement (O.C.G.A. / GA Bar Rule 1.15(I)–1.15(III)) as a GA-specific follow-on.
- **Georgia Rules of Professional Conduct — state adoption of Model Rules** (`ga-rules-of-professional-conduct`): Routing-only, severity info: the GA State Bar handbook (gabar.org) blocks automated fetch (HTTP 403 on 2026-06-06), so the GA-specific deviations remain [UNVERIFIED — needs counsel]. Per the corpus convention, unverified stays true and the literal is a placeholder; sentinel will not match against it. Counsel needs to either (a) confirm the Model Rule literals are acceptable substitutes, or (b) instantiate GA-specific text as new rule files. accessedAt 2026-06-06 records the date the fetch was attempted and blocked.
- **ABA Model Rule 1.7 — Conflict of Interest: Current Clients** (`mrpc-1-7-conflict-current-clients`): Counsel-reference: determining whether interests are 'directly adverse' or 'materially limited' requires case-specific legal judgment, so this never auto-flags. It is the anchor for the counsel-handoff packet when an intake / matter-open / co-representation draft is produced. ABA Model Rule text pulled 2026-06-06 from americanbar.org (corroborated across state mirrors that adopt the Model Rule verbatim). Companion duty: Rule 1.9 (former clients) and Rule 1.10 (imputation) — counsel may want those as follow-on counsel-reference rules.
- **ABA Model Rule 7.3 — Solicitation of Clients** (`mrpc-7-3-solicitation`): Counsel-reference, severity advisory: whether a specific draft is prohibited solicitation turns on channel, motive, and recipient relationship — generative judgments, so no auto-flag. Because agentplain drafts text and never places live calls (project_no_outbound_architecture.md), the 7.3(b) live-contact bar is largely a routing concern; the residual live surface is the operator copy-pasting an agent-drafted phone script. ABA Model Rule text pulled 2026-06-06 from americanbar.org (corroborated via state mirrors). NOTE: many states overlay a written-solicitation 'Advertising Material' labeling requirement (former Model Rule 7.3(c)); counsel to add the firm's state-specific labeling literal. Conservatively kept counsel-reference rather than literal-match: a small candidate list (e.g. 'act now before the statute of limitations runs', 'sign today') risks high false-positive rate without per-state tuning.
- **ABA Model Rule 7.1 / 7.2(c) — candidate advertising triggers (DRAFT)** (`mrpc-7-1-advertising-candidates`): Drafted 2026-05-25. 'Specialist' and 'expert' phrases are direct Rule 7.2(c) targets; most state bars treat them as per-se misleading unless the lawyer's certification is named in the same communication. Superlatives ('best', '#1', 'top') and guarantees are core Rule 7.1 'unjustified expectation' targets. Borderline omissions held back for counsel: 'no recovery, no fee' / 'no fee unless we win' (legitimate in most states with disclaimer — recommend counsel-reference + state-specific disclaimer rule), 'aggressive', 'experienced' (too generic to literal-match without false-positive risk).
- **ABA Model Rule 1.1 — Competence** (`mrpc-1-1-competence`): Counsel-reference: 'competence' is a generative judgment, not a literal phrase, so this never auto-flags. Comment [8] is the explicit 'technology competence' obligation adopted by most state bars. Sentinel uses this as the anchor when flagging law-vertical drafts that rely on agent output without indicia of lawyer review. ABA Model Rule text re-verified 2026-06-06 against americanbar.org.
- **ABA Model Rule 1.6 — Confidentiality of Information** (`mrpc-1-6-confidentiality`): Counsel-reference: whether a given disclosure is 'impliedly authorized' or covered by a 1.6(b) exception is a legal judgment, so this never auto-flags. Rule 1.6(c) (safeguarding) is the technology-handling anchor sentinel uses on cross-border data-flow and vendor-disclosure flags. ABA Model Rule text re-verified 2026-06-06 against americanbar.org.
- **ABA Model Rule 1.18 — Duties to Prospective Client** (`mrpc-1-18-prospective-client`): Counsel-reference: whether information 'could be significantly harmful' or matters are 'substantially related' is a legal judgment, so this never auto-flags. Sentinel anchor for intake-form processing: even a brief consultation that doesn't ripen into representation triggers limited confidentiality and conflict obligations. ABA Model Rule text re-verified 2026-06-06 against americanbar.org.
- **ABA Model Rules 7.1–7.3 — Communications about services, advertising, solicitation** (`mrpc-7-1-through-7-3-communications-solicitation`): Counsel-reference master rule for the 7.x advertising/solicitation family: the misleading/material-omission tests are generative judgments, so this never auto-flags. Concrete literal candidates are carried separately in mrpc-7-1-advertising-candidates (advertising) and the live-contact bar in mrpc-7-3-solicitation. ABA Model Rule text (7.1/7.2/7.3) re-verified 2026-06-06 against americanbar.org.
- **Attorney-Client Privilege — common-law elements and waiver** (`attorney-client-privilege`): Counsel-reference, severity advisory: privilege/waiver turns on case law and the Restatement, not a single quotable statute, so this is a routing/summary entry that never auto-flags. FRE 501 text re-verified 2026-06-06 against law.cornell.edu. If sentinel needs a true literal anchor, FRE 501 itself is the most natural. Recommend a parallel state-law privilege literal (O.C.G.A. § 24-5-501 — Georgia's attorney-client privilege statute) be added in a follow-up.
