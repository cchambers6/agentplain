/**
 * lib/skills/types.ts
 *
 * Shared types + the ISkill contract every step in the value loop
 * (`read → categorize → coordinate → schedule → draft`) implements.
 *
 * Per `project_living_portable_architecture.md` + `feedback_runner_portability.md`:
 * each skill is a small adapter over its inputs. The runner composes
 * them; nothing else does. New skills land here without disturbing the
 * existing ones.
 *
 * Per `project_no_outbound_architecture.md`: nothing in this file calls
 * out. Skills produce structured proposals; the runner persists them;
 * the customer's system decides whether to act. The one exception
 * (`draft.ts`) creates a Gmail DRAFT — which is explicitly listed in
 * `project_no_outbound_architecture.md` as an allowed RECEIVE-shape
 * write because it does not send the message.
 */

import type { Workspace, WebhookEvent } from '@prisma/client';

// ── Common skill contract ───────────────────────────────────────────────

export type SkillResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: SkillError };

export type SkillErrorCode =
  | 'INVALID_INPUT'
  | 'UPSTREAM_LLM_ERROR'
  | 'UPSTREAM_GMAIL_ERROR'
  | 'PARSE_ERROR'
  | 'NOT_APPLICABLE'
  | 'NOT_CONFIGURED'
  | 'UNKNOWN';

export interface SkillError {
  code: SkillErrorCode;
  message: string;
  /** Reference to a downstream error (LLM error code, Gmail error code, etc.). */
  reference?: string;
}

export function skillOk<T>(value: T): { ok: true; value: T } {
  return { ok: true, value };
}

export function skillError(
  code: SkillErrorCode,
  message: string,
  reference?: string,
): { ok: false; error: SkillError } {
  return { ok: false, error: { code, message, reference } };
}

export interface ISkill<TInput, TOutput> {
  readonly name: string;
  run(input: TInput): Promise<SkillResult<TOutput>>;
}

// ── Read skill: ParsedMessage + thread + Gmail port ─────────────────────

/**
 * A single Gmail message after `lib/skills/read.ts` parses it. Provider-
 * neutral — drops Gmail-specific field names (`raw`, `payload.parts`)
 * for clean cross-skill consumption.
 */
export interface ParsedMessage {
  /** Provider message id (Gmail's `Message.id` or M365 equivalent). */
  id: string;
  /** Provider thread id. */
  threadId: string;
  /** RFC822 Message-ID. */
  rfcMessageId: string | null;
  /** Sender email (best-effort lower-cased). */
  fromEmail: string;
  /** Sender display name when present. */
  fromName: string | null;
  /** All To/Cc addresses, lower-cased. */
  toEmails: string[];
  ccEmails: string[];
  subject: string;
  /** Plain-text body. HTML parts decoded to text best-effort. */
  bodyText: string;
  /** Snippet — first ~200 chars, for log lines + UI hover. */
  snippet: string;
  /** RFC2822 References / In-Reply-To header values for thread linking. */
  references: string[];
  inReplyTo: string | null;
  /** Attachment summaries (filename + mime + size). Contents not fetched. */
  attachments: Attachment[];
  /** UTC `internalDate` from Gmail. */
  receivedAt: Date;
  /** Labels Gmail attached at receive time (INBOX, UNREAD, etc.). */
  labels: string[];
}

export interface Attachment {
  filename: string;
  mimeType: string;
  sizeBytes: number;
  /** Provider attachment id — fetch is deferred to the consumer. */
  attachmentId: string | null;
}

/**
 * Port the Read skill uses to fetch Gmail messages off a WebhookEvent
 * cursor. Production implementation calls `gmail.users.history.list` +
 * `gmail.users.messages.get`; the fixture-driven test implementation
 * returns canned messages keyed by the historyId.
 *
 * Per `feedback_no_silent_vendor_lock`: googleapis stays in
 * `lib/integrations/google/`; this port is provider-neutral.
 */
export interface MessageFetcher {
  readonly name: string;
  /**
   * Resolve the WebhookEvent's payload (historyId) to the list of new
   * messages introduced since the previous historyId. Returns one or
   * more `ParsedMessage`s — most of the time exactly one (a single new
   * inbox message), occasionally more (a backfill / catch-up fetch).
   */
  fetchMessagesForEvent(event: WebhookEvent): Promise<SkillResult<ParsedMessage[]>>;
  /**
   * For coordination: pull the prior messages in a thread. Returns
   * messages in chronological order (oldest first). MAY return an empty
   * array if the thread has no other messages.
   */
  fetchThreadMessages(threadId: string): Promise<SkillResult<ParsedMessage[]>>;
}

// ── Categorize skill ─────────────────────────────────────────────────────

export type Intent =
  | 'transactional'
  | 'vendor'
  | 'lead'
  | 'scheduling-needed'
  | 'draft-needed'
  | 'noise';

export interface Categorization {
  intent: Intent;
  /** 0–1. Below 0.5 = treat as `noise` to avoid false-positive downstream work. */
  confidence: number;
  /** Human-readable rationale — surfaces in the operator audit log. */
  reason: string;
  /** Which vertical prompt was applied. */
  verticalSlug: string;
}

// ── Coordinate skill ────────────────────────────────────────────────────

export interface ThreadContext {
  threadId: string;
  /** Inline summary of the thread state (≤ 800 chars). */
  summary: string;
  /** Other thread ids referenced by this thread. */
  referencedThreadIds: string[];
  /** Prior messages in chronological order. May be empty. */
  priorMessages: ParsedMessage[];
}

// ── Schedule skill ──────────────────────────────────────────────────────

export interface ProposedSlot {
  /** ISO 8601 day-of-week label (`monday`, `tuesday`, ...) — the runner is
   *  agnostic about which week; the customer's system maps to a date when
   *  it executes. */
  day: string;
  /** Local start time, `HH:MM` 24-hour. Caller's local timezone. */
  startLocal: string;
  /** Local end time. */
  endLocal: string;
}

export interface SchedulingProposal {
  /** False when the message is informational and does not need a scheduling
   *  decision (e.g. confirming an already-set meeting). */
  needsResponse: boolean;
  proposedSlots: ProposedSlot[];
  reasoning: string;
  confidence: number;
}

// ── Draft skill ─────────────────────────────────────────────────────────

export type DraftTone = 'formal' | 'casual' | 'technical';

export interface DraftReply {
  /** UUID assigned by the draft skill — stable across retries within a run. */
  draftId: string;
  /** Provider-side draft id when the persistence step succeeded. NULL
   *  when persistence was skipped (e.g. low-confidence) or failed. */
  providerDraftId: string | null;
  subject: string;
  /** Plain-text body. The customer's system reads from Gmail's draft
   *  later — this field is logged for the operator + e2e tests. */
  body: string;
  tone: DraftTone;
  confidence: number;
  /** When false, the draft was generated but NOT persisted to Gmail.
   *  Per project_no_outbound_architecture.md: low-confidence drafts
   *  stay in the operator queue rather than landing in the customer
   *  inbox where a hurried tap could send them. */
  persisted: boolean;
}

/**
 * Port the Draft skill uses to persist the reply as a Gmail draft. Prod
 * implementation calls `gmail.users.drafts.create`. The test
 * implementation records the call without making a network request.
 *
 * Per `project_no_outbound_architecture.md` lines 28–43: drafts.create
 * is allowed; messages.send is NOT. The interface here intentionally
 * has no `send` method.
 */
export interface DraftPersister {
  readonly name: string;
  persistDraft(args: {
    workspaceId: string;
    threadId: string;
    inReplyToMessageId: string | null;
    toEmails: string[];
    subject: string;
    body: string;
  }): Promise<SkillResult<{ providerDraftId: string }>>;
}

// ── Runner-level types ──────────────────────────────────────────────────

export interface SkillRunInputs {
  workspace: Pick<Workspace, 'id' | 'slug' | 'name' | 'vertical'>;
  event: WebhookEvent;
  /** Override fetcher (tests). When omitted, the runner looks one up. */
  fetcher?: MessageFetcher;
  /** Override persister (tests). When omitted, the runner looks one up. */
  persister?: DraftPersister;
  /** Override LLM provider (tests). */
  llm?: import('../llm/types').LlmProvider;
  /** Customer-provided scheduling preferences. Optional. */
  schedulingPreferences?: SchedulingPreferences;
  /** Optional fixed clock for deterministic tests. */
  now?: Date;
  /** When false, the runner does not write to `agent-state/skill-runs/`.
   *  Default: true. */
  writeLog?: boolean;
}

export interface SchedulingPreferences {
  businessHours: { startLocal: string; endLocal: string };
  /** ISO weekday names the customer accepts meetings on. */
  workDays: string[];
  /** Default meeting length in minutes. */
  defaultDurationMinutes: number;
  /** Optional buffer between meetings, in minutes. */
  bufferMinutes?: number;
}

export const DEFAULT_SCHEDULING_PREFERENCES: SchedulingPreferences = {
  businessHours: { startLocal: '09:00', endLocal: '17:00' },
  workDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
  defaultDurationMinutes: 30,
  bufferMinutes: 15,
};

/**
 * What the runner records for a single WebhookEvent pass. Persisted as
 * JSONL to `agent-state/skill-runs/<yyyymmdd>.jsonl` so the operator
 * dogfood audit (`agent-state/integrations_audit_log.md`) has a
 * machine-readable companion.
 */
export interface SkillRunRecord {
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  workspaceId: string;
  workspaceSlug: string;
  verticalSlug: string;
  webhookEventId: string;
  llmProviderName: string;
  fetcherName: string;
  persisterName: string;
  steps: SkillStepRecord[];
  outcome: SkillRunOutcome;
}

export interface SkillStepRecord {
  step: 'read' | 'categorize' | 'coordinate' | 'schedule' | 'draft' | 'mark-processed';
  ok: boolean;
  /** Compact summary — full payload stays in the typed return for tests. */
  summary: string;
  durationMs: number;
  errorCode?: string;
}

export interface SkillRunOutcome {
  category: Intent | null;
  threadId: string | null;
  scheduledProposal: SchedulingProposal | null;
  draft: DraftReply | null;
  markedProcessed: boolean;
}
