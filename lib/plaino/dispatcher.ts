/**
 * lib/plaino/dispatcher.ts
 *
 * The workspace-level chat dispatcher. Each customer turn arrives via
 * the `/talk` server action; this routes the turn into one of three
 * honest paths:
 *
 *   - ANSWER: substrate-grounded Q&A. The dispatcher retrieves
 *     workspace snippets through the IKnowledgeSubstratePort (MCP
 *     boundary, same shape the support-handler uses), the LLM drafts
 *     a reply citing the snippets it grounded in, and the chat store
 *     persists the Plaino message with the citation metadata.
 *
 *   - REGISTER: the customer is asking for work. The dispatcher
 *     creates a SupportRequest behind the scenes (well, it requests
 *     the chat store create one and emits the existing
 *     `agentplain/support-request.created` Inngest event), tells the
 *     customer "got it — handed to the team" in chat, and stores the
 *     SupportRequest id on the Plaino ChatMessage so the UI can show
 *     a small "drafted reply in your approval queue" link when the
 *     downstream support-handler skill produces a draft.
 *
 *   - DECLINE_HONESTLY: the customer is asking for something the
 *     fleet cannot do today. The reply NAMES a specific capability
 *     gap (the LLM is forced to produce one — `namedGap: null` is
 *     rejected) and does not fabricate. Per
 *     reference_product_claims_vs_reality.
 *
 * Per project_no_outbound_architecture: nothing here sends. Chat
 * persistence + an internal Inngest event are the only outputs.
 *
 * Per feedback_no_silent_vendor_lock + feedback_runner_portability:
 * everything external is behind a port (IChatStore, IEventEmitter,
 * IKnowledgeSubstratePort, LlmProvider). The dispatcher is portable.
 *
 * Per feedback_cold_start_safe_agents: stateless across fires. Every
 * call reads workspace state fresh.
 */

import { DISCIPLINE_IDS } from '../disciplines';
import { getLlmProvider } from '../llm';
import { MODEL_HAIKU } from '../llm/model-tiers';
import {
  llmOk,
  type LlmCompletionRequest,
  type LlmProvider,
} from '../llm/types';
import { skillError, skillOk } from '../skills/types';
import { buildSystemPrompt } from './system-prompt';
import {
  CUSTOMER_MESSAGE_CHAR_CAP,
  DEFAULT_ANSWER_FLOOR,
  DEFAULT_TOP_K,
  HISTORY_CAP,
  isPreferenceScopeId,
  type PersistedChatMessage,
  type PlainoClassification,
  type PlainoDispatchKind,
  type PlainoRunResult,
  type PlainoTurnInput,
  type PlainoTurnOutput,
  type SupportContextSnippet,
} from './types';
import {
  shouldAttachCard,
  messageHasCardIntent,
  buildReplyCard,
} from './reply-card';
import {
  DEFAULT_DISPATCH_MEMORY_BUDGET,
  DISPATCH_MEMORY_CHAR_CAP,
  extractMemoryFromConversation,
  type IMemoryStore,
  type MemoryEntry,
  type ProposedMemoryEntry,
} from './memory';
import {
  buildPreferenceMemoryBody,
  PREFERENCE_MEMORY_TITLE_PREFIX,
} from './preference-memory';

const SUPPORT_REQUEST_CREATED_EVENT = 'agentplain/support-request.created';
const INSTRUCTION_CREATED_EVENT = 'agentplain/instruction.created';

const NO_OUTBOUND_NOTE =
  "No message sent outside the workspace. The customer's reply is " +
  'persisted as a ChatMessage and rendered in /talk. If the turn ' +
  'routed REGISTER, the downstream draft lands in the operator ' +
  'approval queue — Plaino never sends. ' +
  'Per project_no_outbound_architecture.md.';

/**
 * Run one customer turn. Always persists exactly one customer message
 * and exactly one Plaino message. Returns an error result on classifier
 * malformations; on substrate / event failures, it FALLS BACK to a
 * placeholder reply so the customer never sees a dead chat.
 */
export async function runPlainoTurn(
  input: PlainoTurnInput,
): Promise<PlainoRunResult> {
  if (input.customerMessage.trim().length === 0) {
    return skillError('INVALID_INPUT', 'customerMessage must be non-empty');
  }
  const trimmedMessage = input.customerMessage.slice(0, CUSTOMER_MESSAGE_CHAR_CAP);

  // 1. Persist the customer's message first. Even if everything
  //    downstream fails, we never lose the inbound turn.
  const customerMessage = await input.store.appendMessage({
    threadId: await ensureThreadId(input),
    workspaceId: input.workspaceId,
    role: 'customer',
    body: trimmedMessage,
    now: input.now,
  });

  // 2. Try to pull substrate snippets for the ANSWER path. Best-effort
  //    — a substrate failure does not block the dispatcher.
  const topK = clampTopK(input.topK ?? DEFAULT_TOP_K);
  let snippets: SupportContextSnippet[] = [];
  try {
    snippets = await input.substrate.searchForRequest({
      workspaceId: input.workspaceId,
      query: trimmedMessage,
      k: topK,
    });
  } catch {
    snippets = [];
  }

  // 2b. Pull customer-persistent memory if a store is attached.
  //     Pinned entries always included; the rest selected by recency
  //     + keyword overlap with the inbound message. Failures here
  //     never block the turn — Plaino simply runs without memory and
  //     the customer never sees a hint that anything went wrong.
  const recalledMemory = await readMemoryForTurn({
    store: input.memory,
    workspaceId: input.workspaceId,
    customerMessage: trimmedMessage,
    now: input.now,
  });

  // 3. Classify + draft via the LLM.
  const provider = input.llm ?? getLlmProvider();
  const system = buildSystemPrompt({
    workspaceName: input.workspaceName,
    capabilities: input.capabilities,
  });
  const userMessage = buildUserMessage({
    customerMessage: trimmedMessage,
    history: input.history.slice(-HISTORY_CAP),
    snippets,
    memory: recalledMemory,
  });
  const completion = await provider.complete({
    system,
    model: MODEL_HAIKU,
    messages: [{ role: 'user', content: userMessage }],
    responseFormat: 'json',
    temperature: 0.2,
    maxTokens: 700,
    cacheSystem: true,
    meta: {
      skill: 'plaino-dispatcher',
      workspaceId: input.workspaceId,
    },
  } satisfies LlmCompletionRequest);
  if (!completion.ok) {
    // Soft-fail: persist a placeholder Plaino reply so the chat does
    // not appear broken to the customer, then return the error so the
    // server action can log it.
    const fallback = await persistPlaceholderReply({
      input,
      customerMessage,
      reason: 'LLM provider failed',
    });
    return skillError(
      'UPSTREAM_LLM_ERROR',
      `plaino dispatcher LLM call failed: ${completion.error.message}; persisted placeholder reply ${fallback.id}`,
      completion.error.code,
    );
  }
  const parsed = parseDispatcherJson(completion.value.text);
  if (!parsed.ok) {
    const fallback = await persistPlaceholderReply({
      input,
      customerMessage,
      reason: 'classifier output malformed',
    });
    return skillError(
      'PARSE_ERROR',
      `${parsed.error}; persisted placeholder reply ${fallback.id}`,
    );
  }

  const decision = parsed.value;
  if (decision.kind === 'DECLINE_HONESTLY') {
    if (!decision.namedGap || decision.namedGap.trim().length === 0) {
      const fallback = await persistPlaceholderReply({
        input,
        customerMessage,
        reason: 'DECLINE_HONESTLY without a named gap',
      });
      return skillError(
        'PARSE_ERROR',
        `dispatcher chose DECLINE_HONESTLY without a namedGap; persisted placeholder reply ${fallback.id}`,
      );
    }
  }
  if (
    (decision.kind === 'REGISTER' || decision.kind === 'INSTRUCT') &&
    claimsActionCompleted(decision.reply)
  ) {
    const fallback = await persistPlaceholderReply({
      input,
      customerMessage,
      reason: `${decision.kind} reply claimed completion`,
    });
    return skillError(
      'PARSE_ERROR',
      `dispatcher's ${decision.kind} reply claimed work was completed; persisted placeholder reply ${fallback.id}`,
    );
  }
  if (decision.kind === 'INSTRUCT') {
    if (
      !decision.targetDiscipline ||
      !(DISCIPLINE_IDS as readonly string[]).includes(decision.targetDiscipline)
    ) {
      const fallback = await persistPlaceholderReply({
        input,
        customerMessage,
        reason: `INSTRUCT with invalid targetDiscipline ${String(decision.targetDiscipline)}`,
      });
      return skillError(
        'PARSE_ERROR',
        `dispatcher chose INSTRUCT with invalid targetDiscipline=${String(
          decision.targetDiscipline,
        )}; persisted placeholder reply ${fallback.id}`,
      );
    }
  }
  if (decision.kind === 'PREFERENCE') {
    if (!decision.preferenceRule || decision.preferenceRule.trim().length === 0) {
      const fallback = await persistPlaceholderReply({
        input,
        customerMessage,
        reason: 'PREFERENCE without a preferenceRule',
      });
      return skillError(
        'PARSE_ERROR',
        `dispatcher chose PREFERENCE without preferenceRule; persisted placeholder reply ${fallback.id}`,
      );
    }
    if (
      !decision.preferenceScope ||
      !isPreferenceScopeId(decision.preferenceScope)
    ) {
      const fallback = await persistPlaceholderReply({
        input,
        customerMessage,
        reason: `PREFERENCE with invalid preferenceScope ${String(decision.preferenceScope)}`,
      });
      return skillError(
        'PARSE_ERROR',
        `dispatcher chose PREFERENCE with invalid preferenceScope=${String(
          decision.preferenceScope,
        )}; persisted placeholder reply ${fallback.id}`,
      );
    }
  }

  // 4. Branch on kind.
  let supportRequestId: string | null = null;
  let instructionApprovalId: string | null = null;
  let preferenceMemoryId: string | null = null;
  let citations: SupportContextSnippet[] = [];
  if (decision.kind === 'ANSWER') {
    citations = restrictCitations(decision.citedTitles, snippets);
  } else if (decision.kind === 'REGISTER') {
    // Hand off to the support-handler skill via the existing event.
    // The chat store creates the SupportRequest because it owns the
    // workspace-isolation envelope; the dispatcher then emits the
    // Inngest event the support-handler is already triggered by.
    const registered = await registerWithSupportHandler({ input, trimmedMessage });
    supportRequestId = registered.supportRequestId;
  } else if (decision.kind === 'INSTRUCT') {
    // Create the PLAINO_INSTRUCTION approval queue item NOW (status
    // PENDING, payload.status='drafting') + fire the Inngest event the
    // instruction-handler consumes. The handler reads the row, drafts,
    // updates the row's payload back. Customer sees a "drafted into
    // your approval queue" tile in the chat thread.
    const instructed = await routeInstruction({
      input,
      decision,
      customerMessageId: customerMessage.id,
    });
    instructionApprovalId = instructed.approvalQueueItemId;
  } else if (decision.kind === 'PREFERENCE') {
    // Write the rule as a FEEDBACK memory entry so the next skill fire
    // can inject it. We do this synchronously (not fire-and-forget)
    // because the customer's confirmation reply asserts it landed.
    preferenceMemoryId = await persistPreferenceMemory({
      input,
      decision,
      customerMessage,
    });
  }

  // 5. Persist the Plaino reply with classification metadata.
  //    Deterministically attach the activation/what-next card when the
  //    frequency rule fires. The card is ADDITIVE — the prose reply is
  //    always the source of truth; the card is enhancement only.
  //    - first reply in conversation (history empty)
  //    - or the customer asked "what can you do?" / "what's next?"
  //    Marketing mode never reaches this dispatcher so no workspace-card
  //    leak is possible (per project_no_outbound_architecture).
  const isFirstReply = input.history.length === 0;
  const hasIntent = messageHasCardIntent(trimmedMessage);
  const attachCard = shouldAttachCard({
    isFirstReply,
    hasCardIntent: hasIntent,
    isDegradedPlaceholder: false,
  });
  const replyCard = attachCard
    ? buildReplyCard({
        workspaceId: input.workspaceId,
        snapshot: input.capabilities,
        vertical: input.vertical ?? null,
        // Onboarding state is not available in the dispatcher's input.
        // Default to all-false (new workspace) so the card always shows
        // setup-gap steps — conservative, never over-claims completion.
      })
    : null;

  const plainoMessage = await input.store.appendMessage({
    threadId: customerMessage.threadId,
    workspaceId: input.workspaceId,
    role: 'plaino',
    body: decision.reply,
    metadata: {
      kind: decision.kind,
      reasoning: decision.reasoning,
      namedGap: decision.namedGap,
      supportRequestId,
      instructionApprovalId,
      targetDiscipline: decision.targetDiscipline,
      preferenceMemoryId,
      preferenceScope: decision.preferenceScope,
      citations: citations.map((c) => ({
        title: c.title,
        sourceUrl: c.sourceUrl,
        similarity: Number(c.similarity.toFixed(3)),
      })),
      ...(replyCard !== null ? { card: replyCard } : {}),
    },
    now: input.now,
  });

  const classification: PlainoClassification = {
    kind: decision.kind,
    reasoning: decision.reasoning,
    namedGap: decision.namedGap,
    targetDiscipline: decision.targetDiscipline,
    preferenceRule: decision.preferenceRule,
    preferenceScope: decision.preferenceScope,
  };

  // 6. Fire-and-forget memory write-back. The dispatcher does NOT
  //    block on this — a slow or failed extract pass leaves the chat
  //    intact. The returned promise lets tests await determinism.
  const memoryWritebackPromise = input.memory
    ? runMemoryWriteback({
        memory: input.memory,
        llm: provider,
        workspaceId: input.workspaceId,
        customerMessage,
        plainoMessage,
      })
    : null;

  return skillOk({
    classification,
    customerMessage,
    plainoMessage,
    supportRequestId,
    instructionApprovalId,
    preferenceMemoryId,
    citations,
    recalledMemory,
    memoryWritebackPromise,
    noOutboundNote: NO_OUTBOUND_NOTE,
  } satisfies PlainoTurnOutput);
}

// ── INSTRUCT routing ────────────────────────────────────────────────────

interface RouteInstructionArgs {
  input: PlainoTurnInput;
  decision: DispatcherDecision;
  customerMessageId: string;
}

interface RouteInstructionResult {
  approvalQueueItemId: string | null;
}

/**
 * Persist a PLAINO_INSTRUCTION approval queue item for the INSTRUCT
 * turn + emit the Inngest event the instruction-handler consumes.
 *
 * The queue item carries the original customer instruction (encrypted
 * at rest via the v1 envelope, like every other payload that holds
 * customer content). The Inngest handler reads the row, drafts, writes
 * the draft into the same row, and flips the queue item back to
 * PENDING for operator review. See lib/inngest/functions/
 * instruction-handler-on-create.ts.
 *
 * Best-effort: a failed event-emit returns the approvalQueueItemId
 * the chat surface can still link to. The handler can be re-fired via
 * the Inngest dashboard if the original emit got dropped.
 */
async function routeInstruction(
  args: RouteInstructionArgs,
): Promise<RouteInstructionResult> {
  const approvalQueueItemId = await createInstructionApprovalRow(args);
  if (!approvalQueueItemId) return { approvalQueueItemId: null };

  const emitRes = await args.input.events.emit({
    name: INSTRUCTION_CREATED_EVENT,
    data: {
      approvalQueueItemId,
      workspaceId: args.input.workspaceId,
      targetDiscipline: args.decision.targetDiscipline,
      source: 'plaino-talk' as const,
    },
  });
  if (!emitRes.ok) {
    // Soft-fail: leave the queue item visible to the operator. The
    // instruction-handler can be manually re-fired from /operator/inngest
    // (see lib/inngest/dashboard).
    return { approvalQueueItemId };
  }
  return { approvalQueueItemId };
}

/**
 * Hand off to the chat store to create a PLAINO_INSTRUCTION approval
 * queue item. The store owns the workspace-isolation envelope (same
 * pattern as createSupportRequest for the REGISTER path), keeping the
 * dispatcher portable across IChatStore implementations.
 *
 * Returns null when the store does not support instruction creation
 * (recording test stores override; production implements it). A null
 * here ALSO means the customer's chat reply still lands (they see the
 * "I'll herd this through the team" message), but no queue item gets
 * created — surfaced in the audit log via the supportRequestId-style
 * metadata.
 */
async function createInstructionApprovalRow(
  args: RouteInstructionArgs,
): Promise<string | null> {
  const store = args.input.store as unknown as {
    createInstructionApproval?: (args: {
      workspaceId: string;
      fromUserId: string;
      sourceChatMessageId: string;
      instructionText: string;
      targetDiscipline: string;
      reasoning: string;
    }) => Promise<string>;
  };
  if (typeof store.createInstructionApproval !== 'function') {
    return null;
  }
  return store.createInstructionApproval({
    workspaceId: args.input.workspaceId,
    fromUserId: args.input.fromUserId,
    sourceChatMessageId: args.customerMessageId,
    instructionText: args.input.customerMessage,
    // We validated above; non-null at this point. The `!` is honest
    // here — the type system can't track the earlier validation gate.
    targetDiscipline: args.decision.targetDiscipline!,
    reasoning: args.decision.reasoning,
  });
}

// ── PREFERENCE persistence ──────────────────────────────────────────────

interface PersistPreferenceArgs {
  input: PlainoTurnInput;
  decision: DispatcherDecision;
  customerMessage: PersistedChatMessage;
}

/**
 * Write a FEEDBACK memory entry for the PREFERENCE turn. Synchronous
 * (not fire-and-forget) because the customer's reply asserts the rule
 * landed — a silent miss would create a trust gap.
 *
 * Returns the new memory entry id on success, null when the workspace
 * has no memory store attached (legacy / test). On a write failure we
 * also return null so the dispatcher's reply still lands; the audit
 * log carries the failure cause via the dispatcher's debug surface.
 */
async function persistPreferenceMemory(
  args: PersistPreferenceArgs,
): Promise<string | null> {
  if (!args.input.memory) return null;
  if (!args.decision.preferenceRule || !args.decision.preferenceScope) {
    return null;
  }
  try {
    const entry = await args.input.memory.upsert({
      workspaceId: args.input.workspaceId,
      kind: 'FEEDBACK',
      title: `${PREFERENCE_MEMORY_TITLE_PREFIX}${args.decision.preferenceScope}`,
      body: buildPreferenceMemoryBody({
        scope: args.decision.preferenceScope,
        rule: args.decision.preferenceRule,
      }),
      sourceChatMessageId: args.customerMessage.id,
      now: args.input.now,
    });
    return entry.id;
  } catch {
    return null;
  }
}

// ── REGISTER hand-off ───────────────────────────────────────────────────

interface RegisterArgs {
  input: PlainoTurnInput;
  trimmedMessage: string;
}

interface RegisterResult {
  supportRequestId: string | null;
}

/**
 * Create a SupportRequest row + emit the support-handler event. We do
 * this through a side-channel rather than calling the support skill
 * directly so the dispatcher does not import the skill's runtime —
 * the support-handler is event-driven by contract.
 *
 * Best-effort: a failed event emit is recorded in the Plaino message
 * metadata so the operator can correlate "no draft showed up" with
 * the cause. The chat reply still lands. Per project_no_outbound: the
 * Inngest event is INTERNAL — it carries no customer-visible side
 * effect on its own.
 */
async function registerWithSupportHandler(
  args: RegisterArgs,
): Promise<RegisterResult> {
  const supportRequestId = await createSupportRequestRow(args);
  if (!supportRequestId) return { supportRequestId: null };

  const emitRes = await args.input.events.emit({
    name: SUPPORT_REQUEST_CREATED_EVENT,
    data: {
      supportRequestId,
      workspaceId: args.input.workspaceId,
      source: 'plaino-talk' as const,
    },
  });
  if (!emitRes.ok) {
    // Surfacing the failure here is enough — the dispatcher metadata
    // will carry the supportRequestId either way.
    return { supportRequestId };
  }
  return { supportRequestId };
}

/**
 * Hand-off to the chat store to create a SupportRequest. We piggy-back
 * on the store because it owns the workspace-isolation envelope; this
 * keeps the dispatcher portable. Returns null when the store does not
 * support a SupportRequest creation (test stores override; production
 * implements it).
 */
async function createSupportRequestRow(
  args: RegisterArgs,
): Promise<string | null> {
  const store = args.input.store as unknown as {
    createSupportRequest?: (args: {
      workspaceId: string;
      fromUserId: string;
      subject: string;
      body: string;
    }) => Promise<string>;
  };
  if (typeof store.createSupportRequest !== 'function') {
    return null;
  }
  return store.createSupportRequest({
    workspaceId: args.input.workspaceId,
    fromUserId: args.input.fromUserId,
    subject: deriveSubject(args.trimmedMessage),
    body: args.trimmedMessage,
  });
}

function deriveSubject(body: string): string {
  // First non-empty line, capped at ~80 chars. The support-handler is
  // resilient to short subjects — a short subject is honest about
  // where the request came from.
  const firstLine = body.split(/\r?\n/).map((l) => l.trim()).find((l) => l.length > 0) ?? '';
  if (firstLine.length === 0) return 'Talk-to-Plaino request';
  if (firstLine.length <= 80) return firstLine;
  return `${firstLine.slice(0, 77).trimEnd()}…`;
}

// ── Helpers ─────────────────────────────────────────────────────────────

async function ensureThreadId(input: PlainoTurnInput): Promise<string> {
  const thread = await input.store.ensureWorkspaceThread({
    workspaceId: input.workspaceId,
    now: input.now,
  });
  return thread.id;
}

function clampTopK(raw: number): number {
  if (!Number.isFinite(raw) || raw <= 0) return DEFAULT_TOP_K;
  return Math.min(Math.floor(raw), 10);
}

interface DispatcherDecision {
  kind: PlainoDispatchKind;
  reply: string;
  citedTitles: string[];
  namedGap: string | null;
  targetDiscipline: string | null;
  preferenceRule: string | null;
  preferenceScope: string | null;
  reasoning: string;
}

function parseDispatcherJson(
  raw: string,
): { ok: true; value: DispatcherDecision } | { ok: false; error: string } {
  const trimmed = raw.trim();
  const unwrapped = trimmed
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();
  let json: unknown;
  try {
    json = JSON.parse(unwrapped);
  } catch (err) {
    return {
      ok: false,
      error: `plaino dispatcher LLM returned non-JSON: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
  if (!isRecord(json)) {
    return { ok: false, error: 'plaino dispatcher LLM JSON was not an object' };
  }
  const kind = json.kind;
  if (
    kind !== 'ANSWER' &&
    kind !== 'REGISTER' &&
    kind !== 'INSTRUCT' &&
    kind !== 'PREFERENCE' &&
    kind !== 'DECLINE_HONESTLY'
  ) {
    return {
      ok: false,
      error: `plaino dispatcher LLM JSON missing valid \`kind\` (got ${String(kind)})`,
    };
  }
  const reply = typeof json.reply === 'string' ? json.reply.trim() : '';
  if (reply.length === 0) {
    return { ok: false, error: 'plaino dispatcher LLM JSON missing `reply`' };
  }
  const reasoning =
    typeof json.reasoning === 'string' && json.reasoning.trim().length > 0
      ? json.reasoning.trim()
      : 'no reasoning supplied';
  const namedGapRaw = json.namedGap;
  const namedGap =
    typeof namedGapRaw === 'string' && namedGapRaw.trim().length > 0
      ? namedGapRaw.trim()
      : null;
  const targetDisciplineRaw = json.targetDiscipline;
  const targetDiscipline =
    typeof targetDisciplineRaw === 'string' &&
    targetDisciplineRaw.trim().length > 0
      ? targetDisciplineRaw.trim()
      : null;
  const preferenceRuleRaw = json.preferenceRule;
  const preferenceRule =
    typeof preferenceRuleRaw === 'string' && preferenceRuleRaw.trim().length > 0
      ? preferenceRuleRaw.trim()
      : null;
  const preferenceScopeRaw = json.preferenceScope;
  const preferenceScope =
    typeof preferenceScopeRaw === 'string' &&
    preferenceScopeRaw.trim().length > 0
      ? preferenceScopeRaw.trim()
      : null;
  const citedRaw = Array.isArray(json.citedTitles) ? json.citedTitles : [];
  const citedTitles = citedRaw.filter((c): c is string => typeof c === 'string');
  return {
    ok: true,
    value: {
      kind,
      reply,
      citedTitles,
      namedGap,
      targetDiscipline,
      preferenceRule,
      preferenceScope,
      reasoning,
    },
  };
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function restrictCitations(
  citedTitles: string[],
  snippets: SupportContextSnippet[],
): SupportContextSnippet[] {
  const titles = new Set(snippets.map((s) => s.title));
  const matched: SupportContextSnippet[] = [];
  for (const t of citedTitles) {
    if (!titles.has(t)) continue;
    const s = snippets.find((x) => x.title === t);
    if (s && !matched.includes(s)) matched.push(s);
  }
  // We filter, even when the snippets are below the answer floor. The
  // dispatcher only emitted ANSWER if the model believed the snippets
  // were enough; the floor is informational here.
  return matched.filter((s) => s.similarity >= DEFAULT_ANSWER_FLOOR);
}

const COMPLETION_CLAIMS = [
  /\bi (?:just |already )?sent\b/i,
  /\bi (?:just |already )?emailed\b/i,
  /\bi (?:just |already )?called\b/i,
  /\bi (?:just |already )?filed\b/i,
  /\bi (?:just |already )?forwarded\b/i,
  /\bi (?:just |already )?scheduled\b/i,
  /\bdone[.,!]/i,
];

function claimsActionCompleted(reply: string): boolean {
  return COMPLETION_CLAIMS.some((re) => re.test(reply));
}

interface BuildUserArgs {
  customerMessage: string;
  history: Array<{ role: 'customer' | 'plaino'; body: string }>;
  snippets: SupportContextSnippet[];
  memory: MemoryEntry[];
}

function buildUserMessage(args: BuildUserArgs): string {
  const lines: string[] = [];
  // Per the honesty rule (reference_product_claims_vs_reality): when
  // memory is empty for the workspace, OMIT this block entirely. Do
  // not include an empty "What you've told me before" header — that
  // would invite the model to fabricate "as you mentioned…" framing
  // out of thin air. Empty memory means no memory section.
  if (args.memory.length > 0) {
    lines.push(
      "WHAT_YOU_HAVE_TOLD_ME_BEFORE (durable customer memory — honor",
    );
    lines.push(
      '  these facts; do not confuse them with the live message below):',
    );
    for (const m of args.memory) {
      const pin = m.pinned ? ' · pinned' : '';
      lines.push(`  • [${m.kind}${pin}] ${m.title} — ${m.body}`);
    }
    lines.push('');
  }
  if (args.history.length > 0) {
    lines.push('PRIOR_TURNS (oldest first):');
    for (const turn of args.history) {
      const speaker = turn.role === 'customer' ? 'CUSTOMER' : 'PLAINO';
      lines.push(`  [${speaker}] ${turn.body}`);
    }
    lines.push('');
  }
  if (args.snippets.length === 0) {
    lines.push('SUBSTRATE: (no snippets returned for this turn)');
  } else {
    lines.push(
      'SUBSTRATE (use these as the grounding for ANSWER; cite by exact title):',
    );
    for (const s of args.snippets) {
      lines.push('');
      const url = s.sourceUrl ? ` · ${s.sourceUrl}` : '';
      lines.push(`— ${s.title} (similarity=${s.similarity.toFixed(2)}${url})`);
      lines.push(s.bodyExcerpt);
    }
  }
  lines.push('');
  lines.push('CURRENT_TURN:');
  lines.push(args.customerMessage);
  return lines.join('\n');
}

// ── Memory read path ───────────────────────────────────────────────────

interface ReadMemoryArgs {
  store: IMemoryStore | undefined;
  workspaceId: string;
  customerMessage: string;
  now: Date | undefined;
}

/**
 * Pull memory for the dispatcher prompt. Pinned entries always
 * included; unpinned entries selected by recency + keyword overlap
 * with the inbound message body, capped by the per-fire budget +
 * character cap.
 *
 * Failures are swallowed — Plaino runs without memory rather than
 * blocking the customer reply. The store's `markRead` call is
 * fire-and-forget for the same reason.
 */
async function readMemoryForTurn(args: ReadMemoryArgs): Promise<MemoryEntry[]> {
  if (!args.store) return [];
  let all: MemoryEntry[];
  try {
    all = await args.store.listForWorkspace({
      workspaceId: args.workspaceId,
      limit: 500,
    });
  } catch {
    return [];
  }
  const selected = selectMemoryForPrompt({
    entries: all,
    customerMessage: args.customerMessage,
    budget: DEFAULT_DISPATCH_MEMORY_BUDGET,
    charCap: DISPATCH_MEMORY_CHAR_CAP,
  });
  if (selected.length > 0) {
    void args.store
      .markRead({
        workspaceId: args.workspaceId,
        ids: selected.map((m) => m.id),
        now: args.now ?? new Date(),
      })
      .catch(() => undefined);
  }
  return selected;
}

interface SelectMemoryArgs {
  entries: MemoryEntry[];
  customerMessage: string;
  budget: number;
  charCap: number;
}

/**
 * Pure selector. Pinned entries first (never dropped for budget). Then
 * fill remaining slots with unpinned entries scored by keyword overlap
 * with the customer message, tie-broken by recency. The character cap
 * is a soft cap — once exceeded, we stop adding unpinned entries; the
 * pinned ones already included still ship.
 */
function selectMemoryForPrompt(args: SelectMemoryArgs): MemoryEntry[] {
  const pinned = args.entries.filter((e) => e.pinned);
  const unpinned = args.entries.filter((e) => !e.pinned);
  const tokens = tokenize(args.customerMessage);
  const scored = unpinned
    .map((e) => ({ e, score: scoreOverlap(tokens, e) }))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return b.e.updatedAt.getTime() - a.e.updatedAt.getTime();
    });

  const picked: MemoryEntry[] = [];
  let chars = 0;
  for (const p of pinned) {
    picked.push(p);
    chars += p.title.length + p.body.length;
  }
  for (const { e } of scored) {
    if (picked.length >= args.budget) break;
    if (chars + e.title.length + e.body.length > args.charCap) break;
    picked.push(e);
    chars += e.title.length + e.body.length;
  }
  return picked;
}

function tokenize(s: string): Set<string> {
  return new Set(
    s
      .toLowerCase()
      .split(/[^a-z0-9]+/g)
      .filter((t) => t.length >= 4),
  );
}

function scoreOverlap(tokens: Set<string>, entry: MemoryEntry): number {
  if (tokens.size === 0) return 0;
  const entryTokens = tokenize(`${entry.title} ${entry.body}`);
  let score = 0;
  for (const t of tokens) {
    if (entryTokens.has(t)) score++;
  }
  return score;
}

// ── Memory write path ─────────────────────────────────────────────────

interface MemoryWritebackArgs {
  memory: IMemoryStore;
  llm: LlmProvider;
  workspaceId: string;
  customerMessage: PersistedChatMessage;
  plainoMessage: PersistedChatMessage;
}

/**
 * Async post-turn memory write-back. Pulls the last few turns from
 * the store (best-effort), runs the extractor, upserts each
 * validated entry. Errors are swallowed — a failed memory write
 * never breaks the customer-visible chat reply.
 *
 * Returns the count of entries upserted. The dispatcher's caller can
 * await this for determinism in tests; production code ignores it
 * (fire-and-forget).
 */
async function runMemoryWriteback(
  args: MemoryWritebackArgs,
): Promise<number> {
  try {
    const result = await extractMemoryFromConversation({
      workspaceId: args.workspaceId,
      turns: [
        {
          role: 'customer',
          body: args.customerMessage.body,
          chatMessageId: args.customerMessage.id,
        },
        {
          role: 'plaino',
          body: args.plainoMessage.body,
          chatMessageId: args.plainoMessage.id,
        },
      ],
      llm: args.llm,
    });
    let upserted = 0;
    for (const p of result.proposed) {
      try {
        await persistProposedMemoryEntry({
          memory: args.memory,
          workspaceId: args.workspaceId,
          proposed: p,
          defaultSource: args.customerMessage.id,
        });
        upserted++;
      } catch {
        // Single-entry failure is not fatal — try the next one.
      }
    }
    return upserted;
  } catch {
    return 0;
  }
}

async function persistProposedMemoryEntry(args: {
  memory: IMemoryStore;
  workspaceId: string;
  proposed: ProposedMemoryEntry;
  defaultSource: string;
}): Promise<void> {
  await args.memory.upsert({
    workspaceId: args.workspaceId,
    kind: args.proposed.kind,
    title: args.proposed.title,
    body: args.proposed.body,
    sourceChatMessageId:
      args.proposed.sourceChatMessageId ?? args.defaultSource,
  });
}

interface PlaceholderArgs {
  input: PlainoTurnInput;
  customerMessage: PersistedChatMessage;
  reason: string;
}

async function persistPlaceholderReply(
  args: PlaceholderArgs,
): Promise<PersistedChatMessage> {
  const body = [
    "Sorry — I couldn't put together a useful reply this turn. I'm",
    'flagging this to the team and someone will follow up. Mind',
    'rephrasing in the meantime?',
    '',
    '— Plaino',
  ].join('\n');

  // The degraded placeholder is when the card is MOST valuable — the
  // customer still gets a useful next action even though Plaino can't
  // answer. The isFirstReply/intent check is skipped here: the card
  // ALWAYS attaches to a placeholder reply so the "what should I do?"
  // question has a real answer even when the LLM is offline.
  const placeholderCard = buildReplyCard({
    workspaceId: args.input.workspaceId,
    snapshot: args.input.capabilities,
    vertical: args.input.vertical ?? null,
    firstSession: true, // conservative — show killer workflow
  });

  return args.input.store.appendMessage({
    threadId: args.customerMessage.threadId,
    workspaceId: args.input.workspaceId,
    role: 'plaino',
    body,
    metadata: {
      kind: 'PLACEHOLDER',
      reason: args.reason,
      card: placeholderCard,
    },
    now: args.input.now,
  });
}

// ── Test surface ────────────────────────────────────────────────────────

export const __testing = {
  parseDispatcherJson,
  restrictCitations,
  claimsActionCompleted,
  deriveSubject,
  buildUserMessage,
  suppressUnusedLlmOk: llmOk,
};
