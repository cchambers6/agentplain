/**
 * lib/skills/inbox-triage-general/types.ts
 *
 * Provider-neutral types for the cross-role inbox-triage skill served on
 * the `/general` on-ramp. Unlike `office-admin` (which only recognizes
 * admin / IT / verification-code mail) and unlike `chief-of-staff-
 * scheduler` (which only handles scheduling + meeting + to-do
 * proposals), this skill triages the GENERAL inbox: every inbound that
 * is not obviously admin and not obviously a meeting ask. It scores
 * each message into a priority bucket and (for customer-active and
 * vendor-pending only) drafts a gentle acknowledgement with operator
 * merge fields.
 *
 * Cross-role by design — works the same for a contractor, a board
 * member, a solo operator, or any owner who falls outside the ten
 * ratified verticals.
 *
 * Per `project_no_outbound_architecture.md`: the skill DRAFTS and
 * CLASSIFIES — it never sends, never books, never writes to a third-
 * party system. Every proposal carries `status: 'PENDING'` and lands
 * in the approval queue via the same `ApprovalSink` port the chief-of-
 * staff skill uses.
 *
 * Per `feedback_no_silent_vendor_lock.md`: no Gmail / Outlook / vendor
 * SDK imports in this directory. The fetcher port is provider-neutral;
 * production binds an adapter once the customer connects their mailbox.
 *
 * Per `feedback_cold_start_safe_agents.md`: the skill keeps no state
 * across runs. Each call reads the full inbox snapshot the fetcher
 * returns and emits proposals deterministically from that snapshot.
 */

import type { SkillResult } from '../types';

/**
 * One inbound message under triage. Same shape as the chief-of-staff
 * `InboxMessage` but kept independent so the two skills can evolve
 * separately — the chief-of-staff cares about scheduling cues; this
 * skill cares about urgency + counterparty class.
 */
export interface TriageMessage {
  id: string;
  threadId: string;
  fromEmail: string;
  fromName: string | null;
  subject: string;
  /** Plain-text body. The triage classifier reads the first ~800 chars. */
  bodyText: string;
  receivedAt: Date;
  /** Has the operator (or another agent) already drafted a reply? */
  hasOpenReplyDraft?: boolean;
}

/**
 * Snapshot the fetcher returns: just the inbox window. No calendar, no
 * to-do — those belong to chief-of-staff. Keeping the snapshot shape
 * narrow keeps the two skills decoupled.
 */
export interface TriageSnapshot {
  inbox: TriageMessage[];
}

export interface TriageFetcher {
  readonly name: string;
  fetchSnapshot(args: {
    workspaceId: string;
    asOf: Date;
  }): Promise<SkillResult<TriageSnapshot>>;
}

/**
 * The five priority buckets. Order is descending priority — `urgent`
 * first, `noise` last. Operator views inbound in this order on the
 * triage card.
 */
export type TriagePriority =
  | 'urgent'
  | 'customer-active'
  | 'vendor-pending'
  | 'needs-decision'
  | 'noise';

export const TRIAGE_PRIORITY_ORDER: TriagePriority[] = [
  'urgent',
  'customer-active',
  'vendor-pending',
  'needs-decision',
  'noise',
];

/**
 * A triage proposal: one classification + an optional drafted ack.
 * Drafts only land for `customer-active` and `vendor-pending` — urgent
 * needs the operator's eyes on it directly (no auto-ack risk), needs-
 * decision is by definition something the operator must answer, noise
 * is filed away without any draft.
 *
 * Per `project_no_outbound_architecture.md`: nothing here gets sent.
 */
export interface TriageProposal {
  proposalId: string;
  kind: 'inbox-triage';
  status: 'PENDING';
  sourceMessageId: string;
  sourceThreadId: string;
  priority: TriagePriority;
  /** One-line summary of why this priority — surfaces in /approvals. */
  reasoning: string;
  /** 0-1 confidence in the classification. Below 0.4 demotes to noise. */
  confidence: number;
  /** Drafted acknowledgement, only populated for customer-active and
   *  vendor-pending. NULL for everything else. */
  ackDraft: TriageAckDraft | null;
}

export interface TriageAckDraft {
  toEmails: string[];
  subject: string;
  body: string;
  tone: 'formal' | 'casual';
}

/**
 * Sink port — same pattern as chief-of-staff. Tests bind a recording
 * sink to prove no-outbound; production binds a Prisma-backed sink that
 * writes WorkApprovalQueueItem rows.
 */
export interface TriageApprovalSink {
  readonly name: string;
  record(args: {
    workspaceId: string;
    proposal: TriageProposal;
  }): Promise<SkillResult<{ sinkId: string }>>;
}

export interface TriageInput {
  workspaceId: string;
  fetcher: TriageFetcher;
  sink?: TriageApprovalSink;
  /** Override clock — defaults to `new Date()`. */
  now?: Date;
  /** Threshold under which a classification is demoted to `noise`. */
  noiseConfidenceFloor?: number;
  /** Threshold under which the sink skips persistence (used to keep
   *  noise out of the operator's queue). Defaults to 0. */
  sinkThreshold?: number;
  /** Wave-2 per-skill config — extra cue phrases that force priority
   *  to `urgent`. Sourced from `WorkspacePreference` via
   *  `lib/skills/config#readInboxTriageConfig`. Merged into the
   *  built-in URGENT_CUES list at fire time. Empty/undefined = no
   *  customer cues. */
  extraUrgentCues?: string[];
  /** Per-skill config — sender allowlist. A message whose `fromEmail`
   *  matches (exact address, `@domain.com`, or bare `domain.com`) is
   *  forced to `urgent` so it tops the queue regardless of body cues.
   *  Sourced from `lib/skills/config#readInboxTriageConfig`. Empty =
   *  off. */
  flagFromSenders?: string[];
  /** Per-skill config — sender denylist. A message whose `fromEmail`
   *  matches is demoted to `noise` (no auto-ack) so routine senders
   *  stay out of the operator's active buckets. Allowlist wins if a
   *  sender somehow appears on both. Empty = off. */
  autoArchiveSenders?: string[];
  /** Wave-4 — opt-in LLM provider for FEEDBACK-rule refinement. When
   *  provided (alongside a non-empty `feedbackRulesBlock`), the skill
   *  invokes `maybeRefineTriage` after the heuristic classifier to let
   *  workspace-specific FEEDBACK rules override priorities. LLM errors
   *  degrade gracefully — the heuristic output passes through. When
   *  omitted, behavior is identical to wave-3. */
  llm?: import('../../llm/types').LlmProvider;
  /** Wave-4 — rendered FEEDBACK rules block (already in plain text).
   *  Empty = no LLM refinement (heuristic-only). */
  feedbackRulesBlock?: string;
}

export interface TriageOutput {
  asOf: string;
  inboxScanned: number;
  proposals: TriageProposal[];
  /** Number of proposals the sink accepted (may be < proposals.length
   *  when `sinkThreshold` filters some out). */
  sunk: number;
  noOutboundNote: string;
}

export const DEFAULT_NOISE_CONFIDENCE_FLOOR = 0.4;
