/**
 * lib/skills/chief-of-staff-scheduler/llm-refine.ts
 *
 * Wave-4 — opt-in LLM refinement seam for chief-of-staff proposals.
 * After the heuristic emits meeting / reply-draft / todo proposals, the
 * caller MAY pass an `LlmProvider` + a `feedbackRulesBlock` (rendered
 * from workspace FEEDBACK rules under the `scheduling` scope). When
 * BOTH are present this module asks the LLM to either DROP or RE-RANK
 * proposals based on the FEEDBACK rules.
 *
 * Honesty bar: the refiner can only DROP proposals (skip them) or
 * adjust their `reasoning` line. It does NOT mint new proposals or
 * change time slots — those come from the heuristic's deterministic
 * calendar walk. LLM errors / empty FEEDBACK rules pass the heuristic
 * output through unchanged.
 */

import type { LlmProvider } from '@/lib/llm/types';
import type { ChiefOfStaffProposal } from './types';

const REFINE_SYSTEM_PROMPT = [
  'You are the chief-of-staff refiner for Plaino, the workspace\'s named service partner.',
  'A heuristic has built a list of proposals (meetings / reply drafts / to-dos) from',
  'the operator\'s inbox + calendar. Your only job: read the workspace\'s CUSTOMER',
  'PREFERENCES below and decide whether any proposal should be DROPPED or have its',
  'reasoning RE-WORDED because a preference rule clearly applies. Do NOT invent',
  'proposals; the heuristic owns generation.',
  '',
  'Hard rules:',
  '- Only act when a preference rule clearly + specifically applies. Generic context',
  '  ("we care about customers") → no action.',
  '- Cite the rule verbatim in `ruleApplied`.',
  '',
  '── OUTPUT FORMAT ──',
  'Return STRICTLY a single JSON object — no prose outside it:',
  '{',
  '  "drops": string[],         // proposalIds to drop (skip persisting)',
  '  "rewordings": [',
  '    { "proposalId": string, "newReasoning": string, "ruleApplied": string }',
  '  ]',
  '}',
].join('\n');

export interface RefineCosInput {
  llm: LlmProvider;
  feedbackRulesBlock: string;
  proposals: ChiefOfStaffProposal[];
  workspaceId: string;
}

export interface RefineCosOutput {
  proposals: ChiefOfStaffProposal[];
  dropped: number;
  reworded: number;
  note: string;
}

export async function maybeRefineCos(
  input: RefineCosInput,
): Promise<RefineCosOutput> {
  if (input.proposals.length === 0) {
    return { proposals: input.proposals, dropped: 0, reworded: 0, note: '' };
  }
  if (input.feedbackRulesBlock.trim().length === 0) {
    return { proposals: input.proposals, dropped: 0, reworded: 0, note: '' };
  }
  const userPrompt = renderUserPrompt(input);
  const completion = await input.llm.complete({
    system: REFINE_SYSTEM_PROMPT,
    cacheSystem: true,
    messages: [{ role: 'user', content: userPrompt }],
    maxTokens: 600,
    temperature: 0.2,
    responseFormat: 'json',
    meta: {
      skill: 'chief-of-staff-scheduler',
      workspaceId: input.workspaceId,
      sourceSurface: 'SCHEDULE',
    },
  });
  if (!completion.ok) {
    return {
      proposals: input.proposals,
      dropped: 0,
      reworded: 0,
      note: `LLM refine failed (${completion.error.code}); heuristic output kept.`,
    };
  }
  const parsed = parseResponse(completion.value.text);
  if (!parsed.ok) {
    return {
      proposals: input.proposals,
      dropped: 0,
      reworded: 0,
      note: 'LLM refine returned malformed JSON; heuristic output kept.',
    };
  }
  const dropSet = new Set(parsed.drops);
  const rewordMap = new Map(parsed.rewordings.map((r) => [r.proposalId, r]));
  const next: ChiefOfStaffProposal[] = [];
  let dropped = 0;
  let reworded = 0;
  for (const p of input.proposals) {
    if (dropSet.has(p.proposalId)) {
      dropped += 1;
      continue;
    }
    const r = rewordMap.get(p.proposalId);
    if (r) {
      reworded += 1;
      next.push({
        ...p,
        reasoning: `${r.newReasoning} · FEEDBACK rule: ${r.ruleApplied}`,
      });
    } else {
      next.push(p);
    }
  }
  return {
    proposals: next,
    dropped,
    reworded,
    note:
      dropped + reworded > 0
        ? `LLM dropped ${dropped} + reworded ${reworded} proposal${reworded === 1 ? '' : 's'} per FEEDBACK.`
        : '',
  };
}

function renderUserPrompt(input: RefineCosInput): string {
  const lines: string[] = [];
  lines.push(input.feedbackRulesBlock.trim());
  lines.push('');
  lines.push('── PROPOSALS ──');
  for (const p of input.proposals) {
    lines.push('');
    lines.push(`proposalId: ${p.proposalId}`);
    lines.push(`kind: ${p.kind}`);
    lines.push(`reasoning: ${p.reasoning}`);
    if (p.kind === 'meeting') {
      lines.push(`subject: ${p.subject}`);
    } else if (p.kind === 'reply-draft') {
      lines.push(`subject: ${p.subject}`);
    } else if (p.kind === 'todo') {
      lines.push(`title: ${p.title}`);
    }
  }
  return lines.join('\n');
}

interface ParsedResponse {
  drops: string[];
  rewordings: Array<{
    proposalId: string;
    newReasoning: string;
    ruleApplied: string;
  }>;
}

function parseResponse(
  raw: string,
): { ok: true; drops: string[]; rewordings: ParsedResponse['rewordings'] } | { ok: false; error: string } {
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
  const rawRewordings = Array.isArray(obj.rewordings) ? obj.rewordings : [];
  const rewordings: ParsedResponse['rewordings'] = [];
  for (const r of rawRewordings) {
    if (!r || typeof r !== 'object') continue;
    const ro = r as Record<string, unknown>;
    const proposalId = typeof ro.proposalId === 'string' ? ro.proposalId : null;
    const newReasoning =
      typeof ro.newReasoning === 'string' ? ro.newReasoning : null;
    const ruleApplied =
      typeof ro.ruleApplied === 'string' ? ro.ruleApplied : '';
    if (!proposalId || !newReasoning) continue;
    rewordings.push({ proposalId, newReasoning, ruleApplied });
  }
  return { ok: true, drops, rewordings };
}
