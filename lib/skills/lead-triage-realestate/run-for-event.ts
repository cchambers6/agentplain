/**
 * lib/skills/lead-triage-realestate/run-for-event.ts
 *
 * Production entry point that wires the real-estate lead-triage skill
 * into the wave-1 vertical webhook router. Designed to be called for
 * every WebhookEvent the sweep processes ON A real-estate workspace.
 * Other verticals get NO call to this function (the router is the seam).
 *
 * Per `feedback_cold_start_safe_agents.md`: every call re-reads the
 * messages from the MCP server. No instance memoizes anything across
 * events.
 *
 * Per `project_no_outbound_architecture.md`: triage produces a routing
 * recommendation + first-touch DRAFT. Wave 2 auto-pushes that draft into
 * the broker's Gmail / M365 Drafts folder for HOT and WARM leads (via
 * `./drafts-persister.ts`, gated by `LIVE_INBOX_FETCH`, fixtures in dev);
 * cold + nurture drafts still ride into /approvals only. A Gmail DRAFT is
 * the allowed RECEIVE-shape write (`users.drafts.create`) — the broker
 * still presses send. The lead-triage approval row ALSO lands regardless,
 * so the routing decision stays reviewable.
 *
 * Per the honesty bar — when the inbound message can't be derived into
 * a LeadRecord (no body, no-reply sender, etc.) the skill cleanly
 * processes zero leads and writes nothing. Nothing fake lands in the
 * queue.
 */

import type { WebhookEvent } from '@prisma/client';
import { skillError, skillOk, type SkillResult } from '../types';
import type { DraftPersister, MessageFetcher } from '../types';
import { SYSTEM_OPERATOR_CONTEXT } from '@/lib/db';
import { PrismaMemoryStore } from '@/lib/plaino/memory';
import { getLlmProvider } from '@/lib/llm';
import { buildFeedbackRulesBlock } from '../feedback-rules';
import type { IMemoryStore } from '@/lib/plaino/memory/types';
import type { LlmProvider } from '@/lib/llm/types';
import { ParsedMessageLeadFetcher } from './parsed-message-fetcher';
import { PrismaLeadTriageApprovalSink } from './prisma-approval-sink';
import type { LeadTriageApprovalSink } from './prisma-approval-sink';
import {
  buildLeadDraftPersister,
  HOT_WARM_PERSIST_THRESHOLD,
} from './drafts-persister';
import { runSkill } from './skill';
import type { LeadTriageOutput } from './types';

const LEAD_TRIAGE_SCOPES = ['lead-triage'] as const;

export interface RunLeadTriageForEventInput {
  workspaceId: string;
  /** Email provider adapter (Gmail or Outlook) — already constructed
   *  by `process-webhook-event` from the credential. */
  fetcher: MessageFetcher;
  event: WebhookEvent;
  /** Override sink — defaults to PrismaLeadTriageApprovalSink. Tests
   *  pass a recording sink to assert no-outbound without touching DB. */
  sink?: LeadTriageApprovalSink | null;
  /** Clock injection for deterministic tests. */
  now?: Date;
  /** Sink threshold — drafts below this confidence skip the
   *  firstTouchDraft persistence path. Triage row still lands; just
   *  without a Gmail-side draft (wave-1 default = always null persister). */
  sinkThreshold?: number;
  /** Wave-4 — override the memory store. Defaults to PrismaMemoryStore;
   *  pass null to skip FEEDBACK-rule reads + LLM refinement. */
  memory?: IMemoryStore | null;
  /** Wave-4 — override the LLM provider. Defaults to getLlmProvider();
   *  pass null to skip LLM refinement entirely (heuristic-only). */
  llm?: LlmProvider | null;
  /** Wave-2 — the live Gmail / Outlook draft adapter (the same adapter the
   *  webhook sweep built). Used to auto-push the first-touch draft into the
   *  broker's Drafts folder for hot/warm leads when `LIVE_INBOX_FETCH` is
   *  on. When omitted / off, the fixture persister records the draft so the
   *  seam runs in dev. */
  draftAdapter?: DraftPersister | null;
  /** Wave-2 — override the first-touch drafts persister entirely (tests
   *  pass a recording persister to assert what would be pushed). When set,
   *  the flag + `draftAdapter` are ignored. */
  persister?: DraftPersister | null;
}

export interface RunLeadTriageForEventOutput {
  /** Number of messages that successfully derived to a LeadRecord. */
  leadsProcessed: number;
  /** Number of triage approval rows the sink accepted. */
  sunk: number;
  /** Full triage output for callers that want the per-lead detail. */
  triage: LeadTriageOutput;
}

const DEFAULT_SINK_THRESHOLD = 0.0; // every triaged lead lands a row

export async function runLeadTriageForEvent(
  input: RunLeadTriageForEventInput,
): Promise<SkillResult<RunLeadTriageForEventOutput>> {
  const messagesRes = await input.fetcher.fetchMessagesForEvent(input.event);
  if (!messagesRes.ok) {
    return skillError(
      'UPSTREAM_GMAIL_ERROR',
      `lead-triage fetcher (${input.fetcher.name}) failed: ${messagesRes.error.message}`,
      messagesRes.error.code,
    );
  }
  if (messagesRes.value.length === 0) {
    return skillOk({
      leadsProcessed: 0,
      sunk: 0,
      triage: {
        processed: 0,
        triaged: [],
        categoryCounts: { hot: 0, warm: 0, cold: 0, nurture: 0 },
      },
    });
  }

  const leadFetcher = new ParsedMessageLeadFetcher({
    workspaceId: input.workspaceId,
    messages: messagesRes.value,
  });

  // Wave-4 — read FEEDBACK rules under the lead-triage scope. The skill
  // only invokes the LLM when rules are non-empty (cost guard).
  const memory =
    input.memory === undefined
      ? new PrismaMemoryStore(input.workspaceId, {
          ctx: SYSTEM_OPERATOR_CONTEXT,
        })
      : input.memory;
  let feedbackRulesBlock = '';
  if (memory) {
    try {
      feedbackRulesBlock = await buildFeedbackRulesBlock({
        memory,
        workspaceId: input.workspaceId,
        scopes: LEAD_TRIAGE_SCOPES,
      });
    } catch (err) {
      console.warn(
        `lead-triage: failed to read FEEDBACK rules — continuing heuristic-only. ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }
  const llmForRefine =
    input.llm === undefined
      ? memory && feedbackRulesBlock.length > 0
        ? getLlmProvider()
        : null
      : input.llm;

  // Wave-2 — auto-push first-touch drafts to Gmail/M365 Drafts for
  // hot/warm leads. The persister resolves to the live adapter only when
  // `LIVE_INBOX_FETCH` is on AND a live adapter was supplied; otherwise the
  // fixture persister records the draft (dev) so the seam runs end-to-end
  // with no live OAuth. The `HOT_WARM_PERSIST_THRESHOLD` (0.7) is what
  // scopes the push to hot/warm — cold/nurture drafts still ride into
  // /approvals but skip the mailbox-side write. Tests pass `persister`
  // explicitly to assert what would be pushed.
  const persister =
    input.persister !== undefined
      ? input.persister
      : buildLeadDraftPersister({ liveAdapter: input.draftAdapter ?? null });

  const skillRes = await runSkill({
    workspaceId: input.workspaceId,
    fetcher: leadFetcher,
    persister,
    persistThreshold: HOT_WARM_PERSIST_THRESHOLD,
    now: input.now,
    llm: llmForRefine ?? undefined,
    feedbackRulesBlock,
  });
  if (!skillRes.ok) return skillRes;

  // Honesty seam — when no message derived to a LeadRecord we skip the
  // sink entirely. Better than writing zero-row "lead-triage produced
  // nothing" placeholders.
  if (skillRes.value.triaged.length === 0) {
    return skillOk({
      leadsProcessed: 0,
      sunk: 0,
      triage: skillRes.value,
    });
  }

  const sink =
    input.sink === undefined
      ? new PrismaLeadTriageApprovalSink()
      : input.sink;
  let sunk = 0;
  if (sink) {
    const threshold = input.sinkThreshold ?? DEFAULT_SINK_THRESHOLD;
    for (const lead of skillRes.value.triaged) {
      // Use the composite score as the persistence gate — nurture-tier
      // leads at the very bottom can still land if threshold=0 (the
      // default), but the seam is there so a workspace can raise the
      // bar via threshold config later.
      if (lead.scores.composite < threshold) continue;
      const res = await sink.record({
        workspaceId: input.workspaceId,
        triaged: lead,
      });
      if (res.ok) sunk += 1;
    }
  }
  return skillOk({
    leadsProcessed: skillRes.value.triaged.length,
    sunk,
    triage: skillRes.value,
  });
}
