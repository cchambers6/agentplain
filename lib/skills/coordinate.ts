/**
 * lib/skills/coordinate.ts
 *
 * Step 3 of the value loop. Given the newest message, walks the thread
 * (via `MessageFetcher.fetchThreadMessages`) and asks the LLM to
 * produce a compact `ThreadContext` — summary, references to other
 * threads, parties relevant across threads.
 *
 * Why a coordinate step at all: drafting a reply with full context (e.g.
 * "you'd previously asked about X, here's an update") is the unlock
 * customers care about. A naïve "summarize the thread" call wastes
 * tokens; a focused coordinate skill resolves references first so the
 * draft skill gets the right slice.
 *
 * Per `project_no_outbound_architecture.md`: read-only. This skill
 * never fetches threads it wasn't given — the runner controls scope.
 */

import type { LlmProvider } from '../llm/types';
import type { VerticalPromptBundle } from './prompts/index';
import {
  ISkill,
  MessageFetcher,
  ParsedMessage,
  SkillResult,
  ThreadContext,
  skillError,
  skillOk,
} from './types';

export interface CoordinateSkillInput {
  message: ParsedMessage;
  fetcher: MessageFetcher;
  prompts: VerticalPromptBundle;
  /** Soft cap on how many prior messages to feed the LLM. Default 6 —
   *  beyond that the signal-to-noise on the summary drops. */
  priorMessageCap?: number;
}

export class CoordinateSkill implements ISkill<CoordinateSkillInput, ThreadContext> {
  readonly name = 'coordinate' as const;
  constructor(private readonly llm: LlmProvider) {}

  async run(input: CoordinateSkillInput): Promise<SkillResult<ThreadContext>> {
    const priorRes = await input.fetcher.fetchThreadMessages(input.message.threadId);
    if (!priorRes.ok) {
      return skillError(
        'UPSTREAM_GMAIL_ERROR',
        `fetchThreadMessages failed: ${priorRes.error.message}`,
        priorRes.error.code,
      );
    }
    const priorAll = priorRes.value;
    // Exclude the newest message if the fetcher included it (some
    // implementations return the whole thread including the trigger).
    const prior = priorAll.filter((m) => m.id !== input.message.id);
    const cap = input.priorMessageCap ?? 6;
    const slice = prior.slice(Math.max(0, prior.length - cap));

    const userPrompt = renderUserPrompt(input.message, slice);
    const res = await this.llm.complete({
      system: input.prompts.coordinate,
      messages: [{ role: 'user', content: userPrompt }],
      responseFormat: 'text',
      temperature: 0.0,
      maxTokens: 800,
    });
    if (!res.ok) {
      return skillError(
        'UPSTREAM_LLM_ERROR',
        `coordinate LLM call failed: ${res.error.message}`,
        res.error.code,
      );
    }
    const parsed = parseCoordinateText(res.value.text, input.message.threadId);
    return skillOk({
      threadId: input.message.threadId,
      summary: parsed.summary,
      referencedThreadIds: parsed.referencedThreadIds,
      priorMessages: prior,
    });
  }
}

function renderUserPrompt(
  newest: ParsedMessage,
  prior: ParsedMessage[],
): string {
  const lines: string[] = [];
  lines.push(`THREAD_ID: ${newest.threadId}`);
  if (prior.length > 0) {
    lines.push('PRIOR_MESSAGES (oldest first):');
    for (const m of prior) {
      lines.push(`  - [${m.receivedAt.toISOString()}] from=${m.fromEmail} subject="${m.subject}"`);
      lines.push(`    snippet: ${m.snippet}`);
    }
  } else {
    lines.push('PRIOR_MESSAGES: (none — this is the first message in the thread)');
  }
  lines.push('');
  lines.push('NEWEST_MESSAGE:');
  lines.push(`  from=${newest.fromEmail} subject="${newest.subject}"`);
  lines.push(`  body:`);
  lines.push(newest.bodyText);
  return lines.join('\n');
}

interface ParsedCoordinate {
  summary: string;
  referencedThreadIds: string[];
}

function parseCoordinateText(text: string, fallbackThreadId: string): ParsedCoordinate {
  // The coordinate prompt is text-format ("THREAD_SUMMARY: ...\nREFERENCES: [...]")
  // — defensively parse the structured fields. When the model deviates
  // we still want a usable summary, so we fall back to the raw text.
  const summaryMatch = /THREAD_SUMMARY:\s*([\s\S]*?)(?=\nREFERENCES:|\nCROSS_THREAD:|$)/.exec(text);
  const referencesMatch = /REFERENCES:\s*(\[.*?\])/.exec(text);
  const summary = summaryMatch?.[1]?.trim() || text.trim().slice(0, 400) || `(thread ${fallbackThreadId})`;
  let referencedThreadIds: string[] = [];
  if (referencesMatch) {
    try {
      const arr = JSON.parse(referencesMatch[1]);
      if (Array.isArray(arr)) {
        referencedThreadIds = arr.filter((s): s is string => typeof s === 'string');
      }
    } catch {
      // Tolerate malformed array — drop, do not error.
    }
  }
  return { summary, referencedThreadIds };
}
