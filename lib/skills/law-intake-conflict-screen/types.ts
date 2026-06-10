/**
 * lib/skills/law-intake-conflict-screen/types.ts
 *
 * Provider-neutral types for the law-firm prospective-client conflict
 * screen. The skill takes a new-matter intake + the firm's existing
 * client ledger and produces a deterministic conflict report with a
 * draft notice for the responsible attorney.
 *
 * Per `feedback_no_silent_vendor_lock.md`: matter-management SDKs
 * (Clio / MyCase / PracticePanther) stay behind the `LedgerFetcher`
 * port; this skill speaks only the ports below.
 *
 * Per `project_no_outbound_architecture.md`: this skill DRAFTS. The
 * `persister` parameter writes a Gmail or Outlook draft. The responsible
 * attorney decides whether to send.
 *
 * Per `lib/skills/prompts/law.ts` `draftToneGuidance` (and ABA MRPC 1.7
 * / 1.18): the draft never states a legal conclusion — every conflict
 * call surfaces a `{{operator: ...}}` merge field for the attorney to
 * confirm before sending.
 */

import type { DraftPersister, SkillResult } from '../types';

// ── Input shapes ─────────────────────────────────────────────────────────

export interface ProspectiveIntake {
  /** Stable id from the matter-management system. */
  matterId: string;
  /** Prospective client's display name (the would-be client). */
  prospectName: string;
  /** Prospective client's primary email — used as the chase recipient. */
  prospectEmail: string;
  /** Adverse / opposing parties named in the intake. May be empty for
   *  transactional matters where there's no opposing party (an estate
   *  plan, a corporate filing). */
  opposingParties: string[];
  /** Free-text matter description — verbatim from the intake form. */
  matterDescription: string;
  /** Firm attorney who would handle the matter. */
  responsibleAttorney: ContactPerson;
}

export interface ContactPerson {
  name: string;
  email: string;
}

/**
 * One row in the firm's existing-clients + closed-matters ledger. Used
 * to look up direct and adverse-party conflicts. Production population:
 * Clio / MyCase / PracticePanther MCP (stubbed today; same JSON shape).
 */
export interface LedgerEntry {
  /** Client display name as recorded in the matter-management system. */
  clientName: string;
  /** Status — open matters create stricter conflicts than closed ones. */
  status: 'active' | 'closed';
  /** Optional matter description for the audit trail. */
  matterLabel?: string;
}

export interface LedgerFetcher {
  readonly name: string;
  fetchLedger(args: { workspaceId: string }): Promise<SkillResult<LedgerEntry[]>>;
}

// ── Output shapes ────────────────────────────────────────────────────────

export type ConflictSeverity = 'direct' | 'adverse' | 'former-adverse';
export type ScreenStatus = 'clear' | 'flagged' | 'needs-counsel-review';

export interface ConflictHit {
  severity: ConflictSeverity;
  /** Which party (prospect or opposing) triggered the hit. */
  matchedAgainst: 'prospect' | 'opposing-party';
  /** The opposing-party string (when matchedAgainst='opposing-party'). */
  opposingPartyText: string | null;
  /** Existing client this hit matched. */
  existingClient: LedgerEntry;
  /** Lower-cased normalized form used for the match. */
  normalizedMatch: string;
}

export interface IntakeNoticeDraft {
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

export interface IntakeConflictScreenOutput {
  matterId: string;
  prospectName: string;
  status: ScreenStatus;
  conflicts: ConflictHit[];
  /** Internal note for the responsible attorney — draft email + audit log row. */
  attorneyNotice: IntakeNoticeDraft;
}

export interface IntakeConflictScreenInput {
  workspaceId: string;
  intake: ProspectiveIntake;
  fetcher: LedgerFetcher;
  persister?: DraftPersister | null;
  /** Below this confidence, drafts return but DON'T persist. Default 0.5. */
  persistThreshold?: number;
  /** Optional clock for deterministic tests. */
  now?: Date;
}

export const DEFAULT_PERSIST_THRESHOLD = 0.5;

// ── Engagement letter ────────────────────────────────────────────────────

/**
 * Deterministic engagement-letter draft produced on a CLEAR screen result.
 * No LLM in the generation path — the template is parameterized by the
 * intake fields. All merge fields that require attorney judgment carry a
 * `{{operator: ...}}` placeholder so nothing auto-sends without review.
 */
export interface EngagementLetterDraft {
  draftId: string;
  matterId: string;
  prospectName: string;
  /** Plain-text body ready for attorney review + edit. */
  body: string;
}

// ── Approval sink ────────────────────────────────────────────────────────

/**
 * Port the skill writes to after the screen verdict. Two outcome paths:
 *
 *   - CLEAR  → one PROCESS_DOC_DRAFT row carrying the engagement-letter
 *               draft so the attorney can review, edit, and sign.
 *   - FLAGGED / NEEDS-COUNSEL-REVIEW → one COMPLIANCE_FLAG row carrying
 *               the conflict matches so the attorney can review and decide.
 *
 * Per `feedback_runner_portability.md` two-implementation rule:
 *   - `RecordingConflictApprovalSink` (test, captures calls in-memory).
 *   - `PrismaConflictApprovalSink` (production, writes WorkApprovalQueueItem).
 */
export interface ConflictApprovalSink {
  readonly name: string;
  record(args: {
    workspaceId: string;
    screen: IntakeConflictScreenOutput;
    engagementLetter: EngagementLetterDraft | null;
  }): Promise<import('../types').SkillResult<{ sinkId: string }>>;
}

// ── Firm context ─────────────────────────────────────────────────────────

/**
 * Optional firm-level metadata included in the engagement-letter template.
 * When omitted, `{{operator: ...}}` placeholders stand in for the values
 * so the attorney fills them before sending.
 */
export interface FirmContext {
  firmName: string;
  firmAddress?: string;
  stateOfPractice?: string;
}

// ── Extended input ───────────────────────────────────────────────────────

/**
 * Extends the base skill input with:
 *   - `sink`        — optional approval-queue sink; when provided the skill
 *                      writes the verdict card + engagement-letter draft.
 *   - `firmContext` — optional firm info for the engagement-letter template.
 *   - `gateAllow`   — caller-resolved fire-gate outcome (vacation / window).
 *                      When `false` the skill returns NOT_APPLICABLE without
 *                      touching the ledger or sink.
 */
export interface ConflictScreenExtendedInput extends IntakeConflictScreenInput {
  sink?: ConflictApprovalSink | null;
  firmContext?: FirmContext | null;
  /** When false the skill is off-gate and must not fire. */
  gateAllow?: boolean;
}
