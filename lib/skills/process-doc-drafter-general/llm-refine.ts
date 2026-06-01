/**
 * lib/skills/process-doc-drafter-general/llm-refine.ts
 *
 * Wave-4 — opt-in LLM refinement seam for process-doc-drafter. After
 * the heuristic clusters past actions into SOP proposals, the caller
 * MAY pass an `LlmProvider` + a `feedbackRulesBlock` (rendered from
 * workspace FEEDBACK rules under the `content` scope). When BOTH are
 * present this module asks the LLM to either DROP proposals the rules
 * reject (e.g. "no SOPs for personal email patterns") or RE-TITLE them
 * to match the workspace's preferred SOP naming convention.
 *
 * Honesty bar: the LLM never invents new patterns or invents an SOP
 * body — the heuristic owns generation. Errors / empty rules pass the
 * heuristic output through unchanged.
 */

import type { LlmProvider } from '@/lib/llm/types';
import { MODEL_OPUS } from '@/lib/llm/model-tiers';
import type { ProcessDocProposal } from './types';

const REFINE_SYSTEM_PROMPT = [
  'You are the process-doc refiner for Plaino, the workspace\'s named service partner.',
  'A heuristic has drafted SOP proposals from clusters of past operator actions.',
  'Your only job: read the workspace\'s CUSTOMER PREFERENCES below and decide whether',
  'any proposal should be DROPPED or have its TITLE re-worded to match the workspace\'s',
  'preferred SOP naming convention. Do NOT rewrite the SOP body — the heuristic owns',
  'that content.',
  '',
  'Hard rules:',
  '- Only act when a preference rule clearly + specifically applies.',
  '- Cite the rule verbatim in `ruleApplied`.',
  '',
  '── OUTPUT FORMAT ──',
  'Return STRICTLY a single JSON object — no prose outside it:',
  '{',
  '  "drops": string[],',
  '  "retitles": [',
  '    { "proposalId": string, "newTitle": string, "ruleApplied": string }',
  '  ]',
  '}',
].join('\n');

export interface RefineProcessDocInput {
  llm: LlmProvider;
  feedbackRulesBlock: string;
  proposals: ProcessDocProposal[];
  workspaceId: string;
}

export interface RefineProcessDocOutput {
  proposals: ProcessDocProposal[];
  dropped: number;
  retitled: number;
  note: string;
}

export async function maybeRefineProcessDoc(
  input: RefineProcessDocInput,
): Promise<RefineProcessDocOutput> {
  if (input.proposals.length === 0) {
    return { proposals: input.proposals, dropped: 0, retitled: 0, note: '' };
  }
  if (input.feedbackRulesBlock.trim().length === 0) {
    return { proposals: input.proposals, dropped: 0, retitled: 0, note: '' };
  }
  const userPrompt = renderUserPrompt(input);
  const completion = await input.llm.complete({
    system: REFINE_SYSTEM_PROMPT,
    model: MODEL_OPUS,
    cacheSystem: true,
    messages: [{ role: 'user', content: userPrompt }],
    maxTokens: 500,
    temperature: 0.2,
    responseFormat: 'json',
    meta: {
      skill: 'process-doc-drafter-general',
      workspaceId: input.workspaceId,
      sourceSurface: 'PROCESS_DOC_DRAFTER',
    },
  });
  if (!completion.ok) {
    return {
      proposals: input.proposals,
      dropped: 0,
      retitled: 0,
      note: `LLM refine failed (${completion.error.code}); heuristic output kept.`,
    };
  }
  const parsed = parseResponse(completion.value.text);
  if (!parsed.ok) {
    return {
      proposals: input.proposals,
      dropped: 0,
      retitled: 0,
      note: 'LLM refine returned malformed JSON; heuristic output kept.',
    };
  }
  const dropSet = new Set(parsed.drops);
  const retitleMap = new Map(parsed.retitles.map((r) => [r.proposalId, r]));
  let dropped = 0;
  let retitled = 0;
  const next: ProcessDocProposal[] = [];
  for (const p of input.proposals) {
    if (dropSet.has(p.proposalId)) {
      dropped += 1;
      continue;
    }
    const r = retitleMap.get(p.proposalId);
    if (r) {
      retitled += 1;
      next.push({
        ...p,
        title: r.newTitle,
        reasoning: `${p.reasoning} · FEEDBACK retitle: ${r.ruleApplied}`,
      });
    } else {
      next.push(p);
    }
  }
  return {
    proposals: next,
    dropped,
    retitled,
    note:
      dropped + retitled > 0
        ? `LLM dropped ${dropped} + retitled ${retitled} SOP${retitled === 1 ? '' : 's'} per FEEDBACK.`
        : '',
  };
}

function renderUserPrompt(input: RefineProcessDocInput): string {
  const lines: string[] = [];
  lines.push(input.feedbackRulesBlock.trim());
  lines.push('');
  lines.push('── SOP PROPOSALS ──');
  for (const p of input.proposals) {
    lines.push('');
    lines.push(`proposalId: ${p.proposalId}`);
    lines.push(`title: ${p.title}`);
    lines.push(`patternKey: ${p.patternKey}`);
    lines.push(`occurrenceCount: ${p.occurrenceCount}`);
  }
  return lines.join('\n');
}

interface ParsedResponse {
  drops: string[];
  retitles: Array<{
    proposalId: string;
    newTitle: string;
    ruleApplied: string;
  }>;
}

function parseResponse(
  raw: string,
): { ok: true; drops: string[]; retitles: ParsedResponse['retitles'] } | { ok: false; error: string } {
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
  const obj = parsed as Record<string, unknown>;
  const drops = Array.isArray(obj.drops)
    ? obj.drops.filter((d): d is string => typeof d === 'string')
    : [];
  const rawRetitles = Array.isArray(obj.retitles) ? obj.retitles : [];
  const retitles: ParsedResponse['retitles'] = [];
  for (const r of rawRetitles) {
    if (!r || typeof r !== 'object') continue;
    const ro = r as Record<string, unknown>;
    const proposalId = typeof ro.proposalId === 'string' ? ro.proposalId : null;
    const newTitle = typeof ro.newTitle === 'string' ? ro.newTitle : null;
    const ruleApplied =
      typeof ro.ruleApplied === 'string' ? ro.ruleApplied : '';
    if (!proposalId || !newTitle || newTitle.trim().length === 0) continue;
    retitles.push({ proposalId, newTitle: newTitle.trim(), ruleApplied });
  }
  return { ok: true, drops, retitles };
}
