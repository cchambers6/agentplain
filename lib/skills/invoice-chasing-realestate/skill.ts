/**
 * lib/skills/invoice-chasing-realestate/skill.ts
 *
 * Vertical-specific workflow: chase unpaid commission invoices for a
 * real-estate brokerage. The skill's job is to surface what needs to
 * happen — bucket invoices by days outstanding, draft tier-appropriate
 * reminders, and (optionally) park drafts in the broker's email-drafts
 * folder for review.
 *
 * Per `project_no_outbound_architecture.md`: this skill DRAFTS. The
 * broker's own system sends. The skill's `persister` parameter is a
 * `DraftPersister` (the same port `lib/skills/draft.ts` uses) — the
 * production binding writes a Gmail or Outlook draft; nothing in this
 * file ever calls `messages.send` or its equivalent.
 *
 * Per `feedback_no_silent_vendor_lock.md`: QuickBooks / Follow Up Boss /
 * Gmail SDK calls do NOT appear in this file. The skill speaks the
 * `InvoiceFetcher` + `DraftPersister` ports defined in `./types.ts` and
 * `../types.ts`.
 *
 * Per `feedback_no_quick_fixes.md`: this skill produces an end-to-end
 * functional output on the inputs it accepts. The body templates are
 * vertical-aware real-estate language (commission, closing, broker /
 * title / cooperating-broker counterparties) — not a generic dunning
 * reminder.
 */

import { randomUUID } from 'node:crypto';
import { skillError, skillOk, type DraftPersister, type SkillResult } from '../types';
import {
  bucketTier,
  type ContactRecord,
  type FollowUpTier,
  type InvoiceChasingDraft,
  type InvoiceChasingInput,
  type InvoiceChasingOutput,
  type InvoiceFollowUp,
  type InvoiceRecord,
  type SkipReason,
} from './types';

const DEFAULT_PERSIST_THRESHOLD = 0.5;
const MS_PER_DAY = 86_400_000;

export async function runSkill(
  input: InvoiceChasingInput,
): Promise<SkillResult<InvoiceChasingOutput>> {
  const now = input.now ?? new Date();
  const persistThreshold = input.persistThreshold ?? DEFAULT_PERSIST_THRESHOLD;

  const invoicesRes = await input.fetcher.fetchOpenInvoices({
    workspaceId: input.workspaceId,
  });
  if (!invoicesRes.ok) {
    return skillError(
      'UPSTREAM_GMAIL_ERROR',
      `invoice fetcher (${input.fetcher.name}) failed: ${invoicesRes.error.message}`,
      invoicesRes.error.code,
    );
  }
  const invoices = invoicesRes.value;

  // First pass: skip invoices that don't need chasing. Collect contact
  // ids for the survivors so we can hydrate recipients in a single call.
  const survivors: InvoiceRecord[] = [];
  const skipped: SkipReason[] = [];
  for (const inv of invoices) {
    if (inv.status === 'paid') {
      skipped.push({ kind: 'paid', invoiceId: inv.id });
      continue;
    }
    if (inv.status === 'void' || inv.status === 'disputed') {
      skipped.push({
        kind: 'void-or-disputed',
        invoiceId: inv.id,
        reason: `status=${inv.status} — operator handles directly`,
      });
      continue;
    }
    if (inv.negotiatedExtensionUntil && inv.negotiatedExtensionUntil > now) {
      skipped.push({
        kind: 'negotiated-extension',
        invoiceId: inv.id,
        until: inv.negotiatedExtensionUntil.toISOString(),
      });
      continue;
    }
    if (inv.dueAt > now) {
      skipped.push({
        kind: 'not-yet-due',
        invoiceId: inv.id,
        dueAt: inv.dueAt.toISOString(),
      });
      continue;
    }
    survivors.push(inv);
  }

  // Hydrate contacts.
  const neededContactIds = Array.from(new Set(survivors.map((i) => i.contactId)));
  const contactsRes =
    neededContactIds.length === 0
      ? { ok: true as const, value: {} as Record<string, ContactRecord> }
      : await input.fetcher.fetchContactsByIds({
          workspaceId: input.workspaceId,
          contactIds: neededContactIds,
        });
  if (!contactsRes.ok) {
    return skillError(
      'UPSTREAM_GMAIL_ERROR',
      `contact fetch failed: ${contactsRes.error.message}`,
      contactsRes.error.code,
    );
  }
  const contacts = contactsRes.value;

  // Second pass: bucket + draft for each survivor.
  const followUps: InvoiceFollowUp[] = [];
  for (const inv of survivors) {
    const contact = contacts[inv.contactId];
    if (!contact) {
      skipped.push({
        kind: 'missing-contact',
        invoiceId: inv.id,
        contactId: inv.contactId,
      });
      continue;
    }
    const daysOutstanding = daysBetween(inv.dueAt, now);
    const tier = bucketTier(daysOutstanding, input.thresholds);
    const draft = renderReminderDraft({
      invoice: inv,
      contact,
      tier,
      daysOutstanding,
    });
    const followUp: InvoiceFollowUp = {
      invoiceId: inv.id,
      invoiceNumber: inv.invoiceNumber,
      closingReference: inv.closingReference,
      amountCents: inv.amountCents,
      daysOutstanding,
      tier,
      recipient: {
        contactId: contact.id,
        name: contact.name,
        email: contact.email,
        kind: contact.kind,
      },
      draft,
    };
    if (input.persister && draft.confidence >= persistThreshold) {
      const persisted = await persistDraft(input.persister, {
        workspaceId: input.workspaceId,
        contact,
        invoice: inv,
        draft,
      });
      followUp.draft = persisted;
    }
    followUps.push(followUp);
  }

  const bucketCounts: Record<FollowUpTier, number> = { warm: 0, firm: 0, escalate: 0 };
  for (const f of followUps) bucketCounts[f.tier] += 1;

  return skillOk({
    processed: invoices.length,
    followUps,
    skipped,
    bucketCounts,
  });
}

// ── Draft rendering ─────────────────────────────────────────────────────

interface RenderDraftArgs {
  invoice: InvoiceRecord;
  contact: ContactRecord;
  tier: FollowUpTier;
  daysOutstanding: number;
}

function renderReminderDraft(args: RenderDraftArgs): InvoiceChasingDraft {
  const { invoice, contact, tier, daysOutstanding } = args;
  const amount = formatMoney(invoice.amountCents, invoice.currency);
  const closing = invoice.closingReference || '{{operator: closing reference}}';
  const greeting = pickGreeting(contact, tier);
  const signoff = pickSignoff(tier);
  const body = renderBody({
    tier,
    contact,
    invoice,
    amount,
    closing,
    daysOutstanding,
    greeting,
    signoff,
  });
  const subject = renderSubject({ tier, invoice, closing });
  const tone: InvoiceChasingDraft['tone'] = tier === 'escalate' ? 'formal' : 'casual';
  // Confidence high for our two clean buckets (warm/firm); lower for
  // escalate so the operator reviews before sending (per the no-outbound
  // architecture: legal-adjacent escalations need a human eye).
  const confidence = tier === 'escalate' ? 0.55 : 0.78;
  return {
    draftId: randomUUID(),
    providerDraftId: null,
    subject,
    body,
    tone,
    confidence,
    persisted: false,
  };
}

function renderSubject(args: {
  tier: FollowUpTier;
  invoice: InvoiceRecord;
  closing: string;
}): string {
  const { tier, invoice, closing } = args;
  const ref = `${invoice.invoiceNumber} — ${closing}`;
  switch (tier) {
    case 'warm':
      return `Quick check-in on commission invoice ${ref}`;
    case 'firm':
      return `Following up: commission invoice ${ref}`;
    case 'escalate':
      return `Past-due commission invoice ${ref} — please advise`;
  }
}

interface RenderBodyArgs {
  tier: FollowUpTier;
  contact: ContactRecord;
  invoice: InvoiceRecord;
  amount: string;
  closing: string;
  daysOutstanding: number;
  greeting: string;
  signoff: string;
}

function renderBody(a: RenderBodyArgs): string {
  // Three vertical-aware templates. Real-estate language: commission,
  // closing, broker, title company, cooperating broker. No mention of
  // "dunning" or generic AR terminology — keeps the tone broker-to-
  // counterparty, not collections-agency-to-debtor.
  const closingLine = `closing on ${a.closing}`;
  switch (a.tier) {
    case 'warm':
      return [
        a.greeting,
        '',
        `Wanted to circle back on the commission invoice for the ${closingLine}.`,
        `Invoice ${a.invoice.invoiceNumber} for ${a.amount} was due ${a.daysOutstanding} ` +
          `day${pluralize(a.daysOutstanding)} ago. If it has already gone out, please ` +
          'disregard this — and feel free to forward the confirmation when you get a moment.',
        '',
        countepartyAck(a.contact.kind, 'warm'),
        '',
        a.signoff,
        '{{operator: signature}}',
      ].join('\n');
    case 'firm':
      return [
        a.greeting,
        '',
        `Following up again on the commission invoice for the ${closingLine}. ` +
          `Invoice ${a.invoice.invoiceNumber} for ${a.amount} is now ${a.daysOutstanding} ` +
          'days past due.',
        '',
        'Could you confirm the status on your end — payment in flight, on hold, or ' +
          'pending something we should know about? Happy to work with you on timing ' +
          'if there is a hold-up on the file.',
        '',
        countepartyAck(a.contact.kind, 'firm'),
        '',
        a.signoff,
        '{{operator: signature}}',
      ].join('\n');
    case 'escalate':
      return [
        a.greeting,
        '',
        `This is a follow-up on commission invoice ${a.invoice.invoiceNumber} for ` +
          `the ${closingLine}, in the amount of ${a.amount}. The invoice is now ` +
          `${a.daysOutstanding} days past due.`,
        '',
        'Please confirm a payment timeline by {{operator: target reply date}} or ' +
          'let us know if there is a dispute we need to address. If we do not hear ' +
          'back, the next step on our side is to {{operator: next-step — e.g. notify ' +
          'brokerage counsel / refer to AR review}}.',
        '',
        countepartyAck(a.contact.kind, 'escalate'),
        '',
        a.signoff,
        '{{operator: signature}}',
      ].join('\n');
  }
}

function pickGreeting(contact: ContactRecord, tier: FollowUpTier): string {
  const firstName = contact.name.split(/\s+/)[0] || '{{operator: first name}}';
  if (tier === 'escalate' || contact.kind === 'attorney') {
    return `Dear ${contact.name},`;
  }
  if (contact.kind === 'title-company' || contact.kind === 'cooperating-broker') {
    return `Hi ${firstName},`;
  }
  return `Hi ${firstName},`;
}

function pickSignoff(tier: FollowUpTier): string {
  if (tier === 'escalate') return 'Regards,';
  return 'Thanks,';
}

function countepartyAck(kind: ContactRecord['kind'], tier: FollowUpTier): string {
  // Real-estate-specific relationship-respecting line. Title companies +
  // cooperating brokers expect a brisk, professional ask; clients get
  // softer wording. Per `lib/skills/prompts/real-estate.ts` tone
  // guidance: "warm but transactional."
  if (tier === 'warm') {
    switch (kind) {
      case 'title-company':
        return 'Appreciate you keeping the closing file tidy on your side.';
      case 'cooperating-broker':
        return 'Thanks for keeping the cooperating side moving on this one.';
      case 'attorney':
        return 'Thanks for your help managing the file.';
      case 'client':
        return 'Thanks again for choosing us for this transaction.';
      default:
        return 'Thanks for the partnership on this file.';
    }
  }
  if (tier === 'firm') {
    switch (kind) {
      case 'title-company':
        return 'Let us know if there is any documentation on our end that would speed this up.';
      case 'cooperating-broker':
        return 'Happy to coordinate with your accounting team directly if that is easier.';
      case 'attorney':
        return 'Let us know whether the firm needs anything else from us to process.';
      case 'client':
        return 'If something on our end needs to change, just let us know.';
      default:
        return 'Let us know how we can help close this out.';
    }
  }
  // escalate
  switch (kind) {
    case 'title-company':
      return 'Please loop in your accounting lead if a separate review is required.';
    case 'cooperating-broker':
      return 'Please include the cooperating brokerage of record on the reply.';
    case 'attorney':
      return 'Please copy the appropriate billing contact on the response.';
    case 'client':
      return 'If there has been a change in circumstances, we would rather hear it directly than escalate.';
    default:
      return 'Please reply with the responsible AR contact for this file.';
  }
}

// ── Persistence ─────────────────────────────────────────────────────────

async function persistDraft(
  persister: DraftPersister,
  args: {
    workspaceId: string;
    contact: ContactRecord;
    invoice: InvoiceRecord;
    draft: InvoiceChasingDraft;
  },
): Promise<InvoiceChasingDraft> {
  // Per `project_no_outbound_architecture.md`: `persistDraft` writes the
  // draft to the broker's email-drafts folder via the provider-neutral
  // port. The broker reviews + sends from their own client. There is no
  // `send` method on this interface.
  const res = await persister.persistDraft({
    workspaceId: args.workspaceId,
    threadId: `invoice-${args.invoice.id}`,
    inReplyToMessageId: null,
    toEmails: [args.contact.email],
    subject: args.draft.subject,
    body: args.draft.body,
  });
  if (!res.ok) {
    return { ...args.draft, persisted: false, providerDraftId: null };
  }
  return {
    ...args.draft,
    persisted: true,
    providerDraftId: res.value.providerDraftId,
  };
}

// ── Helpers ─────────────────────────────────────────────────────────────

function daysBetween(earlier: Date, later: Date): number {
  const diff = later.getTime() - earlier.getTime();
  return Math.max(0, Math.floor(diff / MS_PER_DAY));
}

function formatMoney(cents: number, currency: 'USD'): string {
  const dollars = cents / 100;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(dollars);
}

function pluralize(n: number): string {
  return n === 1 ? '' : 's';
}
