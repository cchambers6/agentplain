/**
 * lib/skills/customer-support-triage/types.ts
 *
 * Pillar-3 of the self-healing fleet: PLAINO AS L1 SUPPORT. The contract
 * for the customer-support-triage skill — the thing that stands between a
 * local-business owner's support question and a black hole.
 *
 * The bar: if Conner died tomorrow, a customer with a support question
 * gets a correct answer in minutes OR an honest escalation with a 24h
 * deadline — never silence. This module is the decision core; it routes
 * every inbound support message (the /help SupportRequest path AND the
 * in-app help chat, which both funnel through submitSupportRequest →
 * support-handler-on-create) into exactly one of four outcomes:
 *
 *   1. ESCALATED      — paged a designated human via lib/ops/page-human
 *                       with full context + a 24h deadline, AND the
 *                       customer told (honestly) a human will reply
 *                       within one business day. The conversation is
 *                       marked escalated so Plaino stops auto-replying.
 *   2. AUTO_ANSWERED   — KB confidence > threshold: a grounded reply,
 *                       signed by Plaino, never claiming to be human.
 *   3. AUTO_RESOLVED   — a bounded, zero-dollar account action taken
 *                       through the EXISTING bounded-execute rails
 *                       (lib/skills/bounded-execute.ts). Anything
 *                       touching money stays a draft.
 *   4. DRAFTED         — confidence below threshold OR autonomy off:
 *                       falls through to the EXISTING
 *                       SUPPORT_HANDLER_REPLY_DRAFT approval path. This
 *                       IS the self-routing outcome — it's a good
 *                       failure, not a black hole.
 *
 * Per project_no_outbound_architecture.md: this skill NEVER sends. An
 * auto-answer is a reply text returned to the caller's existing reply
 * path; an auto-resolve is an allowlisted draft pre-blessed for the
 * customer's own execution path. The page is the one allowed
 * notification (an internal alert, not customer outbound).
 *
 * Per feedback_cold_start_safe_agents.md: every decision reads durable
 * policy fresh (KB sources from disk, autonomy flags from the store,
 * escalation constants from env). No cross-fire memory.
 *
 * Per feedback_runner_portability.md: the KB loader, LLM provider, ops
 * flag store, pager, and escalation marker are all injected. The pure
 * decision is testable offline with zero vendor SDKs.
 */

import type { WorkApprovalKind } from '@prisma/client';
import type { LlmProvider } from '../../llm/types';
import type { OpsFlagStore } from '../../ops/flag-store';
import type { PageHumanInput, PageHumanResult } from '../../ops/page-human';
import type { SkillResult } from '../types';

/** The four terminal triage outcomes. Exactly one fires per message. */
export type TriageDecision =
  | 'escalated'
  | 'auto-answered'
  | 'auto-resolved'
  | 'drafted';

/** Why an escalation fired. Surfaced in the page + the metrics row so the
 *  operator can audit the trigger that routed a customer to a human. */
export type EscalationTrigger =
  | 'explicit-human-request'
  | 'legal-or-compliance'
  | 'billing-dispute-over-threshold'
  | 'vulnerability-report'
  | 'mental-health-distress'
  | 'data-deletion-request'
  | 'llm-degraded';

/** A bounded account action the triage layer may auto-resolve. Each maps
 *  to an existing bounded-execute allowlist kind; anything touching money
 *  is deliberately absent. */
export type BoundedAccountAction =
  | 'reconnect-integration-prompt'
  | 'workspace-pause'
  | 'workspace-resume'
  | 'resend-magic-link';

/** The customer's inbound support message, provider-neutral. Built from a
 *  SupportRequest row (or an in-app chat turn) by run-for-request. */
export interface SupportMessageSnapshot {
  /** SupportRequest id (or chat-conversation id) — the durable handle. */
  id: string;
  workspaceId: string;
  workspaceName: string;
  verticalSlug: string | null;
  fromEmail: string;
  fromName: string | null;
  subject: string;
  body: string;
  /** The named service partner for this workspace (e.g. "Plaino"). */
  partnerName: string;
  receivedAt: Date;
}

/** One knowledge-base entry the loader surfaces. Curated source content —
 *  FAQ items + product/brand docs — NOT a vector chunk. */
export interface KbEntry {
  /** Short title (e.g. the FAQ question). */
  title: string;
  /** Full answer / doc body. */
  body: string;
  /** Where it came from, for the operator + audit (e.g. 'faq', 'pricing-doc'). */
  source: string;
}

/** Port the triage layer reads KB content through. Production impl loads
 *  from the in-repo FAQ + docs; tests inject a canned list. Cold-start
 *  safe: load() is called per fire, never cached across fires. */
export interface IKbLoader {
  readonly name: string;
  load(): KbEntry[];
}

/** Port that marks a conversation escalated so Plaino stops auto-replying
 *  on that thread. Production impl advances the SupportRequest status +
 *  writes an audit row; tests record the call. */
export interface IEscalationMarker {
  readonly name: string;
  markEscalated(args: {
    workspaceId: string;
    supportMessageId: string;
    trigger: EscalationTrigger;
  }): Promise<void>;
}

/** Port the triage layer pages a human through. Always lib/ops/page-human
 *  in production (the one fleet-wide escalation choke point); tests inject
 *  a recording pager. */
export type Pager = (input: PageHumanInput) => Promise<PageHumanResult>;

/** Port that records a metrics row per triage decision. The Pillar-6
 *  fleet-health cron reads backlog age + deflection rate off these rows.
 *  Production impl writes an AuditLog row; tests record the call. */
export interface ITriageMetricsSink {
  readonly name: string;
  record(row: TriageMetricsRow): Promise<void>;
}

/** One metrics row per triage decision. Queryable by the Pillar-6 cron. */
export interface TriageMetricsRow {
  workspaceId: string;
  supportMessageId: string;
  decision: TriageDecision;
  /** 0–1 KB confidence the triage layer computed (null for escalations
   *  that fired before any KB attempt, and for degraded-mode). */
  confidence: number | null;
  /** Populated when decision === 'escalated'. */
  escalationTrigger: EscalationTrigger | null;
  /** Populated when decision === 'auto-resolved'. */
  boundedAction: BoundedAccountAction | null;
  /** Whether the LLM was degraded for this fire (escalate-everything). */
  degraded: boolean;
}

/** The reply text the triage layer produces for an auto-answer /
 *  escalation acknowledgement. Always signed by the partner, NEVER
 *  claiming to be human. */
export interface TriageReply {
  subject: string;
  body: string;
}

/** What a single triage pass returns. The caller (run-for-request /
 *  the Inngest fn) decides what to do with it: send the reply through
 *  the existing reply path (auto-answer), stage the bounded draft
 *  (auto-resolve), or hand off to the SUPPORT_HANDLER_REPLY_DRAFT path
 *  (drafted). The page + escalation marker + metrics are already done
 *  inside the pass — the caller only relays the customer-facing reply. */
export interface TriageOutput {
  decision: TriageDecision;
  /** The customer-facing reply. Present for escalated + auto-answered;
   *  null for drafted (the draft path owns the reply) and auto-resolved
   *  (the bounded action carries its own confirmation draft). */
  reply: TriageReply | null;
  /** KB confidence in [0,1] when a KB attempt ran; null otherwise. */
  confidence: number | null;
  escalationTrigger: EscalationTrigger | null;
  boundedAction: BoundedAccountAction | null;
  /** True when the LLM was unavailable and we degraded to escalate-only. */
  degraded: boolean;
  /** The page result when an escalation paged a human; null otherwise.
   *  Surfaced so the caller can log delivery + the test can assert it. */
  page: PageHumanResult | null;
  /** Human-readable detail for the operator surface + the audit. */
  detail: string;
}

/** Everything one triage pass needs. Pure over its injected ports. */
export interface TriageInput {
  message: SupportMessageSnapshot;
  /** KB content source. */
  kb: IKbLoader;
  /** LLM for the KB-confidence judge + the grounded answer. Omit/undefined
   *  is treated as degraded (escalate-everything). */
  llm: LlmProvider | undefined;
  /** Ops flag store for the bounded-execute autonomy resolution. */
  store: OpsFlagStore;
  /** Pages a human. Defaults to lib/ops/page-human in production. */
  pager: Pager;
  /** Marks the conversation escalated. */
  escalationMarker: IEscalationMarker;
  /** Records the per-decision metrics row. */
  metrics: ITriageMetricsSink;
  /** Env snapshot for the tunable constants. Defaults to process.env. */
  env?: NodeJS.ProcessEnv;
  /** Fixed clock for tests. */
  now?: Date;
}

export type TriageResult = SkillResult<TriageOutput>;

/** Map a bounded account action to the WorkApprovalKind whose allowlist
 *  entry governs it. Every action here MUST be on the bounded-execute
 *  reversibility allowlist (lib/skills/bounded-execute.ts) — money-moving
 *  actions are deliberately excluded and stay draft-for-review. */
export const BOUNDED_ACTION_KIND: Record<BoundedAccountAction, WorkApprovalKind> = {
  // Surfacing a "reconnect your integration" prompt + a one-time relink
  // is read/draft only; reuses the verification-code card class.
  'reconnect-integration-prompt': 'ADMIN_VERIFICATION_CODE',
  // Pause/resume is an internal workspace state flip; reuses the to-do
  // class (purely internal, trivially reversible).
  'workspace-pause': 'CHIEF_OF_STAFF_TODO',
  'workspace-resume': 'CHIEF_OF_STAFF_TODO',
  // Re-sending a magic link surfaces a one-time code card; read-only.
  'resend-magic-link': 'ADMIN_VERIFICATION_CODE',
};
