/**
 * lib/skills/invoice-chase-general/skill.ts
 *
 * General-vertical QuickBooks AR invoice-chase skill.
 *
 * End-to-end loop:
 *   1. Fetch overdue AR invoices from QuickBooks (via ArAgingFetcher).
 *   2. Escalate tone by days-overdue bucket:
 *        gentle  < 15 days  — warm check-in
 *        firm    15-45 days — direct ask, offer to help
 *        final   45+ days  — explicit deadline + next-step placeholder
 *   3. Build deterministic template drafts (NO LLM required — works with
 *      ANTHROPIC_API_KEY paused or absent; LLM-polish is flag-gated and
 *      always falls back to templates).
 *   4. Sink each draft as a FOLLOW_UP_NUDGE approval item. FOLLOW_UP_NUDGE
 *      is on the bounded-execute allowlist, so when the master switch is
 *      flipped ON these auto-approve without owner intervention.
 *   5. Each approval payload carries `balanceUsd` so the value ledger can
 *      surface the AR dollars influenced.
 *
 * Hard rules:
 *   - NEVER calls `messages.send` or any outbound path.
 *   - Template path is the DEFAULT. LLM-polish only runs when
 *     `USE_LLM_POLISH=on` AND the LLM call succeeds; on any failure the
 *     skill falls back to the template body silently.
 *   - Cold-start safe: reads the AR snapshot on every call.
 *   - No vendor SDK call in this file — only the ArAgingFetcher port.
 *
 * Per `project_no_outbound_architecture.md`, `feedback_no_silent_vendor_lock.md`,
 * `feedback_cold_start_safe_agents.md`, `feedback_no_quick_fixes.md`.
 */

import { randomUUID } from 'node:crypto';
import { skillOk, type SkillResult } from '../types';
import {
  DEFAULT_MAX_DRAFTS_PER_RUN,
  DEFAULT_SINK_THRESHOLD,
  type ArInvoiceRecord,
  type ChaseEscalationTier,
  type InvoiceChaseInput,
  type InvoiceChaseOutput,
  type InvoiceChaseDraft,
} from './types';

const NO_OUTBOUND_NOTE =
  'No emails sent. Every invoice-chase draft is staged as a FOLLOW_UP_NUDGE approval ' +
  'item (PENDING). The owner approves and their own email client sends. ' +
  'Per project_no_outbound_architecture.md.';

const MS_PER_DAY = 86_400_000;

export async function runSkill(
  input: InvoiceChaseInput,
): Promise<SkillResult<InvoiceChaseOutput>> {
  const now = input.now ?? new Date();
  const maxDrafts = input.maxDraftsPerRun ?? DEFAULT_MAX_DRAFTS_PER_RUN;
  const sinkThreshold = input.sinkThreshold ?? DEFAULT_SINK_THRESHOLD;

  // 1. Fetch overdue AR invoices.
  const fetchRes = await input.fetcher.fetchOverdueInvoices({
    workspaceId: input.workspaceId,
    asOf: now,
    count: maxDrafts * 2, // fetch a buffer; we'll cap after drafting
  });
  if (!fetchRes.ok) {
    // NOT_CONFIGURED bubbles through — the cron sweep treats it as a
    // clean skip ("connect QuickBooks").
    return { ok: false, error: fetchRes.error };
  }
  const invoices = fetchRes.value;

  // Cap to maxDrafts (oldest-overdue first; fetcher already sorted).
  const capped = invoices.slice(0, maxDrafts);

  // 2 + 3. Build drafts from templates.
  const drafts: InvoiceChaseDraft[] = capped.map((inv) =>
    buildDraft({ invoice: inv, now, thresholds: input.thresholds }),
  );

  // 4. Sink drafts into the approval queue.
  let sunk = 0;
  if (input.sink) {
    for (const draft of drafts) {
      if (draft.confidence < sinkThreshold) continue;
      const res = await input.sink.record({
        workspaceId: input.workspaceId,
        draft,
      });
      if (res.ok) sunk += 1;
    }
  }

  // 5. Sum up the total balance being chased this run.
  const totalBalanceUsd = drafts.reduce((sum, d) => sum + d.balanceUsd, 0);

  return skillOk({
    asOf: now.toISOString(),
    invoicesConsidered: invoices.length,
    draftsStaged: sunk,
    totalBalanceUsd: roundTo(totalBalanceUsd, 2),
    drafts,
    noOutboundNote: NO_OUTBOUND_NOTE,
  });
}

// ── Draft building ────────────────────────────────────────────────────────────

interface BuildDraftArgs {
  invoice: ArInvoiceRecord;
  now: Date;
  thresholds?: InvoiceChaseInput['thresholds'];
}

function buildDraft(args: BuildDraftArgs): InvoiceChaseDraft {
  const { invoice } = args;
  const { tier, daysOverdue } = invoice;
  const balanceFmt = formatUsd(invoice.balanceUsd);
  const docLabel = invoice.docNumber ? `Invoice #${invoice.docNumber}` : 'your open invoice';
  const firstName =
    invoice.customerName?.split(/\s+/)[0] ?? '{{operator: first name}}';
  const greeting = `Hi ${firstName},`;
  const subject = buildSubject({ tier, docLabel, daysOverdue });
  const body = buildBody({ invoice, tier, daysOverdue, balanceFmt, docLabel, greeting });

  // Confidence: gentle = high (routine nudge), firm = medium (needs review),
  // final = lower (operator should verify before this goes out).
  const confidence = tier === 'gentle' ? 0.80 : tier === 'firm' ? 0.65 : 0.50;

  return {
    draftId: randomUUID(),
    invoiceId: invoice.invoiceId,
    docNumber: invoice.docNumber,
    customerName: invoice.customerName,
    customerEmail: invoice.customerEmail,
    balanceUsd: invoice.balanceUsd,
    daysOverdue,
    tier,
    subject,
    body,
    confidence,
    reasoning:
      `${docLabel} for ${balanceFmt} is ${daysOverdue} day${daysOverdue === 1 ? '' : 's'} ` +
      `overdue (tier: ${tier}). Drafted without LLM — template path. noOutbound: staged, not sent.`,
  };
}

function buildSubject(args: {
  tier: ChaseEscalationTier;
  docLabel: string;
  daysOverdue: number;
}): string {
  const { tier, docLabel } = args;
  switch (tier) {
    case 'gentle':
      return `Quick check-in: ${docLabel}`;
    case 'firm':
      return `Following up: ${docLabel} — past due`;
    case 'final':
      return `${docLabel} — action required`;
  }
}

interface BuildBodyArgs {
  invoice: ArInvoiceRecord;
  tier: ChaseEscalationTier;
  daysOverdue: number;
  balanceFmt: string;
  docLabel: string;
  greeting: string;
}

function buildBody(a: BuildBodyArgs): string {
  const { tier, daysOverdue, balanceFmt, docLabel, greeting } = a;
  const dayWord = `${daysOverdue} day${daysOverdue === 1 ? '' : 's'}`;
  const dueLine = `${docLabel} for ${balanceFmt} is now ${dayWord} past due.`;

  switch (tier) {
    case 'gentle':
      return [
        greeting,
        '',
        `Wanted to circle back — ${dueLine}`,
        '',
        "If payment is already in flight, please disregard this and feel free to send " +
          'over the confirmation when you get a moment.',
        '',
        '{{operator: any additional context — e.g. payment link, reference number}}',
        '',
        'Thanks for keeping this moving.',
        '',
        '{{operator: signature}}',
      ].join('\n');

    case 'firm':
      return [
        greeting,
        '',
        `Following up on ${docLabel}. ${dueLine}`,
        '',
        "Could you let me know the status on your end — is payment on the way, " +
          'on hold, or is there something we should address on our side? ' +
          "I'm happy to work with you on timing if something came up.",
        '',
        '{{operator: any additional context — e.g. payment portal link, account contact}}',
        '',
        'Looking forward to hearing from you.',
        '',
        '{{operator: signature}}',
      ].join('\n');

    case 'final':
      return [
        greeting,
        '',
        `This is a follow-up on ${docLabel}. ${dueLine}`,
        '',
        'Please confirm a payment date by {{operator: reply deadline, e.g. "Friday, June 13"}} ' +
          'or let us know if there is a dispute we need to resolve. ' +
          "If we don't hear back, our next step will be to {{operator: next action — " +
          'e.g. refer to collections / notify counsel / place a hold on services}}.',
        '',
        '{{operator: any additional context — e.g. escalation contact, reference docs}}',
        '',
        'Regards,',
        '',
        '{{operator: signature}}',
      ].join('\n');
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatUsd(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function roundTo(n: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(n * factor) / factor;
}

export const __testing = { buildDraft };
