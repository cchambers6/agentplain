/**
 * tests/fixtures/webhook-events/_corpus.ts
 *
 * Mock WebhookEvent corpus. 35 fixtures covering:
 *
 *   - Real estate ............ 4 (incl. multi-message thread)
 *   - Mortgage ............... 3
 *   - Insurance .............. 3
 *   - Property management .... 3
 *   - Title / escrow ......... 2
 *   - Recruiting ............. 3
 *   - Home services .......... 3
 *   - CPA .................... 4
 *   - Law .................... 3
 *   - RIA .................... 2
 *   - Cross-vertical noise ... 3 (Pottery Barn / Experian / recruiter spam)
 *   - Edge cases ............. 2 (vertical-divergent + encoded subject)
 *
 * Each fixture cites the lib/skills/prompts/<vertical>.ts rule that
 * justifies its `expectedCategory` (per `feedback_no_guesses_no_estimates.md`).
 *
 * Body text shapes are deliberately modeled on Conner's actual inbox
 * patterns per the task brief. The noise fixtures use the specific
 * senders called out in the prompt noiseSignals so the test directly
 * exercises the noise-discrimination rules.
 */

import type { WebhookEventFixture } from '@/lib/skills/fixture-fetcher';

/** Helper: build a fixture with sane defaults so each entry stays short. */
function fx(
  partial: Omit<WebhookEventFixture, 'webhookEvent' | 'messages'> & {
    fromEmail: string;
    fromName?: string;
    toEmail?: string;
    subject: string;
    body: string;
    historyId?: string;
    receivedAt?: string;
    threadId?: string;
    priorMessages?: Array<{ fromEmail: string; subject: string; body: string; receivedAt: string }>;
  },
): WebhookEventFixture {
  const id = partial.id;
  const receivedAt = partial.receivedAt ?? '2026-05-12T13:00:00.000Z';
  const threadId = partial.threadId ?? `thr-${id}`;
  const fromEmail = partial.fromEmail;
  const toEmail = partial.toEmail ?? `owner-${partial.verticalSlug}@example.com`;
  const message = {
    id: `msg-${id}`,
    threadId,
    rfcMessageId: `<${id}@mail.example.com>`,
    fromEmail,
    fromName: partial.fromName ?? null,
    toEmails: [toEmail],
    ccEmails: [],
    subject: partial.subject,
    bodyText: partial.body,
    snippet: partial.body.slice(0, 200),
    references: [],
    inReplyTo: null,
    attachments: [],
    receivedAt,
    labels: ['INBOX', 'UNREAD'],
  };
  const thread: Record<string, typeof message[]> | undefined = partial.priorMessages
    ? {
        [threadId]: partial.priorMessages.map((pm, i) => ({
          id: `msg-${id}-prior-${i}`,
          threadId,
          rfcMessageId: `<${id}-prior-${i}@mail.example.com>`,
          fromEmail: pm.fromEmail,
          fromName: null,
          toEmails: [toEmail],
          ccEmails: [],
          subject: pm.subject,
          bodyText: pm.body,
          snippet: pm.body.slice(0, 200),
          references: [],
          inReplyTo: null,
          attachments: [],
          receivedAt: pm.receivedAt,
          labels: ['INBOX'],
        })),
      }
    : undefined;
  return {
    id,
    verticalSlug: partial.verticalSlug,
    description: partial.description,
    expectedCategoryReason: partial.expectedCategoryReason,
    expectedCategory: partial.expectedCategory,
    divergentFor: partial.divergentFor,
    webhookEvent: {
      id: `we-${id}`,
      subscriptionId: `ws-${id}`,
      rawPayload: { emailAddress: toEmail, historyId: partial.historyId ?? `100000${id.slice(-4)}` },
      receivedAt,
    },
    messages: [message],
    thread,
  };
}

export const CORPUS: WebhookEventFixture[] = [
  // ── Real estate ────────────────────────────────────────────────────
  fx({
    id: 're-01-buyer-inquiry',
    verticalSlug: 'real-estate',
    description: 'Buyer asks about price + disclosures on a specific listing.',
    expectedCategoryReason:
      'Direct question + please-send ask. Per lib/skills/prompts/real-estate.ts draftSignals: "Direct question about price, condition, or contingencies".',
    expectedCategory: 'draft-needed',
    fromEmail: 'sarah.buyer@gmail.com',
    fromName: 'Sarah Buyer',
    subject: '1247 Magnolia Dr — interested',
    body: 'Hi — I saw the listing at 1247 Magnolia Dr and I am interested. Can you please send the disclosures and let me know what the price flexibility looks like?',
  }),
  fx({
    id: 're-02-listing-consult-scheduling',
    verticalSlug: 'real-estate',
    description: 'Seller wants to schedule a listing consult.',
    expectedCategoryReason:
      'Explicit "want to talk about listing my house" — per real-estate.ts schedulingSignals: "Listing consult".',
    expectedCategory: 'scheduling-needed',
    fromEmail: 'mark.seller@gmail.com',
    fromName: 'Mark Seller',
    subject: 'Want to talk about listing my house',
    body: 'Hi, we are thinking of selling our home in the next 60 days. Want to schedule a listing consult — available Tuesday or Wednesday afternoon?',
  }),
  fx({
    id: 're-03-counter-offer-thread',
    verticalSlug: 'real-estate',
    description: 'Counter-offer reply in a 3-message thread — needs a substantive draft.',
    expectedCategoryReason:
      'Counter-offer thread with explicit ask. Per real-estate.ts draftSignals: "Counter-offer or offer-response thread needing an action".',
    expectedCategory: 'draft-needed',
    fromEmail: 'lisa.chen@realtyteam.com',
    fromName: 'Lisa Chen',
    subject: 'Re: Counter on 89 Oakridge',
    body: 'My buyer counters at 612k with seller covering 5k of closing costs. Can you review and respond by end of day Friday?',
    priorMessages: [
      {
        fromEmail: 'owner-real-estate@example.com',
        subject: 'Re: 89 Oakridge — initial offer',
        body: 'My seller is open to 625k with no seller concessions. Can you confirm?',
        receivedAt: '2026-05-11T18:00:00.000Z',
      },
      {
        fromEmail: 'lisa.chen@realtyteam.com',
        subject: 'Re: 89 Oakridge — initial offer',
        body: 'Initial offer at 605k, asking for 8k seller concessions, inspection contingency 10 days.',
        receivedAt: '2026-05-11T14:00:00.000Z',
      },
    ],
  }),
  fx({
    id: 're-04-redfin-alert-noise',
    verticalSlug: 'real-estate',
    description: 'Redfin neighborhood alert — not addressed to broker by name.',
    expectedCategoryReason:
      'Per real-estate.ts noiseSignals: "Redfin / Zillow generic neighborhood alerts (not addressed to the broker by name)".',
    expectedCategory: 'noise',
    fromEmail: 'alerts@redfin.com',
    fromName: 'Redfin',
    subject: 'New homes in your saved search',
    body: 'Newsletter: 12 new homes match your saved search criteria for the Decatur area. Click below to view.',
  }),

  // ── Mortgage ───────────────────────────────────────────────────────
  fx({
    id: 'mtg-01-doc-collection',
    verticalSlug: 'mortgage',
    description: 'Underwriter requests missing W-2.',
    expectedCategoryReason:
      'Per mortgage.ts draftSignals: "Doc-collection request — still need your W-2 / paystub".',
    expectedCategory: 'draft-needed',
    fromEmail: 'underwriting@regionsbank.com',
    fromName: 'Regions Underwriting',
    subject: 'Please review — still need your W-2',
    body: 'Hi — we still need your 2024 W-2 for the Henderson file. Can you please upload to the portal or forward today? Closing is targeted for next Thursday.',
  }),
  fx({
    id: 'mtg-02-rate-lock-decision',
    verticalSlug: 'mortgage',
    description: 'Loan officer asks for rate-lock decision.',
    expectedCategoryReason:
      'Per mortgage.ts draftSignals: "Rate-lock decision needing the broker OK".',
    expectedCategory: 'draft-needed',
    fromEmail: 'amy.lo@lender.com',
    subject: 'Question: rate-lock — please review',
    body: 'Rates moved 0.125 up overnight. Can you please confirm whether to lock at 6.875 today or float into next week? Need response by 10am.',
  }),
  fx({
    id: 'mtg-03-bankrate-newsletter-noise',
    verticalSlug: 'mortgage',
    description: 'Bankrate newsletter — informational, not actionable.',
    expectedCategoryReason:
      'Per mortgage.ts noiseSignals: "Rate-aggregator newsletters (Bankrate, NerdWallet)".',
    expectedCategory: 'noise',
    fromEmail: 'newsletter@bankrate.com',
    subject: 'Newsletter: This week in mortgage rates',
    body: 'newsletter: Weekly recap of national 30-yr fixed averages and Fed-meeting commentary. Click through for the full report.',
  }),

  // ── Insurance ──────────────────────────────────────────────────────
  fx({
    id: 'ins-01-quote-request',
    verticalSlug: 'insurance',
    description: 'Bundle quote request — auto + home.',
    expectedCategoryReason:
      'Per insurance.ts leadSignals: "Bundled-quote request (auto + home)".',
    expectedCategory: 'lead',
    fromEmail: 'rachel.green@gmail.com',
    subject: 'Looking for a quote — auto + home',
    body: 'Hi, I am looking for a quote on bundling auto + home. My current carrier renews next month and the premium went up 18%. Inquiry in zip 30309.',
  }),
  fx({
    id: 'ins-02-renewal-thread-draft-needed',
    verticalSlug: 'insurance',
    description: 'Existing insured asks about renewal premium increase.',
    expectedCategoryReason:
      'Per insurance.ts draftSignals: "Policy renewal — premium change, coverage change".',
    expectedCategory: 'draft-needed',
    fromEmail: 'tom.client@gmail.com',
    subject: 'Question: my renewal — premium went up?',
    body: 'Hi — my homeowners renewal came in 27% higher than last year. Can you please walk me through what changed and whether we should re-shop?',
  }),
  fx({
    id: 'ins-03-claim-followup',
    verticalSlug: 'insurance',
    description: 'Adjuster asks for repair estimate.',
    expectedCategoryReason:
      'Per insurance.ts draftSignals: "Claims-side request from an adjuster".',
    expectedCategory: 'draft-needed',
    fromEmail: 'jenny.adjuster@statefarm.com',
    subject: 'Please review the repair estimate — claim 49823',
    body: 'Hi — I need your input on the repair estimate from Cooper Roofing. Can you please review and confirm whether to approve the supplement before Friday?',
  }),

  // ── Property management ────────────────────────────────────────────
  fx({
    id: 'pm-01-tenant-maintenance',
    verticalSlug: 'property-management',
    description: 'Tenant reports broken HVAC.',
    expectedCategoryReason:
      'Per property-management.ts draftSignals: "Tenant maintenance request needing approval routing".',
    expectedCategory: 'draft-needed',
    fromEmail: 'tenant@gmail.com',
    subject: 'AC not working — need your input',
    body: 'Hi, the AC stopped working this morning and the upstairs is 84F. Please review and can you send someone out? I have two small kids.',
  }),
  fx({
    id: 'pm-02-showing-request',
    verticalSlug: 'property-management',
    description: 'Prospective tenant asks for a showing.',
    expectedCategoryReason:
      'Per property-management.ts schedulingSignals: "Showing request / unit tour".',
    expectedCategory: 'scheduling-needed',
    fromEmail: 'sam.prospect@gmail.com',
    subject: 'Available for a walk-through?',
    body: 'Hi, I saw the listing at 419 Birch. Would you be available for a walk-through on Friday morning? I work flexible hours.',
  }),
  fx({
    id: 'pm-03-owner-vendor-marketing-noise',
    verticalSlug: 'property-management',
    description: 'AppFolio sales pitch.',
    expectedCategoryReason:
      'Per property-management.ts noiseSignals: "Vendor marketing emails for property-management software".',
    expectedCategory: 'noise',
    fromEmail: 'sales@appfolio.com',
    subject: 'Promotional: see how AppFolio can grow your portfolio',
    body: 'newsletter: Promotional: Schedule a demo with our team to see how AppFolio simplifies property management workflows.',
  }),

  // ── Title / escrow ─────────────────────────────────────────────────
  fx({
    id: 'te-01-closing-schedule',
    verticalSlug: 'title-escrow',
    description: 'Lender asks for a closing-time slot.',
    expectedCategoryReason:
      'Per title-escrow.ts schedulingSignals: "Closing / signing appointment scheduling".',
    expectedCategory: 'scheduling-needed',
    fromEmail: 'lender@bigbank.com',
    subject: 'Closing appointment — file 2026-1182',
    body: 'Hi — please confirm your availability for a closing/signing appointment on Tuesday morning. Buyer and seller both confirmed.',
  }),
  fx({
    id: 'te-02-commitment-exception',
    verticalSlug: 'title-escrow',
    description: 'Underwriter clearance question on a curative item.',
    expectedCategoryReason:
      'Per title-escrow.ts draftSignals: "Underwriter clearance question on a curative item".',
    expectedCategory: 'draft-needed',
    fromEmail: 'clearance@underwriter.com',
    subject: 'Please review — exception 7 on file 2026-1182',
    body: 'Hi, can you please review exception 7 (old mechanics lien) and confirm whether we have the curative docs? Need your input before we can clear to close.',
  }),

  // ── Recruiting ─────────────────────────────────────────────────────
  fx({
    id: 'rec-01-candidate-status-q',
    verticalSlug: 'recruiting',
    description: 'Candidate asks about role status.',
    expectedCategoryReason:
      'Per recruiting.ts draftSignals: "Candidate asking about role status, comp range, next step".',
    expectedCategory: 'draft-needed',
    fromEmail: 'candidate@gmail.com',
    subject: 'Question: any update on the senior engineer role?',
    body: 'Hi — checking in on the senior engineer role I interviewed for two weeks ago. Can you please let me know where I stand? I have another offer with a Friday deadline.',
  }),
  fx({
    id: 'rec-02-hiring-mgr-intake',
    verticalSlug: 'recruiting',
    description: 'Hiring manager wants an intake call.',
    expectedCategoryReason:
      'Per recruiting.ts schedulingSignals: "Intake call request from a new hiring manager".',
    expectedCategory: 'scheduling-needed',
    fromEmail: 'hiring.mgr@startup.com',
    subject: 'Intake call — looking for a VP Eng',
    body: 'Hi, we just opened a VP Eng req and would like to schedule an intake call. Available Wednesday afternoon or Thursday morning?',
  }),
  fx({
    id: 'rec-03-recruiter-spam-noise',
    verticalSlug: 'recruiting',
    description: 'Competing recruiter pitch.',
    expectedCategoryReason:
      'Per recruiting.ts noiseSignals: "Inbound from competing staffing agencies pitching services".',
    expectedCategory: 'noise',
    fromEmail: 'partnership@otherstaffing.com',
    subject: 'Recruiter spam marker — partnership opportunity?',
    body: 'recruiter spam marker — would love to chat about a partnership where we share placements. Newsletter: book a 15-minute intro.',
  }),

  // ── Home services ──────────────────────────────────────────────────
  fx({
    id: 'hs-01-emergency-leak',
    verticalSlug: 'home-services',
    description: 'Homeowner emergency leak — wants next-available appointment.',
    expectedCategoryReason:
      'Per home-services.ts schedulingSignals: "next available, emergency".',
    expectedCategory: 'scheduling-needed',
    fromEmail: 'desperate.homeowner@gmail.com',
    subject: 'Leak in basement — when can you come out?',
    body: 'Help — I have water coming up through the basement floor. When can you come out, next available appointment please? Address is 88 Vine Street.',
  }),
  fx({
    id: 'hs-02-quote-question',
    verticalSlug: 'home-services',
    description: 'Customer asks about price for a panel upgrade.',
    expectedCategoryReason:
      'Per home-services.ts draftSignals: "Customer asking about price, parts availability, or warranty".',
    expectedCategory: 'draft-needed',
    fromEmail: 'customer@gmail.com',
    subject: 'Question: cost to upgrade my electrical panel?',
    body: 'Hi — can you please give me a rough quote on upgrading from 100A to 200A service? House is 1990s build, single story, 1800 sq ft.',
  }),
  fx({
    id: 'hs-03-ferguson-noise',
    verticalSlug: 'home-services',
    description: 'Ferguson promotional email.',
    expectedCategoryReason:
      'Per home-services.ts noiseSignals: "Wholesaler marketing (Ferguson, HD Supply promotional emails)".',
    expectedCategory: 'noise',
    fromEmail: 'specials@ferguson.com',
    subject: 'Promotional: 20% off in-stock fittings this week',
    body: 'newsletter: This week only, 20% off select Pex fittings in your local Ferguson branch. Click for the full catalog.',
  }),

  // ── CPA ───────────────────────────────────────────────────────────
  fx({
    id: 'cpa-01-irs-notice',
    verticalSlug: 'cpa',
    description: 'Client forwards a CP2000 IRS notice — urgent.',
    expectedCategoryReason:
      'Per cpa.ts draftSignals: "IRS notice — CP2000, CP504, audit notice".',
    expectedCategory: 'draft-needed',
    fromEmail: 'panicked.client@gmail.com',
    subject: 'Please review — I got a CP2000 from the IRS',
    body: 'Hi — I just got a CP2000 from the IRS about my 2023 return. They are claiming $4,800 more in tax. Can you please review and let me know what to do? Response deadline is in 30 days.',
  }),
  fx({
    id: 'cpa-02-tax-prep-scheduling',
    verticalSlug: 'cpa',
    description: 'Business client wants a tax-prep meeting.',
    expectedCategoryReason:
      'Per cpa.ts schedulingSignals: "Tax-prep / 1040 review appointment".',
    expectedCategory: 'scheduling-needed',
    fromEmail: 'biz.owner@gmail.com',
    subject: 'Available for tax-prep meeting?',
    body: 'Hi, my K-1s arrived this week. When are you available for our annual tax-prep review? Morning works better for me.',
  }),
  fx({
    id: 'cpa-03-missing-doc',
    verticalSlug: 'cpa',
    description: 'Client missing a 1099 — practice needs to nudge them.',
    expectedCategoryReason:
      'Per cpa.ts draftSignals: "Client missing-document request (W-2, 1099, K-1, receipt)".',
    expectedCategory: 'draft-needed',
    fromEmail: 'client@gmail.com',
    subject: 'Question: do I need to send the 1099 from Etsy?',
    body: 'Hi — I got a 1099-K from Etsy for $987. Do I need to send that to you? Please review and let me know.',
  }),
  fx({
    id: 'cpa-04-drake-marketing-noise',
    verticalSlug: 'cpa',
    description: 'Drake software upgrade promo.',
    expectedCategoryReason:
      'Per cpa.ts noiseSignals: "Tax-software vendor marketing".',
    expectedCategory: 'noise',
    fromEmail: 'upgrades@drakesoftware.com',
    subject: 'Promotional: Drake 2026 — pre-order now',
    body: 'newsletter: Pre-order Drake Tax 2026 and save 15%. New e-signature integration. Click to learn more.',
  }),

  // ── Law ───────────────────────────────────────────────────────────
  fx({
    id: 'law-01-deadline-notice',
    verticalSlug: 'law',
    description: 'Court notice — answer deadline 14 days.',
    expectedCategoryReason:
      'Per law.ts draftSignals: "Court deadline notice — answer, motion, response".',
    expectedCategory: 'draft-needed',
    fromEmail: 'clerk@courtmail.gov',
    subject: 'Please review — answer due — case 2026-CV-1187',
    body: 'Hi counsel, this is a courtesy reminder that an answer is due in 14 days for case 2026-CV-1187. Please review and confirm receipt.',
  }),
  fx({
    id: 'law-02-opp-counsel-meet-confer',
    verticalSlug: 'law',
    description: 'Opposing counsel requests a meet-and-confer.',
    expectedCategoryReason:
      'Per law.ts schedulingSignals: "Client meeting" + draftSignals: "Opposing-counsel meet-and-confer".',
    expectedCategory: 'scheduling-needed',
    fromEmail: 'opposing@bigfirm.com',
    fromName: 'Patrick Lee',
    subject: 'Meet and confer scheduling',
    body: 'Hi counsel — per local rule we need to meet and confer on the motion to compel before filing. Available Tuesday or Wednesday afternoon for a 30-minute consult.',
  }),
  fx({
    id: 'law-03-aba-newsletter-noise',
    verticalSlug: 'law',
    description: 'ABA Journal digest.',
    expectedCategoryReason:
      'Per law.ts noiseSignals: "Legal-publication newsletters (ABA Journal, Law360 digests)".',
    expectedCategory: 'noise',
    fromEmail: 'digest@abajournal.com',
    subject: 'Newsletter: This week at the ABA',
    body: 'newsletter: Top stories this week from the ABA Journal. Click through for the full report.',
  }),

  // ── RIA ───────────────────────────────────────────────────────────
  fx({
    id: 'ria-01-client-q-on-holding',
    verticalSlug: 'ria',
    description: 'Client asks about a holding that dropped.',
    expectedCategoryReason:
      'Per ria.ts draftSignals: "Client question about a holding, performance, or fees".',
    expectedCategory: 'draft-needed',
    fromEmail: 'wealth.client@gmail.com',
    subject: 'Question: my Vanguard fund dropped 8% — what happened?',
    body: 'Hi, my VTSAX position is down 8% this month — please review and let me know what is going on and whether I should change anything.',
  }),
  fx({
    id: 'ria-02-custodian-doc-request',
    verticalSlug: 'ria',
    description: 'Custodian asks for missing onboarding doc.',
    expectedCategoryReason:
      'Per ria.ts draftSignals: "Custodian / TAMP request for missing account documents".',
    expectedCategory: 'draft-needed',
    fromEmail: 'newaccounts@schwab.com',
    subject: 'Please review — missing trust certificate',
    body: 'Hi advisor — we are still missing the trust certification for account TR-441. Can you please send by Wednesday so we can open the account?',
  }),

  // ── Cross-vertical noise (Conner's actual inbox shapes) ────────────
  fx({
    id: 'noise-01-pottery-barn',
    verticalSlug: 'real-estate',
    description: 'Pottery Barn 30% off — universal noise across all verticals.',
    expectedCategoryReason:
      'Per real-estate.ts noiseSignals: "Pottery Barn / West Elm / Wayfair promotional emails".',
    expectedCategory: 'noise',
    fromEmail: 'updates@potterybarn.com',
    subject: '30% off bedroom — this weekend only',
    body: 'newsletter: Pottery Barn promotional: 30% off select bedroom furniture this weekend.',
  }),
  fx({
    id: 'noise-02-experian-alert',
    verticalSlug: 'mortgage',
    description: 'Experian credit-bureau alert — universal noise.',
    expectedCategoryReason:
      'Per mortgage.ts (and shared inbox patterns): Experian credit-bureau alerts are noise unless they reference a specific live file.',
    expectedCategory: 'noise',
    fromEmail: 'alerts@experian.com',
    subject: 'New credit alert on file',
    body: 'newsletter: Experian: There is a new soft inquiry on your credit file. Click to review.',
  }),
  fx({
    id: 'noise-03-recruiter-spam',
    verticalSlug: 'cpa',
    description: 'Generic recruiter pitch — universal noise.',
    expectedCategoryReason:
      'Generic recruiter spam — universal noise pattern. Per cpa.ts noiseSignals (implicit) and recruiting.ts noiseSignals.',
    expectedCategory: 'noise',
    fromEmail: 'opportunities@careerco.com',
    subject: 'Would love to chat about your job at — recruiter spam marker',
    body: 'recruiter spam marker — would love to chat about an exciting opportunity I am working on. Newsletter: 15-minute call?',
  }),

  // ── Edge cases ─────────────────────────────────────────────────────
  fx({
    id: 'edge-01-vertical-divergent',
    verticalSlug: 'real-estate',
    description:
      'Tax-prep email — should be NOISE for real-estate workspace but DRAFT-NEEDED for CPA workspace.',
    expectedCategoryReason:
      'Email reads as tax-prep urgency — irrelevant to a real-estate workspace (no MLS/listing context). Categorize as noise. The same email categorizes as draft-needed for cpa per cpa.ts schedulingSignals.',
    expectedCategory: 'noise',
    divergentFor: [{ verticalSlug: 'cpa', expectedCategory: 'scheduling-needed' }],
    fromEmail: 'client@gmail.com',
    subject: 'Available for tax-prep meeting?',
    body: 'Hi, my K-1s arrived this week. When are you available for our annual tax-prep review? Morning works better for me.',
  }),
  fx({
    id: 'edge-02-confirmation-transactional',
    verticalSlug: 'real-estate',
    description: 'Automated showing-confirmation email — transactional.',
    expectedCategoryReason:
      '"do not reply" + "confirmation" — per shared categorize prompt: transactional confirmation, no draft needed.',
    expectedCategory: 'transactional',
    fromEmail: 'noreply@showingtime.com',
    subject: 'Confirmation: showing scheduled — do not reply',
    body: 'do not reply — confirmation: Your showing has been confirmed for 1247 Magnolia Dr on Saturday at 10:00am. This is an automated notification.',
  }),
];
