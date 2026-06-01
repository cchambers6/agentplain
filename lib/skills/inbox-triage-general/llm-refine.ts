/**
 * lib/skills/inbox-triage-general/llm-refine.ts
 *
 * Wave-4 — opt-in LLM refinement seam for the inbox-triage skill. After
 * the heuristic classifier emits proposals, the caller MAY pass an
 * `LlmProvider` + a `feedbackRulesBlock` (rendered from workspace
 * FEEDBACK rules). When BOTH are present this module asks the LLM —
 * with prompt-caching on the system message — whether any proposal's
 * priority should be revised based on the FEEDBACK rules.
 *
 * The contract:
 *   - No LLM call when `llm` is null OR `feedbackRulesBlock` is empty
 *     OR there are zero proposals — the heuristic output passes through
 *     untouched, byte-for-byte.
 *   - LLM call errors degrade gracefully: the heuristic output passes
 *     through unchanged + a note is appended to the skill's
 *     `noOutboundNote`. Better to ship a slightly-less-good heuristic
 *     output than to drop the cron entirely.
 *   - Only the priority + reasoning fields can change. ackDraft +
 *     confidence + sourceMessageId stay heuristic.
 *
 * Per `feedback_no_silent_vendor_lock.md`: this file imports `LlmProvider`
 * only — no Anthropic SDK references.
 *
 * Per `feedback_cold_start_safe_agents.md`: stateless. Every call passes
 * fresh proposals + fresh rules.
 *
 * Per the honesty bar: the system prompt names the rule that fired in
 * the LLM's reasoning so the operator can verify the FEEDBACK rule did
 * the work, not the model's prior.
 */

import type { LlmProvider } from '@/lib/llm/types';
import { MODEL_SONNET } from '@/lib/llm/model-tiers';
import type {
  TriageMessage,
  TriagePriority,
  TriageProposal,
} from './types';

const VALID_PRIORITIES: ReadonlyArray<TriagePriority> = [
  'urgent',
  'customer-active',
  'vendor-pending',
  'needs-decision',
  'noise',
];

const REFINE_SYSTEM_PROMPT = [
  'You are the inbox-triage refiner for Plaino, the workspace\'s named service partner.',
  'A heuristic classifier has already assigned a priority to each inbound message.',
  'Your only job: read the workspace\'s CUSTOMER PREFERENCES below and decide whether',
  'any priority should be revised because a preference rule clearly applies. Do NOT',
  'reinvent the classifier — when the rules do not apply, return an empty overrides',
  'list.',
  '',
  'Hard rules:',
  '- Only override when a preference rule clearly + specifically applies to the',
  '  message. "Always flag mail from county clerks as URGENT" → override to urgent;',
  '  generic context like "we care about customers" → no override.',
  '- Cite the rule verbatim in `ruleApplied` so the operator can verify.',
  '- Priority MUST be one of: urgent, customer-active, vendor-pending, needs-decision, noise.',
  '',
  '── OUTPUT FORMAT ──',
  'Return STRICTLY a single JSON object — no prose outside it:',
  '{',
  '  "overrides": [',
  '    {',
  '      "messageId": string,',
  '      "newPriority": "urgent" | "customer-active" | "vendor-pending" | "needs-decision" | "noise",',
  '      "ruleApplied": string  // verbatim quote of the preference rule that justified the override',
  '    }',
  '  ]',
  '}',
].join('\n');

export interface RefineTriageInput {
  llm: LlmProvider;
  feedbackRulesBlock: string;
  messages: TriageMessage[];
  proposals: TriageProposal[];
  workspaceId: string;
}

export interface RefineTriageOutput {
  /** Proposals after LLM refinement (or the input proposals unchanged
   *  when the LLM was skipped / errored). */
  proposals: TriageProposal[];
  /** Number of override applied — surfaced in metrics. */
  appliedOverrides: number;
  /** Human-readable note for noOutboundNote / observability. Empty
   *  string when the LLM call succeeded and applied no overrides. */
  note: string;
}

export async function maybeRefineTriage(
  input: RefineTriageInput,
): Promise<RefineTriageOutput> {
  if (input.proposals.length === 0) {
    return { proposals: input.proposals, appliedOverrides: 0, note: '' };
  }
  if (input.feedbackRulesBlock.trim().length === 0) {
    return { proposals: input.proposals, appliedOverrides: 0, note: '' };
  }
  const userPrompt = renderUserPrompt(input);
  const completion = await input.llm.complete({
    system: REFINE_SYSTEM_PROMPT,
    model: MODEL_SONNET,
    cacheSystem: true,
    messages: [{ role: 'user', content: userPrompt }],
    maxTokens: 600,
    temperature: 0.2,
    responseFormat: 'json',
    meta: {
      skill: 'inbox-triage-general',
      workspaceId: input.workspaceId,
      sourceSurface: 'INBOX_TRIAGE',
    },
  });
  if (!completion.ok) {
    return {
      proposals: input.proposals,
      appliedOverrides: 0,
      note: `LLM refine failed (${completion.error.code}); heuristic output kept.`,
    };
  }
  const parsed = parseOverrides(completion.value.text);
  if (!parsed.ok) {
    return {
      proposals: input.proposals,
      appliedOverrides: 0,
      note: `LLM refine returned malformed JSON; heuristic output kept.`,
    };
  }
  if (parsed.overrides.length === 0) {
    return { proposals: input.proposals, appliedOverrides: 0, note: '' };
  }
  const overrideMap = new Map(parsed.overrides.map((o) => [o.messageId, o]));
  let applied = 0;
  const next = input.proposals.map((p) => {
    const o = overrideMap.get(p.sourceMessageId);
    if (!o) return p;
    if (o.newPriority === p.priority) return p;
    applied += 1;
    return {
      ...p,
      priority: o.newPriority,
      reasoning: `${p.reasoning} · FEEDBACK override: ${o.ruleApplied}`,
    };
  });
  return {
    proposals: next,
    appliedOverrides: applied,
    note:
      applied > 0
        ? `LLM applied ${applied} FEEDBACK override${applied === 1 ? '' : 's'}.`
        : '',
  };
}

function renderUserPrompt(input: RefineTriageInput): string {
  const lines: string[] = [];
  lines.push(input.feedbackRulesBlock.trim());
  lines.push('');
  lines.push('── MESSAGES + HEURISTIC PRIORITIES ──');
  for (const p of input.proposals) {
    const msg = input.messages.find((m) => m.id === p.sourceMessageId);
    if (!msg) continue;
    lines.push('');
    lines.push(`messageId: ${p.sourceMessageId}`);
    lines.push(`from: ${msg.fromName ?? msg.fromEmail} <${msg.fromEmail}>`);
    lines.push(`subject: ${msg.subject}`);
    lines.push(`bodyExcerpt: ${msg.bodyText.slice(0, 400)}`);
    lines.push(`heuristicPriority: ${p.priority}`);
    lines.push(`heuristicReasoning: ${p.reasoning}`);
  }
  return lines.join('\n');
}

interface ParsedOverride {
  messageId: string;
  newPriority: TriagePriority;
  ruleApplied: string;
}

function parseOverrides(
  raw: string,
):
  | { ok: true; overrides: ParsedOverride[] }
  | { ok: false; error: string } {
  const trimmed = raw.trim();
  const unwrapped = trimmed
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();
  let parsed: unknown;
  try {
    parsed = JSON.parse(unwrapped);
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { ok: false, error: 'not an object' };
  }
  const rawOverrides = (parsed as { overrides?: unknown }).overrides;
  if (!Array.isArray(rawOverrides)) {
    return { ok: true, overrides: [] };
  }
  const overrides: ParsedOverride[] = [];
  for (const o of rawOverrides) {
    if (!o || typeof o !== 'object') continue;
    const obj = o as Record<string, unknown>;
    const messageId = typeof obj.messageId === 'string' ? obj.messageId : null;
    const newPriorityRaw =
      typeof obj.newPriority === 'string' ? obj.newPriority : null;
    const ruleApplied =
      typeof obj.ruleApplied === 'string' ? obj.ruleApplied : '';
    if (!messageId || !newPriorityRaw) continue;
    if (!VALID_PRIORITIES.includes(newPriorityRaw as TriagePriority)) continue;
    overrides.push({
      messageId,
      newPriority: newPriorityRaw as TriagePriority,
      ruleApplied,
    });
  }
  return { ok: true, overrides };
}
