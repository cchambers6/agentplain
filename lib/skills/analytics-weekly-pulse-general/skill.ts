/**
 * lib/skills/analytics-weekly-pulse-general/skill.ts
 *
 * Pure orchestration: compose the weekly pulse from a snapshot, persist
 * via the injected sink. The LLM-composed body grounds on counts only —
 * the snapshot intentionally does NOT carry any approval body text, so
 * the pulse can never leak a customer-facing draft into a different
 * surface.
 *
 * Per `project_no_outbound_architecture.md`: the skill DRAFTS one row.
 * The operator reviews on /approvals — agentplain sends nothing.
 *
 * Per `feedback_cold_start_safe_agents.md`: stateless. The caller passes
 * a freshly-built snapshot on every fire.
 *
 * Per `feedback_no_quick_fixes.md`: the empty-week case is honest — the
 * pulse prose is templated ("the fleet was quiet this week"), the LLM is
 * NOT called when there is nothing to ground on.
 */

import { randomUUID } from 'node:crypto';
import { getLlmProvider } from '@/lib/llm';
import { MODEL_OPUS } from '@/lib/llm/model-tiers';
import type { LlmProvider } from '@/lib/llm/types';
import { skillError, skillOk, type SkillResult } from '../types';
import type {
  PulseActivitySnapshot,
  PulseProposal,
  PulseSkillInput,
  PulseSkillOutput,
} from './types';

const NO_OUTBOUND_NOTE =
  'No emails or messages sent. The pulse is a single draft row in /approvals ' +
  'for the operator to read. Per project_no_outbound_architecture.md.';

const SYSTEM_PROMPT = [
  'You are Plaino, the workspace\'s named service partner at agentplain.',
  'Write ONE weekly pulse — a calm, specific paragraph (3-6 sentences) on ',
  'what the fleet did this week, where it was underused, and what is worth ',
  'leaning into next week. Tone: calm, service-partner, never chirpy or ',
  'promotional. No emoji. No headers. No bullet points more than 2 deep.',
  '',
  'Hard rules:',
  '- Ground EVERY claim in the snapshot below. Do NOT invent counts, kinds, ',
  '  or activity that is not in the snapshot.',
  '- Reference specific numbers ("inbox-triage produced 12, you approved 11") ',
  '  rather than vague phrasing ("inbox-triage was active").',
  '- If a skill is listed under "installed but did not fire this week", call ',
  '  one or two out by name as candidates the operator might lean on next week.',
  '- If the snapshot is empty (zero approvals + zero chats + zero ',
  '  instructions), reply in two sentences acknowledging the quiet week — do ',
  '  not invent activity.',
  '- Close with one short concrete suggestion for next week, not promises.',
  '',
  '── OUTPUT FORMAT ──',
  'Return STRICTLY a single JSON object — no prose outside it:',
  '{',
  '  "body": string,                  // the pulse paragraph(s) themselves',
  '  "recommendations": string[]       // 0-3 short fragment bullets the operator could act on this week',
  '}',
].join('\n');

export async function runSkill(
  input: PulseSkillInput,
): Promise<SkillResult<PulseSkillOutput>> {
  const now = input.now ?? new Date();
  const llm = input.llm ?? getLlmProvider();
  const snapshot = input.snapshot;

  const forWeekStarting = isoMonday(now);

  const isQuiet =
    snapshot.counts.approvalsCreated === 0 &&
    snapshot.counts.chatThreads === 0 &&
    snapshot.counts.instructions === 0;

  if (isQuiet) {
    const proposal = buildQuietProposal({ snapshot, forWeekStarting });
    return finalize({ input, proposal });
  }

  const userPrompt = renderUserPrompt({
    snapshot,
    feedbackRulesBlock: (input.feedbackRulesBlock ?? '').trim(),
  });
  const completion = await llm.complete({
    system: SYSTEM_PROMPT,
    model: MODEL_OPUS,
    cacheSystem: true,
    messages: [{ role: 'user', content: userPrompt }],
    maxTokens: 700,
    temperature: 0.4,
    responseFormat: 'json',
    meta: {
      skill: 'analytics-weekly-pulse-general',
      workspaceId: snapshot.workspaceId,
      sourceSurface: 'OTHER',
    },
  });

  if (!completion.ok) {
    return skillError(
      'UPSTREAM_LLM_ERROR',
      `analytics-weekly-pulse LLM call failed: ${completion.error.message}`,
      completion.error.code,
    );
  }

  const parsed = parseLlmOutput(completion.value.text);
  if (!parsed.ok) {
    // LLM returned malformed JSON — fall back to a templated body so the
    // row still lands honestly. The operator gets the snapshot rendered
    // verbatim instead of prose.
    const proposal = buildTemplatedProposal({
      snapshot,
      forWeekStarting,
      reason: `LLM returned malformed JSON: ${parsed.error}`,
    });
    return finalize({ input, proposal });
  }

  const proposal: PulseProposal = {
    proposalId: randomUUID(),
    forWeekStarting,
    body: parsed.value.body.trim(),
    snapshot,
    recommendations: parsed.value.recommendations
      .map((r) => r.trim())
      .filter((r) => r.length > 0),
  };
  return finalize({ input, proposal });
}

async function finalize(args: {
  input: PulseSkillInput;
  proposal: PulseProposal;
}): Promise<SkillResult<PulseSkillOutput>> {
  let sunk = false;
  if (args.input.sink) {
    const res = await args.input.sink.record({
      workspaceId: args.input.workspaceId,
      proposal: args.proposal,
    });
    sunk = res.ok;
  }
  return skillOk({
    proposal: args.proposal,
    sunk,
    noOutboundNote: NO_OUTBOUND_NOTE,
  });
}

function renderUserPrompt(args: {
  snapshot: PulseActivitySnapshot;
  feedbackRulesBlock: string;
}): string {
  const s = args.snapshot;
  const lines: string[] = [];
  lines.push(`Workspace: ${s.workspaceName}`);
  lines.push(`Window: ${s.windowFrom} → ${s.windowTo}`);
  lines.push('');
  lines.push('Activity counts (trailing 7 days):');
  lines.push(`- Approvals proposed: ${s.counts.approvalsCreated}`);
  lines.push(`- Approvals approved: ${s.counts.approvalsApproved}`);
  lines.push(`- Approvals rejected: ${s.counts.approvalsRejected}`);
  lines.push(`- Approvals still pending: ${s.counts.approvalsPending}`);
  lines.push(`- New chat threads: ${s.counts.chatThreads}`);
  lines.push(`- New /talk instructions: ${s.counts.instructions}`);
  lines.push(`- Learned notes from corrections: ${s.counts.learnedNotes}`);
  if (s.topKindsByThroughput.length > 0) {
    lines.push('');
    lines.push('Throughput by approval kind:');
    for (const k of s.topKindsByThroughput) {
      lines.push(
        `- ${k.kind}: ${k.proposed} proposed, ${k.approved} approved, ${k.rejected} rejected`,
      );
    }
  }
  if (s.installedSkillsNotFiring.length > 0) {
    lines.push('');
    lines.push('Installed but did NOT fire this week:');
    for (const slug of s.installedSkillsNotFiring) {
      lines.push(`- ${slug}`);
    }
  }
  if (args.feedbackRulesBlock.length > 0) {
    lines.push('');
    lines.push(args.feedbackRulesBlock);
  }
  return lines.join('\n');
}

function buildQuietProposal(args: {
  snapshot: PulseActivitySnapshot;
  forWeekStarting: string;
}): PulseProposal {
  const body =
    `${args.snapshot.workspaceName} had a quiet week — no approvals queued, ` +
    `no /talk turns, and nothing surfaced that needed a decision. The fleet ` +
    `is still cadencing in the background. If anything was supposed to be ` +
    `running here and was not, that is worth a quick look.`;
  return {
    proposalId: randomUUID(),
    forWeekStarting: args.forWeekStarting,
    body,
    snapshot: args.snapshot,
    recommendations: [],
  };
}

function buildTemplatedProposal(args: {
  snapshot: PulseActivitySnapshot;
  forWeekStarting: string;
  reason: string;
}): PulseProposal {
  const s = args.snapshot;
  const body =
    `Plaino had a busy week — ${s.counts.approvalsCreated} drafts proposed, ` +
    `${s.counts.approvalsApproved} approved, ${s.counts.approvalsRejected} ` +
    `rejected, and ${s.counts.approvalsPending} still waiting on you. The ` +
    `pulse prose was not composed this morning (${args.reason}); the counts ` +
    `above are the honest summary.`;
  return {
    proposalId: randomUUID(),
    forWeekStarting: args.forWeekStarting,
    body,
    snapshot: s,
    recommendations: [],
  };
}

interface ParsedOutput {
  body: string;
  recommendations: string[];
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
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { ok: false, error: 'not an object' };
  }
  const obj = parsed as Record<string, unknown>;
  const body = typeof obj.body === 'string' ? obj.body : null;
  if (!body || body.trim().length === 0) {
    return { ok: false, error: 'missing body' };
  }
  const rawRecs = Array.isArray(obj.recommendations) ? obj.recommendations : [];
  const recs = rawRecs
    .filter((r): r is string => typeof r === 'string')
    .slice(0, 5);
  return { ok: true, value: { body, recommendations: recs } };
}

function isoMonday(d: Date): string {
  // Treat the input as UTC and step back to Monday so the row's
  // forWeekStarting is stable across the cron's fire window.
  const day = d.getUTCDay(); // 0=Sun
  const offset = day === 0 ? 6 : day - 1;
  const monday = new Date(d.getTime() - offset * 24 * 60 * 60 * 1000);
  return monday.toISOString().slice(0, 10);
}

export const __testing = {
  parseLlmOutput,
  isoMonday,
};
