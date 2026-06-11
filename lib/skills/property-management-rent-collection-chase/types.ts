/**
 * lib/skills/property-management-rent-collection-chase/types.ts
 *
 * Provider-neutral types for the property-management rent-collection
 * chase workflow. Reads the rent roll for a property-management
 * workspace, buckets each unit by days-past-due against the operator's
 * cadence (grace / soft-chase / formal-notice / escalation), drafts the
 * appropriate per-tenant chase email, and queues the legal escalation
 * for the PM's review when a unit crosses the formal-notice threshold.
 *
 * Per `lib/skills/prompts/property-management.ts` `draftToneGuidance`:
 *   - friendly + direct
 *   - never commit to a repair / maintenance timeline — defer with
 *     `{{operator: maintenance ETA}}`
 *   - never quote a specific dollar amount in the body — surface
 *     the AMOUNT-DUE through an operator merge field
 *
 * Per `feedback_no_silent_vendor_lock.md`: property-management platform
 * SDKs (AppFolio / Buildium / Propertyware / Yardi Breeze) stay behind
 * the `RentRollLookup` port.
 *
 * Per `project_no_outbound_architecture.md`: DRAFTS only. The PM sends.
 */

import type { DraftPersister, SkillResult } from '../types';

// ── Approval sink port ────────────────────────────────────────────────────
// Mirrors lib/skills/home-services-estimate-followup/types.ts. The skill
// calls this after rendering each chase draft; the production impl writes a
// WorkApprovalQueueItem (kind=FOLLOW_UP_NUDGE, status=PENDING) carrying the
// unit's outstanding balance so the PM console can show "you have $X,XXX in
// unpaid rent". Tests pass a RecordingRentChaseApprovalSink. Sink failures
// are non-fatal — a DB hiccup must not drop the draft output.

export interface RentChaseApproval {
  /** The rendered tenant-chase draft. */
  draft: TenantChaseDraft;
}

export interface RentChaseApprovalSink {
  readonly name: string;
  record(args: {
    workspaceId: string;
    approval: RentChaseApproval;
  }): Promise<SkillResult<{ sinkId: string }>>;
}

// ── Input shapes ─────────────────────────────────────────────────────────

export type DelinquencyBucket =
  | 'grace'
  | 'soft-chase'
  | 'formal-notice'
  | 'escalation';

export interface ContactPerson {
  name: string;
  email: string;
  phone: string | null;
}

export interface UnitDelinquency {
  /** Stable lease id from the property-management platform. */
  leaseId: string;
  /** Display unit label (e.g. "1234 Oak St #4B"). */
  unitLabel: string;
  /** Primary leaseholder — the chase addresses this person. */
  primaryTenant: ContactPerson;
  /** Co-leaseholders (CC'd on the chase). */
  coTenants: ContactPerson[];
  /** Days past the lease's grace window. 0 means rent is due today; any
   *  positive number means at least one day past. Negative values are
   *  filtered upstream (current-on-rent). */
  daysPastDue: number;
  /** Outstanding balance in dollars (the at-risk rent). Carried as
   *  metadata for the value-ledger / PM console "$X,XXX unpaid rent"
   *  display — NEVER rendered in the chase body (dollar amounts always
   *  defer to {{operator: amount due}}). Default 0 when the source
   *  platform doesn't carry a balance (fixtures pre-dating the field). */
  outstandingBalanceUsd: number;
  /** Whether the tenant has a payment plan logged in the platform.
   *  Drives a different tone — confirm plan in motion vs. cold chase. */
  paymentPlanInPlace: boolean;
  /** Whether the tenant already acknowledged the most-recent chase touch
   *  (read receipt, replied promising payment, etc.). */
  tenantAcknowledged: boolean;
  /** When the most-recent chase touch was sent (so we can detect repeated
   *  silence and step urgency up). */
  lastChaseAt: Date | null;
  /** PM of record for this property — drafts are signed by this person. */
  propertyManager: ContactPerson;
  /** Whether owner approval is needed before issuing a formal Pay-Or-Quit
   *  notice (jurisdiction-dependent, configured per property). */
  formalNoticeRequiresOwnerApproval: boolean;
}

export interface RentRollLookup {
  readonly name: string;
  /** All units currently past due for the workspace. The platform
   *  filters current units upstream — the skill assumes everything
   *  passed in is past-due. */
  fetchDelinquentUnits(args: { workspaceId: string }): Promise<SkillResult<UnitDelinquency[]>>;
}

// ── Output shapes ────────────────────────────────────────────────────────

export interface TenantChaseDraft {
  draftId: string;
  providerDraftId: string | null;
  leaseId: string;
  bucket: DelinquencyBucket;
  daysPastDue: number;
  /** Outstanding balance copied from UnitDelinquency — carried on the draft
   *  so the approval sink can embed it in the payload without re-fetching
   *  the rent roll. Metadata only; never appears in `body`. */
  outstandingBalanceUsd: number;
  toEmails: string[];
  ccEmails: string[];
  subject: string;
  body: string;
  tone: 'casual';
  confidence: number;
  persisted: boolean;
}

export interface OwnerReviewItem {
  leaseId: string;
  unitLabel: string;
  daysPastDue: number;
  /** True when the unit's configuration requires owner approval before
   *  any formal Pay-Or-Quit notice can be served. */
  formalNoticeRequiresOwnerApproval: boolean;
  /** One-line summary for the PM's queue. */
  note: string;
}

export interface RentCollectionChaseOutput {
  units: Array<{
    leaseId: string;
    bucket: DelinquencyBucket;
    daysPastDue: number;
  }>;
  bucketCounts: Record<DelinquencyBucket, number>;
  /** One draft per non-grace unit. Grace units never get a chase. */
  drafts: TenantChaseDraft[];
  /** Units crossing into escalation — surfaced to the PM for legal
   *  / owner-decision routing before formal-notice paperwork starts. */
  ownerReview: OwnerReviewItem[];
}

export interface RentCollectionChaseInput {
  workspaceId: string;
  lookup: RentRollLookup;
  /** Approval sink — when provided, every rendered chase draft is staged as
   *  a WorkApprovalQueueItem (kind=FOLLOW_UP_NUDGE, status=PENDING) for PM
   *  review before the customer's own mailbox sends. Sink failures are
   *  non-fatal: the skill logs and continues so a DB hiccup doesn't drop the
   *  draft output. Pass null/omit to disable staging (tests that only assert
   *  draft content). */
  sink?: RentChaseApprovalSink | null;
  persister?: DraftPersister | null;
  persistThreshold?: number;
  now?: Date;
  /** Days past due at which grace → soft-chase. Default 3. */
  softChaseAfterDays?: number;
  /** Days past due at which soft-chase → formal-notice. Default 7. */
  formalNoticeAfterDays?: number;
  /** Days past due at which formal-notice → escalation. Default 14. */
  escalationAfterDays?: number;
}

export const DEFAULT_PERSIST_THRESHOLD = 0.5;
export const DEFAULT_SOFT_CHASE_DAYS = 3;
export const DEFAULT_FORMAL_NOTICE_DAYS = 7;
export const DEFAULT_ESCALATION_DAYS = 14;

export interface BucketThresholds {
  softChase: number;
  formalNotice: number;
  escalation: number;
}

export function bucketFor(args: {
  daysPastDue: number;
  thresholds: BucketThresholds;
}): DelinquencyBucket {
  if (args.daysPastDue >= args.thresholds.escalation) return 'escalation';
  if (args.daysPastDue >= args.thresholds.formalNotice) return 'formal-notice';
  if (args.daysPastDue >= args.thresholds.softChase) return 'soft-chase';
  return 'grace';
}
