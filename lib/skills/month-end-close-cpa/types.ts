/**
 * lib/skills/month-end-close-cpa/types.ts
 *
 * Provider-neutral types for the CPA-firm month-end close workflow.
 * Per `feedback_no_silent_vendor_lock.md` + `feedback_runner_portability.md`:
 * the skill speaks these shapes only — QuickBooks / TaxDome / Karbon /
 * Gmail SDKs stay behind the ports defined below.
 *
 * Per `project_no_outbound_architecture.md`: the skill produces DRAFTS
 * (chase emails per missing doc + a single client status update) and
 * PROPOSED reminders. It does NOT send. The CSM (client services manager)
 * reviews and sends from the firm's own client.
 *
 * Domain anchor: `lib/verticals/cpa/content.ts` JTBD tables for the CSM
 * (client services manager) and Staff accountant roles. Tone is formal
 * and never states a tax position — see
 * `lib/skills/prompts/cpa.ts` `draftToneGuidance`.
 */

import type { SkillResult } from '../types';

// ── Input shapes ─────────────────────────────────────────────────────────

/**
 * One client engagement undergoing month-end close. Production wiring
 * populates this from the QuickBooks MCP (TODO: not yet built — accepts
 * the same shape as a JSON payload today, mirroring QuickBooks Online
 * Reports / List shapes).
 */
export interface ClientEngagement {
  /** Stable id within the firm. */
  clientId: string;
  /** Client display name (firm name or individual). */
  clientName: string;
  /** Primary contact for chase emails. */
  primaryContact: ContactPerson;
  /** Optional bookkeeper / controller copy contact (cc'd on chase). */
  ccContacts: ContactPerson[];
  /** Period being closed — `YYYY-MM`. */
  periodMonth: string;
  /** Engagement scope — drives which docs the checklist enumerates. */
  scope: EngagementScope;
  /** Internal close-deadline target the firm has committed to. */
  internalDeadline: Date;
  /** Whether the partner has signed off (close still in flight when false). */
  partnerSignoff: boolean;
}

export interface ContactPerson {
  name: string;
  email: string;
  /** Optional phone — surfaced for escalations, not used for outbound. */
  phone: string | null;
  /** Role on the client side — drives tone in chase emails. */
  role: 'owner' | 'controller' | 'bookkeeper' | 'office-admin' | 'other';
}

/**
 * Per-engagement scope. Drives which checklist items the skill enforces
 * — bookkeeping-only clients don't get a payroll request; full-stack
 * clients get the long list.
 */
export type EngagementScope =
  | 'bookkeeping-only'
  | 'bookkeeping-plus-payroll'
  | 'full-stack-monthly'
  | 'review-only';

/**
 * One required document for the close. Production population: a mix of
 * QuickBooks-derived items (bank-statement reconciliation, AR/AP aging)
 * and engagement-letter checklist items (payroll register, sales-tax
 * filing). The JSON-stub today carries the same shape.
 */
export interface ChecklistItem {
  /** Stable id within the engagement period. */
  id: string;
  /** Checklist label — what the client sees in the chase email. */
  label: string;
  /** Category — drives which staff member chases / which agent owns. */
  category: ChecklistCategory;
  /** Internal deadline for receipt of this item. */
  dueAt: Date;
  /** Required vs. optional. Optional items are tracked but never chased
   *  hard. */
  required: boolean;
}

export type ChecklistCategory =
  | 'bank-statement'
  | 'credit-card-statement'
  | 'loan-statement'
  | 'payroll-register'
  | 'sales-tax-filing'
  | 'ar-ap-detail'
  | 'fixed-asset-changes'
  | 'owner-distributions'
  | 'inventory-count'
  | 'other';

/**
 * One document the firm has already received for the period. Production
 * population: Gmail attachment scan + TaxDome / Karbon doc-portal events.
 */
export interface ReceivedDoc {
  /** Stable id from the doc-portal or message store. */
  id: string;
  /** Which checklist item this satisfies (or null if uncategorized — the
   *  skill surfaces uncategorized receipts as an operator-review row). */
  satisfiesChecklistItemId: string | null;
  receivedAt: Date;
  /** Filename — surfaces in the operator log + status update. */
  filename: string;
  /** Source path — `gmail`, `taxdome`, `karbon`, `manual-upload`. */
  source: 'gmail' | 'taxdome' | 'karbon' | 'manual-upload';
}

/**
 * Port the skill uses to fetch month-end-close inputs. Production binds
 * the QuickBooks MCP for the engagement + checklist, and the Gmail
 * MessageFetcher for received-doc detection. Tests bind `JsonCloseFetcher`.
 *
 * Per `feedback_runner_portability.md` rule 3: ships with `JsonCloseFetcher`
 * so the interface is honest.
 */
export interface CloseFetcher {
  readonly name: string;
  fetchEngagement(args: {
    workspaceId: string;
    clientId: string;
    periodMonth: string;
  }): Promise<SkillResult<ClientEngagement>>;
  fetchChecklist(args: {
    workspaceId: string;
    clientId: string;
    periodMonth: string;
  }): Promise<SkillResult<ChecklistItem[]>>;
  fetchReceivedDocs(args: {
    workspaceId: string;
    clientId: string;
    periodMonth: string;
  }): Promise<SkillResult<ReceivedDoc[]>>;
}

// ── Output shapes ────────────────────────────────────────────────────────

export type DocStatus = 'received' | 'pending' | 'late';

export interface ChecklistItemStatus {
  itemId: string;
  label: string;
  category: ChecklistCategory;
  required: boolean;
  status: DocStatus;
  /** Days past `dueAt` (negative when not yet due). */
  daysPastDue: number;
  /** Receipts that satisfied this item (most-recent first). Empty when
   *  the item is still pending or late. */
  receivedDocs: Array<{ id: string; filename: string; receivedAt: Date }>;
}

export interface ChaseEmailDraft {
  draftId: string;
  providerDraftId: string | null;
  /** Which checklist items this draft chases. May be > 1 — we batch
   *  per recipient to avoid five separate emails to one bookkeeper. */
  itemIds: string[];
  toEmails: string[];
  ccEmails: string[];
  subject: string;
  /** Plain-text body. Formal CPA tone — no tax position, no balance/refund
   *  numbers, defers numerics to `{{operator: ...}}` merge fields. */
  body: string;
  tone: 'formal';
  confidence: number;
  persisted: boolean;
}

export interface ProposedReminder {
  /** Calendar reminder the CSM should set so this item gets a second touch
   *  if no reply lands. The skill PROPOSES — the customer's calendar
   *  system schedules. Per project_no_outbound_architecture.md. */
  itemIds: string[];
  recipientEmail: string;
  /** Local date the reminder should fire on (`YYYY-MM-DD`). */
  reminderOnLocalDate: string;
  rationale: string;
}

export interface ClientStatusUpdate {
  draftId: string;
  providerDraftId: string | null;
  toEmails: string[];
  ccEmails: string[];
  subject: string;
  body: string;
  tone: 'formal';
  confidence: number;
  persisted: boolean;
}

export interface MonthEndCloseOutput {
  clientId: string;
  clientName: string;
  periodMonth: string;
  /** Per-item bucketing. */
  items: ChecklistItemStatus[];
  /** Counts for the operator dashboard. */
  bucketCounts: Record<DocStatus, number>;
  /** Receipts that did not match any checklist item — operator triages. */
  uncategorizedReceipts: Array<{ id: string; filename: string; source: ReceivedDoc['source'] }>;
  /** Chase email drafts (one per recipient, batching their items). */
  chaseEmails: ChaseEmailDraft[];
  /** Proposed calendar reminders for the CSM. */
  reminders: ProposedReminder[];
  /** A single client-facing status update — the partner-or-CSM sends. */
  statusUpdate: ClientStatusUpdate;
  /** True when every required item is received AND partner has signed off. */
  closeReady: boolean;
}

export interface MonthEndCloseInput {
  workspaceId: string;
  clientId: string;
  /** Period in `YYYY-MM` form, e.g. `2026-04`. */
  periodMonth: string;
  fetcher: CloseFetcher;
  persister?: import('../types').DraftPersister | null;
  /** Below this confidence, drafts are returned but NOT persisted.
   *  Default 0.5 — matches `lib/skills/draft.ts`. */
  persistThreshold?: number;
  /** Optional fixed clock for deterministic tests. */
  now?: Date;
  /** Days past `dueAt` at which an item flips from `pending` to `late`.
   *  Default 0 (the moment it crosses the deadline). */
  lateAfterDays?: number;
  /** Days from `now` to schedule the second-touch reminder. Default 3. */
  reminderInDays?: number;
}

// ── Status helpers ──────────────────────────────────────────────────────

export const DEFAULT_LATE_AFTER_DAYS = 0;
export const DEFAULT_REMINDER_IN_DAYS = 3;

export function statusFor(args: {
  hasReceipt: boolean;
  daysPastDue: number;
  lateAfterDays: number;
}): DocStatus {
  if (args.hasReceipt) return 'received';
  if (args.daysPastDue > args.lateAfterDays) return 'late';
  return 'pending';
}
