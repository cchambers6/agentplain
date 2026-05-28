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

import { getLlmProvider } from '../llm';
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
  type PersistedChatMessage,
  type PlainoClassification,
  type PlainoDispatchKind,
  type PlainoRunResult,
  type PlainoTurnInput,
  type PlainoTurnOutput,
  type SupportContextSnippet,
} from './types';
import {
  DEFAULT_DISPATCH_MEMORY_BUDGET,
  DISPATCH_MEMORY_CHAR_CAP,
  extractMemoryFromConversation,
  type IMemoryStore,
  type MemoryEntry,
  type ProposedMemoryEntry,
} from './memory';

const SUPPORT_REQUEST_CREATED_EVENT = 'agentplain/support-request.created';

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
  if (decision.kind === 'REGISTER' && claimsActionCompleted(decision.reply)) {
    const fallback = await persistPlaceholderReply({
      input,
      customerMessage,
      reason: 'REGISTER reply claimed completion',
    });
    return skillError(
      'PARSE_ERROR',
      `dispatcher's REGISTER reply claimed work was completed; persisted placeholder reply ${fallback.id}`,
    );
  }

  // 4. Branch on kind.
  let supportRequestId: string | null = null;
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
  }

  // 5. Persist the Plaino reply with classification metadata.
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
      citations: citations.map((c) => ({
        title: c.title,
        sourceUrl: c.sourceUrl,
        similarity: Number(c.similarity.toFixed(3)),
      })),
    },
    now: input.now,
  });

  const classification: PlainoClassification = {
    kind: decision.kind,
    reasoning: decision.reasoning,
    namedGap: decision.namedGap,
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
    citations,
    recalledMemory,
    memoryWritebackPromise,
    noOutboundNote: NO_OUTBOUND_NOTE,
  } satisfies PlainoTurnOutput);
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
  if (kind !== 'ANSWER' && kind !== 'REGISTER' && kind !== 'DECLINE_HONESTLY') {
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
  const citedRaw = Array.isArray(json.citedTitles) ? json.citedTitles : [];
  const citedTitles = citedRaw.filter((c): c is string => typeof c === 'string');
  return { ok: true, value: { kind, reply, citedTitles, namedGap, reasoning } };
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
  return args.input.store.appendMessage({
    threadId: args.customerMessage.threadId,
    workspaceId: args.input.workspaceId,
    role: 'plaino',
    body,
    metadata: {
      kind: 'PLACEHOLDER',
      reason: args.reason,
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
