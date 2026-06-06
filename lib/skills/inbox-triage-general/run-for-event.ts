/**
 * lib/skills/inbox-triage-general/run-for-event.ts
 *
 * Production entry point that wires the inbox-triage skill into the
 * webhook-event sweep (`lib/inngest/functions/process-webhook-event.ts`).
 * Designed to be called for EVERY WebhookEvent the sweep processes —
 * alongside the existing read → categorize → coordinate → schedule →
 * draft chain — so every workspace with an active Gmail/M365 credential
 * gets inbox-triage proposals as its mail arrives.
 *
 * Per the audit (`docs/agent-interviews/01-runtime-skills.md`):
 *   "No production caller. The wrapper already binds RecordingTriageApprovalSink
 *    in tests; the approval-queue path lights up the moment a Prisma sink + caller exist."
 * This file IS that caller, paired with `./prisma-approval-sink.ts`.
 *
 * Shape:
 *   - Caller passes a `MessageFetcher` (either `GmailMessageAdapter` or
 *     `OutlookMessageAdapter`) already built for the credential's
 *     provider, plus the WebhookEvent row.
 *   - We fetch the messages the same way the chain does — via
 *     `fetcher.fetchMessagesForEvent(event)` — so the triage skill runs
 *     against the same payload the chain saw. (The Gmail / Outlook MCP
 *     server caches nothing across calls; the second fetch is a fresh
 *     read, which keeps cold-start safety honest.)
 *   - We adapt `ParsedMessage[]` to `TriageMessage[]` via the
 *     `ParsedMessageTriageFetcher` and run the skill with
 *     `PrismaTriageApprovalSink` so each proposal lands as an
 *     `INBOX_TRIAGE` row tagged with the right discipline.
 *
 * Per `project_no_outbound_architecture.md`: no send, no inbox label
 * change — drafted ack only, attached to the approval row.
 *
 * Per `feedback_cold_start_safe_agents.md`: every call re-reads the
 * messages from the MCP server (which itself re-resolves the
 * credential). No instance memoizes anything across events.
 *
 * Per `feedback_runner_portability.md`: the helper takes a `fetcher`
 * argument so the caller picks the provider impl. Tests pass a stub
 * fetcher to assert end-to-end without touching real Gmail / Outlook.
 */

import type { WebhookEvent } from '@prisma/client';
import { skillError, skillOk, type SkillResult } from '../types';
import type { MessageFetcher } from '../types';
import {
  DEFAULT_INBOX_TRIAGE_CONFIG,
  readInboxTriageConfig,
  type InboxTriageConfig,
} from '@/lib/skills/config';
import { SYSTEM_OPERATOR_CONTEXT } from '@/lib/db';
import { PrismaMemoryStore } from '@/lib/plaino/memory';
import type { IMemoryStore } from '@/lib/plaino/memory/types';
import type { LlmProvider } from '@/lib/llm/types';
import { buildFeedbackRulesBlock } from '../feedback-rules';
import { getLlmProvider } from '@/lib/llm';
import { ParsedMessageTriageFetcher } from './parsed-message-fetcher';
import { PrismaTriageApprovalSink } from './prisma-approval-sink';
import { runSkill } from './skill';
import type {
  TriageApprovalSink,
  TriageOutput,
} from './types';

export interface RunInboxTriageForEventInput {
  workspaceId: string;
  /** Email provider adapter (Gmail or Outlook) — already constructed
   *  by `process-webhook-event` from the credential. */
  fetcher: MessageFetcher;
  event: WebhookEvent;
  /** Override sink — defaults to `PrismaTriageApprovalSink`. Tests
   *  pass a `RecordingTriageApprovalSink` to assert no-outbound
   *  without touching the database. */
  sink?: TriageApprovalSink | null;
  /** Clock injection for deterministic tests. */
  now?: Date;
  /** Sink threshold — proposals below this confidence skip persistence.
   *  Defaults to 0.4 (matches the inbox-triage noise floor) so noise
   *  doesn't flood the operator's queue. */
  sinkThreshold?: number;
  /** Wave-2 per-skill config override. When provided, the caller passed
   *  the customer's config explicitly (test pattern + the future
   *  config-cached-in-cron pattern). When omitted, this caller reads
   *  it from `SkillConfig` via `readInboxTriageConfig`. */
  config?: InboxTriageConfig;
  /** When true, skip the per-skill config DB read entirely and use
   *  defaults. The unit test seam — exercises the runner without
   *  spinning up Prisma. */
  skipConfigRead?: boolean;
  /** Wave-4 — override the memory store (used to read FEEDBACK rules).
   *  Defaults to PrismaMemoryStore; pass null to skip the LLM
   *  refinement entirely (heuristic-only). */
  memory?: IMemoryStore | null;
  /** Wave-4 — override the LLM provider. Defaults to getLlmProvider().
   *  Pass null to skip the LLM refinement entirely (heuristic-only). */
  llm?: LlmProvider | null;
}

export interface RunInboxTriageForEventOutput {
  /** Number of messages fed into the triage skill. */
  messagesScanned: number;
  /** Number of proposals the sink accepted. */
  sunk: number;
  /** Full skill output for callers that want the proposals list. */
  triage: TriageOutput;
}

const DEFAULT_SINK_THRESHOLD = 0.4;

export async function runInboxTriageForEvent(
  input: RunInboxTriageForEventInput,
): Promise<SkillResult<RunInboxTriageForEventOutput>> {
  // Re-fetch the messages the same way the email chain does. The MCP
  // server is cold-start safe — it never caches the decrypted token —
  // so this second fetch is honestly fresh. Per the Gmail per-user
  // quota (~600 reads/min) and webhook cadence (~minutes-apart push),
  // doubling the fetch per event stays well under quota.
  const messagesRes = await input.fetcher.fetchMessagesForEvent(input.event);
  if (!messagesRes.ok) {
    return skillError(
      'UPSTREAM_GMAIL_ERROR',
      `inbox-triage fetcher (${input.fetcher.name}) failed: ${messagesRes.error.message}`,
      messagesRes.error.code,
    );
  }
  if (messagesRes.value.length === 0) {
    return skillOk({
      messagesScanned: 0,
      sunk: 0,
      triage: {
        asOf: (input.now ?? new Date()).toISOString(),
        inboxScanned: 0,
        proposals: [],
        sunk: 0,
        noOutboundNote:
          'No messages on this WebhookEvent — triage skipped cleanly.',
      },
    });
  }

  const sink =
    input.sink === undefined ? new PrismaTriageApprovalSink() : input.sink;
  const triageFetcher = new ParsedMessageTriageFetcher({
    workspaceId: input.workspaceId,
    messages: messagesRes.value,
  });
  // Wave-2 per-skill config: read customer-defined priority keywords
  // at fire time. Empty list = no customer cues; defaults stay
  // identical. Per `feedback_cold_start_safe_agents.md` this is a
  // durable read every fire, never cached across events. The
  // `config` override + `skipConfigRead` flag let unit tests bypass
  // the DB read.
  const skillConfig: InboxTriageConfig =
    input.config ??
    (input.skipConfigRead
      ? DEFAULT_INBOX_TRIAGE_CONFIG
      : await readInboxTriageConfig(input.workspaceId));

  // Wave-4 — read FEEDBACK rules under the inbox-triage scope so the
  // LLM refinement seam can apply workspace-specific priority overrides.
  // Memory + LLM are both injectable; passing null on either skips the
  // refinement (used by tests that only want the heuristic).
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
        scopes: ['inbox-triage'],
      });
    } catch (err) {
      console.warn(
        `inbox-triage: failed to read FEEDBACK rules — continuing heuristic-only. ${
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

  const result = await runSkill({
    workspaceId: input.workspaceId,
    fetcher: triageFetcher,
    sink: sink ?? undefined,
    now: input.now,
    sinkThreshold: input.sinkThreshold ?? DEFAULT_SINK_THRESHOLD,
    extraUrgentCues: skillConfig.priorityKeywords,
    flagFromSenders: skillConfig.flagFromSenders,
    autoArchiveSenders: skillConfig.autoArchiveSenders,
    llm: llmForRefine ?? undefined,
    feedbackRulesBlock,
  });
  if (!result.ok) return result;
  return skillOk({
    messagesScanned: messagesRes.value.length,
    sunk: result.value.sunk,
    triage: result.value,
  });
}
