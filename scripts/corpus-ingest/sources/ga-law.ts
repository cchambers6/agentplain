/**
 * scripts/corpus-ingest/sources/ga-law.ts
 *
 * Georgia legal-practice / professional-responsibility corpus. FREE,
 * PUBLIC sources only:
 *   - Georgia Rules of Professional Conduct (State Bar of Georgia, gabar.org)
 *   - O.C.G.A. Title 9 Ch. 3 (limitations) + Title 15 Ch. 19 (UPL)
 *
 * Verified against gabar.org's Rules of Professional Conduct, Justia
 * Georgia code, and corroborating free law-school/bar materials on
 * 2026-06-17. Rule numbers and maximum penalties were checked per-rule
 * (Georgia varies them: 1.1/1.3/1.6/1.7/1.9/1.15 = disbarment;
 * 1.4/1.5/1.16 = public reprimand). Two time-sensitive facts are flagged:
 * the CLE rules changed to a biennial 18-hour requirement effective
 * 2026-01-01, and Georgia's Rule 7.3 solicitation ban is broader than the
 * ABA model.
 *
 * Source-URL note: gabar.org serves rule text through one large handbook
 * page with per-rule anchors; the cited anchors are real public URLs.
 * NOT legal advice — reference material Plaino grounds + cites. V1
 * `fetch()` returns this curated set; live-scrape is a Conner TODO.
 */

import type { CorpusSource, RawCorpusItem } from '../types';

const ITEMS: RawCorpusItem[] = [
  {
    sourceKey: 'ga-law-rule-1-1-competence',
    title: 'What does the duty of competence require of a Georgia lawyer?',
    body: `Under the Georgia Rules of Professional Conduct, a lawyer must provide competent representation to a client. Competence is defined as the legal knowledge, skill, thoroughness, and preparation reasonably necessary for the representation. In practice this means a Georgia attorney should not take on a matter she is not qualified to handle unless she can acquire the necessary competence through reasonable preparation, study, or association with a lawyer of established competence in the field. Competence is not limited to substantive knowledge; it includes the practical skills of analysis, drafting, investigation, and procedure appropriate to the matter, and it extends to staying reasonably abreast of changes in the law and its practice. A lawyer may give limited advice in an emergency even where she lacks the skill ordinarily required, but only to the extent reasonably necessary to avoid foreseeable prejudice to the person's interests. Competence is the foundation on which other duties — diligence, communication, and safeguarding client interests — rest. The maximum penalty for a violation of Rule 1.1 is disbarment, reflecting how seriously Georgia treats failures of basic professional capability.`,
    citation: 'Georgia Rules of Professional Conduct Rule 1.1 (Competence)',
    sourceUrl: 'https://www.gabar.org/handbook?rule=rule79',
    jurisdiction: 'GA',
    verticalSlug: 'law',
    verifiedFrom: 'gabar.org Georgia Rules of Professional Conduct (Rule 1.1) + corroborating GA bar materials (2026-06-17)',
  },
  {
    sourceKey: 'ga-law-rule-1-2-scope',
    title: 'Who decides the objectives and means of a representation in Georgia?',
    body: `Rule 1.2 of the Georgia Rules of Professional Conduct allocates decision-making authority between client and lawyer. The client holds ultimate authority to determine the objectives of the representation, and the lawyer must abide by those decisions. Certain decisions are reserved to the client because they affect the client's substantive rights: in a civil case, whether to settle; in a criminal case, the plea to be entered, whether to waive a jury trial, and whether the client will testify. The lawyer generally controls the technical and tactical means used to pursue the client's objectives, after consultation with the client. A lawyer may limit the scope of the representation if the limitation is reasonable under the circumstances and the client gives informed consent — the basis for limited-scope or "unbundled" engagements. Critically, a lawyer must not counsel or assist a client in conduct the lawyer knows is criminal or fraudulent, though the lawyer may discuss the legal consequences of any proposed course of conduct and may help the client make a good-faith effort to determine the validity, scope, meaning, or application of the law. A lawyer's representation of a client does not constitute an endorsement of the client's views or activities. The maximum penalty for a violation of Rule 1.2 is disbarment.`,
    citation: 'Georgia Rules of Professional Conduct Rule 1.2 (Scope of Representation)',
    sourceUrl: 'https://www.gabar.org/handbook?rule=rule50',
    jurisdiction: 'GA',
    verticalSlug: 'law',
    verifiedFrom: 'gabar.org Georgia Rules of Professional Conduct (Rule 1.2) (2026-06-17)',
  },
  {
    sourceKey: 'ga-law-rule-1-3-diligence',
    title: "What is a Georgia lawyer's duty of diligence?",
    body: `Rule 1.3 of the Georgia Rules of Professional Conduct requires a lawyer to act with reasonable diligence and promptness in representing a client. Georgia gives "reasonable diligence" a specific meaning: a lawyer must not, without just cause and to the detriment of the client, in effect wilfully abandon or wilfully disregard a legal matter entrusted to her. This duty captures the most common source of client harm and bar complaints — neglect. A lawyer should pursue a matter despite opposition, obstruction, or inconvenience, and should carry it through to conclusion. Procrastination that lets deadlines lapse, allows a statute of limitations to run, or leaves a client uncertain about the status of the case can violate the rule even where no bad faith exists. Diligence does not require a lawyer to press every advantage or act with offensive zeal; it requires commitment and dedication to the client's interests and reasonable promptness. Heavy workload is not an excuse for neglect of individual matters. The maximum penalty for a violation of Rule 1.3 is disbarment, underscoring that sustained neglect of client matters is among the most serious disciplinary failures in Georgia.`,
    citation: 'Georgia Rules of Professional Conduct Rule 1.3 (Diligence)',
    sourceUrl: 'https://www.gabar.org/handbook?rule=rule52',
    jurisdiction: 'GA',
    verticalSlug: 'law',
    verifiedFrom: 'gabar.org Georgia Rules of Professional Conduct (Rule 1.3) (2026-06-17)',
  },
  {
    sourceKey: 'ga-law-rule-1-4-communication',
    title: 'What must a Georgia lawyer communicate to a client?',
    body: `Rule 1.4 of the Georgia Rules of Professional Conduct governs communication with clients. A lawyer must keep the client reasonably informed about the status of the matter and must promptly comply with reasonable requests for information. The lawyer must also explain a matter to the extent reasonably necessary to permit the client to make informed decisions regarding the representation. In practice this means promptly informing the client of decisions or circumstances requiring the client's informed consent, reasonably consulting about how the client's objectives are to be accomplished, and keeping the client advised even where the client has delegated broad authority. "Prompt" communication does not mean instantaneous; it means timely and reasonable under the circumstances. Adequate communication includes explaining settlement offers, significant developments, and the practical and legal implications of available options so the client can participate intelligently in decisions that belong to the client. The rule also supports the duty to be candid: a lawyer should not withhold information to serve the lawyer's own interest or convenience. Good communication is the practical safeguard that prevents many diligence and competence problems from ripening into client harm. The maximum penalty for a violation of Rule 1.4 is a public reprimand.`,
    citation: 'Georgia Rules of Professional Conduct Rule 1.4 (Communication)',
    sourceUrl: 'https://www.gabar.org/handbook?rule=rule54',
    jurisdiction: 'GA',
    verticalSlug: 'law',
    verifiedFrom: 'gabar.org Georgia Rules of Professional Conduct (Rule 1.4) (2026-06-17)',
  },
  {
    sourceKey: 'ga-law-rule-1-5-fees',
    title: 'What are the fee rules and written-agreement requirements in Georgia?',
    body: `Rule 1.5 of the Georgia Rules of Professional Conduct requires that a lawyer's fees be reasonable. Reasonableness is judged by factors including the time and labor required and the novelty and difficulty of the questions; the skill needed to perform the service properly; the likelihood that accepting the matter will preclude other employment; the fee customarily charged in the locality for similar services; the amount involved and the results obtained; time limitations imposed by the client or circumstances; the nature and length of the professional relationship with the client; the experience, reputation, and ability of the lawyer; and whether the fee is fixed or contingent. Contingent fee agreements must be in writing and must state the method by which the fee is determined — including the percentages accruing to the lawyer in the event of settlement, trial, or appeal, the litigation and other expenses to be deducted from the recovery, and whether those expenses are deducted before or after the contingent fee is calculated. At the conclusion of a contingent matter the lawyer must provide the client a written statement of the outcome and the remittance. Georgia prohibits contingent fees in two settings: a fee contingent upon securing a divorce or annulment, or the amount of alimony, support, or property settlement in a domestic relations matter; and a contingent fee for representing a defendant in a criminal case. The maximum penalty for a violation of Rule 1.5 is a public reprimand.`,
    citation: 'Georgia Rules of Professional Conduct Rule 1.5 (Fees)',
    sourceUrl: 'https://www.gabar.org/handbook?rule=rule55',
    jurisdiction: 'GA',
    verticalSlug: 'law',
    verifiedFrom: 'gabar.org Georgia Rules of Professional Conduct (Rule 1.5) (2026-06-17)',
  },
  {
    sourceKey: 'ga-law-rule-1-6-confidentiality',
    title: 'What information must a Georgia lawyer keep confidential, and when may it be disclosed?',
    body: `Rule 1.6 of the Georgia Rules of Professional Conduct establishes a broad duty of confidentiality. A lawyer must maintain in confidence all information gained in the professional relationship with a client — including information the client has requested be held inviolate and information the disclosure of which would be embarrassing or likely detrimental to the client — unless the client gives informed consent, the disclosure is impliedly authorized to carry out the representation, or an exception applies. The duty is broader than the attorney-client evidentiary privilege and continues after the representation ends. Georgia permits a lawyer to reveal confidential information to the extent the lawyer reasonably believes necessary in several circumstances: to serve the client's interest unless it is information the client has specifically required not be disclosed; to comply with the Rules or other law or a court order; and to establish a claim or defense in a controversy between lawyer and client, to defend against a charge or claim arising from the representation, or to respond to allegations in any proceeding concerning the lawyer's representation. Notably, Georgia makes disclosure mandatory in one situation: a lawyer shall reveal information necessary to prevent the client from committing a criminal act the lawyer reasonably believes is likely to result in death or substantial bodily harm. The maximum penalty for a violation of Rule 1.6 is disbarment.`,
    citation: 'Georgia Rules of Professional Conduct Rule 1.6 (Confidentiality of Information)',
    sourceUrl: 'https://www.gabar.org/handbook?rule=rule57',
    jurisdiction: 'GA',
    verticalSlug: 'law',
    verifiedFrom: 'gabar.org Georgia Rules of Professional Conduct (Rule 1.6) (2026-06-17)',
  },
  {
    sourceKey: 'ga-law-rule-1-7-current-client-conflicts',
    title: 'How does Georgia handle conflicts of interest involving current clients?',
    body: `Rule 1.7 of the Georgia Rules of Professional Conduct governs conflicts among current clients. A lawyer shall not represent or continue to represent a client if there is a significant risk that the lawyer's own interests, or the lawyer's duties to another client, a former client, or a third person, will materially and adversely affect the representation of the client. Where the conflict is consentable, the lawyer may nonetheless proceed only if each affected client consents — preferably in writing — after consultation, having received in writing reasonable and adequate information about the material risks of the representation and having been given the opportunity to consult independent counsel. Some conflicts cannot be cured by consent. Consent is not permissible when the circumstances make it reasonably unlikely the lawyer can provide adequate representation to one or more affected clients, or when the representation involves asserting a claim by one client against another client the lawyer represents in the same or a substantially related proceeding. The analysis turns on whether the lawyer's loyalty and independent judgment would be compromised, not merely on whether the clients are formally adverse. Conflicts may arise at the outset or develop during a representation, requiring ongoing vigilance and, where unresolvable, withdrawal. The maximum penalty for a violation of Rule 1.7 is disbarment.`,
    citation: 'Georgia Rules of Professional Conduct Rule 1.7 (Conflict of Interest: General Rule)',
    sourceUrl: 'https://www.gabar.org/handbook?rule=rule58',
    jurisdiction: 'GA',
    verticalSlug: 'law',
    verifiedFrom: 'gabar.org Georgia Rules of Professional Conduct (Rule 1.7) (2026-06-17)',
  },
  {
    sourceKey: 'ga-law-rule-1-9-former-client-conflicts',
    title: 'When does representing a new client conflict with duties to a former client in Georgia?',
    body: `Rule 1.9 of the Georgia Rules of Professional Conduct protects former clients. A lawyer who has formerly represented a client in a matter shall not thereafter represent another person in the same or a substantially related matter in which that person's interests are materially adverse to the interests of the former client, unless the former client gives informed consent after consultation. Two matters are "substantially related" when they involve the same transaction or legal dispute, or when there is a substantial risk that confidential information the lawyer would normally have learned in the prior representation would materially advance the new client's position in the later matter. The rule also restricts use and disclosure of a former client's information: a lawyer may not use information relating to the prior representation to the disadvantage of the former client, nor reveal such information, except as the Rules would otherwise permit or require, or where the information has become generally known. Rule 1.9 likewise addresses lawyers who move between firms, attributing certain knowledge to protect clients of a lawyer's former firm. The duty of loyalty and the duty of confidentiality together underpin these former-client protections, which survive the end of the engagement. The maximum penalty for a violation of Rule 1.9 is disbarment.`,
    citation: 'Georgia Rules of Professional Conduct Rule 1.9 (Conflict of Interest: Former Client)',
    sourceUrl: 'https://www.gabar.org/handbook?rule=rule61',
    jurisdiction: 'GA',
    verticalSlug: 'law',
    verifiedFrom: 'gabar.org Georgia Rules of Professional Conduct (Rule 1.9) (2026-06-17)',
  },
  {
    sourceKey: 'ga-law-rule-1-15-1-safekeeping-property',
    title: 'How must a Georgia lawyer safeguard client and third-party property?',
    body: `Rule 1.15(I) of the Georgia Rules of Professional Conduct sets the general duty to safeguard property. A lawyer must hold the funds and property of clients or third persons that are in the lawyer's possession in connection with a representation separate from the lawyer's own funds and property. Client and third-party funds must be kept in a trust account, and other property must be identified as such and appropriately safeguarded. The lawyer must maintain complete records of trust account funds and other property and preserve them for a specified period after the representation ends. Commingling client funds with the lawyer's own funds is prohibited, as is using client funds for the lawyer's purposes. Upon receiving funds or property in which a client or third person has an interest, the lawyer must promptly notify the client or third person and, except as otherwise permitted by law or agreement, promptly deliver any funds or property the recipient is entitled to receive and, on request, render a full accounting. When two or more persons claim an interest in property the lawyer holds, the lawyer must keep the disputed portion separate until the dispute is resolved; undisputed amounts must be distributed promptly. Because mishandling client money is treated as among the gravest professional violations, the maximum penalty for a violation of Rule 1.15(I) is disbarment.`,
    citation: 'Georgia Rules of Professional Conduct Rule 1.15(I) (Safekeeping Property)',
    sourceUrl: 'https://www.gabar.org/handbook?rule=rule42',
    jurisdiction: 'GA',
    verticalSlug: 'law',
    verifiedFrom: 'gabar.org Georgia Rules of Professional Conduct (Rule 1.15(I)) + trust-account guidance (2026-06-17)',
  },
  {
    sourceKey: 'ga-law-rule-1-15-2-iolta-trust-accounts',
    title: "What are Georgia's trust account and IOLTA requirements?",
    body: `Rule 1.15(II) of the Georgia Rules of Professional Conduct governs trust accounts and IOLTA. Every lawyer who holds client or third-party funds must maintain those funds in a trust account separate from the lawyer's own operating funds, and that account must be at a financial institution approved by the State Bar of Georgia as a depository for attorney trust accounts. Client funds must be placed in one of two account types: an interest-bearing account in which the interest is paid to the client, or an interest-bearing IOLTA (Interest on Lawyer Trust Accounts) account in which the interest is paid to the Georgia Bar Foundation. The deciding factor is whether the funds, considering the amount and the expected holding period, could earn net interest for the client after accounting for the costs of establishing and administering a separate account. Funds that are nominal in amount or are to be held for only a short time — such that they cannot earn net interest for the client — must be placed in an IOLTA account, and the interest on such pooled client funds may never inure to the benefit of the lawyer or law firm. Interest remitted to the Georgia Bar Foundation funds legal aid for low-income Georgians and other access-to-justice programs. Approved-institution and overdraft-notification requirements ensure trust accounts are monitored. The maximum penalty for a violation of Rule 1.15(II) is disbarment.`,
    citation: 'Georgia Rules of Professional Conduct Rule 1.15(II) (Trust Account and IOLTA)',
    sourceUrl: 'https://www.gabar.org/handbook?rule=rule45',
    jurisdiction: 'GA',
    verticalSlug: 'law',
    verifiedFrom: 'gabar.org Georgia Rules of Professional Conduct (Rule 1.15(II)) + Approved Banks / IOLTA materials (2026-06-17)',
  },
  {
    sourceKey: 'ga-law-rule-1-16-declining-terminating',
    title: 'When may or must a Georgia lawyer withdraw from a representation?',
    body: `Rule 1.16 of the Georgia Rules of Professional Conduct governs declining and terminating representation. Withdrawal is mandatory in three situations: when continuing would result in a violation of the Georgia Rules of Professional Conduct or other law; when the lawyer's physical or mental condition materially impairs her ability to represent the client; or when the lawyer is discharged by the client. A client may discharge a lawyer at any time, with or without cause, subject to liability for payment of services rendered. Withdrawal is permissive — allowed if it can be accomplished without material adverse effect on the client's interests, or for good cause — when, for example, the client persists in a course of action the lawyer reasonably believes is criminal or fraudulent, has used the lawyer's services to perpetrate a crime or fraud, insists on a repugnant or imprudent objective, fails substantially to fulfill an obligation such as paying fees after reasonable warning, or makes the representation unreasonably difficult. If a tribunal requires continued representation, the lawyer must comply notwithstanding good cause to withdraw. On termination, the lawyer must take reasonable steps to protect the client's interests — giving reasonable notice, allowing time to obtain other counsel, surrendering papers and property to which the client is entitled, and refunding any advance payment of fees not yet earned. The maximum penalty for a violation of Rule 1.16 is a public reprimand.`,
    citation: 'Georgia Rules of Professional Conduct Rule 1.16 (Declining or Terminating Representation)',
    sourceUrl: 'https://www.gabar.org/handbook?rule=rule48',
    jurisdiction: 'GA',
    verticalSlug: 'law',
    verifiedFrom: 'gabar.org Georgia Rules of Professional Conduct (Rule 1.16) (2026-06-17)',
  },
  {
    sourceKey: 'ga-law-upl-who-may-practice',
    title: 'Who may practice law in Georgia, and what is the unauthorized practice of law?',
    body: `In Georgia, only persons duly licensed and admitted to the State Bar of Georgia (or otherwise authorized by the Supreme Court of Georgia) may practice law. Admission requires graduation from an approved law school, passing the bar examination, and satisfying the Board to Determine Fitness of Bar Applicants as to character and fitness. The "practice of law" is defined by statute (O.C.G.A. § 15-19-50) and includes representing litigants in court; preparing legal instruments by which legal rights are secured; rendering legal advice and services; and holding oneself out as entitled to practice law. O.C.G.A. § 15-19-51 forbids any person who is not a duly licensed attorney from practicing or appearing as an attorney for another in any court, holding themselves out as entitled to practice law, rendering legal services or advice, using titles such as "lawyer" or "attorney at law" in a manner conveying authorization to practice, or advertising a law office. Certain narrow activities by non-lawyers are permitted, and people may always represent themselves. Violations are misdemeanors under O.C.G.A. § 15-19-56, and the State Bar may also seek injunctive relief. For licensed lawyers, assisting in the unauthorized practice of law violates Rule 5.5 of the Georgia Rules of Professional Conduct. Recent law graduates should not call themselves "lawyers" or "attorneys" until they are admitted to the bar.`,
    citation: 'O.C.G.A. § 15-19-50, § 15-19-51, § 15-19-56; GA Rules of Professional Conduct Rule 5.5',
    sourceUrl: 'https://www.gabar.org/committeesprogramssections/programs/upl/rulesandstatutes.cfm',
    jurisdiction: 'GA',
    verticalSlug: 'law',
    verifiedFrom: 'gabar.org UPL rules-and-statutes + Justia O.C.G.A. § 15-19-51/56 (2026-06-17)',
  },
  {
    sourceKey: 'ga-law-rules-7-1-7-3-advertising-solicitation',
    title: "What are Georgia's rules on lawyer advertising and solicitation?",
    body: `Georgia regulates lawyer advertising and solicitation through Rules 7.1 to 7.3 of the Rules of Professional Conduct (former Rules 7.4 and 7.5 are now reserved, their substance folded into these rules). Rule 7.1 prohibits a lawyer from making a false or misleading communication about the lawyer or the lawyer's services; a communication is false or misleading if it contains a material misrepresentation of fact or law, or omits a fact necessary to make the statement considered as a whole not materially misleading. Rule 7.2 governs advertising generally: communications about a lawyer's services may be made through any media, but a lawyer must not give anything of value to a person for recommending the lawyer's services (subject to limited exceptions, such as paying the reasonable costs of permitted advertising or the usual charges of a lawful referral service), and any communication must include the name and contact information of at least one responsible lawyer or firm. Rule 7.3 governs solicitation and is notably stricter in Georgia than the ABA Model Rule: it prohibits a lawyer from soliciting professional employment from a non-lawyer through direct personal contact or live telephone contact when a significant motive is the lawyer's pecuniary gain, even where the person has a prior relationship with the lawyer — a broader ban than most states impose. The maximum penalty for a violation of these advertising and solicitation rules is disbarment.`,
    citation: 'Georgia Rules of Professional Conduct Rules 7.1, 7.2, 7.3 (Information About Legal Services)',
    sourceUrl: 'https://www.gabar.org/handbook?rule=rule145',
    jurisdiction: 'GA',
    verticalSlug: 'law',
    verifiedFrom: 'gabar.org Georgia Rules of Professional Conduct (Rules 7.1-7.3; GA broader solicitation ban) (2026-06-17)',
  },
  {
    sourceKey: 'ga-law-cle-requirements',
    title: "What are Georgia's mandatory continuing legal education (CLE) requirements?",
    body: `Active members of the State Bar of Georgia must complete mandatory continuing legal education (MCLE), which is administered by the Commission on Continuing Lawyer Competency under the authority of the Supreme Court of Georgia. By order of the Supreme Court of Georgia, the CLE structure changed effective January 1, 2026, moving from an annual requirement to a biennial (two-year) requirement. For each two-year compliance period, an active member must complete 18 CLE hours, which must include at least 3 hours of legal ethics and at least 2 hours of professionalism. The first biennial compliance period runs from January 1, 2026, through December 31, 2027, with the compliance deadline falling on December 31 of each odd-numbered year. (Under the prior rule, in effect through 2025, the requirement was 12 CLE hours each calendar year, including at least 1 ethics hour and 1 professionalism hour, with trial lawyers needing additional trial-practice credit.) Lawyers should confirm any specialized or transitional requirements — such as newly admitted attorney programs or trial-practice hours — directly with the Commission, and should retain records of completed credit. The Commission tracks compliance and can impose consequences, including fees and ultimately suspension of the license, for failure to meet the CLE requirement.`,
    citation: 'State Bar of Georgia CLE Rules; Commission on Continuing Lawyer Competency (effective Jan 1, 2026)',
    sourceUrl: 'https://www.gabar.org/programs/continuing-legal-education/new-cle-rules',
    jurisdiction: 'GA',
    verticalSlug: 'law',
    verifiedFrom: 'gabar.org/programs/continuing-legal-education/new-cle-rules (2026-06-17)',
  },
  {
    sourceKey: 'ga-law-statutes-of-limitation-civil',
    title: 'What are the basic statutes of limitation for common Georgia civil claims?',
    body: `Georgia's limitation periods for civil actions are set primarily in O.C.G.A. Title 9, Chapter 3, and the deadline ordinarily runs from when the right of action accrues. For personal injury (injuries to the person), the period is two years under O.C.G.A. § 9-3-33; that statute also sets two years for loss of consortium and one year for injuries to reputation (libel and slander). Actions on simple written contracts must generally be brought within six years after the contract becomes due and payable under O.C.G.A. § 9-3-24, while actions on open accounts, oral or implied contracts, and similar undertakings carry a four-year period under O.C.G.A. § 9-3-25 (sales-of-goods contracts under the UCC have their own rules). Trespass upon or damage to realty must be brought within four years (O.C.G.A. § 9-3-30), and injuries to personal property likewise generally carry a four-year period (O.C.G.A. § 9-3-31/§ 9-3-32). Medical malpractice has a two-year limitation period and, importantly, a five-year statute of repose that bars suit more than five years after the negligent act regardless of when the injury is discovered, with a narrow exception for foreign objects left in the body (O.C.G.A. § 9-3-71). These are general rules; tolling provisions (for example, for minors or fraud), discovery-rule nuances, and special claim types can change the deadline, so the controlling statute and case law should always be confirmed for the specific claim.`,
    citation: 'O.C.G.A. § 9-3-24, § 9-3-25, § 9-3-30, § 9-3-31, § 9-3-33, § 9-3-71',
    sourceUrl: 'https://law.justia.com/codes/georgia/title-9/chapter-3/article-2/section-9-3-33/',
    jurisdiction: 'GA',
    verticalSlug: 'law',
    verifiedFrom: 'law.justia.com/codes/georgia/title-9/chapter-3 (§§ 9-3-24/25/30/31/33/71) (2026-06-17)',
  },
];

export const gaLawSource: CorpusSource = {
  id: 'ga-law',
  label: 'Georgia legal practice (GA Rules of Professional Conduct, O.C.G.A. Title 9/15)',
  description:
    'Georgia attorney duties (competence, diligence, communication, fees, confidentiality, conflicts, trust/IOLTA, withdrawal), UPL, advertising/solicitation, CLE, and civil statutes of limitation.',
  verticalSlug: 'law',
  authority: 'primary',
  fetch: async () => ITEMS,
};
