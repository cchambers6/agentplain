/**
 * lib/skills/process-doc-drafter-general/types.ts
 *
 * Provider-neutral types for the cross-role process-doc drafter served
 * on the `/general` on-ramp. The skill observes a list of recurring
 * "approved actions" the operator has handled (approved drafts, sent
 * follow-ups, completed bookings, etc.) and PROPOSES a draft Standard
 * Operating Procedure (SOP) for every pattern that repeats ≥ N times
 * — so the process moves out of the operator's head and into a
 * document they can hand off.
 *
 * Cross-role by design: a contractor's "send a deposit-receipt email
 * after every signed estimate" is the same shape as a board member's
 * "circulate the quarterly read-ahead 7 days before the meeting" — both
 * are recurring patterns with a recognizable trigger + action shape.
 *
 * Per `project_no_outbound_architecture.md`: this skill DRAFTS only.
 * It does NOT publish SOPs to Notion / Confluence / Drive / Google Docs.
 * Every proposal is PENDING; the operator copies the drafted SOP into
 * their own documentation system once it's accurate.
 *
 * Per `feedback_no_silent_vendor_lock.md`: no vendor SDK imports here.
 *
 * Per `feedback_cold_start_safe_agents.md`: no in-memory state. The
 * full set of past actions is read from the fetcher every run.
 */

import type { SkillResult } from '../types';

/**
 * One past action the operator approved or completed. The skill clusters
 * these by (kind, triggerHint) to find recurring patterns.
 *
 * - `kind` — coarse classification of what the operator did. Provider-
 *   neutral; values come from the customer's workspace activity log
 *   (the runner already records this for /approvals). Examples:
 *   'send-reply', 'book-meeting', 'send-quote', 'approve-follow-up'.
 * - `triggerHint` — a short keyword/phrase the action was about, used
 *   to cluster similar actions. Examples: 'new-customer', 'deposit',
 *   'monthly-statement', 'quarterly-review'.
 * - `subject` — the original subject line / event title, captured so
 *   the SOP draft can quote a representative example.
 * - `bodySnippet` — ≤ 400 chars of the operator's drafted/sent text,
 *   so the SOP draft can show "what the operator actually wrote".
 */
export interface PastAction {
  id: string;
  occurredAt: Date;
  kind: string;
  triggerHint: string;
  subject: string;
  bodySnippet: string;
}

/**
 * An existing process doc the operator has already saved. The skill
 * uses these to DEDUPE — if an SOP already exists for a cluster, don't
 * propose another one. Dedupe key is normalized title.
 */
export interface ExistingProcessDoc {
  id: string;
  title: string;
}

export interface ProcessDocSnapshot {
  pastActions: PastAction[];
  existingProcessDocs: ExistingProcessDoc[];
}

export interface ProcessDocFetcher {
  readonly name: string;
  fetchSnapshot(args: {
    workspaceId: string;
    asOf: Date;
    /** How far back the past-actions window reaches. */
    lookbackDays: number;
  }): Promise<SkillResult<ProcessDocSnapshot>>;
}

/**
 * A process-doc proposal: a drafted SOP with merge fields where the
 * operator needs to verify the steps. NEVER published — only drafted.
 */
export interface ProcessDocProposal {
  proposalId: string;
  kind: 'process-doc';
  status: 'PENDING';
  /** Pattern key — same value the skill clustered on (kind + triggerHint). */
  patternKey: string;
  title: string;
  /** Plain-markdown body of the drafted SOP. Always contains at least
   *  one `{{operator: ...}}` merge field. */
  body: string;
  /** How many past actions surfaced this pattern. */
  occurrenceCount: number;
  /** Last time this pattern fired — surfaces in the operator UI for
   *  context. */
  lastObservedAt: string;
  /** Source action ids the SOP is grounded in. */
  sourceActionIds: string[];
  confidence: number;
  reasoning: string;
}

export interface ProcessDocApprovalSink {
  readonly name: string;
  record(args: {
    workspaceId: string;
    proposal: ProcessDocProposal;
  }): Promise<SkillResult<{ sinkId: string }>>;
}

export interface ProcessDocInput {
  workspaceId: string;
  fetcher: ProcessDocFetcher;
  sink?: ProcessDocApprovalSink;
  now?: Date;
  /** Minimum cluster size before the skill drafts an SOP. */
  minOccurrences?: number;
  /** Max SOPs to propose per run — keeps queue noise bounded. */
  maxProposalsPerRun?: number;
  /** Lookback window the fetcher uses. */
  lookbackDays?: number;
  /** Sink-confidence threshold. */
  sinkThreshold?: number;
}

export interface ProcessDocOutput {
  asOf: string;
  actionsScanned: number;
  patternsFound: number;
  proposals: ProcessDocProposal[];
  sunk: number;
  noOutboundNote: string;
}

export const DEFAULT_MIN_OCCURRENCES = 3;
export const DEFAULT_MAX_PROPOSALS_PER_RUN = 3;
export const DEFAULT_PROCESS_DOC_LOOKBACK_DAYS = 60;
