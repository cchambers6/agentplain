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
