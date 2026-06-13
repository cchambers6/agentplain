/**
 * lib/reports/vertical-outcomes.ts
 *
 * Per-vertical OUTCOME phrasing for the weekly customer report email.
 *
 * The value ledger (`lib/measurement/value-impact`) speaks in approval
 * KINDS and hours/dollars. An SMB owner reading their Friday email does not
 * think in "FOLLOW_UP_NUDGE" or "LEAD_TRIAGE" — they think in the language
 * of their trade: rent chased, invoices sent, showings booked, conflicts
 * screened. This module is the ONE place that translates the kind-level
 * aggregates into a handful of vertical-specific outcome lines.
 *
 * Pure + DB-free: it takes already-aggregated per-kind counts and returns
 * display strings. The data layer (`weekly-report-data`) owns the reads.
 *
 * Honesty rules this module obeys:
 *   - `project_no_outbound_architecture.md`: agentplain DRAFTS and CHASES;
 *     the customer's own system does the sending/booking. Copy therefore
 *     says "drafted", "prepared", "chased" — never "sent" or "collected".
 *   - `feedback_no_guesses_no_estimates.md`: a dollar figure only appears
 *     when a real invoice/estimate amount was carried on the payload (the
 *     `realDollars` sum). We never fabricate a dollar outcome from the
 *     time-based labor estimate here — that lives in the ledger section,
 *     clearly labelled.
 *   - Only outcomes with a non-zero count render. A vertical with no
 *     matching activity contributes nothing (the email omits the section).
 */

import type { Vertical, WorkApprovalKind } from '@prisma/client';

/** One aggregated row per approval kind, for the reported week. */
export interface KindAggregate {
  kind: WorkApprovalKind;
  /** Items of this kind Plaino drafted (proposed) during the week. */
  drafted: number;
  /** Sum of REAL invoice/estimate dollar amounts carried on the payloads
   *  of this kind's items this week (0 when none carried a real amount). */
  realDollarsSum: number;
}

/** A single owner-facing outcome line. */
export interface VerticalOutcome {
  /** The headline phrase, e.g. "$4,200 in outstanding rent chased". */
  label: string;
  /** Optional supporting clause shown in a lighter weight. */
  detail?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────

function plural(n: number, one: string, many = `${one}s`): string {
  return n === 1 ? one : many;
}

function usd(n: number): string {
  return `$${Math.round(n).toLocaleString('en-US')}`;
}

/** Read one kind's drafted count out of the aggregate map (0 when absent). */
function drafted(map: Map<WorkApprovalKind, KindAggregate>, kind: WorkApprovalKind): number {
  return map.get(kind)?.drafted ?? 0;
}

/** Sum the real-dollar amounts carried across one or more kinds. */
function dollars(
  map: Map<WorkApprovalKind, KindAggregate>,
  kinds: WorkApprovalKind[],
): number {
  return kinds.reduce((acc, k) => acc + (map.get(k)?.realDollarsSum ?? 0), 0);
}

// ── Per-vertical builders ───────────────────────────────────────────────────
//
// Each builder reads the kind aggregates relevant to its trade and returns
// the outcome lines that have activity. Kinds that don't map to a vertical-
// specific phrase fall through to the generic builder (so nothing is lost).

type Builder = (map: Map<WorkApprovalKind, KindAggregate>) => VerticalOutcome[];

const realEstate: Builder = (m) => {
  const out: VerticalOutcome[] = [];
  const leads = drafted(m, 'LEAD_TRIAGE');
  if (leads > 0) {
    out.push({
      label: `${leads} new ${plural(leads, 'lead')} triaged`,
      detail: `Plaino scored intent and drafted a first-touch reply for each.`,
    });
  }
  const inquiries = drafted(m, 'BUYER_INQUIRY_REPLY_DRAFT');
  if (inquiries > 0) {
    out.push({
      label: `${inquiries} buyer ${plural(inquiries, 'inquiry', 'inquiries')} answered`,
      detail: `A warm reply drafted and waiting for your sign-off.`,
    });
  }
  const listings = drafted(m, 'LISTING_RECOMMENDATION');
  if (listings > 0) {
    out.push({ label: `${listings} listing ${plural(listings, 'recommendation')} prepared` });
  }
  const pricing = drafted(m, 'PRICING_RECOMMENDATION');
  if (pricing > 0) {
    out.push({ label: `${pricing} pricing ${plural(pricing, 'recommendation')} drafted` });
  }
  return out;
};

const propertyManagement: Builder = (m) => {
  const out: VerticalOutcome[] = [];
  const nudges = drafted(m, 'FOLLOW_UP_NUDGE');
  const rent = dollars(m, ['FOLLOW_UP_NUDGE']);
  if (rent > 0) {
    out.push({
      label: `${usd(rent)} in outstanding rent chased`,
      detail: `Across ${nudges} ${plural(nudges, 'reminder')} drafted for your tenants.`,
    });
  } else if (nudges > 0) {
    out.push({ label: `${nudges} rent ${plural(nudges, 'reminder')} drafted` });
  }
  return out;
};

const cpa: Builder = (m) => {
  const out: VerticalOutcome[] = [];
  const nudges = drafted(m, 'FOLLOW_UP_NUDGE');
  const ar = dollars(m, ['FOLLOW_UP_NUDGE']);
  if (ar > 0) {
    out.push({
      label: `${usd(ar)} in receivables chased`,
      detail: `${nudges} invoice ${plural(nudges, 'follow-up')} drafted, ready to send.`,
    });
  } else if (nudges > 0) {
    out.push({ label: `${nudges} invoice ${plural(nudges, 'follow-up')} drafted` });
  }
  const finance = drafted(m, 'FINANCE_PULSE');
  if (finance > 0) {
    out.push({
      label: `${finance} finance ${plural(finance, 'pulse')} prepared`,
      detail: `Your AR aging and open-invoice picture, summarized.`,
    });
  }
  return out;
};

const homeServices: Builder = (m) => {
  const out: VerticalOutcome[] = [];
  const nudges = drafted(m, 'FOLLOW_UP_NUDGE');
  const quotes = dollars(m, ['FOLLOW_UP_NUDGE']);
  if (quotes > 0) {
    out.push({
      label: `${usd(quotes)} in open estimates chased`,
      detail: `${nudges} estimate ${plural(nudges, 'follow-up')} drafted for prospects who haven't booked yet.`,
    });
  } else if (nudges > 0) {
    out.push({ label: `${nudges} estimate ${plural(nudges, 'follow-up')} drafted` });
  }
  return out;
};

const law: Builder = (m) => {
  const out: VerticalOutcome[] = [];
  const compliance = drafted(m, 'COMPLIANCE_FLAG') + drafted(m, 'COMPLIANCE_DIGEST');
  if (compliance > 0) {
    out.push({
      label: `${compliance} ${plural(compliance, 'matter')} screened for risk`,
      detail: `Conflicts and disclosure gaps flagged before they reach a client.`,
    });
  }
  const research = drafted(m, 'RESEARCH_BRIEF');
  if (research > 0) {
    out.push({ label: `${research} research ${plural(research, 'brief')} drafted` });
  }
  return out;
};

// ── Generic builder (every vertical, for kinds without a trade phrase) ───────

const GENERIC_KIND_PHRASES: Partial<
  Record<WorkApprovalKind, (n: number) => VerticalOutcome>
> = {
  INBOX_TRIAGE: (n) => ({
    label: `${n} inbox ${plural(n, 'message')} triaged`,
    detail: `Sorted, prioritized, and drafted where a reply was needed.`,
  }),
  PROCESS_DOC_DRAFT: (n) => ({
    label: `${n} process ${plural(n, 'doc')} drafted`,
  }),
  CHIEF_OF_STAFF_MEETING: (n) => ({
    label: `${n} ${plural(n, 'meeting')} scheduled`,
    detail: `Slot proposals drafted for your calendar.`,
  }),
  CHIEF_OF_STAFF_REPLY_DRAFT: (n) => ({
    label: `${n} ${plural(n, 'reply')} drafted for you`,
  }),
  SUPPORT_HANDLER_REPLY_DRAFT: (n) => ({
    label: `${n} support ${plural(n, 'request')} answered`,
  }),
  CONTENT_CALENDAR: (n) => ({
    label: `${n} content ${plural(n, 'plan')} prepared`,
  }),
};

const VERTICAL_BUILDERS: Partial<Record<Vertical, Builder>> = {
  REAL_ESTATE: realEstate,
  PROPERTY_MANAGEMENT: propertyManagement,
  CPA: cpa,
  HOME_SERVICES: homeServices,
  LAW: law,
};

/** Kinds the vertical-specific builders already consume — so the generic
 *  pass doesn't double-count them. */
const VERTICAL_OWNED_KINDS: Partial<Record<Vertical, Set<WorkApprovalKind>>> = {
  REAL_ESTATE: new Set([
    'LEAD_TRIAGE',
    'BUYER_INQUIRY_REPLY_DRAFT',
    'LISTING_RECOMMENDATION',
    'PRICING_RECOMMENDATION',
  ]),
  PROPERTY_MANAGEMENT: new Set(['FOLLOW_UP_NUDGE']),
  CPA: new Set(['FOLLOW_UP_NUDGE', 'FINANCE_PULSE']),
  HOME_SERVICES: new Set(['FOLLOW_UP_NUDGE']),
  LAW: new Set(['COMPLIANCE_FLAG', 'COMPLIANCE_DIGEST', 'RESEARCH_BRIEF']),
};

/**
 * Build the owner-facing outcome lines for a vertical from the week's
 * per-kind aggregates. Vertical-specific lines first (the trade language),
 * then a generic pass for any remaining kind with activity that the
 * vertical builder didn't already claim. Returns [] for a quiet week.
 */
export function buildVerticalOutcomes(
  vertical: Vertical,
  aggregates: Map<WorkApprovalKind, KindAggregate>,
): VerticalOutcome[] {
  const builder = VERTICAL_BUILDERS[vertical];
  const owned = VERTICAL_OWNED_KINDS[vertical] ?? new Set<WorkApprovalKind>();
  const out: VerticalOutcome[] = builder ? builder(aggregates) : [];

  // Generic pass — only kinds the vertical builder didn't already cover.
  for (const [kind, agg] of aggregates) {
    if (agg.drafted <= 0) continue;
    if (owned.has(kind)) continue;
    const phrase = GENERIC_KIND_PHRASES[kind];
    if (phrase) out.push(phrase(agg.drafted));
  }

  return out;
}
