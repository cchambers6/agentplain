# Counsel handoff packet — Law compliance corpus

> **DRAFT — not legal advice.** This packet is a fleet-drafted compliance corpus for attorney review. No rule fires on customer drafts until counsel red-lines it AND the vertical is enabled via `COMPLIANCE_CORPUS_COUNSEL_REVIEWED`. Sentinel ADVISES; it never blocks a send.

## Status

- **Vertical:** `law`
- **Corpus status:** DRAFT
- **Last reviewed:** 2026-05-25
- **Counsel reviewer:** _none yet_
- **Packet generated:** 2026-05-25

### Coverage at a glance

| Bucket | Count |
| --- | --- |
| Live literal triggers (firing today) | 0 |
| Candidate literal triggers (to red-line) | 17 |
| Candidate regex triggers (to red-line) | 0 |
| Counsel-reference rules | 7 |
| Open questions | 6 |

## 1. Live literal triggers (firing on drafts today)

_None. This corpus is DRAFT — no rule is counsel-verified, so the scanner fires on nothing yet. Phrases below are candidates for review._

## 2. Candidate literal triggers — counsel red-line, phrase by phrase

_Sentinel does NOT fire on these. Check a box to approve a phrase as a literal-match trigger; strike, reword, or demote to counsel-reference otherwise._

#### ABA Model Rule 7.1 / 7.2(c) — candidate advertising triggers (DRAFT) (`mrpc-7-1-advertising-candidates`)
- **Severity:** 🟡 advisory
- **Category:** advertising
- **Citation:** ABA Model Rules of Professional Conduct, Rules 7.1 and 7.2(c)
  — https://www.americanbar.org/groups/professional_responsibility/publications/model_rules_of_professional_conduct/rule_7_1_communication_concerning_a_lawyer_s_services/ (read 2026-05-25)
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

_None._

## 4. Counsel-reference rules — substantive law, never auto-flagged

#### ABA Model Rule 1.1 — Competence (`mrpc-1-1-competence`)
- **Severity:** 🟡 advisory · **Status:** draft
- **Citation:** ABA Model Rules of Professional Conduct, Rule 1.1; Comment [8] (technology competence)
  — https://www.americanbar.org/groups/professional_responsibility/publications/model_rules_of_professional_conduct/rule_1_1_competence/ (read 2026-05-12)
- **Summary:** A lawyer shall provide competent representation, requiring the legal knowledge, skill, thoroughness, and preparation reasonably necessary for the representation; competence includes keeping abreast of changes in the law and its practice, including the benefits and risks of relevant technology.
- **Drafter notes:** Comment [8] is the explicit 'technology competence' obligation adopted by most state bars. Sentinel uses this as the anchor when flagging law-vertical drafts that rely on agent output without indicia of lawyer review.

> Rule 1.1: Competence
> A lawyer shall provide competent representation to a client. Competent representation requires the legal knowledge, skill, thoroughness and preparation reasonably necessary for the representation.
> 
> Comment [8] (Maintaining Competence):
> To maintain the requisite knowledge and skill, a lawyer should keep abreast of changes in the law and its practice, including the benefits and risks associated with relevant technology, engage in continuing study and education and comply with all continuing legal education requirements to which the lawyer is subject.

#### ABA Model Rule 1.6 — Confidentiality of Information (`mrpc-1-6-confidentiality`)
- **Severity:** 🟡 advisory · **Status:** draft
- **Citation:** ABA Model Rules of Professional Conduct, Rule 1.6
  — https://www.americanbar.org/groups/professional_responsibility/publications/model_rules_of_professional_conduct/rule_1_6_confidentiality_of_information/ (read 2026-05-12)
- **Summary:** A lawyer shall not reveal information relating to the representation of a client unless the client gives informed consent, the disclosure is impliedly authorized to carry out the representation, or a narrow exception in 1.6(b) applies; the lawyer shall also make reasonable efforts to prevent inadvertent or unauthorized disclosure (1.6(c)).

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
  — https://www.americanbar.org/groups/professional_responsibility/publications/model_rules_of_professional_conduct/rule_1_18_duties_of_prospective_client/ (read 2026-05-12)
- **Summary:** Even when no client-lawyer relationship ensues, a lawyer who has had discussions with a prospective client owes that person a duty of confidentiality and may not undertake representation adverse to the prospective client in the same or a substantially related matter if information learned could be significantly harmful, subject to written consent or specified screening conditions.

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
- **Severity:** 🟡 advisory · **Status:** draft
- **Citation:** ABA Model Rules of Professional Conduct, Rule 5.5
  — https://www.americanbar.org/groups/professional_responsibility/publications/model_rules_of_professional_conduct/rule_5_5_unauthorized_practice_of_law_multijurisdictional_practice_of_law/ (read 2026-05-12)
- **Summary:** A lawyer shall not practice law in a jurisdiction in violation of the regulation of the legal profession in that jurisdiction or assist another in doing so; multijurisdictional temporary practice is permitted only under narrow conditions specified in 5.5(c).

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
  — https://www.americanbar.org/groups/professional_responsibility/publications/model_rules_of_professional_conduct/rule_7_1_communication_concerning_a_lawyer_s_services/ (read 2026-05-12)
- **Summary:** A lawyer shall not make a false or misleading communication about the lawyer or the lawyer's services (Rule 7.1); communications must include identifying information (Rule 7.2); a lawyer shall not solicit professional employment by live person-to-person contact when a significant motive is the lawyer's pecuniary gain, subject to exceptions for other lawyers, family, close personal or prior professional relationships, and persons who routinely use the type of legal services involved (Rule 7.3).

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
- **Severity:** 🟡 advisory · **Status:** draft
- **Citation:** Georgia Rules of Professional Conduct (Rules and Regulations of the State Bar of Georgia, Part IV, Chapter 1)
  — https://www.gabar.org/barrules/handbookdetail.cfm?what=rule (read 2026-05-12)
- **Summary:** Georgia adopts the ABA Model Rules of Professional Conduct as the Georgia Rules of Professional Conduct, codified in Part IV, Chapter 1 of the Rules and Regulations of the State Bar of Georgia, with state-specific modifications.
- **Drafter notes:** This entry is routing-only — sentinel will not match against the placeholder. Counsel needs to either (a) confirm that the corresponding Model Rule literals are acceptable substitutes, or (b) instantiate GA-specific text as new rule files.

> [CROSS-REFERENCE + UNVERIFIED] Substance: Georgia has adopted the ABA Model Rules of Professional Conduct as the Georgia Rules of Professional Conduct, codified in Part IV, Chapter 1 of the Rules and Regulations of the State Bar of Georgia. State-specific deviations from the Model Rules include (among others) Georgia-specific advertising provisions and Rule 5.5 multijurisdictional-practice carve-outs. For rules where Georgia has not deviated from the Model Rule, sentinel should use the Model Rule literals loaded elsewhere in this corpus.
> 
> Counsel: please pull the canonical Georgia-specific deviations and instantiate them as their own standalone literals in this corpus — the routing entry alone is not sufficient for sentinel matching where the state rule differs.

#### Attorney-Client Privilege — common-law elements and waiver (`attorney-client-privilege`)
- **Severity:** 🟡 advisory · **Status:** draft
- **Citation:** FRE 501 (privilege under federal common law); Restatement (Third) of the Law Governing Lawyers §§ 68–86; Upjohn Co. v. United States, 449 U.S. 383 (1981); United States v. Kovel, 296 F.2d 918 (2d Cir. 1961)
  — https://www.law.cornell.edu/rules/fre/rule_501 (read 2026-05-12)
- **Summary:** The attorney-client privilege protects confidential communications between a client (or prospective client) and the lawyer made for the purpose of obtaining or providing legal advice. Privilege is waived by voluntary disclosure to third parties and may be inadvertently waived; certain agency-like third parties (interpreters, accountants under Kovel) may be brought within privilege.
- **Drafter notes:** Counsel: this is intentionally a routing/summary entry rather than a 'literal' since privilege rests on case law and Restatement, not a single quotable statute. If sentinel needs a true literal anchor, the most natural is FRE 501 itself. Recommend a parallel state-law privilege literal (O.C.G.A. § 24-5-501 — Georgia's attorney-client privilege statute) be added in a follow-up.

> [ROUTING / SUMMARY — needs counsel for literal] Substance:
> 
> Federal Rule of Evidence 501 provides: "The common law — as interpreted by United States courts in the light of reason and experience — governs a claim of privilege unless any of the following provides otherwise: the United States Constitution; a federal statute; or rules prescribed by the Supreme Court. But in a civil case, state law governs privilege regarding a claim or defense for which state law supplies the rule of decision."
> 
> The attorney-client privilege requires (per the Restatement (Third) of the Law Governing Lawyers § 68): (a) a communication, (b) made between privileged persons, (c) in confidence, (d) for the purpose of obtaining or providing legal assistance for the client.
> 
> Waiver: The privilege is waived by voluntary disclosure of privileged material to non-privileged third parties (Restatement § 79). Inadvertent disclosure may also waive privilege depending on the jurisdiction's adopted test (the majority Hopson/middle-ground test considers the reasonableness of the producing party's precautions). Federal Rule of Evidence 502 provides a federal rule against subject-matter waiver from inadvertent disclosure where reasonable steps to prevent and rectify were taken.
> 
> Third-party agents under Kovel: a non-lawyer assistant (interpreter, accountant, sometimes other consultants) may be brought within privilege when the assistant is necessary or highly useful for the effective consultation between the client and the lawyer regarding which the latter has been professionally consulted (United States v. Kovel, 296 F.2d 918 (2d Cir. 1961)).

## 5. Questions for counsel

**Corpus open questions (drafter → counsel):**

- [ ] ABA Model Rules 1.1 / 1.6 / 1.18 / 5.5 / 7.1 quoted from drafter recollection of the canonical text — counsel to verify against current ABA published version (Model Rules text may differ slightly from drafted version).
- [ ] GA Rules of Professional Conduct adopt the Model Rules with state-specific modifications — drafter included the GA reference at scope level only; counsel to confirm which GA-specific deviations need standalone literals.
- [ ] Attorney-client privilege summary draws on common-law principles and the Restatement (Third) of the Law Governing Lawyers; this is a routing entry only, not a literal statute.
- [ ] Counsel: please advise whether sentinel should also load MRPC 8.4 (misconduct) and 1.7/1.9 (conflicts) — drafter omitted these from initial pass to keep scope contained.
- [ ] CANDIDATE TRIGGERS (2026-05-25 wave): `mrpc-7-1-advertising-candidates-literal.ts` ships 17 candidate advertising phrases drafted from Model Rule 7.1 (misleading) and Rule 7.2(c) (specialist claims) — e.g. 'guaranteed result', 'best lawyer in', 'specialist in', 'expert in'. Sentinel does NOT fire on these — counsel to red-line phrase-by-phrase before flipping `unverified: false`.
- [ ] CANDIDATE TRIGGERS — counsel decision: state bar rules diverge substantially on advertising; counsel to overlay GA-specific bar rules (and any other jurisdictions the firm operates in) before flipping verified. Held-back borderline phrases ('no recovery, no fee', 'aggressive', 'experienced') noted in the candidate rule's drafterNotes.

**Per-rule drafter notes (most ambiguous first):**

- **Georgia Rules of Professional Conduct — state adoption of Model Rules** (`ga-rules-of-professional-conduct`): This entry is routing-only — sentinel will not match against the placeholder. Counsel needs to either (a) confirm that the corresponding Model Rule literals are acceptable substitutes, or (b) instantiate GA-specific text as new rule files.
- **ABA Model Rule 7.1 / 7.2(c) — candidate advertising triggers (DRAFT)** (`mrpc-7-1-advertising-candidates`): Drafted 2026-05-25. 'Specialist' and 'expert' phrases are direct Rule 7.2(c) targets; most state bars treat them as per-se misleading unless the lawyer's certification is named in the same communication. Superlatives ('best', '#1', 'top') and guarantees are core Rule 7.1 'unjustified expectation' targets. Borderline omissions held back for counsel: 'no recovery, no fee' / 'no fee unless we win' (legitimate in most states with disclaimer — recommend counsel-reference + state-specific disclaimer rule), 'aggressive', 'experienced' (too generic to literal-match without false-positive risk).
- **Attorney-Client Privilege — common-law elements and waiver** (`attorney-client-privilege`): Counsel: this is intentionally a routing/summary entry rather than a 'literal' since privilege rests on case law and Restatement, not a single quotable statute. If sentinel needs a true literal anchor, the most natural is FRE 501 itself. Recommend a parallel state-law privilege literal (O.C.G.A. § 24-5-501 — Georgia's attorney-client privilege statute) be added in a follow-up.
- **ABA Model Rule 1.1 — Competence** (`mrpc-1-1-competence`): Comment [8] is the explicit 'technology competence' obligation adopted by most state bars. Sentinel uses this as the anchor when flagging law-vertical drafts that rely on agent output without indicia of lawyer review.
