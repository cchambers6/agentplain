/**
 * lib/skills/support-handler/types.ts
 *
 * Contract for the support-handler skill — the fleet-side handler that
 * fires when a customer submits a SupportRequest from /help.
 *
 * Today every /help submission lands in a human inbox (SUPPORT_EMAIL =
 * hello@) and the operator triages by hand. This skill closes the
 * biggest "no human at agentplain in the loop" gap surfaced by the
 * self-serve readiness audit (PR #97) + UX re-eval (PR #109): it reads
 * the request, queries the knowledge substrate for relevant context,
 * and drafts a first-touch reply that lands in the operator's approval
 * queue. Approval routes through the same external-execution path the
 * existing operator email flow uses; the skill itself never sends.
 *
 * Per project_no_outbound_architecture.md: this skill DRAFTS ONLY. No
 * email goes from agentplain to the customer. The customer's existing
 * operator email path is the executor of an approved draft.
 *
 * Per feedback_runner_portability.md two-implementation rule:
 *   - IKnowledgeSubstratePort: ProductionKnowledgeSubstrate (via
 *     retrieveCustomerContext / MCP boundary) + RecordingKnowledgeSubstrate
 *     (test, returns canned snippets).
 *   - ApprovalSink: PrismaApprovalSink (production) + RecordingApprovalSink
 *     (test).
 * Skills never construct vendor SDKs directly.
 *
 * Per feedback_cold_start_safe_agents.md: every run reads durable state
 * from the SupportRequest row. The skill holds no cross-fire memory.
 *
 * Per project_hierarchical_approval_chain (memory rule): the draft lands
 * in the operator's queue. Only escalations reach Conner. The skill
 * marks LOW_CONFIDENCE drafts so the operator can route them to escalation
 * rather than treating them as a one-click approve.
 */

import type { SkillResult } from '../types';

/** Confidence tier the skill assigns to a synthesized draft. */
export type SupportDraftConfidence = 'high' | 'medium' | 'low' | 'placeholder';

/** A single snippet the substrate returned, surfaced in the draft so
 *  the operator can verify the source. */
export interface SupportContextSnippet {
  title: string;
  /** Excerpt that grounded the draft. Truncated server-side to keep
   *  the approval payload bounded. */
  bodyExcerpt: string;
  /** URL when the substrate has one (e.g. a doc reference). NULL for
   *  vector-embedded chunks without an external source. */
  sourceUrl: string | null;
  /** Cosine similarity in [0, 1]. The operator weighs higher-similarity
   *  snippets more heavily when reviewing. */
  similarity: number;
}

/** Port the skill calls to fetch knowledge-substrate snippets. The
 *  production impl uses retrieveCustomerContext (MCP-boundary). Tests
 *  swap in a recording impl that returns canned snippets. */
export interface IKnowledgeSubstratePort {
  readonly name: string;
  searchForRequest(args: {
    workspaceId: string;
    query: string;
    k: number;
  }): Promise<SupportContextSnippet[]>;
}

/** Output of one support-handler run. Either a drafted reply (with
 *  citations) or a placeholder when the substrate returned nothing
 *  high-confidence — never a fabricated answer. */
export interface SupportDraftProposal {
  proposalId: string;
  /** Source SupportRequest the draft was synthesized from. */
  supportRequestId: string;
  /** Subject line for the reply. Defaults to `Re: <original subject>`. */
  subject: string;
  /** Plain-text body of the reply. */
  body: string;
  /** Confidence tier the skill assigned. */
  confidence: SupportDraftConfidence;
  /** Snippets cited in the draft. EMPTY for placeholder drafts (which
   *  by definition have no grounding to cite). */
  citations: SupportContextSnippet[];
  /** Human-readable rationale — surfaces in the audit log. */
  reasoning: string;
  /** Operator-action hint. Always one of:
   *  - 'approve': draft is high-confidence, citations cover the ask.
   *  - 'edit-then-send': medium confidence, operator should review.
   *  - 'escalate': low confidence; this is the operator's tell to flag
   *    to Conner per the hierarchical approval chain.
   *  - 'placeholder': substrate had nothing; templated holding reply. */
  suggestedAction: 'approve' | 'edit-then-send' | 'escalate' | 'placeholder';
}

/** Approval-sink port. Identical shape to the chief-of-staff sink so
 *  the production binding can be cloned with the right `agentSlug` /
 *  `kind` / `refTable`. */
export interface ApprovalSink {
  readonly name: string;
  record(args: {
    workspaceId: string;
    proposal: SupportDraftProposal;
  }): Promise<SkillResult<{ sinkId: string }>>;
}

export interface SupportRequestSnapshot {
  id: string;
  workspaceId: string;
  workspaceName: string;
  verticalSlug: string | null;
  fromEmail: string;
  fromName: string | null;
  subject: string;
  body: string;
  /** Service-partner first name to sign the draft with. Defaults to
   *  Plaino per project_plaino_named_agent. */
  partnerName: string;
  /** When the customer submitted the request. */
  receivedAt: Date;
}

export interface SupportHandlerInput {
  workspaceId: string;
  request: SupportRequestSnapshot;
  substrate: IKnowledgeSubstratePort;
  /** Optional override for the LLM provider — tests pass a TestLlmProvider
   *  seeded with a deterministic JSON response. Production reads the
   *  default from getLlmProvider(). */
  llm?: import('../../llm/types').LlmProvider;
  /** Top-K substrate snippets to retrieve. Default 5. Capped at 10. */
  topK?: number;
  /** Cosine-similarity floor for a "confident" hit. Below this the
   *  skill falls back to the placeholder draft. Default 0.55. */
  highConfidenceSimilarityFloor?: number;
  /** Mid-confidence floor — between this and the high floor, draft is
   *  marked 'edit-then-send'. Default 0.35. */
  mediumConfidenceSimilarityFloor?: number;
  /** When provided, the skill records the proposal through this sink in
   *  addition to returning it. */
  sink?: ApprovalSink | null;
  /** Wave-3 phase 4 — pre-rendered FEEDBACK rules block (already
   *  filtered by the run-for-* wrapper to the customer-comms /
   *  email-draft scopes). Empty string when none apply; the prompt
   *  builder omits the CUSTOMER PREFERENCES header in that case. */
  feedbackRulesBlock?: string;
  /** Fixed clock for tests. Defaults to new Date(). */
  now?: Date;
}

export interface SupportHandlerOutput {
  proposal: SupportDraftProposal;
  /** True when the sink (if any) accepted the proposal. */
  sunk: boolean;
  /** Snapshot of the substrate hit counts for debugging. */
  substrate: {
    requested: number;
    returned: number;
    highConfidenceHits: number;
  };
  /** Note recorded in the audit trail so the no-outbound stance is
   *  explicit in every run. */
  noOutboundNote: string;
}

export const DEFAULT_TOP_K = 5;
export const DEFAULT_HIGH_CONFIDENCE_FLOOR = 0.55;
export const DEFAULT_MEDIUM_CONFIDENCE_FLOOR = 0.35;
/** Cap on snippet body length surfaced in the approval payload so a
 *  long doc chunk doesn't blow the row size. The full body still lives
 *  in the substrate; this is the operator-visible excerpt. */
export const SNIPPET_EXCERPT_CHAR_CAP = 600;
