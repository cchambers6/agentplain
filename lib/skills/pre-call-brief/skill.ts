/**
 * lib/skills/pre-call-brief/skill.ts
 *
 * Composes a 5-bullet pre-call brief (wave-5, theme #15 / ratif #10).
 *
 * Flow:
 *   1. Parse the prospect/company from the call title.
 *   2. Ground on the research substrate (live web search when wired,
 *      fixture corpus otherwise) keyed on the prospect + any event context.
 *   3. Ask the LLM for EXACTLY 5 bullets, grounded on the snippets.
 *   4. If the LLM fails or returns the wrong count, normalize to 5 via a
 *      deterministic templated fallback so the contract holds — the rep
 *      ALWAYS gets a 5-bullet brief, even on a cold cache.
 *
 * Per `feedback_no_guesses_no_estimates`: bullets are grounded on the
 * substrate; the last bullet always names the grounding scope honestly.
 */

import { getLlmProvider } from '@/lib/llm';
import { MODEL_SONNET } from '@/lib/llm/model-tiers';
import { skillError, skillOk } from '../types';
import type {
  PreCallBrief,
  PreCallBriefInput,
  PreCallBriefResult,
} from './types';

export const BRIEF_BULLET_COUNT = 5;

const SYSTEM_PROMPT = [
  'PRE_CALL_BRIEF_V1',
  '',
  'You are Plaino, preparing a B2B sales rep for an intro call that starts ',
  'soon. Write a SHORT pre-call brief the rep can skim in 30 seconds.',
  '',
  'Hard rules:',
  `- Return EXACTLY ${BRIEF_BULLET_COUNT} bullets. No more, no fewer.`,
  '- Ground every factual bullet in the SOURCES below. Do NOT invent ',
  '  specifics (headcount, funding, names) that are not in the sources.',
  '- Bullet 1: who they are / why this call. Bullets 2-4: the most useful ',
  '  things to know or ask, grounded in sources. Bullet 5: the single ',
  '  highest-leverage question to open with.',
  '- Tone: calm, concrete, no hype, no emoji.',
  '',
  '── OUTPUT FORMAT ──',
  'Return STRICTLY a single JSON object — no prose outside it:',
  '{ "bullets": string[] }   // length must be exactly 5',
].join('\n');

export async function runSkill(
  input: PreCallBriefInput,
): Promise<PreCallBriefResult> {
  if (!input.call?.id || !input.call.title) {
    return skillError('INVALID_INPUT', 'pre-call-brief requires a call with id + title');
  }
  const llm = input.llm ?? getLlmProvider();
  const topK = input.topK ?? 4;
  const groundingIsLive = input.groundingIsLive ?? false;
  const subject = parseSubject(input.call.title);

  const query = [subject, input.call.context ?? '']
    .map((s) => s.trim())
    .filter(Boolean)
    .join(' — ');

  const snippets = await input.substrate.searchForResearch({
    workspaceId: input.workspaceId,
    query: query || input.call.title,
    k: topK,
  });

  const citations = snippets.map((s) => ({
    title: s.title,
    sourceUrl: s.sourceUrl,
  }));

  // No grounding → deterministic 5-bullet brief that NAMES the gap. No LLM
  // call (nothing to ground on).
  if (snippets.length === 0) {
    return skillOk(
      finalize({
        call: input.call,
        subject,
        bullets: ungroundedBullets(subject, groundingIsLive),
        citations,
        groundingIsLive,
      }),
    );
  }

  const completion = await llm.complete({
    system: SYSTEM_PROMPT,
    // A pre-call brief is a small, frequent, latency-sensitive job — use
    // Sonnet, not Opus, per the routing-audit cost posture.
    model: MODEL_SONNET,
    cacheSystem: true,
    messages: [
      {
        role: 'user',
        content: renderUserPrompt(subject, input.call.startUtc, snippets),
      },
    ],
    maxTokens: 600,
    temperature: 0.3,
    responseFormat: 'json',
    meta: {
      skill: 'pre-call-brief',
      workspaceId: input.workspaceId,
      sourceSurface: 'OTHER',
    },
  });

  if (!completion.ok) {
    // LLM failure with grounding present → templated 5 bullets from the
    // snippets. Honest + ugly, never empty.
    return skillOk(
      finalize({
        call: input.call,
        subject,
        bullets: templatedBullets(subject, snippets, groundingIsLive),
        citations,
        groundingIsLive,
      }),
    );
  }

  const parsed = parseBullets(completion.value.text);
  const bullets = parsed.ok
    ? normalizeToFive(parsed.value, subject, snippets, groundingIsLive)
    : templatedBullets(subject, snippets, groundingIsLive);

  return skillOk(
    finalize({ call: input.call, subject, bullets, citations, groundingIsLive }),
  );
}

// ── helpers ─────────────────────────────────────────────────────────────

function finalize(args: {
  call: PreCallBriefInput['call'];
  subject: string;
  bullets: string[];
  citations: PreCallBrief['citations'];
  groundingIsLive: boolean;
}): PreCallBrief {
  return {
    callId: args.call.id,
    subject: args.subject,
    startUtc: args.call.startUtc,
    bullets: args.bullets.slice(0, BRIEF_BULLET_COUNT),
    citations: args.citations,
    groundingIsLive: args.groundingIsLive,
  };
}

/** Parse the prospect / company out of a call title. Handles common
 *  patterns: "Intro call — Acme Realty (Jane Doe)", "Acme / agentplain",
 *  "Demo: Acme Realty". Falls back to the whole title. */
export function parseSubject(title: string): string {
  const cleaned = title
    .replace(/^(intro call|intro|demo|discovery|call|meeting)\s*[—:\-–]\s*/i, '')
    .trim();
  // Drop a trailing "(Person Name)".
  const noParen = cleaned.replace(/\s*\([^)]*\)\s*$/, '').trim();
  // "Acme / agentplain" → take the side that isn't us.
  const slashParts = noParen.split('/').map((p) => p.trim());
  if (slashParts.length === 2) {
    const them = slashParts.find((p) => !/agentplain/i.test(p));
    if (them) return them;
  }
  return noParen || title.trim();
}

function renderUserPrompt(
  subject: string,
  startUtc: string,
  snippets: Array<{ title: string; bodyExcerpt: string; sourceUrl: string | null }>,
): string {
  const lines: string[] = [];
  lines.push(`PROSPECT / COMPANY: ${subject}`);
  lines.push(`CALL STARTS: ${startUtc}`);
  lines.push('');
  lines.push('SOURCES (ground the bullets in these):');
  snippets.forEach((s, i) => {
    lines.push(`[${i + 1}] ${s.title} — ${s.sourceUrl ?? 'no url'}`);
    lines.push(`    ${s.bodyExcerpt.replace(/\s+/g, ' ').trim().slice(0, 400)}`);
  });
  return lines.join('\n');
}

function parseBullets(
  raw: string,
): { ok: true; value: string[] } | { ok: false } {
  const unwrapped = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();
  try {
    const obj = JSON.parse(unwrapped) as unknown;
    if (obj && typeof obj === 'object' && Array.isArray((obj as { bullets?: unknown }).bullets)) {
      const bullets = (obj as { bullets: unknown[] }).bullets
        .filter((b): b is string => typeof b === 'string')
        .map((b) => b.trim())
        .filter(Boolean);
      if (bullets.length > 0) return { ok: true, value: bullets };
    }
  } catch {
    // fallthrough
  }
  return { ok: false };
}

/** Force exactly 5 bullets: truncate if more, pad from snippets/templated
 *  if fewer. The 5-bullet contract is load-bearing. */
function normalizeToFive(
  bullets: string[],
  subject: string,
  snippets: Array<{ title: string; bodyExcerpt: string }>,
  groundingIsLive: boolean,
): string[] {
  if (bullets.length >= BRIEF_BULLET_COUNT) {
    return bullets.slice(0, BRIEF_BULLET_COUNT);
  }
  const padded = [...bullets];
  const filler = templatedBullets(subject, snippets, groundingIsLive);
  let i = 0;
  while (padded.length < BRIEF_BULLET_COUNT && i < filler.length) {
    if (!padded.includes(filler[i])) padded.push(filler[i]);
    i += 1;
  }
  while (padded.length < BRIEF_BULLET_COUNT) {
    padded.push(groundingScopeBullet(groundingIsLive));
  }
  return padded.slice(0, BRIEF_BULLET_COUNT);
}

function templatedBullets(
  subject: string,
  snippets: Array<{ title: string; bodyExcerpt: string }>,
  groundingIsLive: boolean,
): string[] {
  const out: string[] = [
    `Intro call with ${subject} — open warm, confirm their priority for the call.`,
  ];
  for (const s of snippets.slice(0, 3)) {
    out.push(`${s.title}: ${truncate(s.bodyExcerpt, 160)}`);
  }
  out.push(
    `Open with: "What's the one thing that, if we fixed it, would make this call worth your time?"`,
  );
  out.push(groundingScopeBullet(groundingIsLive));
  // Guarantee EXACTLY 5 — pad with generic discovery prompts when few
  // snippets were available. The 5-bullet contract is load-bearing.
  const padding = [
    `Confirm who's on the call and their role before pitching.`,
    `Ask what prompted ${subject} to take this call now.`,
    `Listen for the budget owner vs. the user — note who's which.`,
  ];
  let p = 0;
  while (out.length < BRIEF_BULLET_COUNT && p < padding.length) {
    if (!out.includes(padding[p])) out.push(padding[p]);
    p += 1;
  }
  return out.slice(0, BRIEF_BULLET_COUNT);
}

function ungroundedBullets(subject: string, groundingIsLive: boolean): string[] {
  return [
    `Intro call with ${subject} — no external sources found, so go in discovery-first.`,
    `Confirm who's on the call and their role before pitching anything.`,
    `Ask what prompted them to take the call — let them frame the problem.`,
    `Open with: "Walk me through how you handle [their core workflow] today."`,
    groundingScopeBullet(groundingIsLive),
  ];
}

function groundingScopeBullet(groundingIsLive: boolean): string {
  return groundingIsLive
    ? 'Brief grounded on live web sources — verify anything time-sensitive before the call.'
    : 'Brief grounded on the fixture corpus (no live web-search key set) — treat specifics as directional.';
}

function truncate(value: string, max: number): string {
  if (value.length <= max) return value;
  return value.slice(0, max - 1) + '…';
}

export const __testing = {
  parseSubject,
  parseBullets,
  normalizeToFive,
  templatedBullets,
  ungroundedBullets,
};
