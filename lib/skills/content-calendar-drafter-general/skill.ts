/**
 * lib/skills/content-calendar-drafter-general/skill.ts
 *
 * Pure orchestration. The LLM grounds on (vertical, activity counts,
 * FEEDBACK rules). Output is a structured JSON object the skill parses
 * into 3-5 daily entries. Malformed output falls back to a templated
 * "topics to consider this week" body so the row still lands.
 */

import { randomUUID } from 'node:crypto';
import { getLlmProvider } from '@/lib/llm';
import { MODEL_OPUS } from '@/lib/llm/model-tiers';
import { skillError, skillOk, type SkillResult } from '../types';
import type {
  CalendarSkillInput,
  CalendarSkillOutput,
  CalendarProposal,
  ContentCalendarDayProposal,
  CalendarSnapshot,
} from './types';

const NO_OUTBOUND_NOTE =
  'Calendar drafted into /approvals. agentplain does NOT post to social, ' +
  'send email blasts, or schedule anything. Per project_no_outbound_architecture.md.';

const SYSTEM_PROMPT = [
  'You are Plaino, the workspace\'s named service partner at agentplain.',
  'Draft a 5-day content-calendar suggestion the operator can review on ',
  '/approvals. Five entries — Mon, Tue, Wed, Thu, Fri of the target week. ',
  'Each entry: a short topic + a one-line hook + a channel hint ("email", ',
  '"social", "blog", "newsletter", or "internal-comms"). Tone: calm, plain-',
  'spoken, service-partner. No emoji. No hype.',
  '',
  'Hard rules:',
  '- Ground every topic in the workspace\'s vertical + the recent activity ',
  '  counts. Do NOT invent capabilities the workspace has not exercised.',
  '- If the customer has set FEEDBACK rules under the email-draft or ',
  '  customer-comms scope, HONOR them — they are how this workspace wants ',
  '  content to read.',
  '- If the vertical is real-estate, lean toward listing-coordination, ',
  '  buyer-inquiry follow-up, and broker-news topics. For CPA, lean toward ',
  '  client-prep and books-clarity topics. For law, lean toward intake ',
  '  follow-up and case-status topics. Mirror the vertical\'s natural cadence.',
  '- DO NOT make up specific events, holidays, or named customers. Keep ',
  '  hooks evergreen.',
  '',
  '── OUTPUT FORMAT ──',
  'Return STRICTLY a single JSON object — no prose outside it:',
  '{',
  '  "preamble": string,                   // 1-2 sentence framing line',
  '  "days": [                              // 3-5 entries',
  '    { "date": "yyyy-MM-dd", "channel": string, "topic": string, "hook": string }',
  '  ]',
  '}',
].join('\n');

export async function runSkill(
  input: CalendarSkillInput,
): Promise<SkillResult<CalendarSkillOutput>> {
  const llm = input.llm ?? getLlmProvider();
  const snapshot = input.snapshot;

  const completion = await llm.complete({
    system: SYSTEM_PROMPT,
    model: MODEL_OPUS,
    cacheSystem: true,
    messages: [
      { role: 'user', content: renderUserPrompt(snapshot, input.feedbackRulesBlock ?? '') },
    ],
    maxTokens: 900,
    temperature: 0.5,
    responseFormat: 'json',
    meta: {
      skill: 'content-calendar-drafter-general',
      workspaceId: snapshot.workspaceId,
      verticalSlug: snapshot.verticalSlug,
      sourceSurface: 'OTHER',
    },
  });

  if (!completion.ok) {
    return skillError(
      'UPSTREAM_LLM_ERROR',
      `content-calendar-drafter LLM call failed: ${completion.error.message}`,
      completion.error.code,
    );
  }

  const parsed = parseLlmOutput(completion.value.text, snapshot.forWeekStarting);
  const proposal: CalendarProposal = parsed.ok
    ? {
        proposalId: randomUUID(),
        forWeekStarting: snapshot.forWeekStarting,
        preamble: parsed.value.preamble,
        days: parsed.value.days,
        snapshot,
      }
    : buildTemplatedProposal({
        snapshot,
        reason: `LLM returned malformed JSON: ${parsed.error}`,
      });

  let sunk = false;
  if (input.sink) {
    const sinkRes = await input.sink.record({
      workspaceId: input.workspaceId,
      proposal,
    });
    sunk = sinkRes.ok;
  }
  return skillOk({
    proposal,
    sunk,
    noOutboundNote: NO_OUTBOUND_NOTE,
  });
}

function renderUserPrompt(snapshot: CalendarSnapshot, feedbackRules: string): string {
  const lines: string[] = [];
  lines.push(`Workspace: ${snapshot.workspaceName}`);
  lines.push(`Vertical: ${snapshot.verticalSlug}`);
  lines.push(`Target week (Monday start): ${snapshot.forWeekStarting}`);
  lines.push('');
  lines.push('Trailing-week activity:');
  lines.push(`- Approvals proposed: ${snapshot.recentCounts.approvalsCreated}`);
  lines.push(`- /talk instructions: ${snapshot.recentCounts.instructions}`);
  if (feedbackRules.trim().length > 0) {
    lines.push('');
    lines.push(feedbackRules);
  }
  return lines.join('\n');
}

function buildTemplatedProposal(args: {
  snapshot: CalendarSnapshot;
  reason: string;
}): CalendarProposal {
  const days: ContentCalendarDayProposal[] = buildTemplatedDays(args.snapshot);
  return {
    proposalId: randomUUID(),
    forWeekStarting: args.snapshot.forWeekStarting,
    preamble: `Plaino has a few evergreen ${args.snapshot.verticalSlug} topics for the week — the LLM-composed prose was not generated this morning (${args.reason}); these are the safe defaults.`,
    days,
    snapshot: args.snapshot,
  };
}

function buildTemplatedDays(snapshot: CalendarSnapshot): ContentCalendarDayProposal[] {
  const monday = new Date(snapshot.forWeekStarting + 'T00:00:00.000Z');
  const days: ContentCalendarDayProposal[] = [];
  for (let i = 0; i < 5; i += 1) {
    const d = new Date(monday.getTime() + i * 24 * 60 * 60 * 1000);
    days.push({
      date: d.toISOString().slice(0, 10),
      channel: 'email',
      topic: `${snapshot.verticalSlug} — operator topic to define`,
      hook: '{{operator: replace with a real topic — this is a templated placeholder}}',
    });
  }
  return days;
}

interface ParsedOutput {
  preamble: string;
  days: ContentCalendarDayProposal[];
}

function parseLlmOutput(
  raw: string,
  forWeekStarting: string,
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
  const preamble = typeof obj.preamble === 'string' ? obj.preamble.trim() : '';
  const daysRaw = Array.isArray(obj.days) ? obj.days : [];
  const days: ContentCalendarDayProposal[] = [];
  for (const d of daysRaw) {
    if (!d || typeof d !== 'object') continue;
    const e = d as Record<string, unknown>;
    const date = typeof e.date === 'string' ? e.date : null;
    const channel = typeof e.channel === 'string' ? e.channel : null;
    const topic = typeof e.topic === 'string' ? e.topic : null;
    const hook = typeof e.hook === 'string' ? e.hook : null;
    if (!date || !channel || !topic || !hook) continue;
    days.push({
      date,
      channel: channel.trim(),
      topic: topic.trim(),
      hook: hook.trim(),
    });
  }
  if (days.length === 0) {
    return { ok: false, error: 'no usable days in output' };
  }
  if (!preamble) {
    return {
      ok: false,
      error: 'missing preamble',
    };
  }
  // Sanity check — at least one entry should fall in the target week.
  const targetMonday = forWeekStarting;
  const anyInWeek = days.some((d) => d.date >= targetMonday);
  if (!anyInWeek) {
    return { ok: false, error: 'no entries fall on or after target Monday' };
  }
  return { ok: true, value: { preamble, days: days.slice(0, 5) } };
}

export const __testing = { parseLlmOutput, buildTemplatedDays };
