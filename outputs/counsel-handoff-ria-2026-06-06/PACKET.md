# Counsel handoff packet — RIA compliance corpus

> **DRAFT — not legal advice.** This packet is a fleet-drafted compliance corpus for attorney review. No rule fires on customer drafts until counsel red-lines it AND the vertical is enabled via `COMPLIANCE_CORPUS_COUNSEL_REVIEWED`. Sentinel ADVISES; it never blocks a send.

## Status

- **Vertical:** `ria`
- **Corpus status:** DRAFT
- **Last reviewed:** 2026-06-06
- **Counsel reviewer:** _none yet_
- **Packet generated:** 2026-06-06

### Coverage at a glance

| Bucket | Count |
| --- | --- |
| Live literal triggers (firing today) | 0 |
| Candidate literal triggers (to red-line) | 21 |
| Candidate regex triggers (to red-line) | 2 |
| Counsel-reference rules | 8 |
| Open questions | 9 |

## 1. Live literal triggers (firing on drafts today)

_None. This corpus is DRAFT — no rule is counsel-verified, so the scanner fires on nothing yet. Phrases below are candidates for review._

## 2. Candidate literal triggers — counsel red-line, phrase by phrase

_Sentinel does NOT fire on these. Check a box to approve a phrase as a literal-match trigger; strike, reword, or demote to counsel-reference otherwise._

#### SEC Marketing Rule + FINRA 2210 — candidate advertising triggers (DRAFT) (`ria-marketing-candidates`)
- **Severity:** 🔴 blocking
- **Category:** advertising
- **Citation:** 17 CFR § 275.206(4)-1 (Marketing Rule); FINRA Rule 2210(d)(1)(B); 15 USC § 80b-8(a) (Advisers Act § 208(a))
  — https://www.law.cornell.edu/cfr/text/17/275.206(4)-1 (read 2026-06-06)
- **Safe rewrite:** Strike absolute performance and safety claims. Never promise guaranteed/risk-free/can't-lose returns or 'beat the market' — replace with substantiated, fair-and-balanced language that discloses material risks. Never represent or imply SEC approval/endorsement/sponsorship (registration is not endorsement — Advisers Act § 208(a)). Use 'FDIC insured' only for genuine deposit products and make the non-deposit, may-lose-value nature of advisory products explicit.
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

#### SEC Marketing Rule + FINRA 2210 — candidate advertising triggers (DRAFT) (`ria-marketing-candidates`)
- [ ] **Pattern:** `/guaranteed[^.!?\n]{0,40}returns?\b/i` — 🔴 blocking
  - Catches 'guaranteed … return(s)' performance promises the flat literal list misses when a figure or qualifier sits between the words, e.g. 'guaranteed 8% annual returns' — a FINRA 2210 promissory / Marketing Rule § 206(4)-1(a)(1) unsubstantiated-material-fact target.
  - **Matches (intended):** "We offer a guaranteed 8% annual return on this strategy."
  - **Does NOT match (guard):** "Your guaranteed delivery window is two business days."
- [ ] **Pattern:** `/risk[- ]free\b[^.!?\n]{0,30}\b(investment|return|returns|portfolio|strategy|account)/i` — 🔴 blocking
  - Catches 'risk-free' applied to an investment claim (e.g. 'risk-free investment opportunity', 'risk free portfolio') without false-positiving on unrelated 'risk-free trial' marketing.
  - **Matches (intended):** "Get into this risk-free investment today."
  - **Does NOT match (guard):** "Start your risk-free trial of our newsletter."

## 4. Counsel-reference rules — substantive law, never auto-flagged

#### Investment Advisers Act Section 206 — antifraud provisions / fiduciary duty (`advisers-act-section-206`)
- **Severity:** 🔴 blocking · **Status:** draft
- **Citation:** 15 USC § 80b-6 (Section 206 of the Investment Advisers Act of 1940)
  — https://www.law.cornell.edu/uscode/text/15/80b-6 (read 2026-06-06)
- **Summary:** It is unlawful for any investment adviser to defraud a client or prospective client; to engage in a transaction, practice, or course of business which operates as a fraud or deceit; to engage in principal/agency transactions without written disclosure and client consent; or to engage in any fraudulent, deceptive, or manipulative act, practice, or course of business.
- **Safe rewrite / guidance:** Frame every recommendation, fee description, and conflict in terms of the client's best interest. Strike anything that overstates certainty, hides a conflict, or describes a principal/agency trade without the written, pre-trade capacity disclosure and client consent § 206(3) requires. Disclose material conflicts plainly rather than burying them.
- **Drafter notes:** SEC Staff Bulletin on Standards of Conduct for Broker-Dealers and Investment Advisers (2022) and Regulation Best Interest interpretations expand on the fiduciary contour of Section 206. Counsel may want sentinel to load companion interpretive guidance.

> § 80b-6. Prohibited transactions by investment advisers
> It shall be unlawful for any investment adviser, by use of the mails or any means or instrumentality of interstate commerce, directly or indirectly—
> (1) to employ any device, scheme, or artifice to defraud any client or prospective client;
> (2) to engage in any transaction, practice, or course of business which operates as a fraud or deceit upon any client or prospective client;
> (3) acting as principal for his own account, knowingly to sell any security to or purchase any security from a client, or acting as broker for a person other than such client, knowingly to effect any sale or purchase of any security for the account of such client, without disclosing to such client in writing before the completion of such transaction the capacity in which he is acting and obtaining the consent of the client to such transaction. The prohibitions of this paragraph shall not apply to any transaction with a customer of a broker or dealer if such broker or dealer is not acting as an investment adviser in relation to such transaction; or
> (4) to engage in any act, practice, or course of business which is fraudulent, deceptive, or manipulative. The Commission shall, for the purposes of this paragraph (4) by rules and regulations define, and prescribe means reasonably designed to prevent, such acts, practices, and courses of business as are fraudulent, deceptive, or manipulative.

#### Rule 204A-1 — Investment Adviser Code of Ethics (`advisers-act-rule-204A-1-code-of-ethics`)
- **Severity:** ⚪ info · **Status:** draft
- **Citation:** 17 CFR § 275.204A-1 (Investment adviser codes of ethics)
  — https://www.law.cornell.edu/cfr/text/17/275.204A-1 (read 2026-06-06)
- **Summary:** Every SEC-registered investment adviser must establish, maintain, and enforce a written code of ethics that includes (1) a standard of business conduct; (2) personal securities reporting by access persons; (3) preapproval of access-person investments in IPOs and limited offerings; (4) prompt internal reporting of violations; and (5) acknowledgment of receipt of the code.
- **Safe rewrite / guidance:** No client-facing draft text to rewrite — this is a firm-policy obligation (the adviser must adopt and enforce a written code of ethics). Route any draft that asserts personal-trading, access-person, or code-of-ethics claims to compliance for confirmation against the firm's adopted code.
- **Drafter notes:** Counsel: 17 CFR § 275.204A-1 also has paragraphs (b)(2) (transaction reports — within 30 days of quarter end), (c) (pre-approval of IPOs and limited offerings), (d) (recordkeeping cross-reference to Rule 204-2), and (e) (definitions). Recommend separate literals for those subsections.

> 17 CFR § 275.204A-1 — Investment adviser codes of ethics:
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
- **Severity:** 🔴 blocking · **Status:** draft
- **Citation:** 17 CFR § 275.206(4)-1 (Marketing Rule; adopted 86 Fed. Reg. 13024 (Mar. 5, 2021), eff. May 4, 2021, compliance date Nov. 4, 2022)
  — https://www.law.cornell.edu/cfr/text/17/275.206(4)-1 (read 2026-06-06)
- **Summary:** The 2020 amended Marketing Rule (compliance date Nov. 4, 2022) governs adviser advertising and replaced the former Advertising Rule and Cash Solicitation Rule. Paragraph (a) sets SEVEN general prohibitions (untrue/omitted material fact; unsubstantiated material claims; misleading implications; benefits without fair-and-balanced treatment of material risks; unfair references to specific advice; unfair performance presentation; otherwise materially misleading). Paragraph (b) newly permits TESTIMONIALS and ENDORSEMENTS only with clear-and-prominent disclosures (client/non-client status, compensation, material conflicts), adviser oversight and written agreement, and disqualification of ineligible persons.
- **Safe rewrite / guidance:** Treat any client/third-party quote, rating, or referral arrangement in a draft as a testimonial or endorsement. Strike it unless the required clear-and-prominent disclosures (client vs. non-client status, compensation, material conflicts) ride alongside, the firm has the written agreement and oversight in place, and the promoter is not a disqualified/ineligible person. Strip any benefit claim that lacks fair-and-balanced treatment of material risks, and any performance figure that is not presented fair-and-balanced.
- **Drafter notes:** Verified paragraph (a) seven prohibitions and paragraph (b)(1)/(b)(3) against Cornell LII 2026-06-06. The (b)(2) written-agreement de minimis threshold and paragraphs (c) (third-party ratings), (d) (performance), and (e) (definitions, including 'advertisement') are summarized, not quoted — counsel to pull the canonical (c)/(d)/(e) text; the 'advertisement' definition is the sentinel anchor for whether a draft falls within the rule at all. A dedicated testimonials/endorsements companion ships at `ria-marketing-testimonials-endorsements`.

> 17 CFR § 275.206(4)-1 (Marketing Rule):
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
> (b) Testimonials and endorsements. An advertisement may not include any testimonial or endorsement, and an adviser may not provide compensation, directly or indirectly, for a testimonial or endorsement, unless the adviser complies with paragraphs (b)(1), (2), and (3) of this section:
>   (1) Disclosure. The adviser discloses, or reasonably believes that the person giving the testimonial or endorsement discloses, the following clearly and prominently:
>     (i) That the testimonial was given by a current client or investor, and the endorsement was given by a person other than a current client or investor, as applicable;
>     (ii) That cash or non-cash compensation was provided for the testimonial or endorsement, if applicable; and
>     (iii) A brief statement of any material conflicts of interest on the part of the person giving the testimonial or endorsement resulting from the investment adviser's relationship with such person.
>   (2) Adviser oversight and compliance. The adviser has a reasonable basis for believing that the testimonial or endorsement complies with this section, and (for compensated testimonials/endorsements over the de minimis threshold) has a written agreement with the person describing the scope of the agreed-upon activities and the terms of compensation.
>   (3) Disqualification. The adviser does not compensate a person, directly or indirectly, for a testimonial or endorsement if the adviser knows, or in the exercise of reasonable care should know, that the person is an ineligible person at the time the testimonial or endorsement is disseminated.

#### Marketing Rule — testimonials & endorsements, 17 CFR § 275.206(4)-1(b) (`ria-marketing-testimonials-endorsements`)
- **Severity:** 🟡 advisory · **Status:** draft
- **Citation:** 17 CFR § 275.206(4)-1(b) (Marketing Rule — testimonials and endorsements; compliance date Nov. 4, 2022)
  — https://www.law.cornell.edu/cfr/text/17/275.206(4)-1 (read 2026-06-06)
- **Summary:** An adviser may use, or pay for, a testimonial (from a current client/investor) or an endorsement (from a non-client) only if: (b)(1) it discloses clearly and prominently the giver's client/non-client status, that compensation was provided, and a brief statement of any material conflicts; (b)(2) the adviser has a reasonable basis to believe the testimonial/endorsement complies with the rule and has a written agreement with any promoter compensated above the de minimis amount; and (b)(3) the adviser does not compensate a promoter it knows (or should know) is an 'ineligible person' (subject to disqualifying SEC actions or certain criminal/regulatory events).
- **Safe rewrite / guidance:** Treat any client quote, satisfied-customer story, star rating, referral arrangement, or influencer mention in a draft as a testimonial or endorsement. Do not publish it unless the clear-and-prominent disclosures travel with it (client vs. non-client status, that compensation was paid, and a brief statement of material conflicts), the firm has the required written agreement and oversight for any compensated promoter, and the promoter is not a disqualified/ineligible person.
- **Drafter notes:** Verified (b)(1)(i)-(iii) and (b)(3) against Cornell LII 2026-06-06. (b)(2)'s de minimis written-agreement threshold is summarized — counsel to confirm the current dollar figure and the full 'ineligible person' definition (which cross-references SEC disqualifying events). Overlaps deliberately with the general Marketing Rule entry (`advisers-act-marketing-rule-206-4-1`), which carries the paragraph (a) prohibitions; this file isolates paragraph (b) so a testimonial/endorsement draft routes to the precise conditions.

> 17 CFR § 275.206(4)-1(b) — Testimonials and endorsements:
> 
> An advertisement may not include any testimonial or endorsement, and an investment adviser may not provide compensation, directly or indirectly, for a testimonial or endorsement, unless the investment adviser complies with paragraphs (b)(1), (2), and (3) of this section.
> 
> (1) Disclosure. The investment adviser discloses, or the investment adviser reasonably believes that the person giving the testimonial or endorsement discloses, the following clearly and prominently:
>   (i) That the testimonial was given by a current client or investor, and the endorsement was given by a person other than a current client or investor, as applicable;
>   (ii) That cash or non-cash compensation was provided for the testimonial or endorsement, if applicable; and
>   (iii) A brief statement of any material conflicts of interest on the part of the person giving the testimonial or endorsement resulting from the investment adviser's relationship with such person.
> 
> (2) Adviser oversight and compliance. The investment adviser has a reasonable basis for believing that the testimonial or endorsement complies with the requirements of this section, and, for a testimonial or endorsement for which the adviser provides compensation that exceeds the de minimis threshold, has a written agreement with the person giving the testimonial or endorsement that describes the scope of the agreed-upon activities and the terms of the compensation.
> 
> (3) Disqualification. The investment adviser does not compensate a person, directly or indirectly, for a testimonial or endorsement if the investment adviser knows, or in the exercise of reasonable care should know, that the person giving the testimonial or endorsement is an ineligible person at the time the testimonial or endorsement is disseminated.

#### Form ADV Part 2 (brochure) — delivery & disclosure (`form-adv-part-2-brochure-disclosure`)
- **Severity:** 🟡 advisory · **Status:** draft
- **Citation:** 17 CFR § 275.204-3 (brochure rule) + Form ADV Part 2 instructions (17 CFR § 279.1)
  — https://www.law.cornell.edu/cfr/text/17/275.204-3 (read 2026-06-06)
- **Summary:** The brochure rule (17 CFR § 275.204-3) requires a registered adviser to deliver its current Form ADV Part 2A ('brochure') before or at the time it enters into an advisory contract, and to deliver — annually within 120 days of fiscal year end and free of charge — either a current brochure or a summary of material changes when there have been material changes. Part 2A must disclose, in plain English, advisory business, fees and compensation, conflicts of interest, disciplinary information, code of ethics, brokerage practices (including soft dollars), and custody; Part 2B brochure supplements cover individual supervised persons.
- **Safe rewrite / guidance:** Whenever a draft makes representations about the adviser's fees, conflicts, disciplinary history, custody, or brokerage/soft-dollar practices, confirm those representations match the firm's current Form ADV Part 2A brochure and that the brochure was delivered before/at contracting and offered/updated annually. Do not state or imply terms that contradict or are not disclosed in the delivered brochure.
- **Drafter notes:** Verified the § 275.204-3(b) delivery text (initial before/at contract; annual within 120 days; current brochure OR summary of material changes) against Cornell LII 2026-06-06. The Part 2A item enumeration is paraphrased from the Form ADV Part 2 instructions — counsel to confirm the canonical item list and consider separate literal entries for the most-violated items (Item 9 disciplinary; Item 11 code of ethics/personal trading; Item 12 brokerage/soft dollars — see companion `ria-soft-dollar-section-28e`). Renamed from the former `form-adv-disclosure-framework` routing entry to make Part 2 disclosure coverage explicit per the 2026-06-06 wave.

> 17 CFR § 275.204-3 — Delivery of brochures and brochure supplements:
> 
> (b) Delivery.
> (1) General requirement. You must deliver to a client or prospective client your current brochure and one or more current brochure supplements before or at the time you enter into an investment advisory contract with that client.
> 
> (2) Updates. You must deliver to each client, annually within 120 days after the end of your fiscal year and without charge, if there are material changes in your brochure since your last annual updating amendment:
>   (i) A current brochure; or
>   (ii) The summary of material changes to the brochure (as required by Item 2 of Part 2A of Form ADV) that includes an offer to provide a copy of the current brochure and information on how a client may obtain the brochure.
> 
> Form ADV Part 2A (the "brochure") is the disclosure statement delivered to clients and must address, in plain English, among other items: advisory business; fees and compensation; performance-based fees; types of clients; methods of analysis and investment strategies; disciplinary information; other financial industry activities and affiliations; code of ethics, participation in client transactions and personal trading; brokerage practices (including soft-dollar arrangements); review of accounts; client referrals and other compensation; custody; investment discretion; voting client securities; and financial information. Part 2B (brochure supplement) covers the individual supervised persons who provide advisory services to the client.

#### Custody Rule — 17 CFR § 275.206(4)-2 (`advisers-act-custody-rule-206-4-2`)
- **Severity:** 🟡 advisory · **Status:** draft
- **Citation:** 17 CFR § 275.206(4)-2 (Custody of funds or securities of clients)
  — https://www.law.cornell.edu/cfr/text/17/275.206(4)-2 (read 2026-06-06)
- **Summary:** An adviser with custody of client funds or securities is required to maintain those assets with a qualified custodian, provide clients with quarterly account statements from the qualified custodian, and undergo an annual surprise examination by an independent public accountant (subject to a pooled-investment-vehicle audit exception).
- **Safe rewrite / guidance:** Do not imply the adviser holds, takes possession of, or directly controls client funds or securities (beyond authorized fee deduction). If a draft references custody, qualified custodians, or account statements, confirm the qualified-custodian, written-notice, quarterly-statement, and annual-surprise-exam safeguards are actually in place before the statement goes out.
- **Drafter notes:** literalText is paraphrased from the rule structure and could not be confirmed word-for-word against eCFR (eCFR 302-redirects automated fetch); kept `unverified: true` and the [UNVERIFIED] placeholder per the corpus convention. Counsel to pull the canonical 17 CFR § 275.206(4)-2(a)(1)-(6) text. SEC's proposed Safeguarding Rule (Release No. IA-6240, Feb 2023) would substantially expand the current Custody Rule — was not finalized as of 2026-06-06. Please advise on whether sentinel should track the proposal as a planned-amendment companion entry.

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
- **Severity:** ⚪ info · **Status:** draft
- **Citation:** 15 USC § 80b-3a (Section 203A — state and federal responsibilities); 17 CFR § 275.203A-1 (mid-sized adviser threshold)
  — https://www.law.cornell.edu/uscode/text/15/80b-3a (read 2026-06-06)
- **Summary:** Dodd-Frank Act amendments to the Investment Advisers Act allocated jurisdiction: 'mid-sized advisers' (between $25M and $100M AUM) are generally state-registered; advisers above $100M ($110M to trigger an upward switch) are generally SEC-registered, subject to multistate, internet-adviser, and other federal exemptions.
- **Safe rewrite / guidance:** Routing/scope rule — no client-facing draft text to rewrite. Use it to confirm a draft does not misstate the adviser's registration status (e.g. calling a state-registered adviser 'SEC-registered' or implying SEC registration confers approval — see `ria-marketing-candidates` and § 208(a)).
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

#### Soft dollars — Securities Exchange Act § 28(e) safe harbor + Form ADV disclosure (`ria-soft-dollar-section-28e`)
- **Severity:** 🟡 advisory · **Status:** draft
- **Citation:** 15 USC § 78bb(e) (Section 28(e) of the Securities Exchange Act of 1934); Form ADV Part 2A Item 12 (brokerage practices / soft dollars)
  — https://www.law.cornell.edu/uscode/text/15/78bb (read 2026-06-06)
- **Summary:** An adviser with investment discretion may pay a broker more than the lowest available commission only within the Section 28(e) safe harbor — i.e. on a good-faith determination that the commission is reasonable relative to the value of the 'brokerage and research services' the broker provides — and must disclose its soft-dollar arrangements and the resulting conflicts of interest in Form ADV Part 2A (Item 12). Using client commissions for items outside the § 28(e) definition, or omitting the disclosure, falls outside the safe harbor and implicates the adviser's § 206 fiduciary duty.
- **Safe rewrite / guidance:** Do not describe any product or service paid for with client commissions as 'free' or cost-free — it is paid with client brokerage and creates a best-execution conflict. If a draft references research, data, or services obtained through client commissions, confirm the item falls within the § 28(e) 'brokerage and research services' definition and that the arrangement and its conflicts are disclosed in the firm's Form ADV Part 2A, Item 12.
- **Drafter notes:** Verified the § 28(e)(1) safe-harbor text and the (e)(3)(A)-(C) brokerage-and-research-services definition against Cornell LII 2026-06-06. The Form ADV Part 2A Item 12 obligation is summarized from the Form ADV Part 2 instructions — counsel to confirm the canonical Item 12 wording. Counsel: consider whether 'mixed-use' allocations (a product serving both research and non-research functions) need a dedicated companion rule; the SEC's 2006 interpretive release (Rel. No. 34-54165) is the governing soft-dollar guidance and may warrant citation alongside § 28(e).

> 15 USC § 78bb(e) — Effect on existing law (Section 28(e) safe harbor):
> 
> (1) No person using the mails, or any means or instrumentality of interstate commerce, in the exercise of investment discretion with respect to an account shall be deemed to have acted unlawfully or to have breached a fiduciary duty under State or Federal law unless expressly provided to the contrary by a law enacted by the Congress or any State subsequent to June 4, 1975, solely by reason of his having caused the account to pay a member of an exchange, broker, or dealer an amount of commission for effecting a securities transaction in excess of the amount of commission another member of an exchange, broker, or dealer would have charged for effecting that transaction, if such person determined in good faith that such amount of commission was reasonable in relation to the value of the brokerage and research services provided by such member, broker, or dealer, viewed in terms of either that particular transaction or his overall responsibilities with respect to the accounts as to which he exercises investment discretion.
> 
> (3) For purposes of this subsection a person provides brokerage and research services insofar as he—
> (A) furnishes advice, either directly or through publications or writings, as to the value of securities, the advisability of investing in, purchasing, or selling securities, and the availability of securities or purchasers or sellers of securities;
> (B) furnishes analyses and reports concerning issuers, industries, securities, economic factors and trends, portfolio strategy, and the performance of accounts; or
> (C) effects securities transactions and performs functions incidental thereto (such as clearance, settlement, and custody) or required in connection therewith by rules of the Commission or a self-regulatory organization of which such person is a member or person associated with a member or in which such person is a participant.
> 
> Form ADV Part 2A, Item 12 (Brokerage Practices): The adviser must disclose its soft-dollar practices — the research and other products/services it receives in exchange for client brokerage, the conflicts of interest those arrangements create (an incentive to select a broker based on the adviser's interest in receiving research rather than the client's interest in best execution), and whether the benefits are used for all or only some client accounts.

## 5. Questions for counsel

**Corpus open questions (drafter → counsel):**

- [ ] MOST AMBIGUOUS: 'fdic insured' / 'fdic-insured' in `marketing-rule-candidates-literal.ts` fires unconditionally, but the phrase is legitimate for genuine sweep-deposit coverage at an affiliated bank and a per-se misrepresentation only on a non-deposit advisory product. Counsel must decide whether the literal-match is acceptable as-is given the recurring exam-finding risk, or whether it needs a context modifier / move to the counsel-reference path so it does not false-positive on lawful FDIC references.
- [ ] Marketing Rule § 206(4)-1(b) testimonials/endorsements now ship in TWO places — the paragraph-(a)+(b) overview (`advisers-act-marketing-rule-206-4-1`) and the dedicated (b) rule (`ria-marketing-testimonials-endorsements`). Counsel to confirm the deliberate overlap is acceptable, verify the (b)(2) de minimis written-agreement dollar threshold, and supply the full 'ineligible person' disqualification definition.
- [ ] Soft dollars (new 2026-06-06): `soft-dollar-section-28e-literal.ts` quotes 15 USC § 78bb(e)(1) safe harbor and (e)(3) brokerage-and-research-services definition (verified Cornell LII) plus a summarized Form ADV Part 2A Item 12 disclosure obligation. Counsel to confirm the Item 12 wording and advise whether the SEC 2006 interpretive release (Rel. No. 34-54165) and a 'mixed-use' allocation companion rule are needed.
- [ ] Form ADV Part 2 (re-scoped 2026-06-06): the former scope-only `form-adv-disclosure-framework` is now `form-adv-part-2-brochure-disclosure` with verified 17 CFR § 275.204-3(b) delivery text (initial before/at contract; annual within 120 days). The Part 2A item enumeration is paraphrased — counsel to confirm the canonical item list and whether dedicated literals for Item 9 (disciplinary), Item 11 (code of ethics / personal trading), and Item 12 (brokerage / soft dollars) are warranted.
- [ ] Marketing-rule candidate triggers: counsel to red-line the 21 literal phrases AND the two new regexes ('guaranteed … return(s)', 'risk[- ]free … investment') phrase-by-phrase before any `unverified: false` flip. 'Guaranteed return' phrases are FINRA 2210 promissory core; 'SEC approved/endorsed/sponsored' are direct § 208(a) violations.
- [ ] Custody Rule (17 CFR § 275.206(4)-2): literalText remains an [UNVERIFIED] paraphrase because eCFR 302-redirects automated fetch — counsel to pull canonical (a)(1)-(6) text. Also confirm the status of the SEC proposed Safeguarding Rule (Rel. No. IA-6240, Feb 2023), unfinalized as of 2026-06-06.
- [ ] Code of Ethics (17 CFR § 275.204A-1): paragraph (a) five elements verified against Cornell LII; the (b) holdings/transaction-report detail is drafted from the rule structure and not independently re-verified word-for-word — counsel to confirm (b)(1)-(2), (c) IPO/limited-offering pre-approval, and (d) recordkeeping.
- [ ] Investment Advisers Act § 206 (15 USC § 80b-6) and § 208(a) (15 USC § 80b-8(a)) quoted from Cornell LII — counsel to confirm against the current US Code rendering.
- [ ] State vs. SEC registration: $100M/$110M buffer and 15-state multistate exception (15 USC § 80b-3a / 17 CFR § 275.203A-1) carried from Dodd-Frank; scope-only (severity 'info'). Counsel to verify the buffer and the internet-adviser exemption path (17 CFR § 275.203A-2(e)).

**Per-rule drafter notes (most ambiguous first):**

- **Custody Rule — 17 CFR § 275.206(4)-2** (`advisers-act-custody-rule-206-4-2`): literalText is paraphrased from the rule structure and could not be confirmed word-for-word against eCFR (eCFR 302-redirects automated fetch); kept `unverified: true` and the [UNVERIFIED] placeholder per the corpus convention. Counsel to pull the canonical 17 CFR § 275.206(4)-2(a)(1)-(6) text. SEC's proposed Safeguarding Rule (Release No. IA-6240, Feb 2023) would substantially expand the current Custody Rule — was not finalized as of 2026-06-06. Please advise on whether sentinel should track the proposal as a planned-amendment companion entry.
- **RIA state vs. SEC registration — AUM thresholds** (`ria-state-vs-sec-registration`): Counsel: please verify the $100M / $110M buffer and the 15-state multistate exception in 15 USC § 80b-3a(a)(2)(A). The internet-adviser exemption (17 CFR § 275.203A-2(e)) is a common SEC-registration path; counsel: should sentinel include a companion literal?
- **Soft dollars — Securities Exchange Act § 28(e) safe harbor + Form ADV disclosure** (`ria-soft-dollar-section-28e`): Verified the § 28(e)(1) safe-harbor text and the (e)(3)(A)-(C) brokerage-and-research-services definition against Cornell LII 2026-06-06. The Form ADV Part 2A Item 12 obligation is summarized from the Form ADV Part 2 instructions — counsel to confirm the canonical Item 12 wording. Counsel: consider whether 'mixed-use' allocations (a product serving both research and non-research functions) need a dedicated companion rule; the SEC's 2006 interpretive release (Rel. No. 34-54165) is the governing soft-dollar guidance and may warrant citation alongside § 28(e).
- **SEC Marketing Rule + FINRA 2210 — candidate advertising triggers (DRAFT)** (`ria-marketing-candidates`): Drafted 2026-05-25. Guarantee/risk-free/can't-lose phrases are FINRA 2210 'promissory' core targets and the SEC has issued enforcement actions citing each in advisory advertising. 'SEC approved/endorsed/sponsored' phrases are direct § 208(a) targets — registration with SEC is NOT endorsement and that representation is a per-se violation. 'FDIC insured' is included because misuse on non-deposit investment products (e.g. money-market funds, sweep accounts) is a recurring exam finding; counsel should consider whether the phrase needs a context modifier so it doesn't false-positive on legitimate references to sweep-deposit FDIC coverage at affiliated banks.
- **Investment Advisers Act Section 206 — antifraud provisions / fiduciary duty** (`advisers-act-section-206`): SEC Staff Bulletin on Standards of Conduct for Broker-Dealers and Investment Advisers (2022) and Regulation Best Interest interpretations expand on the fiduciary contour of Section 206. Counsel may want sentinel to load companion interpretive guidance.
- **Rule 204A-1 — Investment Adviser Code of Ethics** (`advisers-act-rule-204A-1-code-of-ethics`): Counsel: 17 CFR § 275.204A-1 also has paragraphs (b)(2) (transaction reports — within 30 days of quarter end), (c) (pre-approval of IPOs and limited offerings), (d) (recordkeeping cross-reference to Rule 204-2), and (e) (definitions). Recommend separate literals for those subsections.
- **Marketing Rule — 17 CFR § 275.206(4)-1** (`advisers-act-marketing-rule-206-4-1`): Verified paragraph (a) seven prohibitions and paragraph (b)(1)/(b)(3) against Cornell LII 2026-06-06. The (b)(2) written-agreement de minimis threshold and paragraphs (c) (third-party ratings), (d) (performance), and (e) (definitions, including 'advertisement') are summarized, not quoted — counsel to pull the canonical (c)/(d)/(e) text; the 'advertisement' definition is the sentinel anchor for whether a draft falls within the rule at all. A dedicated testimonials/endorsements companion ships at `ria-marketing-testimonials-endorsements`.
- **Marketing Rule — testimonials & endorsements, 17 CFR § 275.206(4)-1(b)** (`ria-marketing-testimonials-endorsements`): Verified (b)(1)(i)-(iii) and (b)(3) against Cornell LII 2026-06-06. (b)(2)'s de minimis written-agreement threshold is summarized — counsel to confirm the current dollar figure and the full 'ineligible person' definition (which cross-references SEC disqualifying events). Overlaps deliberately with the general Marketing Rule entry (`advisers-act-marketing-rule-206-4-1`), which carries the paragraph (a) prohibitions; this file isolates paragraph (b) so a testimonial/endorsement draft routes to the precise conditions.
- **Form ADV Part 2 (brochure) — delivery & disclosure** (`form-adv-part-2-brochure-disclosure`): Verified the § 275.204-3(b) delivery text (initial before/at contract; annual within 120 days; current brochure OR summary of material changes) against Cornell LII 2026-06-06. The Part 2A item enumeration is paraphrased from the Form ADV Part 2 instructions — counsel to confirm the canonical item list and consider separate literal entries for the most-violated items (Item 9 disciplinary; Item 11 code of ethics/personal trading; Item 12 brokerage/soft dollars — see companion `ria-soft-dollar-section-28e`). Renamed from the former `form-adv-disclosure-framework` routing entry to make Part 2 disclosure coverage explicit per the 2026-06-06 wave.
