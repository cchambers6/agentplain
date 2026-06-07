# Counsel handoff packet — RIA compliance corpus

> **DRAFT — not legal advice.** This packet is a fleet-drafted compliance corpus for attorney review. No rule fires on customer drafts until counsel red-lines it AND the vertical is enabled via `COMPLIANCE_CORPUS_COUNSEL_REVIEWED`. Sentinel ADVISES; it never blocks a send.

## Status

- **Vertical:** `ria`
- **Corpus status:** DRAFT
- **Last reviewed:** 2026-05-25
- **Counsel reviewer:** _none yet_
- **Packet generated:** 2026-05-25

### Coverage at a glance

| Bucket | Count |
| --- | --- |
| Live literal triggers (firing today) | 0 |
| Candidate literal triggers (to red-line) | 21 |
| Candidate regex triggers (to red-line) | 0 |
| Counsel-reference rules | 6 |
| Open questions | 8 |

## 1. Live literal triggers (firing on drafts today)

_None. This corpus is DRAFT — no rule is counsel-verified, so the scanner fires on nothing yet. Phrases below are candidates for review._

## 2. Candidate literal triggers — counsel red-line, phrase by phrase

_Sentinel does NOT fire on these. Check a box to approve a phrase as a literal-match trigger; strike, reword, or demote to counsel-reference otherwise._

#### SEC Marketing Rule + FINRA 2210 — candidate advertising triggers (DRAFT) (`ria-marketing-candidates`)
- **Severity:** 🟡 advisory
- **Category:** advertising
- **Citation:** 17 CFR § 275.206(4)-1; FINRA Rule 2210; 15 USC § 80b-8(a)
  — https://www.ecfr.gov/current/title-17/chapter-II/part-275/section-275.206(4)-1 (read 2026-05-25)
- **Drafter notes:** Drafted 2026-05-25. Guarantee/risk-free/can't-lose phrases are FINRA 2210 'promissory' core targets and the SEC has issued enforcement actions citing each in advisory advertising. 'SEC approved/endorsed/sponsored' phrases are direct § 208(a) targets — registration with SEC is NOT endorsement and that representation is a per-se violation. 'FDIC insured' is included because misuse on non-deposit investment products (e.g. money-market funds, sweep accounts) is a recurring exam finding; counsel should consider whether the phrase needs a context modifier so it doesn't false-positive on legitimate references to sweep-deposit FDIC coverage at affiliated banks.
- **Candidate phrases to red-line (21):**
  - [ ] `guaranteed return`
  - [ ] `guaranteed returns`
  - [ ] `guaranteed profit`
  - [ ] `guaranteed profits`
  - [ ] `risk-free investment`
  - [ ] `risk free investment`
  - [ ] `no risk`
  - [ ] `zero risk`
  - [ ] `no-risk`
  - [ ] `can't lose`
  - [ ] `cannot lose`
  - [ ] `beat the market`
  - [ ] `outperform the market`
  - [ ] `double your money`
  - [ ] `sec approved`
  - [ ] `approved by the sec`
  - [ ] `sec endorsed`
  - [ ] `endorsed by the sec`
  - [ ] `sec sponsored`
  - [ ] `fdic insured`
  - [ ] `fdic-insured`

## 3. Candidate regex triggers — counsel red-line

_Deterministic patterns for cases a literal phrase list can't express. Each shows the string it must match and a near-miss it must not._

_None._

## 4. Counsel-reference rules — substantive law, never auto-flagged

#### Investment Advisers Act Section 206 — antifraud provisions / fiduciary duty (`advisers-act-section-206`)
- **Severity:** 🟡 advisory · **Status:** draft
- **Citation:** 15 USC § 80b-6 (Section 206 of the Investment Advisers Act of 1940)
  — https://www.law.cornell.edu/uscode/text/15/80b-6 (read 2026-05-12)
- **Summary:** It is unlawful for any investment adviser to defraud a client or prospective client; to engage in a transaction, practice, or course of business which operates as a fraud or deceit; to engage in principal/agency transactions without written disclosure and client consent; or to engage in any fraudulent, deceptive, or manipulative act, practice, or course of business.
- **Drafter notes:** SEC Staff Bulletin on Standards of Conduct for Broker-Dealers and Investment Advisers (2022) and Regulation Best Interest interpretations expand on the fiduciary contour of Section 206. Counsel may want sentinel to load companion interpretive guidance.

> § 80b-6. Prohibited transactions by investment advisers
> It shall be unlawful for any investment adviser, by use of the mails or any means or instrumentality of interstate commerce, directly or indirectly—
> (1) to employ any device, scheme, or artifice to defraud any client or prospective client;
> (2) to engage in any transaction, practice, or course of business which operates as a fraud or deceit upon any client or prospective client;
> (3) acting as principal for his own account, knowingly to sell any security to or purchase any security from a client, or acting as broker for a person other than such client, knowingly to effect any sale or purchase of any security for the account of such client, without disclosing to such client in writing before the completion of such transaction the capacity in which he is acting and obtaining the consent of the client to such transaction. The prohibitions of this paragraph shall not apply to any transaction with a customer of a broker or dealer if such broker or dealer is not acting as an investment adviser in relation to such transaction; or
> (4) to engage in any act, practice, or course of business which is fraudulent, deceptive, or manipulative. The Commission shall, for the purposes of this paragraph (4) by rules and regulations define, and prescribe means reasonably designed to prevent, such acts, practices, and courses of business as are fraudulent, deceptive, or manipulative.

#### Rule 204A-1 — Investment Adviser Code of Ethics (`advisers-act-rule-204A-1-code-of-ethics`)
- **Severity:** 🟡 advisory · **Status:** draft
- **Citation:** 17 CFR § 275.204A-1
  — https://www.ecfr.gov/current/title-17/chapter-II/part-275/section-275.204A-1 (read 2026-05-12)
- **Summary:** Every SEC-registered investment adviser must establish, maintain, and enforce a written code of ethics that includes (1) a standard of business conduct; (2) personal securities reporting by access persons; (3) preapproval of access-person investments in IPOs and limited offerings; (4) prompt internal reporting of violations; and (5) acknowledgment of receipt of the code.
- **Drafter notes:** Counsel: 17 CFR § 275.204A-1 also has paragraphs (b)(2) (transaction reports — within 30 days of quarter end), (c) (pre-approval of IPOs and limited offerings), (d) (recordkeeping cross-reference to Rule 204-2), and (e) (definitions). Recommend separate literals for those subsections.

> [UNVERIFIED — needs counsel] Substance of 17 CFR § 275.204A-1:
> 
> (a) Adoption and enforcement of code of ethics. If you are an investment adviser registered or required to be registered under section 203 of the Act (15 U.S.C. 80b-3), you must establish, maintain and enforce a written code of ethics that, at a minimum, includes:
> 
> (1) A standard (or standards) of business conduct that you require of your supervised persons, which standard must reflect your fiduciary obligations and those of your supervised persons;
> 
> (2) Provisions requiring your supervised persons to comply with applicable Federal securities laws;
> 
> (3) Provisions that require all of your access persons to report, and you to review, their personal securities transactions and holdings periodically as provided below;
> 
> (4) Provisions requiring supervised persons to report any violations of your code of ethics promptly to your chief compliance officer or, provided your chief compliance officer also receives reports of all violations, to other persons you designate in your code of ethics; and
> 
> (5) Provisions requiring you to provide each of your supervised persons with a copy of your code of ethics and any amendments, and requiring your supervised persons to provide you with a written acknowledgment of their receipt of the code and any amendments.
> 
> (b) Reporting requirements—
> (1) Holdings reports. The code of ethics must require your access persons to submit to your chief compliance officer or other persons you designate in your code of ethics a report of the access person's current securities holdings that meets the following requirements:
> (i) Content of holdings reports. Each holdings report must contain, at a minimum:
>   (A) The title and type of security, and as applicable the exchange ticker symbol or CUSIP number, number of shares, and principal amount of each reportable security in which the access person has any direct or indirect beneficial ownership;
>   (B) The name of any broker, dealer or bank with which the access person maintains an account in which any securities are held for the access person's direct or indirect benefit; and
>   (C) The date the access person submits the report.
> 
> (ii) Timing of holdings reports. Your access persons must submit a holdings report:
>   (A) No later than 10 days after the person becomes an access person, and the information must be current as of a date no more than 45 days prior to the date the person becomes an access person.
>   (B) At least once during each 12-month period thereafter on a date you select, and the information must be current as of a date no more than 45 days prior to the date the report was submitted.

#### Marketing Rule — 17 CFR § 275.206(4)-1 (`advisers-act-marketing-rule-206-4-1`)
- **Severity:** 🟡 advisory · **Status:** draft
- **Citation:** 17 CFR § 275.206(4)-1 (Marketing Rule, amended 86 Fed. Reg. 13024 (Mar. 5, 2021))
  — https://www.ecfr.gov/current/title-17/chapter-II/part-275/section-275.206(4)-1 (read 2026-05-12)
- **Summary:** An adviser may not disseminate any advertisement that contains an untrue statement of material fact, a material omission, a statement that the adviser cannot substantiate upon SEC demand, a reference to specific investment advice that is not presented fairly and impartially, or that is otherwise materially misleading; testimonials, endorsements, and performance presentations are subject to specific conditions including required disclosures and prohibitions on cherry-picked performance.
- **Drafter notes:** Counsel: please pull canonical Marketing Rule text — particularly paragraphs (b) (testimonials/endorsements), (c) (third-party ratings), (d) (performance), and (e) (definitions including 'advertisement'). The 'advertisement' definition is a sentinel anchor for whether a draft falls within the rule at all.

> [UNVERIFIED — needs counsel] Substance of 17 CFR § 275.206(4)-1 (Marketing Rule):
> 
> (a) General Prohibitions. It is unlawful within the meaning of section 206(4) of the Investment Advisers Act of 1940 for any investment adviser registered or required to be registered under section 203 of the Advisers Act, directly or indirectly, to disseminate any advertisement that:
>   (1) Includes any untrue statement of a material fact, or omits to state a material fact necessary in order to make the statement made, in the light of the circumstances under which it was made, not misleading;
>   (2) Includes a material statement of fact that the adviser does not have a reasonable basis for believing it will be able to substantiate upon demand by the Commission;
>   (3) Includes information that would reasonably be likely to cause an untrue or misleading implication or inference to be drawn concerning a material fact relating to the investment adviser;
>   (4) Discusses any potential benefits to clients or investors connected with or resulting from the investment adviser's services or methods of operation without providing fair and balanced treatment of any material risks or material limitations associated with the potential benefits;
>   (5) Includes a reference to specific investment advice provided by the investment adviser where such investment advice is not presented in a manner that is fair and balanced;
>   (6) Includes or excludes performance results, or presents performance time periods, in a manner that is not fair and balanced; or
>   (7) Is otherwise materially misleading.
> 
> (b) Testimonials and Endorsements. An advertisement may not include any testimonial or endorsement, and an adviser may not provide compensation, directly or indirectly, for a testimonial or endorsement, unless the adviser complies with paragraphs (b)(1), (2), and (3) of this section — specifically, required disclosures (status as client or non-client, compensation arrangement, material conflicts), adviser oversight and written agreement requirements, and prohibitions on certain disqualified persons.

#### Form ADV — registration, brochure delivery, annual updates (`form-adv-disclosure-framework`)
- **Severity:** 🟡 advisory · **Status:** draft
- **Citation:** 17 CFR § 275.203-1 (registration); 17 CFR § 275.204-1 (annual updates); 17 CFR § 275.204-3 (delivery of brochure)
  — https://www.sec.gov/about/forms/formadv.pdf (read 2026-05-12)
- **Summary:** An investment adviser must file Form ADV Part 1 (and Part 1B for state-registered advisers) to register; deliver Form ADV Part 2A ('brochure') and Part 2B ('brochure supplement') to each client and prospective client, with annual updates; and amend Form ADV at least annually and promptly on material changes.
- **Drafter notes:** Counsel: this routing entry covers the framework. For sentinel pattern matching, recommend separate literal entries for the most-violated ADV items — particularly Item 9 (disciplinary information), Item 11 (Code of Ethics / participation in client transactions / personal trading), and Item 12 (brokerage practices / soft dollars).

> [ROUTING / SUMMARY — needs counsel for literal] Substance:
> 
> Rule 203-1 (17 CFR § 275.203-1): A person required to be registered with the Commission as an investment adviser under section 203 of the Investment Advisers Act of 1940 must apply for registration on Form ADV (17 CFR § 279.1).
> 
> Rule 204-1 (17 CFR § 275.204-1): Each registered investment adviser must amend its Form ADV at least annually, within 90 days of the end of its fiscal year, by filing an annual updating amendment; and more frequently as required if information becomes materially inaccurate.
> 
> Rule 204-3 (17 CFR § 275.204-3 — the "brochure rule"): A registered investment adviser must deliver to each client and prospective client a written disclosure statement (Form ADV Part 2A and applicable Part 2B brochure supplements) before or at the time of entering into an investment advisory contract; thereafter, the adviser must deliver an updated brochure or summary of material changes at least annually, free of charge.
> 
> Form ADV Part 2A specifically requires disclosure of (among other items) advisory business, fees and compensation, types of clients, methods of analysis, disciplinary information, other financial industry activities and affiliations, code of ethics / personal trading, brokerage practices, review of accounts, client referrals and other compensation, custody, investment discretion, voting client securities, and financial information.

#### Custody Rule — 17 CFR § 275.206(4)-2 (`advisers-act-custody-rule-206-4-2`)
- **Severity:** 🟡 advisory · **Status:** draft
- **Citation:** 17 CFR § 275.206(4)-2
  — https://www.ecfr.gov/current/title-17/chapter-II/part-275/section-275.206(4)-2 (read 2026-05-12)
- **Summary:** An adviser with custody of client funds or securities is required to maintain those assets with a qualified custodian, provide clients with quarterly account statements from the qualified custodian, and undergo an annual surprise examination by an independent public accountant (subject to a pooled-investment-vehicle audit exception).
- **Drafter notes:** Counsel: SEC's proposed Safeguarding Rule (Release No. IA-6240, Feb 2023) would substantially expand the current Custody Rule — was not finalized as of 2026-05-12. Please advise on whether sentinel should track the proposal as a planned-amendment companion entry.

> [UNVERIFIED — needs counsel] Substance of 17 CFR § 275.206(4)-2:
> 
> (a) Safekeeping required. If you are an investment adviser registered or required to be registered under section 203 of the Act (15 U.S.C. 80b-3), it is a fraudulent, deceptive, or manipulative act, practice, or course of business within the meaning of section 206(4) of the Act (15 U.S.C. 80b-6(4)) for you to have custody of client funds or securities unless:
> 
> (1) Qualified custodian. A qualified custodian maintains those funds and securities:
>   (i) In a separate account for each client under that client's name; or
>   (ii) In accounts that contain only your clients' funds and securities, under your name as agent or trustee for the clients.
> 
> (2) Notice to clients. If you open an account with a qualified custodian on your client's behalf, either under the client's name or under your name as agent, you notify the client in writing of the qualified custodian's name, address, and the manner in which the funds or securities are maintained, promptly when the account is opened and following any changes to this information.
> 
> (3) Account statements to clients. You have a reasonable basis, after due inquiry, for believing that the qualified custodian sends an account statement, at least quarterly, to each of your clients for which it maintains funds or securities, identifying the amount of funds and of each security in the account at the end of the period and setting forth all transactions in the account during that period.
> 
> (4) Independent verification. The client funds and securities of which you have custody are verified by actual examination at least once during each calendar year, except as provided below, by an independent public accountant, pursuant to a written agreement between you and the accountant, at a time that is chosen by the accountant without prior notice or announcement to you and that is irregular from year to year.

#### RIA state vs. SEC registration — AUM thresholds (`ria-state-vs-sec-registration`)
- **Severity:** 🟡 advisory · **Status:** draft
- **Citation:** 15 USC § 80b-3a (Section 203A — state and federal responsibilities); 17 CFR § 275.203A-1 (mid-sized adviser threshold)
  — https://www.law.cornell.edu/uscode/text/15/80b-3a (read 2026-05-12)
- **Summary:** Dodd-Frank Act amendments to the Investment Advisers Act allocated jurisdiction: 'mid-sized advisers' (between $25M and $100M AUM) are generally state-registered; advisers above $100M ($110M to trigger an upward switch) are generally SEC-registered, subject to multistate, internet-adviser, and other federal exemptions.
- **Drafter notes:** Counsel: please verify the $100M / $110M buffer and the 15-state multistate exception in 15 USC § 80b-3a(a)(2)(A). The internet-adviser exemption (17 CFR § 275.203A-2(e)) is a common SEC-registration path; counsel: should sentinel include a companion literal?

> [UNVERIFIED — needs counsel] Substance of 15 USC § 80b-3a (Section 203A) as amended by Dodd-Frank:
> 
> (a) Advisers subject to state authorities.
> (1) In general. No investment adviser that is regulated or required to be regulated as an investment adviser in the State in which it maintains its principal office and place of business shall register under section 203, unless the investment adviser—
>   (A) has assets under management of not less than—
>     (i) $25,000,000, or such higher amount as the Commission may, by rule, deem appropriate in accordance with the purposes of this title; or
>     (ii) $100,000,000, in the case of an investment adviser described in subsection (a)(2); or
>   (B) is an adviser to an investment company registered under the Investment Company Act of 1940.
> 
> (2) Treatment of mid-sized investment advisers.
> No investment adviser described in subparagraph (A) shall register under section 203, unless the investment adviser—
>   (A) is required to be registered as an investment adviser with the securities commissioner (or any agency or officer performing like functions) of 15 or more States; or
>   (B) is exempt from registration with the securities commissioner of the State in which it maintains its principal office and place of business.
> 
> Implementing rule (17 CFR § 275.203A-1) provides a $100M/$110M buffer that requires advisers crossing the threshold to switch to SEC registration only after their AUM has exceeded $110M on the most recent annual updating amendment.

## 5. Questions for counsel

**Corpus open questions (drafter → counsel):**

- [ ] Investment Advisers Act Section 206 quoted directly from 15 USC § 80b-6 — counsel to verify literal against current US Code.
- [ ] Marketing Rule (17 CFR § 275.206(4)-1) replaced the old Advertising Rule on 2022-11-04 — drafted excerpt reflects the Marketing Rule; counsel to confirm no further amendments.
- [ ] Code of Ethics rule (17 CFR § 275.204A-1) summarized via the required content elements; counsel verifies literal.
- [ ] Custody Rule (17 CFR § 275.206(4)-2) summarized; SEC's 2023 Safeguarding Rule proposal had not been finalized as of 2026-05-12 drafting — counsel to confirm rule status.
- [ ] Form ADV reference is scope-only; ADV is a form, not a literal rule. Counsel to advise whether sentinel needs Item-by-Item literals for Form ADV disclosure obligations.
- [ ] State RIA registration threshold ($100M / $110M switch) reflects the standard cited in Dodd-Frank; counsel to verify.
- [ ] CANDIDATE TRIGGERS (2026-05-25 wave): `marketing-rule-candidates-literal.ts` ships 21 candidate advertising phrases drafted from Marketing Rule § 206(4)-1(a)(1), FINRA 2210(d)(1)(B), and Advisers Act § 208(a) — e.g. 'guaranteed return', 'risk-free investment', 'sec approved', 'fdic insured'. Sentinel does NOT fire on these — counsel to red-line phrase-by-phrase before flipping `unverified: false`.
- [ ] CANDIDATE TRIGGERS — counsel decision: 'fdic insured' has legitimate uses (sweep deposits at affiliated bank); counsel to advise whether a context modifier is needed to avoid false-positives or whether the literal-match is acceptable as-is given exam-finding risk.

**Per-rule drafter notes (most ambiguous first):**

- **RIA state vs. SEC registration — AUM thresholds** (`ria-state-vs-sec-registration`): Counsel: please verify the $100M / $110M buffer and the 15-state multistate exception in 15 USC § 80b-3a(a)(2)(A). The internet-adviser exemption (17 CFR § 275.203A-2(e)) is a common SEC-registration path; counsel: should sentinel include a companion literal?
- **SEC Marketing Rule + FINRA 2210 — candidate advertising triggers (DRAFT)** (`ria-marketing-candidates`): Drafted 2026-05-25. Guarantee/risk-free/can't-lose phrases are FINRA 2210 'promissory' core targets and the SEC has issued enforcement actions citing each in advisory advertising. 'SEC approved/endorsed/sponsored' phrases are direct § 208(a) targets — registration with SEC is NOT endorsement and that representation is a per-se violation. 'FDIC insured' is included because misuse on non-deposit investment products (e.g. money-market funds, sweep accounts) is a recurring exam finding; counsel should consider whether the phrase needs a context modifier so it doesn't false-positive on legitimate references to sweep-deposit FDIC coverage at affiliated banks.
- **Investment Advisers Act Section 206 — antifraud provisions / fiduciary duty** (`advisers-act-section-206`): SEC Staff Bulletin on Standards of Conduct for Broker-Dealers and Investment Advisers (2022) and Regulation Best Interest interpretations expand on the fiduciary contour of Section 206. Counsel may want sentinel to load companion interpretive guidance.
- **Rule 204A-1 — Investment Adviser Code of Ethics** (`advisers-act-rule-204A-1-code-of-ethics`): Counsel: 17 CFR § 275.204A-1 also has paragraphs (b)(2) (transaction reports — within 30 days of quarter end), (c) (pre-approval of IPOs and limited offerings), (d) (recordkeeping cross-reference to Rule 204-2), and (e) (definitions). Recommend separate literals for those subsections.
- **Marketing Rule — 17 CFR § 275.206(4)-1** (`advisers-act-marketing-rule-206-4-1`): Counsel: please pull canonical Marketing Rule text — particularly paragraphs (b) (testimonials/endorsements), (c) (third-party ratings), (d) (performance), and (e) (definitions including 'advertisement'). The 'advertisement' definition is a sentinel anchor for whether a draft falls within the rule at all.
- **Form ADV — registration, brochure delivery, annual updates** (`form-adv-disclosure-framework`): Counsel: this routing entry covers the framework. For sentinel pattern matching, recommend separate literal entries for the most-violated ADV items — particularly Item 9 (disciplinary information), Item 11 (Code of Ethics / participation in client transactions / personal trading), and Item 12 (brokerage practices / soft dollars).
- **Custody Rule — 17 CFR § 275.206(4)-2** (`advisers-act-custody-rule-206-4-2`): Counsel: SEC's proposed Safeguarding Rule (Release No. IA-6240, Feb 2023) would substantially expand the current Custody Rule — was not finalized as of 2026-05-12. Please advise on whether sentinel should track the proposal as a planned-amendment companion entry.
