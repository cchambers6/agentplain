/**
 * lib/skills/inbox-triage-general/llm-classify.ts
 *
 * Wave-2 — per-message LLM classification for inbox-triage. Replaces the
 * 15-cue keyword classifier as the PRIMARY priority signal. Given the
 * inbox snapshot, this module asks the `LlmProvider` (the composed seam
 * `lib/llm/index.ts` = Logging(Budget(Sentinel(Caching(Anthropic))))) to
 * assign one priority bucket + a confidence + a one-line reason per
 * message, in a single batched call.
 *
 * The keyword classifier (`./skill.ts#classify`, exported via `__testing`)
 * stays as the DETERMINISTIC FALLBACK: if no provider is passed, the LLM
 * layer is bypassed (`LLM_*` kill switches), the call errors, or the JSON
 * is malformed, each message falls back to the heuristic priority. This
 * keeps the skill correct when the LLM is off — per
 * `feedback_cold_start_safe_agents.md` (provider session memory is
 * performance, never correctness).
 *
 * Per `feedback_no_silent_vendor_lock.md`: imports `LlmProvider` only — no
 * Anthropic SDK references.
 *
 * Per `project_no_outbound_architecture.md`: classification only. No send,
 * no inbox mutation.
 */

import type { LlmProvider } from '@/lib/llm/types';
import { MODEL_HAIKU } from '@/lib/llm/model-tiers';
import type { TriageMessage, TriagePriority } from './types';

const VALID_PRIORITIES: ReadonlyArray<TriagePriority> = [
  'urgent',
  'customer-active',
  'vendor-pending',
  'needs-decision',
  'noise',
];

const CLASSIFY_SYSTEM_PROMPT = [
  "You are the inbox-triage classifier for Plaino, a local business's named service partner.",
  'Read each inbound email and assign exactly ONE priority bucket, a confidence (0-1),',
  'and a one-line reason. You are reasoning about INTENT and URGENCY per message — not',
  'matching keywords. A customer asking about THEIR order is customer-active; a vendor',
  'billing the business is vendor-pending; a true time-pressured ask is urgent.',
  '',
  'Priority buckets (most to least urgent):',
  '- urgent: genuine time pressure or risk if not handled today (deadlines, closings,',
  '  rate locks, escalations, "before EOD"). Reserve for real urgency, not marketing copy.',
  '- customer-active: an existing/prospective CUSTOMER engaging about a purchase, order,',
  '  service, quote, appointment, or question they expect a reply to.',
  '- vendor-pending: a SUPPLIER/vendor billing or transacting WITH the business',
  '  (invoices, statements, renewals, POs, remittance).',
  '- needs-decision: the sender is explicitly asking the owner to DECIDE / approve /',
  '  sign off / weigh in.',
  '- noise: newsletters, no-reply blasts, marketing, automated notifications — nothing',
  '  that needs a human reply.',
  '',
  'Calibrate confidence honestly: 0.8+ only when the bucket is unambiguous; 0.4-0.6 when',
  'plausible but mixed; below 0.4 when you are guessing.',
  '',
  '── OUTPUT FORMAT ──',
  'Return STRICTLY a single JSON object — no prose outside it:',
  '{',
  '  "classifications": [',
  '    {',
  '      "messageId": string,',
  '      "priority": "urgent" | "customer-active" | "vendor-pending" | "needs-decision" | "noise",',
  '      "confidence": number,  // 0-1',
  '      "reason": string       // one short line citing the intent signal',
  '    }',
  '  ]',
  '}',
].join('\n');

export interface MessageClassification {
  priority: TriagePriority;
  confidence: number;
  reasoning: string;
}

export interface ClassifyMessagesInput {
  llm: LlmProvider;
  messages: TriageMessage[];
  workspaceId: string;
}

export interface ClassifyMessagesOutput {
  /** messageId → classification. A message absent from the map fell back
   *  to the heuristic at the call site. */
  byMessageId: Map<string, MessageClassification>;
  /** True when the LLM call succeeded and JSON parsed. False = caller uses
   *  the keyword fallback for ALL messages. */
  llmApplied: boolean;
  /** Human-readable note for noOutboundNote / observability. */
  note: string;
}

/**
 * Classify every message in one batched LLM call. On any failure, returns
 * an empty map + `llmApplied: false` so the caller applies the keyword
 * fallback per message.
 */
export async function classifyMessagesWithLlm(
  input: ClassifyMessagesInput,
): Promise<ClassifyMessagesOutput> {
  if (input.messages.length === 0) {
    return { byMessageId: new Map(), llmApplied: false, note: '' };
  }
  const userPrompt = renderUserPrompt(input.messages);
  const completion = await input.llm.complete({
    system: CLASSIFY_SYSTEM_PROMPT,
    model: MODEL_HAIKU,
    cacheSystem: true,
    messages: [{ role: 'user', content: userPrompt }],
    maxTokens: 900,
    temperature: 0.1,
    responseFormat: 'json',
    meta: {
      skill: 'inbox-triage-general',
      workspaceId: input.workspaceId,
      sourceSurface: 'INBOX_TRIAGE',
    },
  });
  if (!completion.ok) {
    return {
      byMessageId: new Map(),
      llmApplied: false,
      note: `LLM classify failed (${completion.error.code}); keyword classifier used.`,
    };
  }
  const parsed = parseClassifications(completion.value.text);
  if (!parsed.ok) {
    return {
      byMessageId: new Map(),
      llmApplied: false,
      note: 'LLM classify returned malformed JSON; keyword classifier used.',
    };
  }
  const byMessageId = new Map<string, MessageClassification>();
  for (const c of parsed.classifications) {
    byMessageId.set(c.messageId, {
      priority: c.priority,
      confidence: c.confidence,
      reasoning: c.reason || `LLM classified as ${c.priority}.`,
    });
  }
  return {
    byMessageId,
    llmApplied: byMessageId.size > 0,
    note: byMessageId.size > 0 ? 'Priorities classified per-message by LLM.' : '',
  };
}

function renderUserPrompt(messages: TriageMessage[]): string {
  const lines: string[] = ['── MESSAGES ──'];
  for (const m of messages) {
    lines.push('');
    lines.push(`messageId: ${m.id}`);
    lines.push(`from: ${m.fromName ?? m.fromEmail} <${m.fromEmail}>`);
    lines.push(`subject: ${m.subject}`);
    lines.push(`bodyExcerpt: ${m.bodyText.slice(0, 600)}`);
  }
  return lines.join('\n');
}

interface ParsedClassification {
  messageId: string;
  priority: TriagePriority;
  confidence: number;
  reason: string;
}

function parseClassifications(
  raw: string,
):
  | { ok: true; classifications: ParsedClassification[] }
  | { ok: false; error: string } {
  const unwrapped = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();
  let parsed: unknown;
  try {
    parsed = JSON.parse(unwrapped);
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { ok: false, error: 'not an object' };
  }
  const rawList = (parsed as { classifications?: unknown }).classifications;
  if (!Array.isArray(rawList)) {
    return { ok: false, error: 'missing classifications array' };
  }
  const out: ParsedClassification[] = [];
  for (const c of rawList) {
    if (!c || typeof c !== 'object') continue;
    const obj = c as Record<string, unknown>;
    const messageId = typeof obj.messageId === 'string' ? obj.messageId : null;
    const priorityRaw = typeof obj.priority === 'string' ? obj.priority : null;
    const confidence =
      typeof obj.confidence === 'number' && Number.isFinite(obj.confidence)
        ? clamp01(obj.confidence)
        : 0.5;
    const reason = typeof obj.reason === 'string' ? obj.reason : '';
    if (!messageId || !priorityRaw) continue;
    if (!VALID_PRIORITIES.includes(priorityRaw as TriagePriority)) continue;
    out.push({
      messageId,
      priority: priorityRaw as TriagePriority,
      confidence,
      reason,
    });
  }
  return { ok: true, classifications: out };
}

function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0.5;
  return Math.max(0, Math.min(1, n));
}
