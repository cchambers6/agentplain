/**
 * lib/skills/recruiting-candidate-status-update/types.ts
 *
 * Provider-neutral types for the recruiting firm's candidate-status-
 * update workflow. The skill reads a single role's active candidates
 * out of the ATS, classifies each by pipeline stage transition since
 * the last touch, and drafts the per-candidate update — what changed,
 * what's next, what they should expect timing-wise.
 *
 * Per `lib/skills/prompts/recruiting.ts` `draftToneGuidance`:
 *   - warm but quick
 *   - respect candidate time + be transparent about pipeline state
 *   - never quote a salary range or offer detail — defer with
 *     `{{operator: comp/offer details}}`
 *
 * Per `feedback_no_silent_vendor_lock.md`: ATS SDKs (Greenhouse / Lever
 * / Workable / Bullhorn) stay behind the `RolePipelineLookup` port.
 *
 * Per `project_no_outbound_architecture.md`: DRAFTS only. The recruiter
 * sends.
 */

import type { DraftPersister, SkillResult } from '../types';

// ── Input shapes ─────────────────────────────────────────────────────────

export type PipelineStage =
  | 'applied'
  | 'screened'
  | 'manager-screen'
  | 'onsite'
  | 'reference-check'
  | 'offer-in-flight'
  | 'offer-extended'
  | 'rejected'
  | 'withdrawn';

export type StageTransition =
  | 'advanced'
  | 'held'
  | 'rejected'
  | 'withdrawn'
  | 'offer-extended';

export interface ContactPerson {
  name: string;
  email: string;
}

export interface RoleContext {
  /** Stable role id from the ATS. */
  roleId: string;
  /** Display title — used in subject line + lead sentence. */
  title: string;
  /** Client company name — visible to candidate (not anonymized). */
  clientName: string;
  /** Recruiter of record — draft signed by this person. */
  recruiter: ContactPerson;
  /** Whether the role is currently on hold (drives different language). */
  onHold: boolean;
}

export interface CandidateRecord {
  /** Stable candidate id from the ATS. */
  candidateId: string;
  /** Candidate contact — the draft addresses this person. */
  candidate: ContactPerson;
  /** Where the candidate sits today. */
  currentStage: PipelineStage;
  /** Where the candidate sat at the last recruiter touch. NULL = first touch. */
  previousStage: PipelineStage | null;
  /** ISO date of the last recruiter touch. Used to gate stale candidates. */
  lastTouchAt: Date;
  /** ISO date of the most-recent stage transition. */
  stageChangedAt: Date;
  /** Free-text feedback the hiring manager wrote at the last transition.
   *  NEVER rendered verbatim — the skill summarizes the SIGNAL but does
   *  not paraphrase the words. Stays in the audit log for the recruiter. */
  hiringManagerFeedback: string | null;
  /** Whether the candidate has acknowledged the most-recent recruiter
   *  touch (read/replied). Drives polite-not-pushy tone. */
  candidateAcknowledged: boolean;
}

export interface RolePipelineLookup {
  readonly name: string;
  fetchRole(args: { workspaceId: string; roleId: string }): Promise<SkillResult<RoleContext>>;
  fetchCandidates(args: {
    workspaceId: string;
    roleId: string;
  }): Promise<SkillResult<CandidateRecord[]>>;
}

// ── Output shapes ────────────────────────────────────────────────────────

export interface CandidateStatusDraft {
  draftId: string;
  providerDraftId: string | null;
  candidateId: string;
  transition: StageTransition;
  fromStage: PipelineStage | null;
  toStage: PipelineStage;
  toEmails: string[];
  ccEmails: string[];
  subject: string;
  body: string;
  tone: 'casual';
  confidence: number;
  persisted: boolean;
}

export interface RecruiterReviewQueue {
  /** Candidate ids whose drafts the recruiter must review before any
   *  attempt to send (offer-extended + rejected always queue). */
  candidateIds: string[];
  /** Calm one-liner the recruiter sees in their queue. */
  message: string;
}

export interface CandidateStatusUpdateOutput {
  roleId: string;
  roleTitle: string;
  /** Per-candidate transition decisions surfaced for the operator console. */
  transitions: Array<{
    candidateId: string;
    transition: StageTransition;
    fromStage: PipelineStage | null;
    toStage: PipelineStage;
  }>;
  /** Counts by transition for quick read. */
  transitionCounts: Record<StageTransition, number>;
  /** One draft per transition. */
  drafts: CandidateStatusDraft[];
  reviewQueue: RecruiterReviewQueue;
}

export interface CandidateStatusUpdateInput {
  workspaceId: string;
  roleId: string;
  lookup: RolePipelineLookup;
  persister?: DraftPersister | null;
  persistThreshold?: number;
  now?: Date;
  /** Days since last touch at which a still-in-stage candidate triggers a
   *  "held" check-in draft. Default 7 (per recruiting cadence norms). */
  staleAfterDays?: number;
}

export const DEFAULT_PERSIST_THRESHOLD = 0.5;
export const DEFAULT_STALE_AFTER_DAYS = 7;

export function transitionFrom(args: {
  previousStage: PipelineStage | null;
  currentStage: PipelineStage;
  daysSinceLastTouch: number;
  staleAfterDays: number;
}): StageTransition | null {
  if (args.currentStage === 'rejected') return 'rejected';
  if (args.currentStage === 'withdrawn') return 'withdrawn';
  if (args.currentStage === 'offer-extended') return 'offer-extended';
  if (args.previousStage && args.previousStage !== args.currentStage) {
    return 'advanced';
  }
  if (args.daysSinceLastTouch >= args.staleAfterDays) {
    return 'held';
  }
  return null;
}
