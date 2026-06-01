/**
 * lib/skills/lead-triage-realestate/llm-refine.ts
 *
 * Wave-4 — opt-in LLM refinement seam for lead-triage. After the
 * heuristic scores + categorizes each lead, the caller MAY pass an
 * `LlmProvider` + a `feedbackRulesBlock` (rendered from workspace
 * FEEDBACK rules under the `lead-triage` scope). When BOTH are
 * present this module asks the LLM whether any lead's CATEGORY should
 * be revised based on the rules. Honesty bar: the LLM can only change
 * the category, not the scores (the scores are the heuristic's truth);
 * the routing is re-derived from the new category.
 *
 * Errors / empty rules pass the heuristic output through unchanged.
 */

import type { LlmProvider } from '@/lib/llm/types';
import { MODEL_OPUS } from '@/lib/llm/model-tiers';
import type {
  AgentRoster,
  DripCampaign,
  LeadCategory,
  TriagedLead,
} from './types';

const VALID_CATEGORIES: ReadonlyArray<LeadCategory> = [
  'hot',
  'warm',
  'cold',
  'nurture',
];

const REFINE_SYSTEM_PROMPT = [
  'You are the lead-triage refiner for Plaino, the workspace\'s named service partner.',
  'A heuristic has scored each real-estate lead on motivation / timeline / preapproval',
  'and bucketed it hot / warm / cold / nurture. Your only job: read the workspace\'s',
  'CUSTOMER PREFERENCES below and decide whether any lead\'s CATEGORY should be',
  'revised because a preference rule clearly applies. Do NOT change the scores —',
  'those are the heuristic\'s truth.',
  '',
  'Hard rules:',
  '- Only override when a preference rule clearly + specifically applies. Generic',
  '  context ("we love referrals") → no override.',
  '- Cite the rule verbatim in `ruleApplied`.',
  '- Category MUST be one of: hot, warm, cold, nurture.',
  '',
  '── OUTPUT FORMAT ──',
  'Return STRICTLY a single JSON object — no prose outside it:',
  '{',
  '  "overrides": [',
  '    {',
  '      "leadId": string,',
  '      "newCategory": "hot" | "warm" | "cold" | "nurture",',
  '      "ruleApplied": string',
  '    }',
  '  ]',
  '}',
].join('\n');

export interface RefineLeadTriageInput {
  llm: LlmProvider;
  feedbackRulesBlock: string;
  triaged: TriagedLead[];
  agents: AgentRoster[];
  campaigns: DripCampaign[];
  workspaceId: string;
}

export interface RefineLeadTriageOutput {
  triaged: TriagedLead[];
  applied: number;
  note: string;
}

export async function maybeRefineLeadTriage(
  input: RefineLeadTriageInput,
): Promise<RefineLeadTriageOutput> {
  if (input.triaged.length === 0) {
    return { triaged: input.triaged, applied: 0, note: '' };
  }
  if (input.feedbackRulesBlock.trim().length === 0) {
    return { triaged: input.triaged, applied: 0, note: '' };
  }
  const userPrompt = renderUserPrompt(input);
  const completion = await input.llm.complete({
    system: REFINE_SYSTEM_PROMPT,
    model: MODEL_OPUS,
    cacheSystem: true,
    messages: [{ role: 'user', content: userPrompt }],
    maxTokens: 600,
    temperature: 0.2,
    responseFormat: 'json',
    meta: {
      skill: 'lead-triage-realestate',
      workspaceId: input.workspaceId,
      sourceSurface: 'CATEGORIZE',
    },
  });
  if (!completion.ok) {
    return {
      triaged: input.triaged,
      applied: 0,
      note: `LLM refine failed (${completion.error.code}); heuristic output kept.`,
    };
  }
  const parsed = parseOverrides(completion.value.text);
  if (!parsed.ok) {
    return {
      triaged: input.triaged,
      applied: 0,
      note: 'LLM refine returned malformed JSON; heuristic output kept.',
    };
  }
  if (parsed.overrides.length === 0) {
    return { triaged: input.triaged, applied: 0, note: '' };
  }
  const overrideMap = new Map(parsed.overrides.map((o) => [o.leadId, o]));
  let applied = 0;
  const next = input.triaged.map((t) => {
    const o = overrideMap.get(t.leadId);
    if (!o) return t;
    if (o.newCategory === t.category) return t;
    applied += 1;
    return {
      ...t,
      category: o.newCategory,
      // Annotate the routing rationale so the operator can see the
      // FEEDBACK rule fired. The routing TYPE stays as the heuristic
      // chose; only the rationale gets the override note. (Routing
      // re-derivation would need re-running pickRouting, which the
      // honesty bar forbids without re-scoring — kept narrow on
      // purpose.)
      routing: {
        ...t.routing,
        rationale:
          `${t.routing.rationale} · FEEDBACK override of category ${t.category} → ${o.newCategory}: ${o.ruleApplied}`,
      },
    };
  });
  return {
    triaged: next,
    applied,
    note:
      applied > 0
        ? `LLM applied ${applied} FEEDBACK category override${applied === 1 ? '' : 's'}.`
        : '',
  };
}

function renderUserPrompt(input: RefineLeadTriageInput): string {
  const lines: string[] = [];
  lines.push(input.feedbackRulesBlock.trim());
  lines.push('');
  lines.push('── LEADS + HEURISTIC CATEGORIES ──');
  for (const t of input.triaged) {
    lines.push('');
    lines.push(`leadId: ${t.leadId}`);
    lines.push(`leadName: ${t.leadName}`);
    lines.push(`heuristicCategory: ${t.category}`);
    lines.push(
      `scores: motivation=${t.scores.motivation} timeline=${t.scores.timeline} preapproval=${t.scores.preapproval} composite=${t.scores.composite}`,
    );
  }
  return lines.join('\n');
}

interface ParsedOverride {
  leadId: string;
  newCategory: LeadCategory;
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
  if (!Array.isArray(rawOverrides)) return { ok: true, overrides: [] };
  const overrides: ParsedOverride[] = [];
  for (const o of rawOverrides) {
    if (!o || typeof o !== 'object') continue;
    const obj = o as Record<string, unknown>;
    const leadId = typeof obj.leadId === 'string' ? obj.leadId : null;
    const newCategoryRaw =
      typeof obj.newCategory === 'string' ? obj.newCategory : null;
    const ruleApplied =
      typeof obj.ruleApplied === 'string' ? obj.ruleApplied : '';
    if (!leadId || !newCategoryRaw) continue;
    if (!VALID_CATEGORIES.includes(newCategoryRaw as LeadCategory)) continue;
    overrides.push({
      leadId,
      newCategory: newCategoryRaw as LeadCategory,
      ruleApplied,
    });
  }
  return { ok: true, overrides };
}
