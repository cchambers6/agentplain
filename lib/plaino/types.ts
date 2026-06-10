/**
 * lib/plaino/types.ts
 *
 * Contract for the Plaino dispatcher — the workspace-level chat surface
 * that fronts the agentplain fleet. The customer types a message at
 * `/talk`; the dispatcher classifies the turn into one of three honest
 * paths (ANSWER / REGISTER / DECLINE_HONESTLY) and either drafts a
 * substrate-grounded reply, hands the work off to the support-handler
 * skill via the existing `agentplain/support-request.created` Inngest
 * event, or declines with a NAMED CAPABILITY GAP — never a fabrication.
 *
 * Per feedback_no_silent_vendor_lock + feedback_runner_portability:
 *   - IChatStore (port) + PrismaChatStore (prod) + RecordingChatStore (test)
 *   - IEventEmitter (port) + InngestEventEmitter (prod) + RecordingEventEmitter (test)
 *   - IKnowledgeSubstratePort is reused from lib/skills/support-handler
 *     (same shape; same partitioning-by-workspaceId contract).
 *
 * Per project_no_outbound_architecture.md: nothing in this module sends
 * anything outside the workspace. Customer-facing replies are persisted
 * as ChatMessage rows; the REGISTER path emits an Inngest event that
 * the existing support-handler consumes — its downstream send (if any)
 * is gated by the operator approval queue, NOT by Plaino.
 *
 * Per feedback_cold_start_safe_agents.md: the dispatcher reads the
 * workspace's current capability snapshot on every fire. There is no
 * cross-fire memory.
 */

import type { SkillResult } from '../skills/types';
import type {
  IKnowledgeSubstratePort,
  SupportContextSnippet,
} from '../skills/support-handler';
import type { IMemoryStore, MemoryEntry } from './memory/types';

export type {
  IKnowledgeSubstratePort,
  SupportContextSnippet,
} from '../skills/support-handler';

// ── Classification ──────────────────────────────────────────────────────

/**
 * The five honest paths the dispatcher can route a turn into.
 *
 *  - ANSWER: substrate-grounded Q&A. Reply carries citations.
 *  - REGISTER: customer submitted a support request (a problem they
 *    want resolved); we file a SupportRequest + emit the legacy
 *    `agentplain/support-request.created` event. The downstream
 *    support-handler drafts a first-touch reply.
 *  - INSTRUCT: customer asked the FLEET TO DO WORK — draft an email,
 *    chase a doc, summarize a contract, prep a brief. We tag the
 *    discipline, create a PLAINO_INSTRUCTION approval queue item,
 *    and emit `agentplain/instruction.created`; the Inngest
 *    instruction-handler drafts the work back into the same row.
 *  - PREFERENCE: customer told us HOW THEY WANT THINGS DONE going
 *    forward ("next time flag legal mail as high priority"). We
 *    extract the rule + scope and persist it as a FEEDBACK
 *    WorkspaceMemoryEntry so future skill fires inject it into their
 *    prompt assembly.
 *  - DECLINE_HONESTLY: ask is outside what the fleet can do today.
 *    Reply NAMES a specific gap; no fabrication.
 */
export type PlainoDispatchKind =
  | 'ANSWER'
  | 'REGISTER'
  | 'INSTRUCT'
  | 'PREFERENCE'
  | 'DECLINE_HONESTLY';

export interface PlainoClassification {
  kind: PlainoDispatchKind;
  /** Short one-line rationale from the LLM. Surfaced in metadata + the
   *  audit log so the operator can verify the routing decision. */
  reasoning: string;
  /** Populated on DECLINE_HONESTLY — the SPECIFIC named capability gap
   *  the dispatcher pointed at (e.g. "MLS lookups aren't wired"). On
   *  the other paths this is null. The decline path REQUIRES a named
   *  gap; the dispatcher refuses to emit a generic "I can't" reply. */
  namedGap: string | null;
  /** Populated on INSTRUCT — one of the 8 discipline ids the work
   *  belongs to. The Inngest instruction-handler uses this to bias
   *  the drafting prompt (an analytics ask gets a different shape
   *  from a legal ask). null on every other path. */
  targetDiscipline: string | null;
  /** Populated on PREFERENCE — the customer's preference distilled
   *  into one rule statement ("Flag mail from county clerks as high
   *  priority") + the scope it applies in. null on every other path. */
  preferenceRule: string | null;
  preferenceScope: string | null;
}

/**
 * Allowed scopes for PREFERENCE entries. The set is intentionally
 * small + skill-aligned: when a skill assembles its prompt it asks
 * for FEEDBACK rules with a matching scope (or `general` for
 * universally-applicable rules). Adding a new scope is a code change
 * — the wrapper rejects a PREFERENCE classification that names a
 * scope outside this set.
 *
 * Scope ids are kebab-case and stable; they appear in the
 * `WorkspaceMemoryEntry.body` so the skill-side reader can filter.
 */
export const PREFERENCE_SCOPE_IDS = [
  'general',
  'inbox-triage',
  'email-draft',
  'scheduling',
  'legal-flagging',
  'customer-comms',
  'internal-comms',
  'reporting',
  // Wave-3 phase 4 — new scope ids the discipline-wrap skills declare.
  // Each maps one skill to its workspace-side preference rules. The
  // dispatcher's classifier accepts these as targetScope values; legacy
  // scopes still resolve to their original skills.
  'follow-up',
  'content',
  'research',
  'analytics',
  // Wave-4 phase 3 — when the four heuristic skills (chief-of-staff,
  // inbox-triage, lead-triage, process-doc-drafter) flipped to LLM-
  // augmented, the `lead-triage` scope landed as the dedicated bucket
  // for "rules about how leads should be categorized / routed". The
  // other three heuristic skills already had matching scopes
  // (scheduling / inbox-triage / content respectively).
  'lead-triage',
  // Finance discipline scope (wave 5). Lets customers write rules that
  // finance-pulse-general + month-end-close-cpa + invoice-chasing-realestate
  // all read at fire time — e.g. "always classify expenses over $5,000 as
  // capital expenditure" or "treat owner-distribution receipts as
  // priority-review". The skills read `general` + `finance` together.
  'finance',
] as const;
export type PreferenceScopeId = (typeof PREFERENCE_SCOPE_IDS)[number];

export function isPreferenceScopeId(value: string): value is PreferenceScopeId {
  return (PREFERENCE_SCOPE_IDS as readonly string[]).includes(value);
}

// ── Chat persistence port ───────────────────────────────────────────────

export interface PersistedChatMessage {
  id: string;
  threadId: string;
  workspaceId: string;
  role: 'customer' | 'plaino';
  /** Plaintext — the store decrypts at read time and encrypts at write
   *  time. Callers never see ciphertext at this seam. */
  body: string;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
}

export interface IChatStore {
  readonly name: string;
  /** Resolve (or lazily create) the workspace's v1 single thread. */
  ensureWorkspaceThread(args: {
    workspaceId: string;
    now?: Date;
  }): Promise<{ id: string; title: string }>;
  /** Persist a message. The store is the encryption boundary — `body`
   *  is plaintext on the way in; it is encrypted at rest. */
  appendMessage(args: {
    threadId: string;
    workspaceId: string;
    role: 'customer' | 'plaino';
    body: string;
    metadata?: Record<string, unknown> | null;
    now?: Date;
  }): Promise<PersistedChatMessage>;
  /** Read the thread in chronological order. Decrypts on the way out. */
  listMessages(args: {
    threadId: string;
    workspaceId: string;
    limit?: number;
  }): Promise<PersistedChatMessage[]>;
}

// ── Outbound-event port ─────────────────────────────────────────────────

/**
 * Outbound-EVENT (not outbound-MESSAGE) emitter — used by the REGISTER
 * path to fire `agentplain/support-request.created`. Per the
 * no-outbound rule: this emits an INTERNAL event the support-handler
 * skill consumes; it does not send anything to the customer. The
 * support-handler's draft lands in the operator approval queue.
 */
export interface IEventEmitter {
  readonly name: string;
  emit(args: {
    name: string;
    data: Record<string, unknown>;
  }): Promise<{ ok: true } | { ok: false; error: string }>;
}

// ── Workspace-capability snapshot ───────────────────────────────────────

/**
 * What the dispatcher tells the LLM about REAL capabilities. Composed
 * at fire time from the discipline catalog + the marketplace + the
 * connected-integration set, so the system prompt never makes a claim
 * the codebase doesn't back. Per reference_product_claims_vs_reality.
 */
export interface PlainoCapabilitySnapshot {
  /** The 8 disciplines (id + short name). Always all 8 — the catalog
   *  is the source of truth for what Plaino can talk about. */
  disciplines: Array<{ id: string; name: string; description: string }>;
  /** Marketplace tiles whose `status === 'available'` AND which the
   *  workspace has currently connected. Empty list is honest: "you
   *  haven't connected any tools yet." */
  connectedIntegrations: Array<{ id: string; name: string; category: string }>;
  /** Marketplace tiles whose `status === 'available'` but which the
   *  workspace has not connected. Plaino references these as "you can
   *  connect Gmail to let me read your inbox," NOT as things Plaino
   *  can already do. */
  availableButUnconnected: Array<{ id: string; name: string; category: string }>;
  /** Marketplace tiles flagged `coming-soon`. Plaino MAY name these as
   *  "not yet wired" — they are the truth source for the
   *  decline-honestly path. */
  comingSoon: Array<{ id: string; name: string; category: string }>;
}

// ── Dispatcher run input/output ─────────────────────────────────────────

export interface PlainoTurnInput {
  workspaceId: string;
  workspaceName: string;
  /** Required so the support-handler REGISTER hand-off can attribute
   *  the resulting SupportRequest to the actual user. */
  fromUserId: string;
  fromEmail: string;
  fromName: string | null;
  /** The workspace's Prisma Vertical enum value. Used to build the
   *  activation / what-next card carried on the reply metadata — the
   *  card branches on which killer workflow to lead with. Optional: when
   *  absent the card falls back to the general killer workflow. */
  vertical?: import('@prisma/client').Vertical | null;
  /** Verbatim customer message — the turn we're routing. */
  customerMessage: string;
  /** Recent thread context (last ~6 turns). The dispatcher uses this
   *  to disambiguate a short follow-up message. */
  history: Array<{
    role: 'customer' | 'plaino';
    body: string;
  }>;
  capabilities: PlainoCapabilitySnapshot;
  substrate: IKnowledgeSubstratePort;
  events: IEventEmitter;
  store: IChatStore;
  /** Optional customer-persistent memory store. When provided, the
   *  dispatcher reads pinned + recently-relevant memory entries into
   *  the prompt at the start of the turn, and after the turn pair is
   *  persisted, fires an async extract-from-conversation pass to
   *  upsert any new durable memory. When omitted, the dispatcher
   *  behaves exactly as before. */
  memory?: IMemoryStore;
  /** Override the LLM provider — tests pass a StubLlm. Defaults to
   *  the configured provider via getLlmProvider(). */
  llm?: import('../llm/types').LlmProvider;
  /** Top-K substrate snippets for the ANSWER path. Default 5; capped 10. */
  topK?: number;
  /** Fixed clock for tests. */
  now?: Date;
}

export interface PlainoTurnOutput {
  /** What the dispatcher decided to do with the turn. */
  classification: PlainoClassification;
  /** The customer message that was persisted. */
  customerMessage: PersistedChatMessage;
  /** The Plaino reply that was persisted. */
  plainoMessage: PersistedChatMessage;
  /** Populated when the REGISTER path created a SupportRequest. */
  supportRequestId: string | null;
  /** Populated when the INSTRUCT path created a PLAINO_INSTRUCTION
   *  approval queue item. The chat surface uses this to render a
   *  "drafted into your approval queue" tile per turn. */
  instructionApprovalId: string | null;
  /** Populated when the PREFERENCE path wrote a FEEDBACK memory entry.
   *  Tests assert against this; the chat surface doesn't render it
   *  (the customer sees the confirmation in the Plaino reply body
   *  itself, and the entry surfaces on /talk/memory). */
  preferenceMemoryId: string | null;
  /** Snippets cited in the ANSWER path. Empty otherwise. */
  citations: SupportContextSnippet[];
  /** Memory entries included in the prompt for this turn. Empty when
   *  no memory store was attached or when the workspace has no memory
   *  yet. Surfaces on the run result for telemetry + tests; not
   *  rendered to the customer (the entries themselves are visible on
   *  the memory page). */
  recalledMemory: MemoryEntry[];
  /** Promise that resolves when the post-turn memory-extract pass has
   *  completed. Awaited by tests + callers that need determinism;
   *  ignored by the production fire-and-forget path. Resolves to the
   *  number of entries upserted. */
  memoryWritebackPromise: Promise<number> | null;
  /** Note recorded in the run output so the no-outbound stance is
   *  explicit on every fire. */
  noOutboundNote: string;
}

export type PlainoRunResult = SkillResult<PlainoTurnOutput>;

export const DEFAULT_TOP_K = 5;
export const DEFAULT_ANSWER_FLOOR = 0.45;
/** Trim the history we ship to the LLM to keep the prompt bounded. */
export const HISTORY_CAP = 6;
/** Per-message body cap so a 50KB paste does not blow the LLM ceiling. */
export const CUSTOMER_MESSAGE_CHAR_CAP = 8_000;
