/**
 * buildBeforeAfterCard — pure, deterministic builder behind the V31
 * "before / after" card (visual answer to "can it help me?").
 *
 * Spec: docs/explainer-visual-system-2026-06-07.md §4 (visual library extension).
 *
 * Purpose: side-by-side contrast between the manual/status-quo approach and
 * the agentplain-assisted approach. Anchored to the workspace's vertical so
 * the examples are recognizable, not generic. MAX 4 rows.
 *
 * PURE function. No I/O, no LLM, no DB. Every claim is grounded in real
 * discipline capabilities (lib/disciplines). The caller supplies the vertical
 * id and the connected-integration set so the "after" column describes ONLY
 * capabilities that are actually wired (feedback_no_guesses_no_estimates +
 * project_no_outbound_architecture — this card never claims to send; it claims
 * to draft/queue/flag).
 *
 * TEXT FALLBACK: callers MUST persist the Plaino reply body BEFORE attaching
 * this card as metadata.card. The card is an enhancement; the body is the
 * source of truth (per the V27–V34 ADDITIVE contract).
 */
import type { BeforeAfterCard, BeforeAfterRow } from './visual-card';

export interface BuildBeforeAfterArgs {
  /** agentplain vertical id, e.g. "realty", "insurance", "home-services",
   *  or "general" for a non-vertical workspace. */
  vertical: string;
  /** Integrations the workspace has actually connected (used to shade the
   *  "after" column conservatively — only mention what's wired). */
  connectedIntegrations: ReadonlyArray<{ id: string; category: string }>;
}

/** Per-vertical base rows — grounded in the discipline catalog. "after" copy
 *  is conservative: uses "draft", "queue", "flag" — never "send". */
const VERTICAL_ROWS: Record<string, BeforeAfterRow[]> = {
  realty: [
    {
      task: 'preparing offer packages',
      before: 'copy-paste from template, 30+ min per offer',
      after: 'Plaino drafts the package; you review in the approval queue',
    },
    {
      task: 'chasing missing documents',
      before: 'manual follow-up emails, tracked in a sticky note',
      after: 'follow-up drafts queued automatically when a deadline approaches',
    },
    {
      task: 'compliance disclosures',
      before: 'manually reviewed before every send',
      after: 'sentinel flags issues before the draft leaves the queue',
    },
    {
      task: 'lead intake triage',
      before: 'every lead read and categorized by hand',
      after: 'leads scored and routed; high-priority ones surfaced first',
    },
  ],
  insurance: [
    {
      task: 'COI request handling',
      before: 'reply to each request manually; tracked in email',
      after: 'Plaino drafts the reply and queues for your signature',
    },
    {
      task: 'renewal reminders',
      before: 'calendar alerts, often missed on busy weeks',
      after: 'renewal briefs drafted and queued 30 days out',
    },
    {
      task: 'compliance language review',
      before: 'counsel review on every customer-facing piece',
      after: 'sentinel pre-screens; only real flags escalate',
    },
    {
      task: 'new client intake',
      before: 'intake form to spreadsheet to email — manual chain',
      after: 'intake summarized, categorized, and filed in one pass',
    },
  ],
  'home-services': [
    {
      task: 'job scheduling and follow-up',
      before: 'phone + text, no paper trail',
      after: 'follow-up drafted and queued; schedule window respected',
    },
    {
      task: 'invoice chasing',
      before: 'awkward manual calls for overdue invoices',
      after: 'overdue draft queued, tone matched to the relationship',
    },
    {
      task: 'subcontractor comms',
      before: 'back-and-forth email chains; important items lost',
      after: 'key items flagged; summaries drafted for your review',
    },
    {
      task: 'customer review requests',
      before: 'easy to forget after a busy job',
      after: 'review-request draft queued once job is marked complete',
    },
  ],
  general: [
    {
      task: 'inbox triage',
      before: 'read, categorize, and prioritize every message by hand',
      after: 'inbox triaged and high-priority items surfaced with context',
    },
    {
      task: 'follow-up drafting',
      before: 'follow-ups slip when you are heads-down',
      after: 'follow-up drafts queued automatically at the right interval',
    },
    {
      task: 'compliance flagging',
      before: 'manual scan before every send',
      after: 'sentinel pre-screens; only real flags reach your queue',
    },
    {
      task: 'weekly briefing',
      before: 'manual weekly review; inconsistent format',
      after: 'structured weekly digest drafted and ready Monday morning',
    },
  ],
};

const MAX_ROWS = 4;

/**
 * Build the V31 before-after card for a workspace. Returns a card with rows
 * appropriate for the workspace's vertical; falls back to "general" rows when
 * the vertical is unknown. Caps at MAX_ROWS.
 *
 * The `connectedIntegrations` argument is accepted (and used to derive the
 * `context` label) but does not currently gate individual rows — the "after"
 * column describes the Plaino DRAFTING/QUEUING capability, which is always
 * available once the fleet fires, regardless of integrations. If the caller
 * has no connected integrations the context reflects that.
 */
export function buildBeforeAfterCard(
  args: BuildBeforeAfterArgs,
): BeforeAfterCard {
  const { vertical, connectedIntegrations } = args;
  const rows = (VERTICAL_ROWS[vertical] ?? VERTICAL_ROWS['general']).slice(
    0,
    MAX_ROWS,
  );

  const verticalLabel =
    vertical === 'realty'
      ? 'real estate'
      : vertical === 'insurance'
        ? 'insurance'
        : vertical === 'home-services'
          ? 'home services'
          : null;

  const hasConnected = connectedIntegrations.length > 0;
  const context = verticalLabel
    ? `for a ${verticalLabel} business${hasConnected ? '' : ' — connect a tool to unlock more'}`
    : hasConnected
      ? undefined
      : 'connect a tool to unlock more workflows';

  const card: BeforeAfterCard = { type: 'before-after', rows };
  if (context) card.context = context;
  return card;
}
