/**
 * lib/skills/follow-up-chaser-general/types.ts
 *
 * Provider-neutral types for the cross-role follow-up chaser served on
 * the `/general` on-ramp. The skill walks the operator's outbound
 * threads (messages the OPERATOR sent), finds threads where the
 * counterparty has not replied within a stale-window, and PROPOSES a
 * gentle nudge draft for each.
 *
 * Different from `chief-of-staff-scheduler` (which handles inbound
 * scheduling cues + open to-dos) and from `inbox-triage-general` (which
 * classifies inbound). Same no-outbound contract — the nudge is a
 * DRAFT, never sent.
 *
 * Per `feedback_no_silent_vendor_lock.md`: Gmail / Outlook / vendor
 * SDKs are NOT imported in this directory. The fetcher port is
 * provider-neutral.
 *
 * Per `feedback_cold_start_safe_agents.md`: no in-memory state across
 * runs. Every call reads the operator's recent outbound and emits
 * proposals deterministically from that snapshot.
 */

import type { SkillResult } from '../types';

/**
 * One outbound thread the operator has touched. The fetcher returns
 * the most-recent operator message + the most-recent counterparty
 * reply (if any) so the skill can compute stale-window and dedupe.
 */
export interface OutboundThread {
  threadId: string;
  /** Subject line of the latest message — used to label the nudge. */
  subject: string;
  /** Counterparty emails the original was sent to. */
  counterpartyEmails: string[];
  /** Display name of the primary counterparty, when available. */
  counterpartyName: string | null;
  /** When the OPERATOR last sent in this thread. */
  operatorLastSentAt: Date;
  /** When the COUNTERPARTY last replied. NULL if they never replied. */
  counterpartyLastRepliedAt: Date | null;
  /** Short snippet (≤ 400 chars) of the operator's last outbound. The
   *  nudge draft quotes a trimmed slice of this for context. */
  operatorLastBodySnippet: string;
  /** Has the operator already drafted a nudge in this thread (e.g. a
   *  previous run of this skill)? When true, the skill skips so we
   *  don't pile drafts in the customer's draft folder. */
  hasOpenFollowUpDraft?: boolean;
}

export interface FollowUpSnapshot {
  outbound: OutboundThread[];
}

export interface FollowUpFetcher {
  readonly name: string;
  fetchSnapshot(args: {
    workspaceId: string;
    asOf: Date;
    /** How far back the operator-outbound window reaches. Older than
     *  this and the skill ignores the thread (the cadence has passed
     *  and a fresh re-engagement requires operator judgment). */
    lookbackDays: number;
  }): Promise<SkillResult<FollowUpSnapshot>>;
}

/**
 * A follow-up nudge proposal: drafted, never sent.
 */
export interface FollowUpProposal {
  proposalId: string;
  kind: 'follow-up-nudge';
  status: 'PENDING';
  sourceThreadId: string;
  /** Days since the operator sent + counterparty did not reply. */
  ageDays: number;
  /** Cadence stage — "first nudge" at 4-9 days, "second nudge" at 10+. */
  stage: 'first' | 'second';
  toEmails: string[];
  subject: string;
  /** Plain-text body with `{{operator: ...}}` merge fields for anything
   *  that needs operator verification. */
  body: string;
  /** 0-1. Older stalls get lower confidence — fresh ones almost always
   *  benefit from a gentle nudge, very old ones may want operator-
   *  authored re-engagement. */
  confidence: number;
  reasoning: string;
}

export interface FollowUpApprovalSink {
  readonly name: string;
  record(args: {
    workspaceId: string;
    proposal: FollowUpProposal;
  }): Promise<SkillResult<{ sinkId: string }>>;
}

export interface FollowUpInput {
  workspaceId: string;
  fetcher: FollowUpFetcher;
  sink?: FollowUpApprovalSink;
  now?: Date;
  /** Threshold (days) below which a thread is too fresh to nudge. */
  staleAfterDays?: number;
  /** Max threads to nudge per run — keeps the operator's queue sane. */
  maxNudgesPerRun?: number;
  /** Lookback window the fetcher uses. */
  lookbackDays?: number;
  /** Sink-confidence threshold. */
  sinkThreshold?: number;
}

export interface FollowUpOutput {
  asOf: string;
  threadsScanned: number;
  proposals: FollowUpProposal[];
  sunk: number;
  noOutboundNote: string;
}

export const DEFAULT_STALE_AFTER_DAYS = 4;
export const DEFAULT_MAX_NUDGES_PER_RUN = 5;
export const DEFAULT_FOLLOW_UP_LOOKBACK_DAYS = 30;
