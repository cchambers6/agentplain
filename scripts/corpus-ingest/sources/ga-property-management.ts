/**
 * scripts/corpus-ingest/sources/ga-property-management.ts
 *
 * Georgia landlord-tenant + property-management corpus. FREE, PUBLIC
 * sources only:
 *   - O.C.G.A. Title 44, Chapter 7 (Georgia Landlord and Tenant Act)
 *   - O.C.G.A. § 43-40 (GREC — when PM requires a real-estate license)
 *
 * Verified against Justia (law.justia.com/codes/georgia/title-44/chapter-7)
 * on 2026-06-17. Section numbers, day counts, dollar thresholds, and the
 * 10-or-fewer-unit exemption (which does NOT cover the § 44-7-34 return
 * duty, and is lost once a third party manages for a fee) were
 * double-checked. The 2024 Safe at Home Act additions are flagged where
 * relevant.
 *
 * NOT legal advice — reference material Plaino grounds + cites. V1
 * `fetch()` returns this curated set; live-scrape is a Conner TODO.
 */

import type { CorpusSource, RawCorpusItem } from '../types';

const ITEMS: RawCorpusItem[] = [
  {
    sourceKey: 'ga-pm-security-deposit-escrow',
    title: "Where must a Georgia landlord hold a tenant's security deposit?",
    body: `Under Georgia law, whenever a landlord or the landlord's agent holds a security deposit on behalf of a tenant, that deposit must be placed in an escrow account established only for that purpose at a bank or lending institution regulated by the state or federal government. The landlord must inform the tenant in writing of the location of that escrow account. The escrow requirement exists so that deposit funds are segregated from the landlord's operating money and remain identifiable as the tenant's property until the tenancy ends. As an alternative to escrow, a landlord may instead post and maintain a surety bond with the clerk of the superior court in the county where the dwelling unit is located (see O.C.G.A. § 44-7-32); the bond amount is the total of the security deposits the landlord holds or $50,000.00, whichever is less. A property manager who collects deposits for owners should treat trust-account compliance as a core obligation, because failing to escrow funds is a statutory violation that exposes the landlord to the remedies in O.C.G.A. § 44-7-35. The written notice of the account location should be retained as part of the lease file.`,
    citation: 'O.C.G.A. § 44-7-31',
    sourceUrl: 'https://law.justia.com/codes/georgia/title-44/chapter-7/article-2/section-44-7-31/',
    jurisdiction: 'GA',
    verticalSlug: 'property-management',
    verifiedFrom: 'law.justia.com/codes/georgia/title-44/chapter-7/article-2/section-44-7-31/ (2026-06-17)',
  },
  {
    sourceKey: 'ga-pm-surety-bond-alternative',
    title: 'Can a Georgia landlord post a surety bond instead of using an escrow account?',
    body: `Yes. As an alternative to the security-deposit escrow requirement of O.C.G.A. § 44-7-31, a Georgia landlord may post and maintain an effective surety bond with the clerk of the superior court in the county in which the dwelling unit is located. The amount of the bond must equal the total amount of the security deposits the landlord holds on behalf of tenants, or $50,000.00, whichever is less. This bond option lets a landlord satisfy the deposit-protection rule without opening a dedicated escrow account, while still guaranteeing that funds are available to return to tenants. The bond is filed with, and its administration involves, the clerk of the superior court. A property manager should confirm whether an owner is using the escrow route or the surety-bond route, because both are statutorily recognized but they are mutually exclusive ways of meeting the same protection obligation. As with escrow, the surety-bond mechanism is part of the security-deposit framework whose violation triggers tenant remedies under O.C.G.A. § 44-7-35, so documentation of an active, sufficient bond should be kept current.`,
    citation: 'O.C.G.A. § 44-7-32',
    sourceUrl: 'https://law.justia.com/codes/georgia/title-44/chapter-7/article-2/section-44-7-32/',
    jurisdiction: 'GA',
    verticalSlug: 'property-management',
    verifiedFrom: 'law.justia.com/codes/georgia/title-44/chapter-7/article-2/section-44-7-32/ (2026-06-17)',
  },
  {
    sourceKey: 'ga-pm-deposit-exemption-small-owner',
    title: 'Which Georgia landlords are exempt from the security-deposit escrow rules?',
    body: `Georgia exempts certain small, owner-managed landlords from key security-deposit requirements. The escrow, surety-bond, move-in/move-out list, and treble-damages provisions (O.C.G.A. §§ 44-7-31, 44-7-32, 44-7-33, and 44-7-35) do not apply to rental units owned by a natural person where that person, his or her spouse, and his or her minor children collectively own ten or fewer rental units. Critically, this exemption is lost if management of the units — including rent collection — is performed by third parties for a fee. In other words, the moment an owner hires a professional property manager or any third party who collects rent for compensation, the small-owner exemption no longer applies and the full escrow, inspection-list, and penalty regime is back in force. This matters directly to property managers: a managed portfolio cannot rely on the ten-or-fewer-units exemption, so a manager should escrow deposits (or confirm a surety bond), prepare move-in and move-out condition lists, and follow the return rules regardless of how few units the owner holds. Note that the one-month return-and-itemization duty of O.C.G.A. § 44-7-34 is not listed among the exempted sections.`,
    citation: 'O.C.G.A. § 44-7-36',
    sourceUrl: 'https://law.justia.com/codes/georgia/title-44/chapter-7/article-2/section-44-7-36/',
    jurisdiction: 'GA',
    verticalSlug: 'property-management',
    verifiedFrom: 'law.justia.com/codes/georgia/title-44/chapter-7/article-2/ (exemption lists §§ 44-7-31/32/33/35, not 34) (2026-06-17)',
  },
  {
    sourceKey: 'ga-pm-movein-moveout-condition-list',
    title: 'What move-in and move-out condition lists does Georgia require for security deposits?',
    body: `Before a tenant tenders a security deposit, a Georgia landlord must give the tenant a comprehensive written list of any existing damage to the premises. The tenant has the right to inspect the premises to verify the accuracy of that list before taking occupancy, and the landlord and tenant then sign it; the signed list is conclusive evidence of its accuracy as between the parties, except as to latent defects. If the tenant refuses to sign, the tenant must specifically state in writing the items disputed and sign that statement of dissent. When the lease terminates and the premises are vacated or surrendered, the landlord inspects and compiles a list of any damage the landlord intends to charge against the deposit. The tenant has the right, upon request, to inspect the premises and the damage list within five business days after the termination and vacating (or surrender and acceptance) and the landlord's inspection. If the tenant is present at the inspection, both parties sign the list; again, a tenant who disagrees must list and sign specific dissents. A tenant who disputes the final list may sue to recover wrongly withheld amounts, but the tenant's claim is generally limited to the items to which the tenant specifically dissented.`,
    citation: 'O.C.G.A. § 44-7-33',
    sourceUrl: 'https://law.justia.com/codes/georgia/title-44/chapter-7/article-2/section-44-7-33/',
    jurisdiction: 'GA',
    verticalSlug: 'property-management',
    verifiedFrom: 'law.justia.com/codes/georgia/title-44/chapter-7/article-2/section-44-7-33/ (2026-06-17)',
  },
  {
    sourceKey: 'ga-pm-deposit-return-timing',
    title: 'How long does a Georgia landlord have to return a security deposit?',
    body: `Within one month after the tenant surrenders the premises, a Georgia landlord must return the security deposit to the tenant. If the landlord keeps all or part of the deposit, the landlord must deliver to the tenant the remaining balance, if any, together with a written statement that itemizes the specific reasons for retaining any portion. Each deduction should be listed separately with its amount. Georgia permits a landlord to retain deposit funds only for specified reasons — for example, nonpayment of rent or late-payment fees, abandonment of the premises, nonpayment of utility charges the tenant owed, the cost of repairs or cleaning the tenant contracted for with third parties, unpaid pet fees, or actual damages caused by the tenant's breach (with the landlord required to make a reasonable effort to mitigate). The landlord may not deduct for ordinary wear and tear. Because the return-and-itemization duty under this section is not among the provisions waived by the small-owner exemption, property managers should treat the one-month deadline and the written itemized statement as mandatory on every managed tenancy. Missing the deadline or failing to itemize exposes the landlord to the enhanced damages described in O.C.G.A. § 44-7-35.`,
    citation: 'O.C.G.A. § 44-7-34',
    sourceUrl: 'https://law.justia.com/codes/georgia/title-44/chapter-7/article-2/section-44-7-34/',
    jurisdiction: 'GA',
    verticalSlug: 'property-management',
    verifiedFrom: 'law.justia.com/codes/georgia/title-44/chapter-7/article-2/section-44-7-34/ (2026-06-17)',
  },
  {
    sourceKey: 'ga-pm-wrongful-withholding-penalty',
    title: 'What is the penalty in Georgia for wrongfully withholding a security deposit?',
    body: `A Georgia landlord who fails to return any part of a security deposit that should have been returned is liable to the tenant for three times (treble) the sum wrongfully withheld, plus reasonable attorney's fees. This treble-damages remedy is a strong deterrent against improper withholding and against failing to follow the deposit rules. There is a limited safe harbor: the landlord is liable only for the sum actually withheld — not the trebled amount — if the landlord proves by a preponderance of the evidence that the withholding was not intentional and resulted from a bona fide error that occurred despite procedures reasonably designed to avoid such errors. Practically, this means a property manager should maintain documented deposit-handling procedures (escrow records, signed condition lists, itemized statements, mailing records) so that any genuine mistake can qualify for the bona-fide-error defense. Note that this penalty section is one of the provisions from which the small owner-manager (ten or fewer units, self-managed) is exempt under the statute, but that exemption is unavailable once a third party manages the units for a fee. For professionally managed portfolios, the treble-damages exposure applies in full, making strict compliance with the escrow and return-timing rules essential.`,
    citation: 'O.C.G.A. § 44-7-35',
    sourceUrl: 'https://law.justia.com/codes/georgia/title-44/chapter-7/article-2/section-44-7-35/',
    jurisdiction: 'GA',
    verticalSlug: 'property-management',
    verifiedFrom: 'law.justia.com/codes/georgia/title-44/chapter-7/article-2/section-44-7-35/ (2026-06-17)',
  },
  {
    sourceKey: 'ga-pm-tenant-abandonment-deductions',
    title: 'What can a Georgia landlord do when a tenant abandons the property and leaves the deposit?',
    body: `Georgia's security-deposit return statute expressly lists abandonment of the premises among the grounds for which a landlord may retain deposit funds. When a tenant abandons a unit, the landlord may apply the security deposit toward losses such as unpaid rent, late-payment fees, unpaid utility charges the tenant owed, repair or cleaning costs, unpaid pet fees, and actual damages resulting from the tenant's breach of the lease — provided the landlord makes a reasonable effort to mitigate those actual damages, for example by trying to re-rent the unit. The same procedural duties still apply: the landlord must provide a written, itemized statement of the amounts retained, and (subject to the small owner-manager exemption that professionally managed units do not get) must account for the deposit within one month of surrender of the premises. The statute also addresses unclaimed deposits, providing a mechanism for handling deposit money a departed tenant does not claim. Because abandonment can be factually ambiguous, a property manager should document the condition of the unit, dates, notices, and mitigation efforts before applying deposit funds, so the deductions can withstand a later challenge and avoid the treble-damages exposure of O.C.G.A. § 44-7-35.`,
    citation: 'O.C.G.A. § 44-7-34',
    sourceUrl: 'https://law.justia.com/codes/georgia/title-44/chapter-7/article-2/section-44-7-34/',
    jurisdiction: 'GA',
    verticalSlug: 'property-management',
    verifiedFrom: 'law.justia.com/codes/georgia/title-44/chapter-7/article-2/section-44-7-34/ (2026-06-17)',
  },
  {
    sourceKey: 'ga-pm-landlord-duty-repair',
    title: "What is a Georgia landlord's duty to repair and keep the premises habitable?",
    body: `Georgia law imposes on landlords a statutory duty to keep rented premises in repair. Under O.C.G.A. § 44-7-13, the landlord must keep the premises in repair and is responsible for substantial improvements placed on the premises with the landlord's consent. A related provision, O.C.G.A. § 44-7-14, makes the landlord liable to the tenant and to others for damages arising from defective construction or from the landlord's failure to keep the premises in repair. Georgia case law has generally held that, because the landlord is typically out of possession, the duty to repair is triggered once the landlord has notice or knowledge of a defective condition — so prompt tenant repair requests and the manager's response records matter. Importantly, the Safe at Home Act, effective July 1, 2024, added a statutory implied warranty that residential premises are fit for human habitation, strengthening the tenant's position beyond the older repair-duty cases. For property managers this means establishing reliable intake and tracking of maintenance requests, documenting when notice of a defect was received, and ensuring habitability-level issues (such as heat, water, and structural safety) are addressed, since failure to repair can create both contract and tort liability for the owner.`,
    citation: 'O.C.G.A. § 44-7-13 (with § 44-7-14)',
    sourceUrl: 'https://law.justia.com/codes/georgia/title-44/chapter-7/article-1/section-44-7-13/',
    jurisdiction: 'GA',
    verticalSlug: 'property-management',
    verifiedFrom: 'law.justia.com/codes/georgia/title-44/chapter-7/article-1/section-44-7-13/ + Safe at Home Act (2024) bench card (2026-06-17)',
  },
  {
    sourceKey: 'ga-pm-tenancy-at-will-notice',
    title: 'How much notice is needed to end a tenancy-at-will in Georgia?',
    body: `To terminate a tenancy at will in Georgia, sixty days' notice from the landlord or thirty days' notice from the tenant is required. A tenancy at will arises, among other situations, when no definite term is specified for the tenancy (see the related creation rule in O.C.G.A. § 44-7-6). The asymmetry is deliberate: a landlord wishing to end an at-will arrangement must give the tenant a full 60 days, while a tenant who wishes to leave need give only 30 days. This notice requirement governs ending the tenancy itself; it is distinct from the eviction (dispossessory) process. Giving proper notice terminates the rental relationship, but if the tenant then refuses to leave, the landlord must still proceed through the dispossessory framework — demanding possession under O.C.G.A. § 44-7-50 and, on the tenant's refusal, filing a dispossessory affidavit. Property managers handling month-to-month and other at-will arrangements should calendar the correct notice period for the party initiating termination, deliver the notice in writing, and preserve proof of delivery, since a defective or short notice can undermine a subsequent possession action.`,
    citation: 'O.C.G.A. § 44-7-7',
    sourceUrl: 'https://law.justia.com/codes/georgia/title-44/chapter-7/article-1/section-44-7-7/',
    jurisdiction: 'GA',
    verticalSlug: 'property-management',
    verifiedFrom: 'law.justia.com/codes/georgia/title-44/chapter-7/article-1/section-44-7-7/ (2026-06-17)',
  },
  {
    sourceKey: 'ga-pm-dispossessory-demand-and-filing',
    title: 'How does the Georgia eviction (dispossessory) process begin?',
    body: `Georgia eviction is a court process called a dispossessory proceeding, and it begins with a demand for possession. Under O.C.G.A. § 44-7-50, a landlord may demand possession when the tenant holds over beyond the lease term, fails to pay rent when due, or is a tenant at will or at sufferance. If the tenant refuses to surrender possession after the demand, the landlord (or the landlord's agent or attorney) files a dispossessory affidavit with the court, which then issues a summons to the tenant. A landlord cannot lawfully skip this process; physically removing a tenant without going through the courts is prohibited. The demand for possession is a precondition to filing, so a property manager should document that a proper demand was made — and refused or unmet — before initiating the court action. Georgia does not impose a fixed statutory number of days the landlord must wait between demand and filing for nonpayment, though many landlords allow a short period; the lease terms and the demand control. After filing, the case proceeds through service of the summons, the tenant's answer window, and, if warranted, issuance of a writ of possession by the court.`,
    citation: 'O.C.G.A. § 44-7-50',
    sourceUrl: 'https://law.justia.com/codes/georgia/title-44/chapter-7/article-3/section-44-7-50/',
    jurisdiction: 'GA',
    verticalSlug: 'property-management',
    verifiedFrom: 'law.justia.com/codes/georgia/title-44/chapter-7/article-3/section-44-7-50/ (2026-06-17)',
  },
  {
    sourceKey: 'ga-pm-dispossessory-answer-and-writ',
    title: 'How long does a Georgia tenant have to answer an eviction, and when is a writ issued?',
    body: `After a dispossessory summons is served, Georgia law gives the tenant seven days from the date of actual service to answer, either orally or in writing. If the seventh day falls on a Saturday, Sunday, or legal holiday, the answer may be made on the next business day. The tenant's answer may raise any legal or equitable defense or counterclaim. If the tenant does not answer within that window, the court issues a writ of possession instanter (immediately), allowing the landlord to regain possession. If the tenant does answer, the matter is set for a hearing; a tenant who remains in the unit pending the litigation is generally required to pay rent into the registry of the court. When judgment is entered in the landlord's favor after a contested case, Georgia courts typically issue the writ of possession seven days after the judgment, giving the tenant a short period to vacate before the writ is executed. For property managers, the key timing facts are the seven-day answer period and the requirement to obtain a court-issued writ before any removal — self-help is not permitted, and a sheriff or marshal executes the writ.`,
    citation: 'O.C.G.A. § 44-7-51 (answer); § 44-7-53 (writ of possession)',
    sourceUrl: 'https://law.justia.com/codes/georgia/title-44/chapter-7/article-3/section-44-7-51/',
    jurisdiction: 'GA',
    verticalSlug: 'property-management',
    verifiedFrom: 'law.justia.com/codes/georgia/title-44/chapter-7/article-3/section-44-7-51/ + /section-44-7-53/ (2026-06-17)',
  },
  {
    sourceKey: 'ga-pm-no-self-help-utility-shutoff',
    title: 'Can a Georgia landlord shut off utilities or lock out a tenant to force them out?',
    body: `No. Self-help eviction is not permitted in Georgia, and shutting off utilities to force a tenant out is specifically prohibited. Under O.C.G.A. § 44-7-14.1, it is unlawful for a landlord knowingly and willfully to suspend the furnishing of utilities to a tenant until after the final disposition of any dispossessory proceeding the landlord has brought against that tenant. For purposes of this section, utilities means cooling, heat, light, and water service (cooling was added by the Safe at Home Act, effective in 2024). A landlord who violates this prohibition can, upon conviction, be fined up to $500.00, and a tenant may also seek injunctive relief to stop the unlawful conduct and pursue damages. More broadly, a landlord may not change the locks, remove the tenant's belongings, or otherwise physically eject a tenant without a court-issued writ of possession obtained through the dispossessory process. Property managers should treat lockouts and utility interruptions as off-limits enforcement tactics: the only lawful path to removing a tenant runs through the courts, and using utility shutoffs as leverage during a pending eviction creates direct statutory liability for the owner and manager.`,
    citation: 'O.C.G.A. § 44-7-14.1',
    sourceUrl: 'https://law.justia.com/codes/georgia/title-44/chapter-7/article-1/section-44-7-14-1/',
    jurisdiction: 'GA',
    verticalSlug: 'property-management',
    verifiedFrom: 'law.justia.com/codes/georgia/title-44/chapter-7/article-1/section-44-7-14-1/ (2026-06-17)',
  },
  {
    sourceKey: 'ga-pm-no-rent-control-no-grace-period',
    title: 'Does Georgia have rent control, a rent-increase cap, or a statutory grace period for late rent?',
    body: `Georgia does not have rent control, and it does not set a statewide cap on how much rent can be increased. By statute, no county or municipality may enact, maintain, or enforce any ordinance that regulates the amount of rent charged for privately owned residential rental property (O.C.G.A. § 44-7-19), so local rent-control measures are preempted by state law. Rent levels and increases are governed by the lease and by the market, subject to giving the tenant proper notice consistent with the lease term and any applicable notice requirement (for example, the notice rules for ending an at-will tenancy). Georgia also does not impose a statutory grace period for the payment of rent or a state-mandated cap on late fees; whether a grace period exists, and the amount of any late fee, are matters left to the lease agreement. Absent a contractual grace period, rent is generally treated as late the day after it is due. For property managers, the practical takeaway is that pricing, increase amounts, late-fee amounts, and any grace period must be set out clearly in the lease, because Georgia statutory law supplies neither a rent ceiling nor a default grace period; the written lease controls these terms.`,
    citation: 'O.C.G.A. § 44-7-19',
    sourceUrl: 'https://law.justia.com/codes/georgia/title-44/chapter-7/article-1/section-44-7-19/',
    jurisdiction: 'GA',
    verticalSlug: 'property-management',
    verifiedFrom: 'law.justia.com/codes/georgia/title-44/chapter-7/article-1/section-44-7-19/ (2026-06-17)',
  },
  {
    sourceKey: 'ga-pm-broker-license-required-managing-for-others',
    title: "Does a Georgia property manager need a real estate license to manage others' properties?",
    body: `Generally yes. Georgia's real estate license law defines a broker to include, among other acts done for another for a fee or other valuable consideration, negotiating or assisting in renting or leasing real estate and collecting rents or other trust funds (O.C.G.A. § 43-40-1). Because managing rental property for an owner for compensation — leasing units, negotiating with tenants, and collecting rent — falls within this definition, a person who performs property management for others must hold an active real estate license issued by the Georgia Real Estate Commission (GREC) and operate under a Georgia real estate broker. A separate community association manager's license framework applies to those managing community associations. There are statutory exceptions (O.C.G.A. § 43-40-29): an owner managing his or her own property does not need a license, nor do certain full-time salaried employees of an owner who manage that owner's property, among other narrow exemptions. The key distinction for a third-party manager is acting "for another" for compensation, which requires licensure. Property managers should confirm their licensing status and brokerage affiliation, because unlicensed activity can bar recovery of compensation and trigger enforcement.`,
    citation: 'O.C.G.A. § 43-40-1 (exceptions in § 43-40-29)',
    sourceUrl: 'https://law.justia.com/codes/georgia/title-43/chapter-40/',
    jurisdiction: 'GA',
    verticalSlug: 'property-management',
    verifiedFrom: 'law.justia.com/codes/georgia/title-43/chapter-40/ (§ 43-40-1 broker def, § 43-40-29 exceptions) (2026-06-17)',
  },
];

export const gaPropertyManagementSource: CorpusSource = {
  id: 'ga-property-management',
  label: 'Georgia landlord-tenant + property management (O.C.G.A. Title 44 Ch. 7, § 43-40)',
  description:
    'Georgia security deposits, condition lists, return timing + penalties, repair duty, dispossessory/eviction process, no-self-help, rent rules, and PM licensure.',
  verticalSlug: 'property-management',
  authority: 'primary',
  fetch: async () => ITEMS,
};
