/**
 * lib/skills/home-services-estimate-followup/types.ts
 *
 * Provider-neutral types for the home-services estimate-followup
 * workflow. After a trades operator (roofing / HVAC / plumbing / GC /
 * electrical) sends a homeowner an estimate, the deal stalls if the
 * shop doesn't follow up — but heavy-handed daily prodding gets the
 * operator marked as spam. This skill walks open estimates, classifies
 * each one by stage in the followup cadence (T+2 / T+5 / T+10 / cold),
 * and drafts the per-stage homeowner-facing nudge for the owner / sales
 * rep to send from their own email.
 *
 * Per `lib/skills/prompts/home-services.ts` `draftToneGuidance`:
 *   - never quote a price — defer with `{{operator: quote/time estimate}}`
 *   - never commit to a time-on-site — defer with the same merge field
 *   - tone is plain-spoken + practical
 *
 * Per `feedback_no_silent_vendor_lock.md`: FSM SDKs (AccuLynx /
 * JobNimbus / ServiceTitan / Housecall Pro / Jobber) stay behind the
 * `EstimateLookup` port.
 *
 * Per `project_no_outbound_architecture.md`: DRAFTS only. The shop's
 * email client sends.
 */

import type { DraftPersister, SkillResult } from '../types';

// ── Approval sink port ────────────────────────────────────────────────────
// Mirrors the pattern in follow-up-chaser-general/types.ts.  The skill calls
// this after rendering each nudge draft; the production implementation writes
// a WorkApprovalQueueItem (kind=FOLLOW_UP_NUDGE) with the estimate $ in the
// payload.  Tests pass a RecordingEstimateApprovalSink.

export interface EstimateNudgeApproval {
  /** The rendered nudge draft. */
  draft: HomeownerNudgeDraft;
}

export interface EstimateApprovalSink {
  readonly name: string;
  record(args: {
    workspaceId: string;
    approval: EstimateNudgeApproval;
  }): Promise<SkillResult<{ sinkId: string }>>;
}

// ── Input shapes ─────────────────────────────────────────────────────────

export type EstimateStage = 'fresh' | 'soft-nudge' | 'check-in' | 'last-call' | 'cold';

export interface ContactPerson {
  name: string;
  email: string;
  /** Phone is captured for the LO-nudge / cold transition, never rendered
   *  in the draft. */
  phone: string | null;
}

export interface EstimateRecord {
  /** Stable estimate id from the FSM. */
  estimateId: string;
  /** Homeowner — the followup goes to this contact. */
  homeowner: ContactPerson;
  /** Job site address — surfaces in the subject line. */
  serviceAddress: string;
  /** Trade type — drives small framing differences (roofing storm vs. HVAC
   *  pre-season vs. plumbing emergency). */
  trade: 'roofing' | 'hvac' | 'plumbing' | 'electrical' | 'general-contractor';
  /** ISO date the estimate was sent to the homeowner. */
  sentAt: Date;
  /** Whether this estimate was tied to an insurance claim (storm work). */
  insuranceClaim: boolean;
  /** Whether the homeowner already replied to the estimate (acknowledged
   *  receipt but did not sign). Drives polite-not-pushy tone. */
  homeownerAcknowledged: boolean;
  /** The sales rep / owner who sent the estimate — drafts are signed by
   *  this person. */
  rep: ContactPerson;
  /** The total dollar amount of the estimate.  This is the revenue at stake —
   *  recorded in the approval-sink payload as `estimateAmountUsd` so the
   *  operator console can display "you have $X,XXX in unanswered quotes" and
   *  the value ledger can attribute revenue influenced when the owner approves
   *  a nudge that converts to a signed estimate.
   *
   *  Default 0 when the source system does not carry a dollar value (fixture /
   *  JSON seeded tests that pre-date this field). */
  amountUsd: number;
}

export interface EstimateLookup {
  readonly name: string;
  /** All open (un-signed, not-lost) estimates for the workspace. */
  fetchOpenEstimates(args: { workspaceId: string }): Promise<SkillResult<EstimateRecord[]>>;
}

// ── Output shapes ────────────────────────────────────────────────────────

export interface HomeownerNudgeDraft {
  draftId: string;
  providerDraftId: string | null;
  estimateId: string;
  /** Dollar value of the estimate — copied from EstimateRecord.amountUsd.
   *  Carried on the draft so the approval sink can embed it in the payload
   *  without re-fetching the source record. */
  estimateAmountUsd: number;
  stage: EstimateStage;
  toEmails: string[];
  ccEmails: string[];
  subject: string;
  body: string;
  tone: 'casual';
  confidence: number;
  persisted: boolean;
}

export interface ColdEstimateHandoff {
  /** True when at least one estimate fell into the cold bucket. */
  needed: boolean;
  /** Estimate ids that fell cold — the operator should call rather than
   *  send more email. */
  coldEstimateIds: string[];
  /** Calm one-liner the rep / owner sees in the operator queue. */
  message: string;
}

export interface EstimateFollowupOutput {
  /** All open estimates with their classified stage + days since send. */
  estimates: Array<{
    estimateId: string;
    stage: EstimateStage;
    daysSinceSent: number;
    homeownerAcknowledged: boolean;
  }>;
  /** Stage counts for quick read in the operator console. */
  stageCounts: Record<EstimateStage, number>;
  /** One draft per non-cold estimate. Cold estimates produce no draft
   *  (the cold handoff is a phone-call ask, not another email). */
  drafts: HomeownerNudgeDraft[];
  coldHandoff: ColdEstimateHandoff;
}

export interface EstimateFollowupInput {
  workspaceId: string;
  lookup: EstimateLookup;
  /** Approval sink — when provided, every rendered nudge draft is staged as a
   *  WorkApprovalQueueItem (kind=FOLLOW_UP_NUDGE, status=PENDING) for operator
   *  review before the customer sends.  Sink failures are non-fatal: the skill
   *  logs the error and continues so a DB hiccup does not drop the draft output.
   *  Pass null to disable staging (useful in tests that only care about draft
   *  content, not persistence). */
  sink?: EstimateApprovalSink | null;
  persister?: DraftPersister | null;
  persistThreshold?: number;
  now?: Date;
  /** Days since send at which fresh → soft-nudge. Default 2. */
  softNudgeAfterDays?: number;
  /** Days since send at which soft-nudge → check-in. Default 5. */
  checkInAfterDays?: number;
  /** Days since send at which check-in → last-call. Default 10. */
  lastCallAfterDays?: number;
  /** Days since send at which last-call → cold. Default 21. */
  coldAfterDays?: number;
}

export const DEFAULT_PERSIST_THRESHOLD = 0.5;
export const DEFAULT_SOFT_NUDGE_DAYS = 2;
export const DEFAULT_CHECK_IN_DAYS = 5;
export const DEFAULT_LAST_CALL_DAYS = 10;
export const DEFAULT_COLD_DAYS = 21;

export interface StageThresholds {
  softNudge: number;
  checkIn: number;
  lastCall: number;
  cold: number;
}

export function stageFor(args: {
  daysSinceSent: number;
  thresholds: StageThresholds;
}): EstimateStage {
  if (args.daysSinceSent >= args.thresholds.cold) return 'cold';
  if (args.daysSinceSent >= args.thresholds.lastCall) return 'last-call';
  if (args.daysSinceSent >= args.thresholds.checkIn) return 'check-in';
  if (args.daysSinceSent >= args.thresholds.softNudge) return 'soft-nudge';
  return 'fresh';
}
