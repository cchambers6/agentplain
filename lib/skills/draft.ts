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
 */

import { randomUUID } from 'node:crypto';
import type { LlmProvider } from '../llm/types';
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
}

const DEFAULT_PERSIST_THRESHOLD = 0.5;

export class DraftSkill implements ISkill<DraftSkillInput, DraftReply> {
  readonly name = 'draft' as const;
  constructor(private readonly llm: LlmProvider) {}

  async run(input: DraftSkillInput): Promise<SkillResult<DraftReply>> {
    const userPrompt = renderUserPrompt(input);
    const res = await this.llm.complete({
      system: input.prompts.draft,
      messages: [{ role: 'user', content: userPrompt }],
      responseFormat: 'json',
      temperature: 0.3,
      maxTokens: 1200,
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
    return skillError(
      'PARSE_ERROR',
      `draft response not JSON: ${err instanceof Error ? err.message : String(err)} — got: ${text.slice(0, 200)}`,
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
