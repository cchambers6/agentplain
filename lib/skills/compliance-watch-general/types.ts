/**
 * lib/skills/compliance-watch-general/types.ts
 *
 * Wave-3 discipline-wrap skill — legal. Per
 * `docs/fleet-autonomy-audit-2026-05-28.md` §10 the legal discipline
 * was NOT-DELIVERING for non-realty verticals; this daily sweep is the
 * first production caller that lands legal-tagged rows on every active
 * workspace.
 *
 * Daily 8am ET cron. Reads the trailing 24h of approval-queue items
 * (their decrypted draft bodies), runs the sentinel corpus + a generic
 * PII pattern against each, and DRAFTS one digest row when at least
 * one flag was matched. When nothing matched, no row lands — the legal
 * discipline only surfaces on real findings.
 *
 * Per `project_no_outbound_architecture.md`: the skill DRAFTS for the
 * operator to review; it never auto-blocks, auto-edits, or notifies
 * counsel directly.
 */

import type { SkillResult } from '../types';

/** A single match the sweep found in a recent approval. */
export interface ComplianceMatch {
  /** WorkApprovalQueueItem.id this match came from. */
  approvalItemId: string;
  approvalKind: string;
  /** What rule matched — sentinel corpus rule id OR a built-in pattern. */
  ruleId: string;
  ruleSeverity: 'INFO' | 'LOW' | 'MEDIUM' | 'HIGH' | 'BLOCKER';
  /** Short label — e.g. "fair-housing literal match", "PII-email leakage". */
  ruleLabel: string;
  /** Excerpt of the matched span. Truncated to 120 chars for the payload. */
  excerpt: string;
  /**
   * Rewrite-and-stage (pride-audit theme #9). The compliant replacement
   * sentence Plaino drafted for the flagged span — turns the alert into a
   * one-tap fix on /approvals. Null when no rewrite was produced (a PII
   * pattern with no corpus rule, or a counsel-gated vertical). Only sentinel
   * corpus matches carry a rewrite; the suggestion is grounded in the rule
   * that fired and rides with `rewriteCitation`.
   */
  suggestedReplacement?: string | null;
  /** Where the rewrite came from — `learned` (counsel red-line loop),
   *  `llm`, `fallback` (deterministic, no-LLM), or `gated` (counsel
   *  sign-off pending). Absent for non-rewrite matches (PII patterns). */
  rewriteSource?: 'learned' | 'llm' | 'fallback' | 'gated';
  /** Formal citation grounding the rewrite (the rule's source ref). */
  rewriteCitation?: string | null;
  /** Counsel-handoff note when the vertical is gated (rewriteSource='gated'). */
  rewriteGateNote?: string | null;
}

export interface ComplianceSnapshot {
  workspaceId: string;
  workspaceName: string;
  verticalSlug: string;
  windowFrom: string;
  windowTo: string;
  /** All matches found in window — already capped to a reasonable
   *  number (50) to keep the digest manageable. */
  matches: ComplianceMatch[];
  /** Approval rows we scanned this window so the operator knows the
   *  coverage was real. */
  approvalsScanned: number;
}

export interface ComplianceProposal {
  proposalId: string;
  forDate: string;
  /** LLM-composed prose explaining what was flagged + what to do.
   *  Falls back to a templated body when the LLM fails. */
  body: string;
  matches: ComplianceMatch[];
  snapshot: ComplianceSnapshot;
}

export interface ComplianceApprovalSink {
  readonly name: string;
  record(args: {
    workspaceId: string;
    proposal: ComplianceProposal;
  }): Promise<SkillResult<{ sinkId: string }>>;
}

export interface ComplianceSkillInput {
  workspaceId: string;
  snapshot: ComplianceSnapshot;
  sink?: ComplianceApprovalSink;
  feedbackRulesBlock?: string;
  now?: Date;
  llm?: import('../../llm/types').LlmProvider;
}

export interface ComplianceSkillOutput {
  proposal: ComplianceProposal | null;
  sunk: boolean;
  noOutboundNote: string;
}

export const COMPLIANCE_AGENT_SLUG = 'compliance-watch-general';
export const COMPLIANCE_REF_TABLE = 'ComplianceDigestProposal';
