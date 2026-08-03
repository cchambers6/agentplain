/**
 * lib/skills/draft.ts
 *
 * Step 5 of the value loop (conditional — fires when categorize returns
 * `draft-needed`, and optionally chained off `scheduling-needed` so the
 * proposed slots appear in the draft body). Generates a reply DRAFT and
 * persists it via `DraftPersister` (production: `gmail.users.drafts.create`).
 *
 * Per `project_no_outbound_architecture.md` (load-bearing for this skill):
 *   - `users.drafts.create` is the ONLY allowed persistence call.
 *   - `users.messages.send` is forbidden. The customer's system sends.
 *   - When confidence < 0.5, the draft is generated but NOT persisted —
 *     instead, it's returned to the operator queue for human handling.
 *
 * Per `feedback_no_silent_vendor_lock.md`: persistence goes through the
 * `DraftPersister` port; production wires the Gmail-API implementation,
 * tests inject a recording stub.
 *
 * Pre-generation requirements check (lib/plaino/missing-inputs.ts):
 * before this skill existed a zero-grounding fire still called the model.
 * With no customer-context snippets, no learned preferences, no thread
 * summary and no proposed slots, the prompt reduces to "reply to this
 * email" — and the model returns a fluent, confident, entirely invented
 * reply that, above the persist threshold, lands in the broker's REAL
 * Gmail Drafts one tap from send. So we check first and HOLD instead. The
 * in-repo precedent is the `placeholder` tier in
 * `./support-handler/skill.ts`: substrate below the floor produces a
 * deterministic hold, never a fabricated answer, and makes no model call.
 */

import { randomUUID } from 'node:crypto';
import type { LlmProvider } from '../llm/types';
import { MODEL_OPUS } from '../llm/model-tiers';
import {
  buildMissingInputsReport,
  MISSING_CUSTOMER_CONTEXT,
  MISSING_DRAFT_PREFERENCES,
  MISSING_SCHEDULE,
  MISSING_THREAD_SUMMARY,
  type MissingInput,
  type MissingInputReport,
} from '../plaino/missing-inputs';
import type { VerticalPromptBundle } from './prompts/index';
import {
  DraftPersister,
  DraftReply,
  DraftTone,
  ISkill,
  ParsedMessage,
  SchedulingProposal,
  SkillResult,
  ThreadContext,
  skillError,
  skillOk,
} from './types';

export interface DraftSkillInput {
  message: ParsedMessage;
  prompts: VerticalPromptBundle;
  /** Workspace id — recorded on the draft for audit. */
  workspaceId: string;
  /** Optional coordinate-skill output to give the draft skill context. */
  thread?: ThreadContext;
  /** Optional schedule output. When present, the draft skill is told
   *  to surface the proposed slots in the body. */
  schedule?: SchedulingProposal;
  /** Persistence port. Required — even tests pass a recording stub. */
  persister: DraftPersister;
  /** Below this threshold, persist=false even on success. Default 0.5. */
  persistThreshold?: number;
  /**
   * What the caller inlined into the composed prompt bundle. The runner
   * knows both of these at compose time; this skill cannot see them
   * (they're baked into `prompts.draft` as opaque text), which is exactly
   * why they have to be passed explicitly.
   *
   * OMITTED = the caller can't vouch either way, and the requirements
   * check is skipped entirely. Never over-refuse on a caller's silence.
   */
  grounding?: DraftGrounding;
}

export interface DraftGrounding {
  /** How many CUSTOMER-kind snippets were inlined. 0 = nothing on file. */
  customerContextSnippetCount: number;
  /** Did the workspace's preferences render into the draft prompt? */
  preferencesPresent: boolean;
}

const DEFAULT_PERSIST_THRESHOLD = 0.5;

export class DraftSkill implements ISkill<DraftSkillInput, DraftReply> {
  readonly name = 'draft' as const;
  constructor(private readonly llm: LlmProvider) {}

  async run(input: DraftSkillInput): Promise<SkillResult<DraftReply>> {
    // Requirements check FIRST — the refusal path makes no model call and
    // costs nothing.
    const missing = checkDraftGrounding(input);
    if (missing) return skillOk(buildHeldDraft(input, missing));

    const userPrompt = renderUserPrompt(input);
    const res = await this.llm.complete({
      system: input.prompts.draft,
      model: MODEL_OPUS,
      // Draft's system prompt is the biggest in the chain — it carries
      // the vertical's tone guide + workspace preferences (including the
      // learned-from-corrections bullets) + the inlined customer-context
      // snippets. All stable within the 5-min Anthropic cache TTL. Per-
      // fire dynamic content (inbound message, thread summary, proposed
      // slots) rides on the user message.
      cacheSystem: true,
      messages: [{ role: 'user', content: userPrompt }],
      responseFormat: 'json',
      temperature: 0.3,
      maxTokens: 1200,
      meta: {
        skill: 'draft',
        workspaceId: input.workspaceId,
        verticalSlug: input.prompts.verticalSlug,
      },
    });
    if (!res.ok) {
      return skillError(
        'UPSTREAM_LLM_ERROR',
        `draft LLM call failed: ${res.error.message}`,
        res.error.code,
      );
    }
    const parsed = parseDraftJson(res.value.text);
    if (!parsed.ok) return parsed;

    const draftId = randomUUID();
    const threshold = input.persistThreshold ?? DEFAULT_PERSIST_THRESHOLD;
    if (parsed.value.confidence < threshold) {
      return skillOk({
        draftId,
        providerDraftId: null,
        subject: parsed.value.subject,
        body: parsed.value.body,
        tone: parsed.value.tone,
        confidence: parsed.value.confidence,
        persisted: false,
      });
    }
    const persistRes = await input.persister.persistDraft({
      workspaceId: input.workspaceId,
      threadId: input.message.threadId,
      inReplyToMessageId: input.message.id,
      toEmails: [input.message.fromEmail],
      subject: parsed.value.subject,
      body: parsed.value.body,
    });
    if (!persistRes.ok) {
      // Persistence failure is recoverable — the operator can re-issue
      // the draft from the audit row. Don't fail the whole loop.
      return skillOk({
        draftId,
        providerDraftId: null,
        subject: parsed.value.subject,
        body: parsed.value.body,
        tone: parsed.value.tone,
        confidence: parsed.value.confidence,
        persisted: false,
      });
    }
    return skillOk({
      draftId,
      providerDraftId: persistRes.value.providerDraftId,
      subject: parsed.value.subject,
      body: parsed.value.body,
      tone: parsed.value.tone,
      confidence: parsed.value.confidence,
      persisted: true,
    });
  }
}

// ── Pre-generation requirements check ───────────────────────────────────

/**
 * Returns a report when the draft would be composed on nothing, or null to
 * proceed to the model. Pure.
 *
 * Refuses only on the TOTAL blank: no customer-context snippets AND no
 * preferences AND no thread summary AND no proposed slots. Any single
 * surviving input gives the model something real to write from, so a
 * partially-grounded fire always proceeds — over-refusing would be its own
 * bug. Skipped entirely when the caller passed no `grounding`.
 */
export function checkDraftGrounding(
  input: DraftSkillInput,
): MissingInputReport | null {
  const g = input.grounding;
  if (!g) return null;

  const missing: MissingInput[] = [];
  if (g.customerContextSnippetCount === 0) missing.push(MISSING_CUSTOMER_CONTEXT);
  if (!g.preferencesPresent) missing.push(MISSING_DRAFT_PREFERENCES);
  if (!(input.thread?.summary ?? '').trim()) missing.push(MISSING_THREAD_SUMMARY);
  if ((input.schedule?.proposedSlots.length ?? 0) === 0) missing.push(MISSING_SCHEDULE);

  // All four gone = the prompt is "reply to this email" and nothing more.
  if (missing.length < 4) return null;
  return buildMissingInputsReport('REPLY_DRAFT', missing);
}

/**
 * The deterministic HOLD. Not a reply — an operator-facing note that says
 * what Plaino would have needed.
 *
 * INVARIANT: `confidence` is 0, which is below `DEFAULT_PERSIST_THRESHOLD`
 * and below any caller-supplied `persistThreshold` in [0, 1]. Combined
 * with `persisted: false` / `providerDraftId: null` — set here, not
 * derived — a held draft can never reach `persistDraft()`, so it can never
 * reach the broker's Gmail Drafts where a hurried tap could send it.
 */
function buildHeldDraft(
  input: DraftSkillInput,
  report: MissingInputReport,
): DraftReply {
  return {
    draftId: randomUUID(),
    providerDraftId: null,
    subject: replySubject(input.message.subject),
    body: renderHoldNote(report),
    // Tone is inert on a hold note — nothing here is customer-facing prose.
    tone: 'casual',
    confidence: 0,
    persisted: false,
    held: true,
    missing: report.missing,
  };
}

function replySubject(inboundSubject: string): string {
  const s = inboundSubject.trim();
  if (/^re:/i.test(s)) return s;
  return `Re: ${s}`;
}

/**
 * The hold note's body. Marked at the top so no operator skimming their
 * queue could mistake it for a sendable reply, then the customer-vocabulary
 * gap list, then the terse operator line.
 */
function renderHoldNote(report: MissingInputReport): string {
  const lines: string[] = [];
  lines.push('[HELD — this is a note to you, not a reply to send]');
  lines.push('');
  lines.push(report.customerNotice);
  lines.push('');
  lines.push('what he needed:');
  for (const m of report.missing) {
    lines.push(`  - ${m.label}`);
  }
  lines.push('');
  lines.push(report.operatorNote);
  return lines.join('\n');
}

function renderUserPrompt(input: DraftSkillInput): string {
  const { message, thread, schedule } = input;
  const lines: string[] = [];
  lines.push(`FROM: ${message.fromName ? `${message.fromName} <${message.fromEmail}>` : message.fromEmail}`);
  lines.push(`SUBJECT: ${message.subject}`);
  if (thread && thread.summary) {
    lines.push('');
    lines.push('THREAD CONTEXT:');
    lines.push(thread.summary);
  }
  if (schedule && schedule.proposedSlots.length > 0) {
    lines.push('');
    lines.push('PROPOSED MEETING SLOTS (include in reply body when relevant):');
    for (const s of schedule.proposedSlots) {
      lines.push(`  - ${capitalize(s.day)} ${s.startLocal}–${s.endLocal}`);
    }
  }
  lines.push('');
  lines.push('INBOUND MESSAGE BODY:');
  lines.push(message.bodyText);
  return lines.join('\n');
}

interface ParsedDraft {
  subject: string;
  body: string;
  tone: DraftTone;
  confidence: number;
}

function parseDraftJson(text: string): SkillResult<ParsedDraft> {
  let raw: unknown;
  try {
    raw = JSON.parse(stripFences(text));
  } catch (err) {
    // Strip raw LLM text from error messages — the draft model is prompted
    // with the inbound customer body, and when it deviates from the JSON
    // contract its text response can echo that body. Operators correlate
    // via run-id in the audit log. (Data-privacy audit PR #91 must-close #3.)
    const errType = err instanceof Error ? err.name : 'NonError';
    return skillError(
      'PARSE_ERROR',
      `draft response not JSON (error=${errType} responseLen=${text.length})`,
    );
  }
  if (!raw || typeof raw !== 'object') {
    return skillError('PARSE_ERROR', 'draft response not an object');
  }
  const rec = raw as Record<string, unknown>;
  const subject = typeof rec.subject === 'string' ? rec.subject : '';
  const body = typeof rec.body === 'string' ? rec.body : '';
  const toneRaw = typeof rec.tone === 'string' ? rec.tone : 'casual';
  const tone: DraftTone =
    toneRaw === 'formal' || toneRaw === 'technical' ? toneRaw : 'casual';
  const confidence =
    typeof rec.confidence === 'number' && Number.isFinite(rec.confidence)
      ? Math.max(0, Math.min(1, rec.confidence))
      : 0.5;
  if (!subject || !body) {
    return skillError('PARSE_ERROR', 'draft response missing subject or body');
  }
  return skillOk({ subject, body, tone, confidence });
}

function stripFences(text: string): string {
  const trimmed = text.trim();
  const m = /^```(?:json)?\s*\n?([\s\S]*?)\n?```$/.exec(trimmed);
  return m ? m[1].trim() : trimmed;
}

function capitalize(s: string): string {
  return s.length === 0 ? s : s[0].toUpperCase() + s.slice(1);
}

/**
 * Recording test implementation of `DraftPersister`. Used by the e2e
 * test. Mirrors the structure of `lib/integrations/test-provider.ts`.
 */
export class RecordingDraftPersister implements DraftPersister {
  readonly name = 'recording' as const;
  readonly calls: Array<Parameters<DraftPersister['persistDraft']>[0]> = [];
  private nextId = 1;

  async persistDraft(
    args: Parameters<DraftPersister['persistDraft']>[0],
  ): Promise<SkillResult<{ providerDraftId: string }>> {
    this.calls.push(args);
    return skillOk({ providerDraftId: `test-draft-${this.nextId++}` });
  }
}
