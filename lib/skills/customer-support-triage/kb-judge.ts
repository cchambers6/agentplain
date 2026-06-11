/**
 * lib/skills/customer-support-triage/kb-judge.ts
 *
 * The KB-judged retrieval + answer step. Given the customer's question and
 * the curated KB, the LLM:
 *   1. picks the KB entries that actually answer the question,
 *   2. assigns a 0–1 confidence that the KB fully + correctly answers it,
 *   3. drafts a grounded answer when confident.
 *
 * This is the "auto-answer when confidence > threshold" engine. The
 * caller (triage.ts) compares the returned confidence to the tunable
 * threshold; this module does NOT decide to send — it only judges + drafts.
 *
 * LLM-DEAD DETECTION (the degrade seam): the LLM now sits behind the
 * key-rotation + paused-sentinel stack (lib/llm). When the model is
 * paused/dead it returns a structured error (PAUSED / AUTHENTICATION /
 * NOT_CONFIGURED). We surface that as `degraded: true` so triage.ts can
 * flip to escalate-everything mode + page ONCE — never per-ticket, never a
 * fabricated answer.
 *
 * Per feedback_no_guesses_no_estimates.md: when the model can't ground an
 * answer in the KB it returns LOW confidence — it never invents.
 */

import { MODEL_SONNET } from '../../llm/model-tiers';
import type { LlmProvider } from '../../llm/types';
import type { KbEntry, SupportMessageSnapshot } from './types';

export type KbJudgeResult =
  | {
      ok: true;
      /** 0–1 confidence the KB fully answers the question. */
      confidence: number;
      /** The grounded answer body (greeting + signature added later). */
      answer: string;
      /** Titles of the KB entries the answer grounded in. */
      citedTitles: string[];
    }
  | {
      /** The LLM is unavailable (paused / dead key / not configured). The
       *  caller degrades to escalate-everything + pages once. */
      ok: false;
      degraded: boolean;
      reason: string;
    };

/** LLM error codes that mean "the model itself is unavailable" → degrade
 *  to escalate-everything. Distinct from a transient/parse failure, which
 *  is NOT degraded (we just draft-for-review on those). */
const DEGRADED_LLM_CODES = new Set([
  'PAUSED',
  'AUTHENTICATION',
  'NOT_CONFIGURED',
]);

export interface JudgeKbArgs {
  message: SupportMessageSnapshot;
  kb: KbEntry[];
  llm: LlmProvider;
}

/**
 * Run the KB judge. Returns a confidence + grounded answer, or a degraded
 * signal when the LLM is unavailable. Never throws.
 */
export async function judgeKb(args: JudgeKbArgs): Promise<KbJudgeResult> {
  if (args.kb.length === 0) {
    return { ok: false, degraded: false, reason: 'kb-empty' };
  }

  let completion;
  try {
    completion = await args.llm.complete({
      system: buildSystem(),
      model: MODEL_SONNET,
      messages: [{ role: 'user', content: buildUserMessage(args.message, args.kb) }],
      responseFormat: 'json',
      temperature: 0.1,
      maxTokens: 700,
      meta: {
        skill: 'customer-support-triage',
        workspaceId: args.message.workspaceId,
        verticalSlug: args.message.verticalSlug ?? undefined,
        sourceSurface: 'SUPPORT_HANDLER',
      },
    });
  } catch (err) {
    // A thrown error from the provider stack — treat as a non-degraded
    // failure (draft-for-review), not a model-down event, unless the
    // message tells us otherwise. Conservative: don't silence the fleet.
    return {
      ok: false,
      degraded: false,
      reason: `llm threw: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  if (!completion.ok) {
    const degraded = DEGRADED_LLM_CODES.has(completion.error.code);
    return {
      ok: false,
      degraded,
      reason: `${completion.error.code}: ${completion.error.message}`,
    };
  }

  const parsed = parseJudge(completion.value.text);
  if (!parsed) {
    return { ok: false, degraded: false, reason: 'llm returned unparseable JSON' };
  }

  // Restrict citations to titles we actually provided (guard against the
  // model citing a KB entry we didn't give it).
  const known = new Set(args.kb.map((e) => e.title));
  const citedTitles = parsed.citedTitles.filter((t) => known.has(t));
  // If the model cited nothing it grounded in, the answer isn't grounded —
  // clamp confidence to 0 so it falls through to draft-for-review.
  const confidence =
    citedTitles.length === 0 ? 0 : clamp01(parsed.confidence);

  return { ok: true, confidence, answer: parsed.answer, citedTitles };
}

interface ParsedJudge {
  confidence: number;
  answer: string;
  citedTitles: string[];
}

function parseJudge(raw: string): ParsedJudge | null {
  const unwrapped = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();
  let json: unknown;
  try {
    json = JSON.parse(unwrapped);
  } catch {
    return null;
  }
  if (typeof json !== 'object' || json === null || Array.isArray(json)) {
    return null;
  }
  const r = json as Record<string, unknown>;
  const confidence =
    typeof r.confidence === 'number' ? r.confidence : Number.NaN;
  const answer = typeof r.answer === 'string' ? r.answer.trim() : '';
  const citedTitles = Array.isArray(r.citedTitles)
    ? r.citedTitles.filter((t): t is string => typeof t === 'string')
    : [];
  if (!Number.isFinite(confidence) || answer.length === 0) return null;
  return { confidence, answer, citedTitles };
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function buildSystem(): string {
  return [
    'CUSTOMER_SUPPORT_TRIAGE_KB_JUDGE_V1',
    '',
    'You are agentplain support, triaging a local-business owner\'s support',
    'question against a curated KNOWLEDGE BASE. Your job is to decide whether',
    'the KB FULLY and CORRECTLY answers the question, and if so, draft a calm,',
    'accurate reply grounded ONLY in the KB.',
    '',
    'HARD RULES',
    '- GROUND OR ABSTAIN: only use facts present in the KNOWLEDGE BASE. If the',
    '  KB does not clearly answer the question, set confidence LOW (< 0.5) and',
    '  leave citedTitles empty — a human will take it. NEVER invent product',
    '  facts, pricing, policy, or steps that are not in the KB.',
    '- CONFIDENCE = how sure you are the KB answer is COMPLETE and CORRECT for',
    '  THIS question. A partial or tangential match is low confidence.',
    '- VOICE: calm, heritage tone. No exclamation points, no emoji, no hype.',
    '  Do NOT add a greeting or signature — those are added by the system.',
    '- NEVER claim to be a human and NEVER claim to have taken an action',
    '  ("I just reset…"). You only explain.',
    '',
    'OUTPUT — return STRICTLY one JSON object:',
    '  confidence: number 0..1 — KB-answers-this confidence.',
    '  answer: string — the grounded reply body (no greeting, no signature).',
    '  citedTitles: string[] — exact KB titles you grounded in (empty if none).',
    'No prose outside the JSON.',
  ].join('\n');
}

function buildUserMessage(
  message: SupportMessageSnapshot,
  kb: KbEntry[],
): string {
  const kbBlock = kb
    .map((e) => `— ${e.title}\n${e.body}`)
    .join('\n\n');
  return [
    `CUSTOMER QUESTION (subject): ${message.subject}`,
    '',
    'CUSTOMER QUESTION (body):',
    message.body,
    '',
    'KNOWLEDGE BASE (ground only in these):',
    kbBlock,
  ].join('\n');
}

export const __testing = { parseJudge, DEGRADED_LLM_CODES };
