/**
 * scripts/corpus-ingest/sources/ga-cpa.ts
 *
 * CPA / small-business tax corpus — FEDERAL (jurisdiction "US") and
 * GEORGIA (jurisdiction "GA"). FREE, PUBLIC sources only:
 *   - IRS.gov publications + topic pages (Pub 17/334/463/587/583, etc.)
 *   - Georgia Department of Revenue (dor.georgia.gov)
 *   - Georgia State Board of Accountancy (gsba.georgia.gov)
 *
 * Verified against irs.gov, dor.georgia.gov, gsba.georgia.gov, and ssa.gov
 * on 2026-06-17. Tax figures move yearly — each item that quotes a dollar
 * amount or rate names the tax year, and the refresh cron (which re-embeds
 * only when the source text actually changes) is what keeps these current.
 * Pub 535's discontinuation after 2022 is noted where relevant.
 *
 * NOT tax advice — reference material Plaino grounds + cites. V1 `fetch()`
 * returns this curated set; live-scrape is a Conner TODO.
 */

import type { CorpusSource, RawCorpusItem } from '../types';

const ITEMS: RawCorpusItem[] = [
  {
    sourceKey: 'us-cpa-business-structures',
    title: 'How are the main business structures taxed for federal income tax?',
    body: `A business's legal form determines how it is taxed federally. A sole proprietorship is not a separate taxable entity; the owner reports business income and expenses on Schedule C, filed with the individual Form 1040, and net profit flows to the owner's personal return. A partnership is a pass-through entity: it files an information return (Form 1065) and issues Schedule K-1s, but the partners (not the partnership) pay the income tax on their shares. A C corporation is a separate taxpayer that files Form 1120 and pays corporate income tax at a flat 21% federal rate; distributed profits are then taxed again to shareholders as dividends (double taxation). An S corporation generally pays no entity-level federal income tax; it files Form 1120-S and passes income, deductions, and credits through to shareholders via Schedule K-1, who report them on their individual returns. A limited liability company (LLC) has no separate federal tax classification: a single-member LLC is taxed by default as a sole proprietorship, a multi-member LLC as a partnership, and either may elect corporate or S-corporation treatment. Choosing a structure therefore drives filing forms, self-employment tax exposure, and whether income is taxed once or twice.`,
    citation: 'IRS, Business Structures; IRS Publication 542, Corporations (2024)',
    sourceUrl: 'https://www.irs.gov/businesses/small-businesses-self-employed/business-structures',
    jurisdiction: 'US',
    verticalSlug: 'cpa',
    verifiedFrom: 'irs.gov/businesses/small-businesses-self-employed/business-structures (2026-06-17)',
  },
  {
    sourceKey: 'us-cpa-self-employment-tax',
    title: 'What is the self-employment tax and how is it calculated?',
    body: `Self-employment (SE) tax is the Social Security and Medicare tax paid by individuals who work for themselves, paralleling the FICA taxes withheld from employees' wages. The combined SE tax rate is 15.3%, composed of 12.4% for Social Security (old-age, survivors, and disability insurance) and 2.9% for Medicare (hospital insurance). You generally must file Schedule SE and pay SE tax if your net earnings from self-employment are $400 or more for the year. SE tax is computed on net earnings, which are 92.35% of net self-employment profit (this adjustment accounts for the employer-equivalent share). The 12.4% Social Security portion applies only up to the annual Social Security wage base, which was $168,600 for 2024 and $176,100 for 2025; earnings above that ceiling are subject only to the 2.9% Medicare portion, which has no wage cap. Self-employed taxpayers may deduct one-half of their SE tax as an above-the-line adjustment to income on Form 1040. Higher earners may also owe the separate 0.9% Additional Medicare Tax above applicable income thresholds.`,
    citation: 'IRS, Self-Employment Tax (Social Security and Medicare Taxes); IRS Publication 334 (2025); Schedule SE',
    sourceUrl: 'https://www.irs.gov/businesses/small-businesses-self-employed/self-employment-tax-social-security-and-medicare-taxes',
    jurisdiction: 'US',
    verticalSlug: 'cpa',
    verifiedFrom: 'irs.gov self-employment-tax page + ssa.gov/oact/cola/cbb.html (wage base) (2026-06-17)',
  },
  {
    sourceKey: 'us-cpa-ordinary-necessary-expenses',
    title: 'What business expenses are deductible (the ordinary-and-necessary standard)?',
    body: `To be deductible, a business expense must be both ordinary and necessary. An ordinary expense is one that is common and accepted in your trade or business; a necessary expense is one that is helpful and appropriate for your business (it need not be indispensable). The expense must be directly connected to carrying on the business, and only the business-use portion is deductible when an item is used partly for personal purposes. Note that IRS Publication 535, Business Expenses, was discontinued after the 2022 tax year; its content has been redistributed into Publication 334 (Tax Guide for Small Business) and topic-specific publications. For example, the bad-debts guidance formerly in Pub 535 now appears in Chapter 8 of Pub 334, and the IRS maintains a "Guide to Business Expense Resources" page mapping each former Pub 535 topic to its current location. Common deductible categories include supplies, rent, utilities, employee wages, insurance, professional fees, and depreciation of business property. Capital expenditures (assets benefiting future years) generally must be capitalized and recovered through depreciation rather than deducted in full immediately, though provisions such as Section 179 expensing and bonus depreciation can accelerate cost recovery.`,
    citation: 'IRS Publication 334 (2025); IRS Guide to Business Expense Resources (Pub 535 retired after 2022)',
    sourceUrl: 'https://www.irs.gov/forms-pubs/guide-to-business-expense-resources',
    jurisdiction: 'US',
    verticalSlug: 'cpa',
    verifiedFrom: 'irs.gov/forms-pubs/about-publication-535 + /guide-to-business-expense-resources (2026-06-17)',
  },
  {
    sourceKey: 'us-cpa-vehicle-mileage',
    title: 'How are business car expenses and the standard mileage rate handled?',
    body: `When a car is used for business, the owner may deduct the costs of operating it for business purposes using one of two methods. The standard mileage rate method multiplies business miles driven by an IRS-set per-mile rate; the standard business mileage rate was 67 cents per mile for tax year 2024 and 70 cents per mile for tax year 2025. The actual expense method instead deducts the business-use percentage of real operating costs — gas, oil, repairs, insurance, registration, lease payments, and depreciation. Commuting between home and a regular workplace is never deductible; only business travel beyond commuting qualifies. To use the standard mileage rate for a car you own, you generally must choose it in the first year the vehicle is placed in service; in later years you may switch to actual expenses, though restrictions apply. Regardless of method, the taxpayer must keep adequate records documenting the mileage, the date, the destination, and the business purpose of each trip. A contemporaneous mileage log or app-based record is the standard form of substantiation, and the IRS can disallow undocumented deductions.`,
    citation: 'IRS Publication 463, Travel, Gift, and Car Expenses; IRS Standard Mileage Rates',
    sourceUrl: 'https://www.irs.gov/tax-professionals/standard-mileage-rates',
    jurisdiction: 'US',
    verticalSlug: 'cpa',
    verifiedFrom: 'irs.gov/tax-professionals/standard-mileage-rates + /forms-pubs/about-publication-463 (2026-06-17)',
  },
  {
    sourceKey: 'us-cpa-home-office-deduction',
    title: 'Who qualifies for the home office deduction and how is it calculated?',
    body: `A taxpayer may deduct expenses for the business use of a home only if part of the home is used regularly and exclusively for business, and that space is the principal place of business (or is used regularly to meet clients, or is a separate structure used for business). The exclusive-use test means the area cannot double as personal living space. Note that employees generally cannot claim the home office deduction for tax years 2018 through 2025 because the Tax Cuts and Jobs Act suspended miscellaneous itemized deductions; the deduction is primarily available to self-employed taxpayers reporting on Schedule C. Two computation methods exist. The simplified method deducts a prescribed rate of $5 per square foot of qualifying business-use space, capped at 300 square feet, for a maximum deduction of $1,500 per year, with no depreciation and no later depreciation recapture. The regular method allocates actual home expenses — mortgage interest, rent, utilities, insurance, repairs, and depreciation — by the percentage of the home used for business. Under either method, the deduction generally cannot exceed the gross income from the business use of the home, though disallowed amounts may carry forward under the regular method.`,
    citation: 'IRS Publication 587, Business Use of Your Home (2025); IRS Simplified Option for Home Office Deduction',
    sourceUrl: 'https://www.irs.gov/businesses/small-businesses-self-employed/simplified-option-for-home-office-deduction',
    jurisdiction: 'US',
    verticalSlug: 'cpa',
    verifiedFrom: 'irs.gov home-office-deduction + simplified-option pages (2026-06-17)',
  },
  {
    sourceKey: 'us-cpa-recordkeeping-retention',
    title: 'How long should a business keep its tax records?',
    body: `Businesses must keep records that support the income, deductions, and credits reported on their tax returns until the period of limitations for that return expires. As a general rule, keep records for 3 years from the date the return was filed (or its due date, if later), because that is the standard window during which the IRS can assess additional tax and the taxpayer can amend to claim a refund. Longer retention applies in specific situations: keep records for 7 years if you file a claim for a loss from worthless securities or a bad-debt deduction; keep records for 6 years if you fail to report income that you should have reported and it exceeds 25% of the gross income shown on your return; and keep records indefinitely if you file a fraudulent return or do not file a return at all. Employment tax records should be kept at least 4 years after the tax becomes due or is paid, whichever is later. Records relating to property (such as basis and depreciation) should be kept until the period of limitations expires for the year in which you dispose of the property. The IRS does not require any particular bookkeeping system, only that records clearly establish income and deductions.`,
    citation: 'IRS, How Long Should I Keep Records; IRS Publication 583, Starting a Business and Keeping Records',
    sourceUrl: 'https://www.irs.gov/businesses/small-businesses-self-employed/how-long-should-i-keep-records',
    jurisdiction: 'US',
    verticalSlug: 'cpa',
    verifiedFrom: 'irs.gov/businesses/small-businesses-self-employed/how-long-should-i-keep-records (2026-06-17)',
  },
  {
    sourceKey: 'us-cpa-estimated-quarterly-taxes',
    title: 'Who must pay quarterly estimated taxes and when are they due?',
    body: `The U.S. income tax is pay-as-you-go, so taxpayers who do not have enough tax withheld must make quarterly estimated tax payments. Individuals — including sole proprietors, partners, and S-corporation shareholders — generally must pay estimated tax if they expect to owe $1,000 or more in tax when their return is filed, after subtracting withholding and refundable credits. (Corporations use a $500 threshold and Form 1120-W.) Individuals figure and pay estimated tax using Form 1040-ES, which includes a worksheet for projecting income, deductions, self-employment tax, and credits. The tax year is divided into four payment periods. For the 2025 tax year the due dates were April 15, 2025; June 16, 2025; September 15, 2025; and January 15, 2026. When a due date falls on a weekend or legal holiday, the payment is due the next business day. Taxpayers can avoid an underpayment penalty by paying, through withholding and timely estimates, at least 90% of the current year's tax or 100% of the prior year's tax (110% if prior-year adjusted gross income exceeded $150,000). Penalties can apply even if a refund is ultimately due at filing, because they accrue per period.`,
    citation: 'IRS, Estimated Taxes; Form 1040-ES, Estimated Tax for Individuals (2025)',
    sourceUrl: 'https://www.irs.gov/businesses/small-businesses-self-employed/estimated-taxes',
    jurisdiction: 'US',
    verticalSlug: 'cpa',
    verifiedFrom: 'irs.gov/businesses/small-businesses-self-employed/estimated-taxes + estimated-tax FAQs (2026-06-17)',
  },
  {
    sourceKey: 'us-cpa-1099-nec-filing',
    title: 'When must a business file Form 1099-NEC for contractor payments?',
    body: `A business that pays an independent contractor or other nonemployee for services in the course of its trade or business generally must report those payments to the IRS on Form 1099-NEC, Nonemployee Compensation. For payments made during calendar years through 2025, the reporting threshold is $600 or more paid to a single payee during the year; the One Big Beautiful Bill Act raised that threshold to $2,000 for payments made after December 31, 2025 (i.e., for the 2026 tax year forward). Reportable nonemployee compensation includes fees, commissions, prizes, and awards for services performed by someone who is not an employee. Payments to most corporations are generally exempt, but payments to attorneys and certain other recipients are reportable regardless of entity type. The filer must furnish a copy to the recipient and file with the IRS by January 31 (the next business day if January 31 falls on a weekend or holiday); unlike some other information returns, there is no automatic 30-day filing extension for Form 1099-NEC. Businesses should collect a Form W-9 from each contractor before paying them to obtain the correct taxpayer identification number, and backup withholding may apply if a valid TIN is not provided.`,
    citation: 'IRS, About Form 1099-NEC; Instructions for Forms 1099-MISC and 1099-NEC (2025)',
    sourceUrl: 'https://www.irs.gov/forms-pubs/about-form-1099-nec',
    jurisdiction: 'US',
    verticalSlug: 'cpa',
    verifiedFrom: 'irs.gov/forms-pubs/about-form-1099-nec + /instructions/i1099mec (2026-06-17)',
  },
  {
    sourceKey: 'us-cpa-standard-deduction',
    title: 'What is the standard deduction and what are the current amounts?',
    body: `The standard deduction is a fixed dollar amount that reduces the income on which you are taxed, available to taxpayers who do not itemize deductions. Most taxpayers choose the larger of the standard deduction or their total itemized deductions (such as mortgage interest, state and local taxes, and charitable contributions). The amount depends on filing status and is adjusted annually for inflation. For tax year 2025, the standard deduction is $15,750 for single filers and for married individuals filing separately, $31,500 for married couples filing jointly or a qualifying surviving spouse, and $23,625 for head of household. Taxpayers who are 65 or older or blind receive an additional standard deduction amount. Certain taxpayers cannot use the standard deduction — for example, a married person filing separately whose spouse itemizes, or a nonresident alien — and dependents have a limited standard deduction tied to their earned income. Publication 17 (Your Federal Income Tax) is the IRS's comprehensive plain-language guide for individuals and covers the standard deduction, filing status, income, and the major credits and deductions, making it a foundational reference for return preparation.`,
    citation: 'IRS Publication 17, Your Federal Income Tax (2025); IRS Topic No. 551, Standard Deduction',
    sourceUrl: 'https://www.irs.gov/publications/p17',
    jurisdiction: 'US',
    verticalSlug: 'cpa',
    verifiedFrom: 'irs.gov/publications/p17 (2026-06-17)',
  },
  {
    sourceKey: 'ga-cpa-individual-income-tax',
    title: "What is Georgia's individual income tax rate?",
    body: `Georgia has moved from a graduated income tax (with a former top rate of 5.75%) to a flat individual income tax rate that applies to all taxable income. For tax year 2024, the flat rate was 5.39%, effective for taxable years beginning on or after January 1, 2024. The rate was further reduced to 5.19% for tax year 2025. Under the accelerated rate-reduction schedule enacted by the General Assembly, the rate is set to continue declining in 0.10-percentage-point annual increments — reaching 4.99% for tax year 2026 — subject to revenue conditions, until it reaches a target of 4.99%. Georgia residents are taxed on all income, while nonresidents are taxed on Georgia-source income, and the tax is reported on Form 500. Georgia generally begins its income tax calculation from federal adjusted gross income, then applies Georgia-specific additions, subtractions, and its own standard or itemized deductions before applying the flat rate. Because the rate changes year to year under the phased reductions, preparers should confirm the rate for the specific tax year being filed against the Georgia Department of Revenue's current guidance rather than relying on a prior year's figure.`,
    citation: 'Georgia Department of Revenue, Tax Tables & Rate Schedule; O.C.G.A. § 48-7-20',
    sourceUrl: 'https://dor.georgia.gov/taxes/important-tax-updates',
    jurisdiction: 'GA',
    verticalSlug: 'cpa',
    verifiedFrom: 'dor.georgia.gov/taxes/important-tax-updates + 2024 Employer Tax Guide (2026-06-17)',
  },
  {
    sourceKey: 'ga-cpa-corporate-income-net-worth-tax',
    title: 'How is Georgia corporate income and net worth tax structured?',
    body: `Georgia imposes a corporate income tax on corporations that own property, do business in the state, or receive income from Georgia sources, reported on Form 600. Georgia's corporate income tax rate is set at the same flat rate as its individual income tax under the state's rate-reduction schedule — 5.39% for tax year 2024 and 5.19% for tax year 2025 — applied to Georgia taxable net income. Separately, Georgia levies a net worth tax (a franchise-style tax) on corporations as consideration for the privilege of doing business in the state. The net worth tax is based on the corporation's net worth (capital stock, paid-in surplus, and retained earnings) apportioned to Georgia. Corporations with net worth of $100,000 or less are exempt from the net worth tax, though they must still file a return; the maximum net worth tax is $5,000, reached when net worth exceeds roughly $22 million. S corporations recognized at the federal level are generally also treated as pass-through entities in Georgia (filing Form 600S), though Georgia offers an elective entity-level tax for certain pass-throughs. Because both the income tax rate and applicable thresholds can change, confirm the figures against the Department of Revenue's instructions for the relevant filing year.`,
    citation: 'Georgia Department of Revenue, Corporate Income and Net Worth Tax; O.C.G.A. § 48-7-21',
    sourceUrl: 'https://dor.georgia.gov/taxes/corporate-income-and-net-worth-tax',
    jurisdiction: 'GA',
    verticalSlug: 'cpa',
    verifiedFrom: 'dor.georgia.gov/taxes/corporate-income-and-net-worth-tax (2026-06-17)',
  },
  {
    sourceKey: 'ga-cpa-sales-use-tax',
    title: 'How does Georgia sales and use tax work, including the state rate and local add-ons?',
    body: `Georgia imposes a state sales and use tax at a rate of 4% on retail sales of tangible personal property and certain services. On top of the 4% state rate, local jurisdictions (counties and special districts) levy additional local option sales taxes — such as LOST, SPLOST, ESPLOST, and others — commonly 1% each, so the combined rate varies by location and is typically 7% to 8% (for example, 8% in Muscogee County: 4% state plus four 1% local taxes). The applicable rate is determined by where the customer takes delivery of the product (destination-based sourcing), and a dealer must collect tax at the rate of the local jurisdiction where delivery occurs even if the dealer has no physical presence there. Use tax mirrors sales tax and applies when taxable goods are purchased without Georgia sales tax (for example, from an out-of-state seller) and then used, consumed, or stored in Georgia; the use tax rate equals the combined state-plus-local rate for the location of use. The Department of Revenue publishes a sales and use tax rate chart by jurisdiction that is updated quarterly, so businesses should consult the current chart to apply the correct combined rate for each delivery location.`,
    citation: 'Georgia Department of Revenue, Sales & Use Tax Rates; O.C.G.A. § 48-8-30',
    sourceUrl: 'https://dor.georgia.gov/taxes/business-taxes/sales-use-tax/tax-rates',
    jurisdiction: 'GA',
    verticalSlug: 'cpa',
    verifiedFrom: 'dor.georgia.gov/sales-tax-rates-general + /taxes/business-taxes/sales-use-tax/tax-rates (2026-06-17)',
  },
  {
    sourceKey: 'ga-cpa-sales-tax-nexus',
    title: 'When does an out-of-state seller have to collect Georgia sales tax (economic nexus)?',
    body: `Following the U.S. Supreme Court's South Dakota v. Wayfair decision, Georgia requires remote (out-of-state) sellers with no physical presence in the state to collect and remit Georgia sales tax once they meet an economic nexus threshold. A remote seller must register and collect Georgia sales and use tax if, in the previous or current calendar year, it has more than $100,000 in gross revenue from retail sales of tangible personal property delivered into Georgia, or 200 or more separate retail sales transactions delivered into Georgia. (The original 2019 statute set the dollar threshold at $250,000, which the General Assembly lowered to $100,000 effective January 1, 2020; the 200-transaction test was retained.) Separately, marketplace facilitators — platforms that facilitate sales for third-party sellers — must collect Georgia tax on facilitated sales sourced to Georgia once the combined value of their own and their sellers' Georgia sales reaches $100,000 or more in the previous or current calendar year. Physical presence in Georgia (an office, employees, inventory, or other in-state activity) creates nexus regardless of these thresholds. Sellers meeting nexus must register through the Georgia Tax Center, collect at the correct combined state-and-local rate for the delivery location, and file returns.`,
    citation: 'Georgia Department of Revenue, Out-of-State Sellers / Marketplace Facilitators; O.C.G.A. § 48-8-2(8)(M.1)',
    sourceUrl: 'https://dor.georgia.gov/taxes/business-taxes/sales-use-tax/out-state-sellers',
    jurisdiction: 'GA',
    verticalSlug: 'cpa',
    verifiedFrom: 'dor.georgia.gov/taxes/business-taxes/sales-use-tax/out-state-sellers + /marketplace-facilitators (2026-06-17)',
  },
  {
    sourceKey: 'ga-cpa-employer-withholding-registration',
    title: 'How do Georgia employers register for and remit withholding tax?',
    body: `Any business with employees whose wages are subject to Georgia income tax must register for a Georgia withholding payroll tax number before paying wages. Employers are required to withhold Georgia income tax from the wages of residents (for services performed inside or outside Georgia) and from nonresidents for services performed in Georgia. Registration is completed online through the Georgia Tax Center (GTC) and does not require periodic renewal — it remains in effect as long as the business has employees subject to Georgia withholding. Employers withhold based on the employee's Form G-4 (Georgia's withholding allowance certificate) using the tax tables or percentage method published in the Department of Revenue's Employer's Withholding Tax Guide; the withholding rate tracks Georgia's flat income tax rate (for example, 5.19% for 2025). After registering, employers file withholding returns and remit the tax on a monthly, quarterly, semi-weekly, or other schedule determined by the size of their withholding liability, and they must reconcile annually (Form G-1003) and furnish W-2s. Employers also typically need a federal Employer Identification Number and, separately, must address Georgia unemployment insurance tax through the Georgia Department of Labor, which is a distinct registration from DOR withholding.`,
    citation: 'Georgia Department of Revenue, Withholding Tax for Employers; O.C.G.A. § 48-7-101',
    sourceUrl: 'https://dor.georgia.gov/taxes/withholding-tax-employers',
    jurisdiction: 'GA',
    verticalSlug: 'cpa',
    verifiedFrom: 'dor.georgia.gov/how-do-i-register-withholding-payroll-tax-number + /taxes/withholding-tax-employers (2026-06-17)',
  },
  {
    sourceKey: 'ga-cpa-licensure-requirements',
    title: 'What are the requirements to become a licensed CPA in Georgia?',
    body: `To be licensed as a Certified Public Accountant in Georgia, a candidate must satisfy education, examination, and experience requirements administered by the Georgia State Board of Accountancy (with application processing through NASBA). Education: candidates must complete a total of 150 semester hours (225 quarter hours) of college education and hold a baccalaureate degree from an accredited college or university, with a concentration in accounting — generally at least 30 semester hours (45 quarter hours) in accounting above the elementary level and 24 semester hours (35 quarter hours) in general business subjects. Examination: candidates must pass the Uniform CPA Examination, the national exam developed by the AICPA and administered through NASBA. Experience: applicants must complete at least one year and 2,000 hours of qualifying work experience in public accounting, business, industry, government, or college teaching; the experience generally must be supervised by an actively licensed CPA who verifies it (with limited exceptions for certain government and teaching roles). After meeting all three requirements, the candidate submits a license application to the Board through NASBA. Licensed CPAs must thereafter meet continuing professional education (CPE) requirements to renew. Candidates should verify current rules with the Board, as licensure pathways are evolving nationally.`,
    citation: 'Georgia State Board of Accountancy, Licensure; GA Rule Chapter 20-3; O.C.G.A. Title 43, Chapter 3',
    sourceUrl: 'https://gsba.georgia.gov/licensure',
    jurisdiction: 'GA',
    verticalSlug: 'cpa',
    verifiedFrom: 'gsba.georgia.gov/licensure + /licensure-faqs (2026-06-17)',
  },
];

export const gaCpaSource: CorpusSource = {
  id: 'ga-cpa',
  label: 'CPA / small-business tax — federal (IRS) + Georgia (DOR, GSBA)',
  description:
    'Federal business structures, SE tax, deductions, mileage, home office, recordkeeping, estimated taxes, 1099-NEC, standard deduction; Georgia income/sales/withholding tax and CPA licensure.',
  verticalSlug: 'cpa',
  authority: 'primary',
  fetch: async () => ITEMS,
};
