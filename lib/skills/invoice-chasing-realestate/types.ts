/**
 * lib/skills/invoice-chasing-realestate/types.ts
 *
 * Provider-neutral types for the real-estate commission invoice chasing
 * skill. Per `feedback_no_silent_vendor_lock.md` + `feedback_runner_portability.md`:
 * the skill speaks these shapes only — QuickBooks / Follow Up Boss /
 * Gmail SDKs stay behind the ports defined below.
 *
 * Per `project_no_outbound_architecture.md`: the skill produces DRAFTS.
 * It does not send. The customer's system reviews and sends from the
 * broker's own email.
 */

import type { SkillResult } from '../types';

// ── Input shapes ─────────────────────────────────────────────────────────

/**
 * One commission-side invoice the broker is owed. Production wiring
 * populates this from the QuickBooks MCP (TODO: not yet built — the
 * skill accepts the same shape from a JSON import today).
 *
 * Amounts are in cents to match the codebase-wide money convention
 * (see also `lib/billing/`).
 */
export interface InvoiceRecord {
  /** QuickBooks-side stable id. Stub: any string the caller chose. */
  id: string;
  /** Human-readable invoice number (e.g. "INV-2026-04-117"). */
  invoiceNumber: string;
  /** Lower-cased contact id pointing into ContactRecord. */
  contactId: string;
  /** Closing reference (MLS#, address, or transaction id). The reminder
   *  body cites this so the recipient knows which closing the invoice
   *  is for. Empty string when not available. */
  closingReference: string;
  /** Total amount due, in cents. */
  amountCents: number;
  currency: 'USD';
  /** Date the invoice was issued. */
  issuedAt: Date;
  /** Date the invoice is due. */
  dueAt: Date;
  /** Status as reported by QuickBooks (or the JSON import). */
  status: 'open' | 'partial' | 'paid' | 'void' | 'disputed';
  /** Last activity on the invoice (last reminder sent, last payment, etc.). */
  lastActivityAt: Date | null;
  /** When the customer has explicitly negotiated a different timeline,
   *  the broker captures that here so the skill does not chase. */
  negotiatedExtensionUntil: Date | null;
}

/**
 * One contact the broker is invoicing. Production wiring populates this
 * from the Follow Up Boss MCP (TODO: not yet built — the skill accepts
 * the same shape from a JSON import today).
 */
export interface ContactRecord {
  id: string;
  name: string;
  email: string;
  /** Type of counterparty. Drives tone — title companies get firmer
   *  language earlier than relationship-clients do. */
  kind: 'client' | 'title-company' | 'attorney' | 'cooperating-broker' | 'other';
  /** Last known phone number — not used by the skill but available so
   *  the operator can escalate. */
  phone: string | null;
}

/**
 * Provider-neutral port for fetching invoices. The skill takes one of
 * these and asks for "what's open as of now". Production binds the
 * QuickBooks MCP; tests bind `JsonInvoiceFetcher` below.
 *
 * Per `feedback_runner_portability.md` rule 3 (two-implementation rule):
 * this interface ships alongside `JsonInvoiceFetcher`. The
 * `QuickBooksInvoiceFetcher` impl will follow when the QuickBooks MCP
 * lands — at that point the skill code does NOT change.
 */
export interface InvoiceFetcher {
  readonly name: string;
  fetchOpenInvoices(args: { workspaceId: string }): Promise<SkillResult<InvoiceRecord[]>>;
  fetchContactsByIds(args: {
    workspaceId: string;
    contactIds: string[];
  }): Promise<SkillResult<Record<string, ContactRecord>>>;
}

// ── Output shapes ────────────────────────────────────────────────────────

export type FollowUpTier = 'warm' | 'firm' | 'escalate';

export interface InvoiceFollowUp {
  invoiceId: string;
  invoiceNumber: string;
  closingReference: string;
  amountCents: number;
  daysOutstanding: number;
  tier: FollowUpTier;
  recipient: {
    contactId: string;
    name: string;
    email: string;
    kind: ContactRecord['kind'];
  };
  draft: InvoiceChasingDraft;
}

export interface InvoiceChasingDraft {
  /** UUID assigned by the skill — stable across retries within a run. */
  draftId: string;
  /** Provider-side draft id when the persister succeeded. NULL when
   *  persistence was skipped (no persister provided) or failed. */
  providerDraftId: string | null;
  subject: string;
  /** Plain-text body. Contains `{{operator: ...}}` merge fields for any
   *  value that requires broker judgment (custom date offers, fee
   *  waivers, etc.). */
  body: string;
  tone: 'casual' | 'formal' | 'technical';
  confidence: number;
  persisted: boolean;
}

export type SkipReason =
  | { kind: 'paid'; invoiceId: string }
  | { kind: 'void-or-disputed'; invoiceId: string; reason: string }
  | { kind: 'not-yet-due'; invoiceId: string; dueAt: string }
  | { kind: 'negotiated-extension'; invoiceId: string; until: string }
  | { kind: 'missing-contact'; invoiceId: string; contactId: string };

export interface InvoiceChasingOutput {
  /** Number of input invoices considered. */
  processed: number;
  /** Follow-ups bucketed by tier. */
  followUps: InvoiceFollowUp[];
  /** Invoices we deliberately did NOT chase, with the reason. */
  skipped: SkipReason[];
  /** Bucket counts for the operator dashboard. */
  bucketCounts: Record<FollowUpTier, number>;
}

export interface InvoiceChasingInput {
  workspaceId: string;
  fetcher: InvoiceFetcher;
  /** Optional draft persister. When provided, drafts above the persist
   *  threshold land in the broker's email-drafts folder via the
   *  provider-neutral DraftPersister port. When omitted, drafts are
   *  returned in-memory only. */
  persister?: import('../types').DraftPersister | null;
  /** Below this confidence, drafts are returned but NOT persisted.
   *  Default 0.5 — matches `lib/skills/draft.ts`. */
  persistThreshold?: number;
  /** Optional fixed clock for deterministic tests. */
  now?: Date;
  /** Optional per-tier day thresholds. Defaults: warm 1–14, firm 15–30,
   *  escalate 31+. */
  thresholds?: {
    warmMaxDays?: number;
    firmMaxDays?: number;
  };
}

// ── Day-bucket helpers ──────────────────────────────────────────────────

export const DEFAULT_WARM_MAX_DAYS = 14;
export const DEFAULT_FIRM_MAX_DAYS = 30;

export function bucketTier(
  daysOutstanding: number,
  thresholds: InvoiceChasingInput['thresholds'] = {},
): FollowUpTier {
  const warmMax = thresholds.warmMaxDays ?? DEFAULT_WARM_MAX_DAYS;
  const firmMax = thresholds.firmMaxDays ?? DEFAULT_FIRM_MAX_DAYS;
  if (daysOutstanding <= warmMax) return 'warm';
  if (daysOutstanding <= firmMax) return 'firm';
  return 'escalate';
}
