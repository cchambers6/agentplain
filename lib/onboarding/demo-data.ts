/**
 * lib/onboarding/demo-data.ts
 *
 * The "first 5 minutes" demo substrate — PURE data + PURE builders.
 *
 * THE OUTCOME: within five minutes of signup, the customer watches Plaino DO
 * something concrete for them — draft the one piece of work their vertical's
 * killer workflow promises (`lib/plaino/killer-workflow.ts`). To make that land
 * every time (the model key has been paused before; the magic moment must never
 * depend on it — same deterministic-by-design choice the killer-workflow card
 * made), we seed a small, CLEARLY-LABELLED demo dataset per vertical and build
 * the activation draft from it with a deterministic template.
 *
 * This file owns:
 *   - `DEMO_DATASETS` — the per-vertical record sets (leads / estimates /
 *     clients / intakes / portfolios / …). Each set has exactly ONE `urgent`
 *     record — the thing Plaino acts on immediately.
 *   - `buildActivationDraft` — turns the urgent record into a real, send-ready
 *     draft email in Plaino's plain heritage register. No LLM, no I/O.
 *
 * Honesty (feedback_no_guesses_no_estimates + the locked additive/accessible
 * rule): every record is flagged demo at the storage layer (see
 * `demo-seed.ts`), every party email is an `@example.com` placeholder, and the
 * draft the customer approves is a genuine, well-formed draft — it just runs
 * against demo data until their first real sync lands.
 *
 * Voice (project_plaino_named_agent + project_agentplain_mission_and_positioning):
 * "local businesses", never "SMB". Calm, concrete, a heritage partner showing
 * their work — never "Initializing AI agent…".
 */

import type { Vertical } from '@prisma/client';
import { killerWorkflowFor } from '../plaino/killer-workflow';

/** Each demo record's shape drives both its badge and the draft template that
 *  fulfils the vertical's killer-workflow promise. */
export type DemoKind =
  | 'first-touch-lead'
  | 'estimate-chase'
  | 'missing-receipts'
  | 'intake-follow-up'
  | 'client-check-in'
  | 'condition-chase'
  | 'coi-reply'
  | 'late-rent-reminder'
  | 'missing-doc-flag'
  | 'invoice-chase';

export interface DemoParty {
  name: string;
  /** Always an @example.com placeholder — these are demo counterparties. */
  email: string;
}

export interface DemoRecord {
  /** Stable slug, unique within a workspace's demo set. Persisted in the
   *  KnowledgeDocument metadata so the activation run can rebuild the draft
   *  cold (feedback_cold_start_safe_agents). */
  demoId: string;
  demoKind: DemoKind;
  /** Short human label, e.g. "Hot lead · Marcus Pope". */
  title: string;
  /** One-line summary shown in lists + the welcome surface. */
  summary: string;
  /** The counterparty this record concerns (the draft's recipient). */
  party: DemoParty;
  /** Whole-dollar amount when relevant (estimate / invoice / rent). */
  amountUsd?: number;
  /** Age in days since last contact / since the item came due. */
  ageDays?: number;
  /** Human urgency label, e.g. "deadline today", "closes Friday". */
  dueLabel?: string;
  /** Exactly one record per dataset is urgent — the one Plaino acts on now. */
  urgent: boolean;
  /** Extra context lines surfaced in the demo record detail. */
  contextLines: string[];
}

export interface DemoDataset {
  /** `null` = the general (on-ramp / unknown-vertical) dataset. */
  vertical: Vertical | null;
  records: DemoRecord[];
  /** Minutes the immediate action saves the owner — plain, locked per vertical. */
  savedMinutes: number;
}

// ─── Per-vertical datasets ──────────────────────────────────────────────────
// Each `urgent` record's `demoKind` matches the vertical's killer workflow so
// the magic moment PROVES the activation promise the customer already saw on
// the onboarding card.

const REAL_ESTATE_DATASET: DemoDataset = {
  vertical: 'REAL_ESTATE',
  savedMinutes: 15,
  records: [
    {
      demoId: 'lead-marcus-pope',
      demoKind: 'first-touch-lead',
      title: 'Hot lead · Marcus Pope',
      summary: 'New buyer lead — pre-approved, asked about 418 Peachtree Way 11 minutes ago.',
      party: { name: 'Marcus Pope', email: 'marcus.pope@example.com' },
      ageDays: 0,
      dueLabel: 'in the last 15 minutes',
      urgent: true,
      contextLines: [
        'Source: website "request a showing" form',
        'Pre-approved up to $525,000 (lender letter attached)',
        'Asked: "Is 418 Peachtree Way still available, and can I see it this weekend?"',
      ],
    },
    {
      demoId: 'lead-dana-whitfield',
      demoKind: 'first-touch-lead',
      title: 'Warm lead · Dana Whitfield',
      summary: 'Browsing 3-bed listings under $400k. No tour requested yet.',
      party: { name: 'Dana Whitfield', email: 'dana.whitfield@example.com' },
      ageDays: 2,
      urgent: false,
      contextLines: ['Source: Zillow inquiry', 'Two listings favorited'],
    },
    {
      demoId: 'lead-alvarez-family',
      demoKind: 'first-touch-lead',
      title: 'Nurture lead · The Alvarez family',
      summary: 'Relocating next spring — long timeline, worth a quarterly check-in.',
      party: { name: 'The Alvarez family', email: 'alvarez.family@example.com' },
      ageDays: 9,
      urgent: false,
      contextLines: ['Timeline: 6–9 months', 'Relocating from out of state'],
    },
    {
      demoId: 'listing-418-peachtree',
      demoKind: 'first-touch-lead',
      title: 'Listing · 418 Peachtree Way',
      summary: '$489,000 · 4 bed / 3 bath · 6 days on market · 2 saved searches matched.',
      party: { name: '418 Peachtree Way', email: 'listing-418@example.com' },
      urgent: false,
      contextLines: ['Status: active', 'Open house Saturday 1–3pm'],
    },
    {
      demoId: 'listing-22-sweetwater',
      demoKind: 'first-touch-lead',
      title: 'Listing · 22 Sweetwater Ln',
      summary: '$362,000 · 3 bed / 2 bath · 21 days on market — a price review is due.',
      party: { name: '22 Sweetwater Ln', email: 'listing-22@example.com' },
      urgent: false,
      contextLines: ['Status: active', '21 days on market, 0 offers'],
    },
  ],
};

const HOME_SERVICES_DATASET: DemoDataset = {
  vertical: 'HOME_SERVICES',
  savedMinutes: 16,
  records: [
    {
      demoId: 'estimate-brad-nolan',
      demoKind: 'estimate-chase',
      title: 'Open estimate · Brad Nolan',
      summary: '$4,200 roof repair — sent 6 days ago, no reply.',
      party: { name: 'Brad Nolan', email: 'brad.nolan@example.com' },
      amountUsd: 4200,
      ageDays: 6,
      dueLabel: '6 days quiet',
      urgent: true,
      contextLines: [
        'Job: tear-off + re-shingle, detached garage',
        'Quote sent by email; opened twice, never answered',
        'Busy season — this slot fills in about a week',
      ],
    },
    {
      demoId: 'estimate-tina-okafor',
      demoKind: 'estimate-chase',
      title: 'Open estimate · Tina Okafor',
      summary: '$1,850 HVAC tune-up + coil clean — sent 3 days ago.',
      party: { name: 'Tina Okafor', email: 'tina.okafor@example.com' },
      amountUsd: 1850,
      ageDays: 3,
      urgent: false,
      contextLines: ['Repeat customer', 'Asked about a maintenance plan'],
    },
    {
      demoId: 'estimate-greenwood-hoa',
      demoKind: 'estimate-chase',
      title: 'Open estimate · Greenwood HOA',
      summary: '$9,400 common-area lighting — sent 2 days ago.',
      party: { name: 'Greenwood HOA', email: 'board@example.com' },
      amountUsd: 9400,
      ageDays: 2,
      urgent: false,
      contextLines: ['Board votes next Tuesday', 'Biggest open quote this month'],
    },
    {
      demoId: 'invoice-1042-overdue',
      demoKind: 'invoice-chase',
      title: 'Overdue invoice · #1042',
      summary: '$2,300 — 14 days past due (the Hollis kitchen job).',
      party: { name: 'Ray Hollis', email: 'ray.hollis@example.com' },
      amountUsd: 2300,
      ageDays: 14,
      urgent: false,
      contextLines: ['Net-15 terms', 'Job signed off as complete'],
    },
    {
      demoId: 'invoice-1039-overdue',
      demoKind: 'invoice-chase',
      title: 'Overdue invoice · #1039',
      summary: '$480 — 8 days past due (a service call).',
      party: { name: 'Nina Brooks', email: 'nina.brooks@example.com' },
      amountUsd: 480,
      ageDays: 8,
      urgent: false,
      contextLines: ['Net-15 terms'],
    },
  ],
};

const CPA_DATASET: DemoDataset = {
  vertical: 'CPA',
  savedMinutes: 18,
  records: [
    {
      demoId: 'client-cobb-lane',
      demoKind: 'missing-receipts',
      title: 'Quarter-end · Cobb & Lane LLC',
      summary: 'Q2 close starts Monday — 3 expense receipts still missing.',
      party: { name: 'Dana Cobb', email: 'dana.cobb@example.com' },
      dueLabel: 'close starts Monday',
      urgent: true,
      contextLines: [
        'Missing: 2 travel receipts (March), 1 equipment receipt ($1,840)',
        'Books otherwise reconciled through May',
        'Without these, the close slips a week',
      ],
    },
    {
      demoId: 'client-marigold-bakery',
      demoKind: 'missing-receipts',
      title: 'Quarter-end · Marigold Bakery',
      summary: 'Q2 close coming — books current, no blockers yet.',
      party: { name: 'Sofia Marigold', email: 'sofia.marigold@example.com' },
      urgent: false,
      contextLines: ['Monthly bookkeeping on file', 'Payroll reconciled'],
    },
    {
      demoId: 'client-hwang-dental',
      demoKind: 'missing-receipts',
      title: 'Quarter-end · Hwang Dental',
      summary: 'Q2 close coming — awaiting one bank statement.',
      party: { name: 'Dr. Grace Hwang', email: 'grace.hwang@example.com' },
      urgent: false,
      contextLines: ['Statement requested from the bank'],
    },
    {
      demoId: 'client-riverside-plumbing',
      demoKind: 'missing-receipts',
      title: 'Receipts open · Riverside Plumbing',
      summary: '2 vendor receipts outstanding for April.',
      party: { name: 'Carl Reyes', email: 'carl.reyes@example.com' },
      urgent: false,
      contextLines: ['Vendor: supply house', 'Amounts pending'],
    },
  ],
};

const LAW_DATASET: DemoDataset = {
  vertical: 'LAW',
  savedMinutes: 16,
  records: [
    {
      demoId: 'intake-priya-raman',
      demoKind: 'intake-follow-up',
      title: 'Pending intake · Priya Raman',
      summary: 'Conflict screen clear — engagement follow-up due today.',
      party: { name: 'Priya Raman', email: 'priya.raman@example.com' },
      dueLabel: 'follow-up due today',
      urgent: true,
      contextLines: [
        'Matter: contract review for a small business sale',
        'Screened against your matter list — no conflicts found',
        'Said she is comparing two firms; today is the day to respond',
      ],
    },
    {
      demoId: 'intake-delgado-matter',
      demoKind: 'intake-follow-up',
      title: 'Pending intake · Delgado matter',
      summary: 'New estate-planning inquiry — conflict screen queued.',
      party: { name: 'Hector Delgado', email: 'hector.delgado@example.com' },
      ageDays: 1,
      urgent: false,
      contextLines: ['Matter: estate plan', 'Screen pending'],
    },
  ],
};

const RIA_DATASET: DemoDataset = {
  vertical: 'RIA',
  savedMinutes: 16,
  records: [
    {
      demoId: 'portfolio-hartwell-trust',
      demoKind: 'client-check-in',
      title: 'Flagged · The Hartwell Trust',
      summary: 'Unusual transaction — $48,000 withdrawal outside the plan.',
      party: { name: 'Eleanor Hartwell', email: 'eleanor.hartwell@example.com' },
      amountUsd: 48000,
      dueLabel: 'flagged this morning',
      urgent: true,
      contextLines: [
        'Withdrawal not in the quarterly plan',
        'Could be a large purchase, a transfer, or an error — worth a calm check-in',
        'Weekly review is due for this household anyway',
      ],
    },
    {
      demoId: 'portfolio-okonkwo-family',
      demoKind: 'client-check-in',
      title: 'Weekly check-in · Okonkwo Family',
      summary: 'On plan — a routine touch-base note is due.',
      party: { name: 'Ada Okonkwo', email: 'ada.okonkwo@example.com' },
      urgent: false,
      contextLines: ['Allocation on target', 'No flags'],
    },
    {
      demoId: 'portfolio-stein-holdings',
      demoKind: 'client-check-in',
      title: 'Weekly check-in · Stein Holdings',
      summary: 'On plan — quarterly letter coming up.',
      party: { name: 'Marcus Stein', email: 'marcus.stein@example.com' },
      urgent: false,
      contextLines: ['Quarterly letter due in 3 weeks'],
    },
  ],
};

const MORTGAGE_DATASET: DemoDataset = {
  vertical: 'MORTGAGE',
  savedMinutes: 15,
  records: [
    {
      demoId: 'file-janet-cole',
      demoKind: 'condition-chase',
      title: 'Open condition · Janet Cole',
      summary: 'Underwriting needs an updated paystub — clock is running.',
      party: { name: 'Janet Cole', email: 'janet.cole@example.com' },
      dueLabel: 'rate lock holds 9 days',
      urgent: true,
      contextLines: [
        'Condition: most-recent paystub (prior one expired)',
        'Everything else in the file is cleared to close',
        'Rate lock holds 9 more days',
      ],
    },
    {
      demoId: 'file-omar-reyes',
      demoKind: 'condition-chase',
      title: 'Open condition · Omar Reyes',
      summary: "Homeowner's insurance binder outstanding.",
      party: { name: 'Omar Reyes', email: 'omar.reyes@example.com' },
      ageDays: 2,
      urgent: false,
      contextLines: ['Condition: insurance binder', 'Agent contacted'],
    },
  ],
};

const INSURANCE_DATASET: DemoDataset = {
  vertical: 'INSURANCE',
  savedMinutes: 14,
  records: [
    {
      demoId: 'coi-sunbelt-contractors',
      demoKind: 'coi-reply',
      title: 'COI request · Sunbelt Contractors',
      summary: 'Certificate needed naming the GC as additional insured — for a Friday start.',
      party: { name: 'Sunbelt Contractors', email: 'ap@example.com' },
      dueLabel: 'needed before Friday',
      urgent: true,
      contextLines: [
        'Holder: Sunbelt Contractors LLC',
        'Additional insured: Pinnacle General Contractors',
        'They cannot start the job on site without it',
      ],
    },
    {
      demoId: 'coi-maple-property',
      demoKind: 'coi-reply',
      title: 'COI request · Maple Property Mgmt',
      summary: 'Standard certificate for a vendor file — no rush.',
      party: { name: 'Maple Property Mgmt', email: 'vendors@example.com' },
      ageDays: 1,
      urgent: false,
      contextLines: ['Routine vendor compliance file'],
    },
  ],
};

const PROPERTY_MANAGEMENT_DATASET: DemoDataset = {
  vertical: 'PROPERTY_MANAGEMENT',
  savedMinutes: 14,
  records: [
    {
      demoId: 'tenant-unit-4b',
      demoKind: 'late-rent-reminder',
      title: 'Late rent · Unit 4B',
      summary: 'Carla Mendez — rent 5 days late ($1,450).',
      party: { name: 'Carla Mendez', email: 'carla.mendez@example.com' },
      amountUsd: 1450,
      ageDays: 5,
      dueLabel: '5 days late',
      urgent: true,
      contextLines: [
        'Good tenant — first late payment in 2 years',
        'A polite reminder almost always does it',
        'Late fee not yet applied',
      ],
    },
    {
      demoId: 'tenant-unit-2a',
      demoKind: 'late-rent-reminder',
      title: 'Late rent · Unit 2A',
      summary: 'Rent 2 days late ($1,200).',
      party: { name: 'Devon Pratt', email: 'devon.pratt@example.com' },
      amountUsd: 1200,
      ageDays: 2,
      urgent: false,
      contextLines: ['Within the grace window'],
    },
  ],
};

const TITLE_ESCROW_DATASET: DemoDataset = {
  vertical: 'TITLE_ESCROW',
  savedMinutes: 15,
  records: [
    {
      demoId: 'closing-88-magnolia',
      demoKind: 'missing-doc-flag',
      title: 'Closing · 88 Magnolia Ct',
      summary: 'Payoff statement still missing — closes Friday.',
      party: { name: 'First Heritage Bank', email: 'payoffs@example.com' },
      dueLabel: 'closes Friday',
      urgent: true,
      contextLines: [
        'Missing: lender payoff statement',
        'All other docs in the file are clear',
        'Friday closing slips without it',
      ],
    },
    {
      demoId: 'closing-145-elm',
      demoKind: 'missing-doc-flag',
      title: 'Closing · 145 Elm St',
      summary: 'Survey outstanding — closes in 12 days.',
      party: { name: 'Atlas Surveying', email: 'orders@example.com' },
      ageDays: 1,
      urgent: false,
      contextLines: ['Missing: updated survey'],
    },
  ],
};

const RECRUITING_DATASET: DemoDataset = {
  vertical: 'RECRUITING',
  savedMinutes: 15,
  records: [
    {
      demoId: 'invoice-apex-staffing',
      demoKind: 'invoice-chase',
      title: 'Overdue placement fee · Apex Staffing',
      summary: '$6,500 placement fee — 9 days past due.',
      party: { name: 'Apex Staffing', email: 'ap@example.com' },
      amountUsd: 6500,
      ageDays: 9,
      dueLabel: '9 days past due',
      urgent: true,
      contextLines: [
        'Placement: senior controller, started 3 weeks ago',
        'Net-15 terms; candidate is well past the guarantee start',
        'Largest receivable open right now',
      ],
    },
    {
      demoId: 'candidate-jordan-lee',
      demoKind: 'invoice-chase',
      title: 'Candidate · Jordan Lee',
      summary: 'Final-round feedback owed to the client by Thursday.',
      party: { name: 'Jordan Lee', email: 'jordan.lee@example.com' },
      ageDays: 1,
      urgent: false,
      contextLines: ['Role: operations manager', 'Awaiting client decision'],
    },
  ],
};

const GENERAL_DATASET: DemoDataset = {
  vertical: null,
  savedMinutes: 15,
  records: [
    {
      demoId: 'invoice-westside-auto',
      demoKind: 'invoice-chase',
      title: 'Overdue invoice · Westside Auto',
      summary: '$1,200 — 11 days past due.',
      party: { name: 'Westside Auto', email: 'billing@example.com' },
      amountUsd: 1200,
      ageDays: 11,
      dueLabel: '11 days past due',
      urgent: true,
      contextLines: [
        'Net-15 terms',
        'Work delivered and signed off',
        'Largest receivable open right now',
      ],
    },
    {
      demoId: 'invoice-kemp-sons',
      demoKind: 'invoice-chase',
      title: 'Overdue invoice · Kemp & Sons',
      summary: '$640 — 4 days past due.',
      party: { name: 'Kemp & Sons', email: 'accounts@example.com' },
      amountUsd: 640,
      ageDays: 4,
      urgent: false,
      contextLines: ['Net-15 terms'],
    },
    {
      demoId: 'invoice-lias-catering',
      demoKind: 'invoice-chase',
      title: 'Invoice · Lia’s Catering',
      summary: '$2,100 — current, due next week.',
      party: { name: 'Lia’s Catering', email: 'lia@example.com' },
      amountUsd: 2100,
      urgent: false,
      contextLines: ['Net-15 terms', 'Not yet due'],
    },
  ],
};

const DEMO_DATASETS: Record<Vertical, DemoDataset> = {
  REAL_ESTATE: REAL_ESTATE_DATASET,
  MORTGAGE: MORTGAGE_DATASET,
  INSURANCE: INSURANCE_DATASET,
  PROPERTY_MANAGEMENT: PROPERTY_MANAGEMENT_DATASET,
  TITLE_ESCROW: TITLE_ESCROW_DATASET,
  RECRUITING: RECRUITING_DATASET,
  HOME_SERVICES: HOME_SERVICES_DATASET,
  CPA: CPA_DATASET,
  LAW: LAW_DATASET,
  RIA: RIA_DATASET,
};

/**
 * Resolve the demo dataset for a workspace vertical. `null` (not yet picked /
 * on-ramp) resolves to the general dataset so a brand-new workspace still gets
 * a concrete magic moment.
 */
export function demoDatasetFor(vertical: Vertical | null | undefined): DemoDataset {
  if (!vertical) return GENERAL_DATASET;
  return DEMO_DATASETS[vertical] ?? GENERAL_DATASET;
}

/** The single record Plaino acts on immediately. Falls back to the first
 *  record if (defensively) none is flagged urgent. */
export function pickUrgentRecord(dataset: DemoDataset): DemoRecord | null {
  return dataset.records.find((r) => r.urgent) ?? dataset.records[0] ?? null;
}

// ─── Activation-draft builder ───────────────────────────────────────────────

export interface ActivationDraft {
  subject: string;
  /** Multi-paragraph plain-text body (paragraphs split by a blank line). */
  body: string;
  /** Minutes the owner saves by approving instead of writing this by hand. */
  savedMinutes: number;
  demoKind: DemoKind;
  party: DemoParty;
  /** The demo record's title — surfaced as the "what this is about" line. */
  recordTitle: string;
  /** The killer-workflow promise this draft fulfils (locked copy). */
  promiseHeadline: string;
}

export interface BuildActivationDraftArgs {
  vertical: Vertical | null;
  record: DemoRecord;
  /** The workspace name — signs the draft (the owner's business sends it). */
  businessName: string;
  /** Minutes saved for this vertical (from the dataset). */
  savedMinutes: number;
}

/**
 * Build the activation draft for one demo record. Deterministic, no LLM — the
 * template is chosen by `record.demoKind` and filled from the record's party +
 * amounts + context. The result is a genuine, send-ready draft the owner can
 * approve as-is.
 */
export function buildActivationDraft(
  args: BuildActivationDraftArgs,
): ActivationDraft {
  const { record, businessName, savedMinutes } = args;
  const promiseHeadline = killerWorkflowFor(args.vertical).headline;
  const firstName = firstNameOf(record.party.name);
  const sign = `Warm regards,\n${businessName}`;
  const built = TEMPLATES[record.demoKind]({ record, firstName, businessName, sign });
  return {
    subject: built.subject,
    body: built.body,
    savedMinutes,
    demoKind: record.demoKind,
    party: record.party,
    recordTitle: record.title,
    promiseHeadline,
  };
}

interface TemplateArgs {
  record: DemoRecord;
  firstName: string;
  businessName: string;
  sign: string;
}

type Template = (a: TemplateArgs) => { subject: string; body: string };

const TEMPLATES: Record<DemoKind, Template> = {
  'first-touch-lead': ({ record, firstName, sign }) => ({
    subject: 'Thanks for reaching out — happy to set up a showing',
    body: [
      `Hi ${firstName},`,
      `Thanks for reaching out about ${listingName(record)}. It is still available, and I'd be glad to get you in to see it this weekend.`,
      `I have Saturday morning or Sunday afternoon open — would either of those work? If you'd rather I pull a few comparable homes in the same area first, I can have those to you today.`,
      'Either way, you are in good hands. Looking forward to it.',
      sign,
    ].join('\n\n'),
  }),
  'estimate-chase': ({ record, firstName, sign }) => ({
    subject: `Still happy to do your ${jobLabel(record)} — quick check-in`,
    body: [
      `Hi ${firstName},`,
      `Just following up on the estimate I sent for your ${jobLabel(record)}${money(record.amountUsd)}. I want to make sure it reached you and answer any questions.`,
      'My schedule is filling up for the next couple of weeks, so if you would like to move ahead I can still hold a slot for you. A quick yes or no is all I need to get you on the calendar.',
      'No pressure either way — just did not want it to slip through the cracks.',
      sign,
    ].join('\n\n'),
  }),
  'missing-receipts': ({ record, firstName, sign }) => ({
    subject: 'Quick items to finish your quarter-end close',
    body: [
      `Hi ${firstName},`,
      'We are ready to start your quarter-end close. To finish cleanly, I just need a few receipts that are still outstanding:',
      receiptList(record),
      'If you can send those over in the next day or two, we will keep everything on schedule. Snapping a photo and replying here is perfectly fine.',
      'Thanks — almost there.',
      sign,
    ].join('\n\n'),
  }),
  'intake-follow-up': ({ record, firstName, sign }) => ({
    subject: 'Following up on your inquiry — we can take this on',
    body: [
      `Hi ${firstName},`,
      'Thank you for reaching out. I have reviewed the details of your matter and run our conflict check — we are clear to represent you, and we would be glad to help.',
      'If you would like to move forward, I can send the engagement letter today and we can find a time to talk this week. Let me know what works and I will get it on the calendar.',
      'Happy to answer any questions in the meantime.',
      sign,
    ].join('\n\n'),
  }),
  'client-check-in': ({ record, firstName, sign }) => ({
    subject: 'Touching base on your account',
    body: [
      `Hi ${firstName},`,
      `I was reviewing your account this morning and noticed a transaction that sits outside our plan${money(record.amountUsd)}. I wanted to check in before doing anything on my end.`,
      'If this was an intentional move — a purchase, a transfer, or a planned withdrawal — no action is needed and I will note it. If it was unexpected, let me know and we will look into it together right away.',
      'Either way, your plan is in good shape. Just keeping a close eye, as always.',
      sign,
    ].join('\n\n'),
  }),
  'condition-chase': ({ record, firstName, sign }) => ({
    subject: 'One item left to keep your loan on track',
    body: [
      `Hi ${firstName},`,
      `Good news — your file is nearly cleared to close. Underwriting just needs one more item from you: ${conditionLabel(record)}.`,
      'Sending that over in the next day or two keeps everything on schedule and protects your rate lock. You can reply here with a photo or PDF and I will take it from there.',
      'You are almost at the finish line.',
      sign,
    ].join('\n\n'),
  }),
  'coi-reply': ({ record, firstName, sign }) => ({
    subject: 'Your certificate of insurance is on the way',
    body: [
      `Hi ${firstName},`,
      'Thanks for the request. I am preparing your certificate of insurance now, with the additional insured listed exactly as you asked.',
      'I will have the finished certificate to you shortly so there is no hold-up on your start date. If anything on the holder or additional-insured language needs to change, just let me know.',
      'Glad to keep this moving for you.',
      sign,
    ].join('\n\n'),
  }),
  'late-rent-reminder': ({ record, firstName, sign }) => ({
    subject: 'Friendly reminder about this month’s rent',
    body: [
      `Hi ${firstName},`,
      `Just a gentle note that this month's rent${money(record.amountUsd)} came due and we have not seen it yet. I know things slip by — no worries at all.`,
      'Whenever you get a chance, you can pay the usual way and we will mark it received. If anything has come up, reach out and we will work it through together.',
      'Thanks, and appreciate you.',
      sign,
    ].join('\n\n'),
  }),
  'missing-doc-flag': ({ record, firstName, sign }) => ({
    subject: 'One document needed to keep the closing on schedule',
    body: [
      `Hi ${firstName},`,
      `We are putting the final file together for ${closingLabel(record)} and there is one item still outstanding: ${docLabel(record)}.`,
      'Getting that to us in the next day or two keeps the closing on schedule for all parties. If it is already on the way, just let me know and I will watch for it.',
      'Thanks for the quick turn — almost there.',
      sign,
    ].join('\n\n'),
  }),
  'invoice-chase': ({ record, firstName, sign }) => ({
    subject: `Quick reminder on invoice${invoiceNumber(record)}`,
    body: [
      `Hi ${firstName},`,
      `Hope all is well. This is a friendly reminder that invoice${invoiceNumber(record)}${money(record.amountUsd)} is now past due.`,
      'If it is already scheduled to go out, please disregard — and thank you. Otherwise, whenever you have a moment to send it over, I would appreciate it. Happy to resend the invoice or answer any questions.',
      'Thanks for your business.',
      sign,
    ].join('\n\n'),
  }),
};

// ─── Small pure helpers (template fillers) ──────────────────────────────────

function firstNameOf(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return 'there';
  // Org-style names ("Sunbelt Contractors", "Greenwood HOA") read better whole.
  if (/\b(LLC|Inc|HOA|Bank|Staffing|Mgmt|Management|Contractors|Catering|Auto|Surveying|Sons|Holdings|Trust)\b/i.test(trimmed)) {
    return trimmed;
  }
  const first = trimmed.split(/\s+/)[0] ?? trimmed;
  return first;
}

function money(amount: number | undefined): string {
  if (typeof amount !== 'number') return '';
  return ` ($${amount.toLocaleString('en-US')})`;
}

function listingName(record: DemoRecord): string {
  const line = record.contextLines.find((l) => /Asked:/i.test(l));
  const m = line?.match(/Is\s+(.+?)\s+still/i);
  if (m) return m[1];
  return 'the listing you asked about';
}

function jobLabel(record: DemoRecord): string {
  // "$4,200 roof repair — sent 6 days ago" → "roof repair"
  const m = record.summary.match(/\$[\d,]+\s+(.+?)(?:\s+—|\s+-|,|$)/);
  if (m) return m[1].trim();
  return 'job';
}

function receiptList(record: DemoRecord): string {
  const missing = record.contextLines.find((l) => /^Missing:/i.test(l));
  if (missing) {
    const items = missing.replace(/^Missing:\s*/i, '');
    return items
      // Split on item-separating commas only — NOT commas inside a
      // parenthesised amount like "($1,840)".
      .split(/,\s*(?![^(]*\))/)
      .map((i) => `• ${i}`)
      .join('\n');
  }
  return '• the outstanding expense receipts on file';
}

function conditionLabel(record: DemoRecord): string {
  const cond = record.contextLines.find((l) => /^Condition:/i.test(l));
  if (cond) return cond.replace(/^Condition:\s*/i, '').replace(/\s*\(.*\)\s*$/, '');
  return 'the outstanding underwriting condition';
}

function closingLabel(record: DemoRecord): string {
  const m = record.title.match(/Closing\s+·\s+(.+)$/);
  return m ? m[1] : 'this closing';
}

function docLabel(record: DemoRecord): string {
  const missing = record.contextLines.find((l) => /^Missing:/i.test(l));
  if (missing) return missing.replace(/^Missing:\s*/i, '');
  return 'the outstanding document';
}

function invoiceNumber(record: DemoRecord): string {
  const m = record.title.match(/#(\d+)/);
  return m ? ` #${m[1]}` : '';
}

export const __testing = {
  DEMO_DATASETS,
  GENERAL_DATASET,
};
