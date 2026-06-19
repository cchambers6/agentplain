/**
 * scripts/corpus-ingest/sources/ga-real-estate.ts
 *
 * Georgia real-estate regulatory corpus. FREE, PUBLIC sources only:
 *   - O.C.G.A. § 43-40 (Georgia real estate license law)
 *   - O.C.G.A. § 10-6A (BRRETA — brokerage relationships)
 *   - GREC rules (Ga. Comp. R. & Regs. R. 520-1-.xx)
 *
 * Every item was verified against Justia (law.justia.com/codes/georgia),
 * Cornell LII (law.cornell.edu/regulations/georgia), and GREC official
 * PDFs (grec.state.ga.us) on 2026-06-17. Per-item `verifiedFrom` records
 * the exact source fetched. Numeric facts (hours, fees, penalties) were
 * double-checked; anything that could not be pinned to an exact figure was
 * stated as the verifiable rule.
 *
 * NOT legal advice. This is reference material Plaino grounds answers in
 * and CITES; counsel sign-off on customer-facing use is a Conner TODO.
 *
 * V1 `fetch()` returns this curated set. The live-scrape seam (pull +
 * parse GREC/Justia HTML here) is a documented TODO — see
 * docs/strategic-build-2026-06-17/TODOS-FOR-CONNER.md.
 */

import type { CorpusSource, RawCorpusItem } from '../types';

const ITEMS: RawCorpusItem[] = [
  {
    sourceKey: 'ga-re-salesperson-license-requirements',
    title: 'What are the requirements to get a Georgia real estate salesperson license?',
    body: `To qualify for a Georgia real estate salesperson license under O.C.G.A. § 43-40-8, an applicant must be at least 18 years old, be a high school graduate or hold a certificate of equivalency, and be a resident of Georgia (unless qualifying under reciprocity provisions). The applicant must complete at least 75 instructional hours in a salesperson's prelicense course of study approved by the Georgia Real Estate Commission (GREC). After completing the course, the applicant must pass a real estate examination administered or approved by the Commission covering matters confronting real estate brokers and salespersons. Applicants must also satisfy the statute's criminal-history requirements; failure to disclose a conviction, nolo contendere plea, or first offender sentence is grounds for denial. The statute provides that failure to meet any of these requirements is grounds for denial of a license without a hearing. A newly licensed salesperson must affiliate with and work under a licensed broker; a salesperson cannot operate independently.`,
    citation: 'O.C.G.A. § 43-40-8',
    sourceUrl: 'https://law.justia.com/codes/georgia/title-43/chapter-40/section-43-40-8/',
    jurisdiction: 'GA',
    verticalSlug: 'real-estate',
    verifiedFrom: 'law.justia.com/codes/georgia/title-43/chapter-40/section-43-40-8/ + law.cornell.edu/regulations/georgia/Ga-Comp-R-Regs-R-520-1-.05 (2026-06-17)',
  },
  {
    sourceKey: 'ga-re-salesperson-application-background-check',
    title: 'What background check and application steps are required for a Georgia salesperson license?',
    body: `Georgia requires every real estate license applicant to verify lawful presence in the United States and to undergo a criminal background check as part of the application process administered through the Georgia Real Estate Commission (GREC). Applicants must submit a criminal history report and disclose their full criminal history, including pardoned offenses and first offender sentences; the GREC background clearance process instructs that a Georgia resident attach a Georgia Crime Information Center (GCIC) report from a local law enforcement agency (or an equivalent report from another state of residency) that is not more than 60 days old. Failure to disclose any conviction, nolo contendere plea, or first offender sentence is itself grounds for denial of a license. Applicants with certain felony or moral-turpitude convictions face waiting periods before they may apply. Because criminal-history rules involve case-by-case GREC review, an applicant with any record should request a background determination from GREC before paying for prelicense coursework or the exam.`,
    citation: 'O.C.G.A. § 43-40-8; GREC Background Clearance Application',
    sourceUrl: 'https://grec.state.ga.us/wp-content/uploads/pdfs/RealEstate/GRECbackgroundclearance.pdf',
    jurisdiction: 'GA',
    verticalSlug: 'real-estate',
    verifiedFrom: 'grec.state.ga.us GREC background clearance PDF + § 43-40-8 disclosure grounds (2026-06-17)',
  },
  {
    sourceKey: 'ga-re-broker-license-requirements',
    title: 'What are the requirements to upgrade to a Georgia real estate broker license?',
    body: `To qualify for a Georgia real estate broker license under O.C.G.A. § 43-40-8, an applicant must be a high school graduate or hold a certificate of equivalency and must satisfy an experience requirement: maintaining a salesperson's license in active status for at least three of the five years immediately preceding the application (or holding a broker's license in active status for at least five years, where applicable). The applicant must complete 60 instructional hours in a broker's course of study approved by the Georgia Real Estate Commission. After completing the course, the applicant must pass a real estate examination administered or approved by the Commission covering the matters generally confronting real estate brokers. As with the salesperson license, failure to meet any of these statutory requirements is grounds for denial of the license without a hearing. A broker may operate independently and may supervise affiliated associate brokers and salespersons, but assumes responsibility for the firm's trust accounts and the supervision of its licensees.`,
    citation: 'O.C.G.A. § 43-40-8',
    sourceUrl: 'https://law.justia.com/codes/georgia/title-43/chapter-40/section-43-40-8/',
    jurisdiction: 'GA',
    verticalSlug: 'real-estate',
    verifiedFrom: 'law.justia.com/codes/georgia/title-43/chapter-40/section-43-40-8/ (2026-06-17)',
  },
  {
    sourceKey: 'ga-re-continuing-education',
    title: 'How much continuing education does a Georgia real estate licensee need?',
    body: `An active Georgia real estate licensee must complete 36 instructional hours of Commission-approved continuing education (CE) during each renewal period, and at least 3 of those hours must be on the topic of license law (a requirement effective July 1, 2016). The renewal period operates on a four-year cycle tied to the licensee's record. Effective July 1, 2025, GREC rules require Georgia brokers to complete a minimum of 18 of their 36 CE hours in broker-specific topics during each renewal period. CE requirements apply to active licensees, including associate brokers, salespersons, and community association managers; inactive licensees have different obligations to reactivate. Completing required CE on time is necessary to renew an active license, and licensees should retain documentation of completed courses for GREC audit.`,
    citation: 'Ga. Comp. R. & Regs. R. 520-1-.05; O.C.G.A. § 43-40-8',
    sourceUrl: 'https://www.law.cornell.edu/regulations/georgia/Ga-Comp-R-Regs-R-520-1-.05',
    jurisdiction: 'GA',
    verticalSlug: 'real-estate',
    verifiedFrom: 'law.cornell.edu/regulations/georgia/Ga-Comp-R-Regs-R-520-1-.05 (36hr + 3 license-law) + 2025 broker 18hr change grec.state.ga.us (2026-06-17)',
  },
  {
    sourceKey: 'ga-re-license-lapse-reinstatement',
    title: 'What happens if a Georgia real estate license lapses, and how is it reinstated?',
    body: `Under GREC rules, the path to reinstating a lapsed Georgia real estate license depends on how long the license has been lapsed. If the license has been lapsed for less than two years, the licensee may generally reinstate by paying the required fees and completing the required continuing education. If the license has been lapsed for at least two but less than five years, reinstatement additionally requires completing the appropriate prelicense course of study for the license level. If the license has been lapsed for five years or more, the person must requalify as an original applicant — meaning they must satisfy the full original qualification, education, and examination requirements again. Because lapse consequences escalate sharply at the two-year and five-year marks, a licensee who is letting a license go inactive should track these deadlines carefully; allowing more than five years to pass effectively erases prior licensure for reinstatement purposes.`,
    citation: 'Ga. Comp. R. & Regs. R. 520-1-.05',
    sourceUrl: 'https://www.law.cornell.edu/regulations/georgia/Ga-Comp-R-Regs-R-520-1-.05',
    jurisdiction: 'GA',
    verticalSlug: 'real-estate',
    verifiedFrom: 'law.cornell.edu/regulations/georgia/Ga-Comp-R-Regs-R-520-1-.05 (lapse tiers <2yr/2-5yr/5yr+) (2026-06-17)',
  },
  {
    sourceKey: 'ga-re-trust-account-deposit-timing',
    title: 'When must a Georgia broker deposit earnest money or trust funds into the trust account?',
    body: `Under GREC Rule 520-1-.08, a broker who accepts trust funds (such as earnest money) must deposit them into a designated trust account "as soon after receipt as is practicably possible." The rule does not set a fixed number of days; the standard is reasonable promptness. Trust funds must be held in a federally insured account that the financial institution designates as a trust account, and the broker must register the account with the Commission, notifying GREC of the institution's name and each account's name or number within one month of opening the account. A broker may maintain more than one trust account. Before depositing trust funds into an interest-bearing account, the broker must obtain the written agreement of the parties specifying to whom any interest earned will be paid. Brokers must account for each deposit and each subsequent disbursement relating to a given transaction.`,
    citation: 'GREC Rule 520-1-.08 (Ga. Comp. R. & Regs. R. 520-1-.08)',
    sourceUrl: 'https://www.law.cornell.edu/regulations/georgia/Ga-Comp-R-Regs-R-520-1-.08',
    jurisdiction: 'GA',
    verticalSlug: 'real-estate',
    verifiedFrom: 'law.cornell.edu/regulations/georgia/Ga-Comp-R-Regs-R-520-1-.08 (2026-06-17)',
  },
  {
    sourceKey: 'ga-re-commingling-prohibition',
    title: "Can a Georgia broker mix client trust funds with the brokerage's own money?",
    body: `No. Under GREC Rule 520-1-.08, commingling — mixing a broker's own funds with client or customer trust funds — is prohibited and is a violation of Georgia license law that may result in disciplinary action against the broker's license. A broker may keep its own money in a trust account only in narrowly defined circumstances: to meet a financial institution's minimum balance requirement, to cover service charges on the account, and amounts that represent earned commissions being paid from client funds. In each of these limited cases, the broker's own funds must be clearly identified as the broker's deposit. The broker must be able to account for every deposit and every disbursement tied to each individual transaction, and for each closed transaction the trust account balance attributable to that transaction should reflect zero (other than a portion lawfully transferred to satisfy a commission). Refunds of earnest money must be paid by check or credited at closing, not in cash.`,
    citation: 'GREC Rule 520-1-.08 (Ga. Comp. R. & Regs. R. 520-1-.08)',
    sourceUrl: 'https://www.law.cornell.edu/regulations/georgia/Ga-Comp-R-Regs-R-520-1-.08',
    jurisdiction: 'GA',
    verticalSlug: 'real-estate',
    verifiedFrom: 'law.cornell.edu/regulations/georgia/Ga-Comp-R-Regs-R-520-1-.08 + rules.sos.ga.gov/gac/520-1-.08 (2026-06-17)',
  },
  {
    sourceKey: 'ga-re-earnest-money-disputes',
    title: 'How does a Georgia broker handle disputed earnest money held in escrow?',
    body: `When the parties to a transaction dispute who is entitled to earnest money held in a broker's trust account, GREC Rule 520-1-.08 limits how the broker may release the funds. A broker may disburse disputed trust funds only on a recognized basis: upon a written agreement signed by all parties having an interest in the funds; pursuant to a court order, including by filing an interpleader action and paying the funds into the court; or upon a reasonable interpretation of the contract that authorizes the broker to disburse. The broker should also have reasonable assurance that the financial institution has actually credited the funds before disbursing. Because releasing disputed funds to the wrong party can itself be a license-law violation, brokers commonly use interpleader or wait for a signed mutual release when buyer and seller disagree. The rule is designed to keep the broker neutral and protect the funds until entitlement is resolved.`,
    citation: 'GREC Rule 520-1-.08 (Ga. Comp. R. & Regs. R. 520-1-.08)',
    sourceUrl: 'https://www.law.cornell.edu/regulations/georgia/Ga-Comp-R-Regs-R-520-1-.08',
    jurisdiction: 'GA',
    verticalSlug: 'real-estate',
    verifiedFrom: 'law.cornell.edu/regulations/georgia/Ga-Comp-R-Regs-R-520-1-.08 (2026-06-17)',
  },
  {
    sourceKey: 'ga-re-brreta-overview',
    title: 'What is BRRETA and how does it govern Georgia agency relationships?',
    body: `The Brokerage Relationships in Real Estate Transactions Act (BRRETA), codified at O.C.G.A. § 10-6A, is Georgia's governing law for real estate agency relationships and has been in effect since January 1, 1994. BRRETA distinguishes between a "client" — a person who has entered into a brokerage engagement with a broker — and a "customer," a person who has not engaged the broker but for whom the broker may perform ministerial acts. The Act recognizes single-client (seller or buyer) representation, no-agency/customer relationships, dual agency, and designated agency. A broker generally owes a client the duties to perform the terms of the engagement, promote the client's interests, exercise reasonable skill and care, comply with BRRETA and other applicable law, and keep confidential information that the client expressly designates as confidential. BRRETA also limits a broker's liability to the duties the statute enumerates, narrowing common-law agency exposure in Georgia transactions.`,
    citation: 'O.C.G.A. § 10-6A (BRRETA)',
    sourceUrl: 'https://law.justia.com/codes/georgia/title-10/chapter-6a/',
    jurisdiction: 'GA',
    verticalSlug: 'real-estate',
    verifiedFrom: 'law.justia.com/codes/georgia/title-10/chapter-6a/ (2026-06-17)',
  },
  {
    sourceKey: 'ga-re-brreta-relationship-disclosure',
    title: 'When must a Georgia broker disclose the brokerage relationship?',
    body: `Under BRRETA, when a broker who already has an existing brokerage relationship with a customer or client enters into a new brokerage relationship with that same person in a contemplated transaction, the broker must timely disclose the new relationship to everyone involved in the transaction (O.C.G.A. § 10-6A-4). In practice, Georgia brokers establish a written brokerage relationships policy and disclose their representation status to the parties so that buyers and sellers understand whom the broker represents. Dual agency — where one broker represents both the seller and the buyer in the same transaction — is permitted in Georgia only with the informed, written consent of both parties, and BRRETA sets out the specific requirements for that consent (O.C.G.A. § 10-6A-12). Designated agency, where the broker assigns different affiliated licensees to represent each side, is also recognized. Because disclosure timing and consent requirements are strict, brokers typically document the relationship in the engagement agreement and any required disclosure forms at the outset.`,
    citation: 'O.C.G.A. § 10-6A-4; O.C.G.A. § 10-6A-12',
    sourceUrl: 'https://law.justia.com/codes/georgia/title-10/chapter-6a/',
    jurisdiction: 'GA',
    verticalSlug: 'real-estate',
    verifiedFrom: 'law.justia.com/codes/georgia/title-10/chapter-6a/ (§ 10-6A-4 disclosure, § 10-6A-12 dual agency) (2026-06-17)',
  },
  {
    sourceKey: 'ga-re-seller-broker-disclosure-duties',
    title: 'What adverse facts must a Georgia broker disclose about a property?',
    body: `Under O.C.G.A. § 10-6A-5, a broker engaged by a seller must timely disclose to all parties with whom the broker is working all adverse material facts pertaining to the physical condition of the property and improvements that are actually known to the broker and could not be discovered by a reasonably diligent inspection by the buyer — including material defects, environmental contamination, and facts that statute or regulation requires to be disclosed. The broker must also disclose actually-known adverse physical conditions in the immediate neighborhood (within one mile) that the buyer could not discover through diligent inspection or review of reasonably available public records. Importantly, BRRETA does not impose a duty on the broker to investigate or discover such facts, and a broker is not liable for failing to disclose matters beyond those the statute enumerates absent a finding of fraud. This is a disclosure duty for facts already known to the broker, not an affirmative duty to inspect.`,
    citation: 'O.C.G.A. § 10-6A-5',
    sourceUrl: 'https://law.justia.com/codes/georgia/title-10/chapter-6a/section-10-6a-5/',
    jurisdiction: 'GA',
    verticalSlug: 'real-estate',
    verifiedFrom: 'law.justia.com/codes/georgia/title-10/chapter-6a/section-10-6a-5/ (2026-06-17)',
  },
  {
    sourceKey: 'ga-re-caveat-emptor-seller-disclosure',
    title: 'Does a home seller in Georgia have to disclose defects (caveat emptor)?',
    body: `Georgia remains largely a caveat emptor ("buyer beware") state for residential real estate, meaning buyers are generally expected to protect themselves through inspection and due diligence. A buyer typically cannot sustain a fraud or misrepresentation claim against a seller unless the buyer shows the problem could not have been prevented through ordinary and reasonable care. However, caveat emptor is not absolute: a seller may not actively conceal a known defect or make affirmative misrepresentations, and Georgia courts recognize liability where a seller fails to disclose a latent (hidden) material defect that the seller knows about and that a buyer could not discover through a reasonable inspection. Separately, a listing broker has statutory disclosure duties under BRRETA (O.C.G.A. § 10-6A-5) for adverse material facts actually known to the broker. Many Georgia sellers voluntarily complete a Seller's Property Disclosure Statement, but a standardized state-mandated form is not the operative legal duty — the operative limits come from caveat emptor's exceptions and BRRETA.`,
    citation: 'O.C.G.A. § 10-6A-5; Georgia common law (caveat emptor)',
    sourceUrl: 'https://law.justia.com/codes/georgia/title-10/chapter-6a/section-10-6a-5/',
    jurisdiction: 'GA',
    verticalSlug: 'real-estate',
    verifiedFrom: 'law.justia.com/codes/georgia/title-10/chapter-6a/section-10-6a-5/ (broker duty) + GA caveat-emptor doctrine via legal sources (2026-06-17)',
  },
  {
    sourceKey: 'ga-re-advertising-under-firm',
    title: 'What are the rules for how a Georgia agent can advertise listings?',
    body: `Under GREC Rule 520-1-.09, all advertising by associate brokers, salespersons, and community association managers must be done under the direct supervision of their broker and in the name of their firm. A licensee may not advertise as though they were an unlicensed private party. Any advertising that is misleading or inaccurate in any material fact, or that in any way misrepresents any real estate, is prohibited. When a licensee advertises real estate they personally own, lease, buy, or rent, the licensee must notify their broker and obtain the broker's written consent, and the advertisement must include either a disclosure that the seller, buyer, landlord, or tenant (as applicable) holds a real estate license, or the licensee's Georgia real estate license number. These rules ensure the public knows it is dealing with a licensed professional acting through a supervising firm and protect against deceptive listing promotion.`,
    citation: 'GREC Rule 520-1-.09 (Ga. Comp. R. & Regs. R. 520-1-.09)',
    sourceUrl: 'https://www.law.cornell.edu/regulations/georgia/Ga-Comp-R-Regs-R-520-1-.09',
    jurisdiction: 'GA',
    verticalSlug: 'real-estate',
    verifiedFrom: 'law.cornell.edu/regulations/georgia/Ga-Comp-R-Regs-R-520-1-.09 (2026-06-17)',
  },
  {
    sourceKey: 'ga-re-activities-requiring-license',
    title: 'What real estate activities require a license in Georgia?',
    body: `Under O.C.G.A. § 43-40-1, a real estate license is required for anyone who, for a fee, commission, or other valuable consideration (or with the expectation of receiving the same), performs real-estate brokerage activity for another person. Covered activities include listing, selling, purchasing, exchanging, renting, leasing, or optioning real estate, as well as negotiating or attempting to negotiate such transactions, advertising or holding oneself out as engaged in such business, and providing property management or community association management services for compensation. The triggering elements are (1) acting for another person and (2) receiving or expecting valuable consideration. Property owners selling or leasing their own real estate, and certain other statutorily exempted persons, generally do not need a license for their own property. Because the definition turns on compensation and acting for others, unlicensed individuals cannot lawfully be paid a commission or fee for brokering someone else's transaction.`,
    citation: 'O.C.G.A. § 43-40-1',
    sourceUrl: 'https://law.justia.com/codes/georgia/title-43/chapter-40/',
    jurisdiction: 'GA',
    verticalSlug: 'real-estate',
    verifiedFrom: 'law.justia.com/codes/georgia/title-43/chapter-40/ (2026-06-17)',
  },
  {
    sourceKey: 'ga-re-unlicensed-activity-penalty',
    title: 'What is the penalty for practicing real estate without a license in Georgia?',
    body: `Practicing real estate brokerage without a license is unlawful in Georgia. Under O.C.G.A. § 43-40-30, any person who acts as a real estate licensee within the meaning of the chapter without a license, or who violates other provisions of the chapter, is guilty of a misdemeanor. The Georgia Real Estate Commission may also issue a cease and desist order against an unlicensed violator, and the Attorney General may bring an action in superior court to enjoin the illegal conduct. In addition, the Commission's general sanction authority allows fines, and each day a person practices in violation of the law can be treated as a separate violation. These remedies are cumulative — a criminal misdemeanor charge, administrative cease-and-desist and fines, and a civil injunction can all apply to the same unlicensed conduct. This is why unlicensed persons cannot lawfully collect a commission or fee for brokering another party's real estate transaction.`,
    citation: 'O.C.G.A. § 43-40-30',
    sourceUrl: 'https://law.justia.com/codes/georgia/2020/title-43/chapter-40/section-43-40-30/',
    jurisdiction: 'GA',
    verticalSlug: 'real-estate',
    verifiedFrom: 'law.justia.com/codes/georgia/2020/title-43/chapter-40/section-43-40-30/ (2026-06-17)',
  },
  {
    sourceKey: 'ga-re-grec-sanctions',
    title: 'What sanctions can the Georgia Real Estate Commission impose on a licensee?',
    body: `Under O.C.G.A. § 43-40-25, the Georgia Real Estate Commission (GREC) may discipline licensees, schools, and instructors for violations of the license law, the Commission's rules, unfair trade practices, or failure to comply with a final GREC order. After the opportunity for a hearing, GREC's available sanctions include revoking or suspending a license; issuing a reprimand or a warning letter; requiring the licensee to complete a course of study in real estate brokerage; and imposing a fine not to exceed $1,000.00 for each violation, with fines for multiple violations limited to $5,000.00 in any one disciplinary proceeding. GREC may consider a licensee's prior sanctions — including discipline by another state's real estate licensing authority — in determining the severity of a new sanction. Failure to comply with or obey a final order of the Commission is itself cause for suspension or revocation. These sanctions are administrative and separate from any criminal liability for unlicensed activity.`,
    citation: 'O.C.G.A. § 43-40-25',
    sourceUrl: 'https://law.justia.com/codes/georgia/title-43/chapter-40/section-43-40-25/',
    jurisdiction: 'GA',
    verticalSlug: 'real-estate',
    verifiedFrom: 'law.justia.com/codes/georgia/title-43/chapter-40/section-43-40-25/ ($1,000/violation, $5,000 cap) (2026-06-17)',
  },
];

export const gaRealEstateSource: CorpusSource = {
  id: 'ga-real-estate',
  label: 'Georgia real estate (O.C.G.A. § 43-40, § 10-6A BRRETA, GREC rules)',
  description:
    'Georgia salesperson/broker licensing, trust-account rules, BRRETA agency duties, advertising, and GREC enforcement.',
  verticalSlug: 'real-estate',
  authority: 'primary',
  fetch: async () => ITEMS,
};
