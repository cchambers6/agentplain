/**
 * lib/skills/research-on-demand-general/types.ts
 *
 * Wave-3 discipline-wrap skill — research. Per
 * `docs/fleet-autonomy-audit-2026-05-28.md` §10 the research discipline
 * was NOT-DELIVERING; this skill is the first production caller.
 *
 * Unlike the cron-driven analytics/marketing/legal skills, research
 * fires REACTIVELY: when /talk's classifier flags an instruction as
 * targetDiscipline='research', the instruction-handler picks up
 * this skill instead of the generic drafter. The skill:
 *
 *   1. Queries the workspace's CUSTOMER-scoped knowledge substrate
 *      (same MCP-fronted port the support-handler uses) for snippets
 *      relevant to the instruction text.
 *   2. Drafts a structured research brief: summary + key findings +
 *      open questions / gaps + citations.
 *   3. Stores the brief back into the same PLAINO_INSTRUCTION approval
 *      queue row (the row was created by the dispatcher; this skill
 *      attaches the drafted brief).
 *
 * Honesty bar — there is NO public web-search adapter in the repo
 * today. The brief is grounded EXCLUSIVELY on the workspace's own
 * knowledge substrate. When the substrate is empty for a query, the
 * brief says so explicitly ("Plaino did not find anything relevant in
 * your knowledge base — wire a knowledge source (Drive, Notion) or
 * try a more specific topic"). The "gaps" surface NAMES the web-
 * search gap so the customer sees the honest scope.
 *
 * Per `project_no_outbound_architecture.md`: drafts only. The brief
 * lands in the approval queue.
 */

import type { SkillResult } from '../types';
import type { SupportContextSnippet } from '../support-handler';

export interface ResearchBriefCitation {
  /** Source title — from the substrate snippet. */
  title: string;
  /** URL when the substrate has one. */
  sourceUrl: string | null;
  /** Cosine similarity in [0, 1]. */
  similarity: number;
}

export interface ResearchBrief {
  /** One-paragraph summary the operator reads first. */
  summary: string;
  /** 3-5 key findings, each a single sentence. */
  keyFindings: string[];
  /** What the brief could NOT answer + why. Names specific gaps:
   *  "Plaino does not have a web-search adapter wired yet" /
   *  "your knowledge base did not contain anything on X". */
  gaps: string[];
  /** Citations the brief is grounded on. Empty when the substrate
   *  returned nothing — the gaps section is the honest signal in that
   *  case. */
  citations: ResearchBriefCitation[];
}

export interface ResearchSkillInput {
  /** Instruction text from the customer's /talk turn. */
  instructionText: string;
  /** Dispatcher's one-line context. */
  dispatcherReasoning: string;
  /** Workspace id — used to scope the substrate query. */
  workspaceId: string;
  /** Substrate port. Production binds CustomerFilesKnowledgeSubstrate
   *  (MCP-fronted); tests bind RecordingKnowledgeSubstrate. */
  substrate: IResearchSubstratePort;
  /** Pre-rendered FEEDBACK rules block. Empty string when none set. */
  feedbackRulesBlock?: string;
  /** Cap on substrate snippets. Default 6. */
  topK?: number;
  /** Optional LLM provider override. Defaults to `getLlmProvider()`. */
  llm?: import('../../llm/types').LlmProvider;
  /** Whether the bound substrate grounds on LIVE web sources (wave-5,
   *  theme #11). When true the skill DROPS the "no web search wired" gap
   *  and labels citations as live sources; when false (or omitted) the
   *  honest "grounded on your knowledge base / fixture corpus only" gap is
   *  retained. Defaults to false to preserve the pre-wave-5 behavior. */
  groundingIsLive?: boolean;
}

export interface ResearchSkillOutput {
  brief: ResearchBrief;
  /** Snippets actually returned by the substrate, surfaced for the
   *  approval-queue payload so the operator can verify grounding. */
  substrateSnippets: SupportContextSnippet[];
  /** Whether the brief had to fall back to a "nothing found" pattern. */
  isPlaceholder: boolean;
  noOutboundNote: string;
}

/**
 * Port the skill uses for substrate lookups. Production wraps
 * `CustomerFilesKnowledgeSubstrate` (the same one support-handler uses);
 * tests inject `RecordingKnowledgeSubstrate`.
 *
 * Per the two-implementation rule we keep this surface narrow.
 */
export interface IResearchSubstratePort {
  readonly name: string;
  searchForResearch(args: {
    workspaceId: string;
    query: string;
    k: number;
  }): Promise<SupportContextSnippet[]>;
}

export const RESEARCH_AGENT_SLUG = 'research-on-demand-general';
