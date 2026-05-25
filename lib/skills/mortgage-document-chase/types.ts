/**
 * lib/skills/mortgage-document-chase/types.ts
 *
 * Provider-neutral types for the mortgage brokerage's borrower document-
 * chase workflow. The skill reads a single loan file's outstanding doc
 * list out of the LOS, classifies each item by category (income,
 * assets, identity, property, declarations), buckets pending vs. late
 * against the broker's per-category cadence, and drafts a single
 * batched borrower email plus an optional VOX nudge for stuck items.
 *
 * Per `lib/skills/prompts/mortgage.ts` `draftToneGuidance`:
 *   - never quote a rate, APR, LTV, or DTI — defer with
 *     `{{operator: rate/APR}}`
 *   - never use promissory language ("you will qualify"); always frame
 *     as "conditional" or "subject to underwriting"
 *   - drafts go to the BORROWER, signed by the LO of record
 *
 * Per `feedback_no_silent_vendor_lock.md`: LOS SDKs (Encompass /
 * LendingPad / Calyx) stay behind the `LoanFileLookup` port.
 *
 * Per `project_no_outbound_architecture.md`: DRAFTS only. The LO sends.
 */

import type { DraftPersister, SkillResult } from '../types';

// ── Input shapes ─────────────────────────────────────────────────────────

export type DocCategory =
  | 'income'
  | 'assets'
  | 'identity'
  | 'property'
  | 'declarations'
  | 'credit-letter';

export interface ContactPerson {
  name: string;
  email: string;
}

export interface LoanFile {
  /** Stable LOS loan id. */
  loanId: string;
  /** Borrower account on the LOS. */
  borrower: ContactPerson;
  /** Optional co-borrower — when present, CC'd on the chase. */
  coBorrower: ContactPerson | null;
  /** LO of record — the chase draft is signed by this person. */
  loanOfficer: ContactPerson;
  /** Free-text property address, surfaces in subject line. */
  propertyAddress: string;
  /** Loan purpose label (purchase / refi-rt / refi-co / heloc). Used in
   *  the email lead-in copy. */
  purpose: 'purchase' | 'refinance' | 'cash-out-refi' | 'heloc';
  /** ISO date of the LOS-recorded estimated closing. Surfaces in the
   *  borrower-facing urgency framing when late items pile up. */
  estimatedClosingDate: string;
}

export interface OutstandingDoc {
  /** Stable id within the loan file (LOS doc-item id). */
  id: string;
  /** Borrower-facing label — verbatim into the chase bullet. */
  label: string;
  /** Doc category — drives the cadence floor and the bucket grouping. */
  category: DocCategory;
  /** ISO date the doc was first requested from the borrower. The chase
   *  uses (now − requestedAt) to compute days-outstanding. */
  requestedAt: Date;
  /** True when this doc was already chased at least once and the
   *  borrower acknowledged but did not deliver. */
  borrowerAcknowledged: boolean;
  /** True when this doc is required to clear an UW condition rather than
   *  a stock day-1 ask — raises urgency. */
  conditionAttached: boolean;
}

export interface LoanFileLookup {
  readonly name: string;
  fetchFile(args: { workspaceId: string; loanId: string }): Promise<SkillResult<LoanFile>>;
  fetchOutstandingDocs(args: {
    workspaceId: string;
    loanId: string;
  }): Promise<SkillResult<OutstandingDoc[]>>;
}

// ── Output shapes ────────────────────────────────────────────────────────

export type DocBucket = 'fresh' | 'pending' | 'late' | 'stuck';

export interface DocStatus {
  docId: string;
  label: string;
  category: DocCategory;
  bucket: DocBucket;
  daysOutstanding: number;
  conditionAttached: boolean;
}

export interface BorrowerChaseDraft {
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

export interface LoNudge {
  /** True when the doc list contains at least one stuck item — i.e. the
   *  LO should pick up the phone instead of relying on a written chase. */
  needed: boolean;
  /** Doc ids that triggered the nudge. */
  stuckDocIds: string[];
  /** Calm one-liner for the LO's queue. */
  message: string;
}

export interface MortgageDocChaseOutput {
  loanId: string;
  propertyAddress: string;
  docStatuses: DocStatus[];
  bucketCounts: Record<DocBucket, number>;
  /** One batched chase draft per file — never one-per-doc spam. NULL
   *  when no documents are outstanding. */
  borrowerChase: BorrowerChaseDraft | null;
  /** Hand-off prompt to the LO when a stuck item demands a phone call. */
  loNudge: LoNudge;
}

export interface MortgageDocChaseInput {
  workspaceId: string;
  loanId: string;
  lookup: LoanFileLookup;
  persister?: DraftPersister | null;
  persistThreshold?: number;
  now?: Date;
  /** Days-outstanding at which a doc flips from `pending` → `late`.
   *  Default 4 (mortgage doc cadence is faster than other verticals). */
  lateAfterDays?: number;
  /** Days-outstanding at which a doc flips from `late` → `stuck` (i.e.
   *  the chase has not been working and the LO should call). Default 10. */
  stuckAfterDays?: number;
}

export const DEFAULT_PERSIST_THRESHOLD = 0.5;
export const DEFAULT_LATE_AFTER_DAYS = 4;
export const DEFAULT_STUCK_AFTER_DAYS = 10;

export function bucketFor(args: {
  daysOutstanding: number;
  lateAfter: number;
  stuckAfter: number;
}): DocBucket {
  if (args.daysOutstanding >= args.stuckAfter) return 'stuck';
  if (args.daysOutstanding >= args.lateAfter) return 'late';
  if (args.daysOutstanding >= 1) return 'pending';
  return 'fresh';
}
