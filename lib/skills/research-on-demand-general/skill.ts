/**
 * lib/skills/research-on-demand-general/skill.ts
 *
 * Composes the research brief. Three states:
 *
 *   - Substrate returned nothing: emit a placeholder brief that names
 *     the gap honestly. The LLM is NOT called — there is nothing to
 *     ground on, so anything composed would be a fabrication.
 *   - Substrate returned snippets: render the brief via the LLM,
 *     grounded on those snippets. The brief format is structured
 *     (summary + key findings + gaps + citations).
 *   - LLM failure (with snippets present): fall back to a templated
 *     brief that lists each snippet verbatim as a finding — honest,
 *     ugly, but real.
 *
 * Per `feedback_no_guesses_no_estimates`: every claim cites a
 * substrate snippet or names a gap. Web search is not wired yet, so
 * the gaps surface NAMES that limitation.
 */

import { getLlmProvider } from '@/lib/llm';
import { MODEL_OPUS } from '@/lib/llm/model-tiers';
import { skillError, skillOk, type SkillResult } from '../types';
import type {
  ResearchBrief,
  ResearchBriefCitation,
  ResearchSkillInput,
  ResearchSkillOutput,
} from './types';
import type { SupportContextSnippet } from '../support-handler';

const NO_OUTBOUND_NOTE =
  'No outbound. The research brief drafts into the same PLAINO_INSTRUCTION ' +
  'approval queue row the dispatcher created. Per project_no_outbound_architecture.md.';

const WEB_SEARCH_GAP_NOTE =
  'Plaino does not have a web search adapter wired yet — every brief is ' +
  'grounded on the workspace\'s own knowledge base only. Connect Drive, Notion, ' +
  'or upload reference docs to widen what Plaino can pull from.';

const PROMPT_VERSION = 'RESEARCH_ON_DEMAND_V1';

const SYSTEM_PROMPT = [
  PROMPT_VERSION,
  '',
  'You are Plaino, the workspace\'s named service partner at agentplain.',
  'A customer asked you to research a topic. You have the customer\'s ',
  'knowledge-base snippets below — these are the ONLY grounding you have. ',
  'Plaino does NOT have a public web search adapter today.',
  '',
  'Write a brief the operator can review on /approvals. The brief has FOUR ',
  'parts: summary, key findings, gaps, citations. Tone: calm, precise. No ',
  'emoji. No hype. No marketing.',
  '',
  'Hard rules:',
  '- Ground EVERY claim in the snippets. Do NOT fabricate facts that are ',
  '  not in the snippets.',
  '- If the snippets do not cover an aspect of the question, NAME that ',
  '  gap in the "gaps" array — do not paper over it.',
  '- ALWAYS include "Plaino does not have web search wired yet — this brief ',
  '  is grounded on your knowledge base only." as one of the gaps. This is ',
  '  a load-bearing scope statement, not a hedge.',
  '- The brief is NOT a reply to the customer — it is a working document ',
  '  the operator reads. Write it as a brief, not a chat reply.',
  '',
  '── OUTPUT FORMAT ──',
  'Return STRICTLY a single JSON object — no prose outside it:',
  '{',
  '  "summary": string,           // one paragraph framing the question + what you found',
  '  "keyFindings": string[],      // 3-5 single-sentence findings, each grounded in a citation',
  '  "gaps": string[]              // 1-3 named gaps, including the "no web search" gap',
  '}',
  '(Citations are populated by the skill from the snippet list — do not include them in the JSON.)',
].join('\n');

const PLACEHOLDER_GAP =
  'Plaino did not find anything relevant in your knowledge base for this question. ' +
  'Try a more specific topic or connect a knowledge source (Drive, Notion, uploaded docs).';

export async function runSkill(
  input: ResearchSkillInput,
): Promise<SkillResult<ResearchSkillOutput>> {
  const llm = input.llm ?? getLlmProvider();
  const topK = input.topK ?? 6;

  const snippets = await input.substrate.searchForResearch({
    workspaceId: input.workspaceId,
    query: input.instructionText,
    k: topK,
  });

  if (snippets.length === 0) {
    return skillOk({
      brief: buildPlaceholderBrief(input.instructionText),
      substrateSnippets: [],
      isPlaceholder: true,
      noOutboundNote: NO_OUTBOUND_NOTE,
    });
  }

  const completion = await llm.complete({
    system: SYSTEM_PROMPT,
    model: MODEL_OPUS,
    cacheSystem: true,
    messages: [
      {
        role: 'user',
        content: renderUserPrompt({
          instructionText: input.instructionText,
          dispatcherReasoning: input.dispatcherReasoning,
          snippets,
          feedbackRulesBlock: input.feedbackRulesBlock ?? '',
        }),
      },
    ],
    maxTokens: 1100,
    temperature: 0.3,
    responseFormat: 'json',
    meta: {
      skill: 'research-on-demand-general',
      workspaceId: input.workspaceId,
      sourceSurface: 'OTHER',
    },
  });

  if (!completion.ok) {
    return skillError(
      'UPSTREAM_LLM_ERROR',
      `research-on-demand LLM call failed: ${completion.error.message}`,
      completion.error.code,
    );
  }

  const parsed = parseLlmOutput(completion.value.text);
  const citations = snippets.map(toCitation);
  if (!parsed.ok) {
    return skillOk({
      brief: buildTemplatedBrief({
        snippets,
        reason: `LLM returned malformed JSON: ${parsed.error}`,
      }),
      substrateSnippets: snippets,
      isPlaceholder: false,
      noOutboundNote: NO_OUTBOUND_NOTE,
    });
  }

  const brief: ResearchBrief = {
    summary: parsed.value.summary.trim(),
    keyFindings: parsed.value.keyFindings.map((k) => k.trim()).filter(Boolean),
    gaps: ensureWebSearchGap(parsed.value.gaps.map((g) => g.trim()).filter(Boolean)),
    citations,
  };

  return skillOk({
    brief,
    substrateSnippets: snippets,
    isPlaceholder: false,
    noOutboundNote: NO_OUTBOUND_NOTE,
  });
}

function ensureWebSearchGap(gaps: string[]): string[] {
  const hasWebSearchNote = gaps.some((g) =>
    g.toLowerCase().includes('web search'),
  );
  if (hasWebSearchNote) return gaps;
  return [...gaps, WEB_SEARCH_GAP_NOTE];
}

function renderUserPrompt(args: {
  instructionText: string;
  dispatcherReasoning: string;
  snippets: SupportContextSnippet[];
  feedbackRulesBlock: string;
}): string {
  const lines: string[] = [];
  lines.push('CUSTOMER ASKED:');
  lines.push(args.instructionText);
  lines.push('');
  lines.push(`Dispatcher classifier reasoning: ${args.dispatcherReasoning}`);
  lines.push('');
  lines.push('KNOWLEDGE BASE SNIPPETS (the ONLY grounding you have):');
  args.snippets.forEach((s, idx) => {
    lines.push(
      `[${idx + 1}] "${s.title}" (similarity ${s.similarity.toFixed(2)}) — ${
        s.sourceUrl ?? 'no source url'
      }`,
    );
    lines.push(`    ${s.bodyExcerpt.replace(/\s+/g, ' ').trim().slice(0, 700)}`);
    lines.push('');
  });
  if (args.feedbackRulesBlock.trim().length > 0) {
    lines.push(args.feedbackRulesBlock);
  }
  return lines.join('\n');
}

function buildPlaceholderBrief(instructionText: string): ResearchBrief {
  return {
    summary:
      `You asked: "${truncate(instructionText, 240)}". Plaino did not find anything ` +
      `relevant in your workspace's knowledge base for this question. The brief ` +
      `below names the gap rather than guessing — Plaino does NOT fabricate findings.`,
    keyFindings: [],
    gaps: [PLACEHOLDER_GAP, WEB_SEARCH_GAP_NOTE],
    citations: [],
  };
}

function buildTemplatedBrief(args: {
  snippets: SupportContextSnippet[];
  reason: string;
}): ResearchBrief {
  return {
    summary:
      `Plaino found ${args.snippets.length} relevant snippet${
        args.snippets.length === 1 ? '' : 's'
      } in your knowledge base. The LLM-composed brief failed (${args.reason}); the ` +
      `findings below are the raw snippet titles for the operator to read.`,
    keyFindings: args.snippets.map(
      (s) => `${s.title} — ${truncate(s.bodyExcerpt, 200)}`,
    ),
    gaps: [WEB_SEARCH_GAP_NOTE],
    citations: args.snippets.map(toCitation),
  };
}

function toCitation(s: SupportContextSnippet): ResearchBriefCitation {
  return {
    title: s.title,
    sourceUrl: s.sourceUrl,
    similarity: s.similarity,
  };
}

interface ParsedOutput {
  summary: string;
  keyFindings: string[];
  gaps: string[];
}

function parseLlmOutput(
  raw: string,
): { ok: true; value: ParsedOutput } | { ok: false; error: string } {
  const trimmed = raw.trim();
  const unwrapped = trimmed
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
  const obj = parsed as Record<string, unknown>;
  const summary = typeof obj.summary === 'string' ? obj.summary.trim() : '';
  const keyFindings = Array.isArray(obj.keyFindings)
    ? obj.keyFindings.filter((f): f is string => typeof f === 'string')
    : [];
  const gaps = Array.isArray(obj.gaps)
    ? obj.gaps.filter((g): g is string => typeof g === 'string')
    : [];
  if (!summary) return { ok: false, error: 'missing summary' };
  return { ok: true, value: { summary, keyFindings, gaps } };
}

function truncate(value: string, max: number): string {
  if (value.length <= max) return value;
  return value.slice(0, max - 1) + '…';
}

export const __testing = {
  parseLlmOutput,
  buildPlaceholderBrief,
  buildTemplatedBrief,
  ensureWebSearchGap,
  WEB_SEARCH_GAP_NOTE,
};
