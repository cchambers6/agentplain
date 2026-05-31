/**
 * lib/skills/analytics-weekly-pulse-general/types.ts
 *
 * Wave-3 discipline-wrap skill — analytics. Drafts a weekly read of
 * what the fleet did in the workspace + where it's underused +
 * what to lean into. Per `docs/fleet-autonomy-audit-2026-05-28.md`
 * §10 the analytics discipline was NOT-DELIVERING; this skill is
 * the first production caller that lands real rows under it.
 *
 * Per `project_no_outbound_architecture.md`: the skill READS state +
 * DRAFTS one row. Never sends to the customer.
 *
 * Per `feedback_runner_portability.md`: the snapshot reader + sink are
 * both ports the caller injects.
 */

import type { SkillResult } from '../types';

/** What "Plaino did this week" surfaced in the pulse. Sourced from
 *  WorkApprovalQueueItem + ChatMessage + LlmUsageRecord (counts only —
 *  no body text crosses into the pulse prompt). */
export interface PulseActivitySnapshot {
  workspaceId: string;
  workspaceName: string;
  windowFrom: string;
  windowTo: string;
  /** Counts the LLM grounds the brief on. */
  counts: {
    approvalsCreated: number;
    approvalsApproved: number;
    approvalsRejected: number;
    approvalsPending: number;
    chatThreads: number;
    instructions: number;
    learnedNotes: number;
  };
  /** Top approval kinds with throughput so the brief can call out
   *  "your inbox-triage ran 12 times, all approved". */
  topKindsByThroughput: Array<{
    kind: string;
    proposed: number;
    approved: number;
    rejected: number;
  }>;
  /** Skills NOT firing this week — surfaced as "underused / consider
   *  installing" cues. */
  installedSkillsNotFiring: string[];
}

export interface PulseProposal {
  proposalId: string;
  /** Week the pulse covers — ISO yyyy-MM-dd of the Monday at top of week. */
  forWeekStarting: string;
  /** LLM-composed prose; falls back to a templated body on LLM failure
   *  so /approvals never gets a hollow card. */
  body: string;
  /** Counts the brief was grounded in, surfaced in the approval payload
   *  so the operator can verify the brief reflects the workspace state. */
  snapshot: PulseActivitySnapshot;
  /** What the brief proposes the operator do this week — bullet
   *  fragments parsed back out of the body for the approval card
   *  affordances. Empty list = nothing actionable. */
  recommendations: string[];
}

export interface PulseApprovalSink {
  readonly name: string;
  record(args: {
    workspaceId: string;
    proposal: PulseProposal;
  }): Promise<SkillResult<{ sinkId: string }>>;
}

export interface PulseSkillInput {
  workspaceId: string;
  snapshot: PulseActivitySnapshot;
  sink?: PulseApprovalSink;
  /** Plaintext FEEDBACK-rules block (already rendered) to inject into
   *  the pulse prompt under CUSTOMER PREFERENCES. Empty string = no
   *  preferences set (no header rendered). */
  feedbackRulesBlock?: string;
  /** Fixed clock for tests. */
  now?: Date;
  /** Optional LLM override. Defaults to `getLlmProvider()` at runtime. */
  llm?: import('../../llm/types').LlmProvider;
}

export interface PulseSkillOutput {
  proposal: PulseProposal;
  sunk: boolean;
  noOutboundNote: string;
}

export const PULSE_AGENT_SLUG = 'analytics-weekly-pulse-general';
export const PULSE_REF_TABLE = 'AnalyticsPulseProposal';
