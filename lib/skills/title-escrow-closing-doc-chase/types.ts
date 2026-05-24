/**
 * lib/skills/title-escrow-closing-doc-chase/types.ts
 *
 * Provider-neutral types for the title-escrow closing-doc chase. The
 * skill walks a closing file's checklist of source documents, buckets
 * each item by responsible party (lender / buyer / seller / attorney /
 * underwriter), and drafts a separate chase email per party that needs
 * something.
 *
 * Per `lib/skills/prompts/title-escrow.ts` (formal tone, never assert a
 * title status / closing date / disbursement):
 *   - never claim title status — defer to {{operator: title status}}
 *   - never confirm a wire-instructions destination — defer to
 *     {{operator: wire confirmation}}
 *   - never commit to a recording / disbursement timeline without the
 *     escrow officer's confirmation
 *
 * Per `feedback_no_silent_vendor_lock.md`: production wiring binds
 * SoftPro / Qualia / RamQuest MCPs behind the `ClosingFileFetcher` port.
 *
 * Per `project_no_outbound_architecture.md`: DRAFTS only. The closing
 * coordinator's email client sends.
 */

import type { DraftPersister, SkillResult } from '../types';

// ── Input shapes ─────────────────────────────────────────────────────────

export type ClosingParty =
  | 'buyer'
  | 'seller'
  | 'lender'
  | 'buyer-attorney'
  | 'seller-attorney'
  | 'underwriter'
  | 'realtor';

export interface ContactPerson {
  name: string;
  email: string;
  role: ClosingParty;
}

export interface ClosingFile {
  /** Stable id from the title-production system. */
  fileId: string;
  /** Free-text property address — surfaces in subject line. */
  propertyAddress: string;
  /** ISO date of the scheduled closing. */
  scheduledClosingDate: string;
  /** Escrow officer / closing coordinator — the chase emails go FROM
   *  this person's signature merge field. */
  closingCoordinator: ContactPerson;
  /** All counterparties on the file. */
  contacts: ContactPerson[];
}

export interface ChecklistItem {
  /** Stable id within the closing file. */
  id: string;
  /** Document label rendered in the chase (e.g. "Final CD"). */
  label: string;
  /** Which party owes us this doc. */
  responsibleParty: ClosingParty;
  /** Internal target receipt date. */
  dueAt: Date;
  /** Required vs. optional — optional items are tracked but never chased hard. */
  required: boolean;
}

export interface ReceivedDoc {
  /** Stable id from the doc-portal. */
  id: string;
  /** Which checklist item this satisfies (null = uncategorized). */
  satisfiesChecklistItemId: string | null;
  receivedAt: Date;
  filename: string;
}

export interface ClosingFileFetcher {
  readonly name: string;
  fetchFile(args: { workspaceId: string; fileId: string }): Promise<SkillResult<ClosingFile>>;
  fetchChecklist(args: { workspaceId: string; fileId: string }): Promise<SkillResult<ChecklistItem[]>>;
  fetchReceivedDocs(args: { workspaceId: string; fileId: string }): Promise<SkillResult<ReceivedDoc[]>>;
}

// ── Output shapes ────────────────────────────────────────────────────────

export type DocStatus = 'received' | 'pending' | 'late';

export interface ChecklistItemStatus {
  itemId: string;
  label: string;
  responsibleParty: ClosingParty;
  required: boolean;
  status: DocStatus;
  daysPastDue: number;
}

export interface PartyChaseDraft {
  draftId: string;
  providerDraftId: string | null;
  party: ClosingParty;
  itemIds: string[];
  toEmails: string[];
  ccEmails: string[];
  subject: string;
  body: string;
  tone: 'formal';
  confidence: number;
  persisted: boolean;
}

export interface ClosingDocChaseOutput {
  fileId: string;
  propertyAddress: string;
  items: ChecklistItemStatus[];
  bucketCounts: Record<DocStatus, number>;
  /** One draft per party with outstanding items. */
  drafts: PartyChaseDraft[];
  /** True when every required item is received. */
  closingReady: boolean;
}

export interface ClosingDocChaseInput {
  workspaceId: string;
  fileId: string;
  fetcher: ClosingFileFetcher;
  persister?: DraftPersister | null;
  persistThreshold?: number;
  /** Optional clock for deterministic tests. */
  now?: Date;
  /** Days past dueAt at which an item flips from pending → late. Default 0. */
  lateAfterDays?: number;
}

export const DEFAULT_PERSIST_THRESHOLD = 0.5;
export const DEFAULT_LATE_AFTER_DAYS = 0;

export function statusFor(args: {
  hasReceipt: boolean;
  daysPastDue: number;
  lateAfterDays: number;
}): DocStatus {
  if (args.hasReceipt) return 'received';
  if (args.daysPastDue > args.lateAfterDays) return 'late';
  return 'pending';
}
