/**
 * lib/skills/categorize.ts
 *
 * Step 2 of the value loop. Given a parsed inbound message + the
 * workspace's vertical, asks the LLM to assign one of six intents.
 *
 * Per `feedback_integration_acceptance_is_functional.md`: categorization
 * is the load-bearing decision in the loop. False positives downstream
 * (drafting a reply to a marketing email, proposing a meeting for a
 * receipt) are visible bugs; false negatives are silent.
 *
 * Per `feedback_no_silent_vendor_lock.md`: LLM call goes through the
 * `LlmProvider` interface, not the Anthropic SDK directly.
 *
 * Per `project_no_outbound_architecture.md`: this skill produces a
 * categorization. It does not act on it.
 */

import type { LlmProvider } from '../llm/types';
import type { VerticalPromptBundle } from './prompts/index';
import {
  Categorization,
  ISkill,
  Intent,
  ParsedMessage,
  SkillResult,
  skillError,
  skillOk,
} from './types';

export interface CategorizeSkillInput {
  message: ParsedMessage;
  /** Per-vertical prompt bundle. The runner looks one up from the
   *  workspace's vertical enum. */
  prompts: VerticalPromptBundle;
  /** Telemetry context. The runner inlines workspace + vertical so the
   *  `llm.usage` log line can slice cache-hit rate by workspace. */
  workspaceId?: string;
}

export class CategorizeSkill implements ISkill<CategorizeSkillInput, Categorization> {
  readonly name = 'categorize' as const;
  constructor(private readonly llm: LlmProvider) {}

  async run(input: CategorizeSkillInput): Promise<SkillResult<Categorization>> {
    const userPrompt = renderUserPrompt(input.message);
    const res = await this.llm.complete({
      system: input.prompts.categorize,
      // Per `lib/llm/types.ts`: the categorize system prompt is stable
      // across every fire of the loop for a given workspace+vertical
      // within the 5-min Anthropic cache TTL — vertical-specific rules
      // + workspace preference snippets + customer-context overlay only
      // change when the workspace itself changes. Marking the system
      // cacheable converts the heavy stable prefix into a cache-read on
      // every subsequent fire.
      cacheSystem: true,
      messages: [{ role: 'user', content: userPrompt }],
      responseFormat: 'json',
      temperature: 0.0,
      maxTokens: 512,
      meta: {
        skill: 'categorize',
        workspaceId: input.workspaceId,
        verticalSlug: input.prompts.verticalSlug,
      },
    });
    if (!res.ok) {
      return skillError(
        'UPSTREAM_LLM_ERROR',
        `categorize LLM call failed: ${res.error.message}`,
        res.error.code,
      );
    }
    const parsed = parseCategorizationJson(res.value.text);
    if (!parsed.ok) {
      return parsed;
    }
    return skillOk({
      ...parsed.value,
      verticalSlug: input.prompts.verticalSlug,
    });
  }
}

function renderUserPrompt(m: ParsedMessage): string {
  // Compact rendering — give the model the signals it needs without
  // overwhelming the context window. Snippet + bodyText together cover
  // the cases where the snippet alone misses critical signal.
  return [
    `FROM: ${m.fromName ? `${m.fromName} <${m.fromEmail}>` : m.fromEmail}`,
    `TO: ${m.toEmails.join(', ')}`,
    m.ccEmails.length > 0 ? `CC: ${m.ccEmails.join(', ')}` : null,
    `SUBJECT: ${m.subject}`,
    m.labels.length > 0 ? `LABELS: ${m.labels.join(', ')}` : null,
    `SNIPPET: ${m.snippet}`,
    '',
    'BODY:',
    m.bodyText,
  ]
    .filter((s) => s !== null)
    .join('\n');
}

function parseCategorizationJson(
  text: string,
): SkillResult<Omit<Categorization, 'verticalSlug'>> {
  let raw: unknown;
  try {
    raw = JSON.parse(stripJsonFences(text));
  } catch (err) {
    // Log only identifiers — the raw LLM text can echo customer content
    // back when the model deviates from the JSON contract. Per the data-
    // privacy audit (PR #91 must-close #3), error messages must not embed
    // raw model output. Operators correlate via the run-id in the audit log.
    const errType = err instanceof Error ? err.name : 'NonError';
    return skillError(
      'PARSE_ERROR',
      `categorize response was not JSON (error=${errType} responseLen=${text.length})`,
    );
  }
  if (!raw || typeof raw !== 'object') {
    return skillError('PARSE_ERROR', 'categorize response was not a JSON object');
  }
  const rec = raw as { intent?: unknown; confidence?: unknown; reason?: unknown };
  if (!isValidIntent(rec.intent)) {
    // Describe the SHAPE of what we got, not the value — the LLM sometimes
    // emits `intent: "<a paraphrase of customer text>"` when prompted poorly.
    return skillError(
      'PARSE_ERROR',
      `categorize response missing/invalid intent (type=${typeof rec.intent})`,
    );
  }
  const confidence = clamp01(rec.confidence);
  if (confidence === null) {
    return skillError(
      'PARSE_ERROR',
      `categorize response missing/invalid confidence (type=${typeof rec.confidence})`,
    );
  }
  const reason = typeof rec.reason === 'string' ? rec.reason : '';
  return skillOk({ intent: rec.intent, confidence, reason });
}

function isValidIntent(v: unknown): v is Intent {
  return (
    typeof v === 'string' &&
    ['transactional', 'vendor', 'lead', 'scheduling-needed', 'draft-needed', 'noise'].includes(v)
  );
}

function clamp01(v: unknown): number | null {
  if (typeof v !== 'number' || !Number.isFinite(v)) return null;
  return Math.max(0, Math.min(1, v));
}

function stripJsonFences(text: string): string {
  // The model sometimes wraps JSON in ```json fences despite the system
  // prompt asking it not to. Strip them defensively.
  const trimmed = text.trim();
  const fenceMatch = /^```(?:json)?\s*\n?([\s\S]*?)\n?```$/.exec(trimmed);
  if (fenceMatch) return fenceMatch[1].trim();
  return trimmed;
}
