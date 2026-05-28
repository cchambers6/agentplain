/**
 * lib/skills/office-admin/classifier.ts
 *
 * LLM-driven classifier for office-admin email. Returns one of the 9
 * admin categories or `not-admin`. The runner uses the category to
 * decide whether to emit an admin approval or let the vertical chain
 * proceed.
 *
 * Per `feedback_no_quick_fixes.md`: classification is LLM-driven. The
 * pre-screen in `./screen.ts` is a cost filter — when the screen finds
 * zero admin signal we short-circuit to `not-admin` without burning a
 * token. When the screen finds something, the LLM decides which (if
 * any) category fits.
 *
 * Per `feedback_no_silent_vendor_lock.md`: the call goes through
 * `LlmProvider`. No `@anthropic-ai/sdk` import.
 *
 * Per `project_no_outbound_architecture.md`: classification is read-only.
 */

import type { LlmProvider } from '../../llm/types';
import {
  skillError,
  skillOk,
  type ParsedMessage,
  type SkillResult,
} from '../types';
import { screenForAdminSignal, type AdminScreenSignal } from './screen';
import { extractAdminSignals } from './signals';
import { OFFICE_ADMIN_SYSTEM_PROMPT } from './prompt';
import {
  OFFICE_ADMIN_CATEGORIES,
  OFFICE_ADMIN_MIN_CONFIDENCE,
  type OfficeAdminCategory,
  type OfficeAdminClassification,
} from './types';

export interface ClassifyOfficeAdminInput {
  message: ParsedMessage;
  llm: LlmProvider;
  /** Telemetry context for the `llm.usage` log line. */
  workspaceId?: string;
  verticalSlug?: string;
}

export async function classifyOfficeAdmin(
  input: ClassifyOfficeAdminInput,
): Promise<SkillResult<OfficeAdminClassification>> {
  const { message, llm } = input;
  const screen = screenForAdminSignal(message);
  const signals = extractAdminSignals(message);

  // Short-circuit when nothing in the body looks admin-shaped. Avoids
  // an LLM call on the majority of inbound traffic.
  if (!screen.worthClassifying) {
    return skillOk({
      category: 'not-admin',
      confidence: 0.95,
      reason: 'screen found no admin vocabulary in subject or body',
      signals,
    });
  }

  const userPrompt = renderClassifierUserPrompt(message, screen.signals);
  const res = await llm.complete({
    system: OFFICE_ADMIN_SYSTEM_PROMPT,
    // The office-admin classifier prompt is a workspace-agnostic
    // constant — the same string across every workspace, every vertical,
    // every fire. The highest cache-hit-rate surface in the chain.
    cacheSystem: true,
    messages: [{ role: 'user', content: userPrompt }],
    responseFormat: 'json',
    temperature: 0.0,
    maxTokens: 256,
    meta: {
      skill: 'office-admin-classify',
      workspaceId: input.workspaceId,
      verticalSlug: input.verticalSlug,
    },
  });
  if (!res.ok) {
    return skillError(
      'UPSTREAM_LLM_ERROR',
      `office-admin classify LLM call failed: ${res.error.message}`,
      res.error.code,
    );
  }

  const parsed = parseClassificationJson(res.value.text);
  if (!parsed.ok) {
    return parsed;
  }

  // Apply the confidence floor. Anything below the threshold is demoted
  // to `not-admin` so we never park a real lead in the admin queue on a
  // weak signal.
  let category = parsed.value.category;
  let reason = parsed.value.reason;
  if (parsed.value.confidence < OFFICE_ADMIN_MIN_CONFIDENCE && category !== 'not-admin') {
    category = 'not-admin';
    reason = `confidence ${parsed.value.confidence.toFixed(2)} below ${OFFICE_ADMIN_MIN_CONFIDENCE} — demoted from ${parsed.value.category}`;
  }

  return skillOk({
    category,
    confidence: parsed.value.confidence,
    reason,
    signals,
  });
}

// ── Prompt rendering ────────────────────────────────────────────────────

function renderClassifierUserPrompt(
  message: ParsedMessage,
  screenSignals: AdminScreenSignal[],
): string {
  return [
    `FROM: ${message.fromName ? `${message.fromName} <${message.fromEmail}>` : message.fromEmail}`,
    `TO: ${message.toEmails.join(', ')}`,
    `SUBJECT: ${message.subject}`,
    screenSignals.length > 0
      ? `PRE-SCREEN HINTS (advisory; you can still pick 'not-admin'): ${screenSignals.join(', ')}`
      : null,
    '',
    'BODY:',
    truncate(message.bodyText, 4000),
  ]
    .filter((s): s is string => s !== null)
    .join('\n');
}

function truncate(text: string, limit: number): string {
  if (text.length <= limit) return text;
  return `${text.slice(0, limit)}\n…(truncated; ${text.length - limit} chars omitted)`;
}

// ── JSON parsing ────────────────────────────────────────────────────────

function parseClassificationJson(
  text: string,
): SkillResult<Pick<OfficeAdminClassification, 'category' | 'confidence' | 'reason'>> {
  let raw: unknown;
  try {
    raw = JSON.parse(stripJsonFences(text));
  } catch (err) {
    // Strip raw LLM text — same reasoning as categorize.ts: the classifier
    // is prompted with the inbound body and the model may echo it on
    // contract violation. (Data-privacy audit PR #91 must-close #3.)
    const errType = err instanceof Error ? err.name : 'NonError';
    return skillError(
      'PARSE_ERROR',
      `office-admin classify response was not JSON (error=${errType} responseLen=${text.length})`,
    );
  }
  if (!raw || typeof raw !== 'object') {
    return skillError('PARSE_ERROR', 'office-admin classify response was not a JSON object');
  }
  const rec = raw as { category?: unknown; confidence?: unknown; reason?: unknown };
  if (!isValidCategory(rec.category)) {
    return skillError(
      'PARSE_ERROR',
      `office-admin classify response missing/invalid category (type=${typeof rec.category})`,
    );
  }
  const confidence = clamp01(rec.confidence);
  if (confidence === null) {
    return skillError(
      'PARSE_ERROR',
      `office-admin classify response missing/invalid confidence: ${JSON.stringify(rec.confidence)}`,
    );
  }
  const reason = typeof rec.reason === 'string' ? rec.reason : '';
  return skillOk({ category: rec.category, confidence, reason });
}

function isValidCategory(v: unknown): v is OfficeAdminCategory {
  if (typeof v !== 'string') return false;
  if (v === 'not-admin') return true;
  return (OFFICE_ADMIN_CATEGORIES as ReadonlyArray<string>).includes(v);
}

function clamp01(v: unknown): number | null {
  if (typeof v !== 'number' || !Number.isFinite(v)) return null;
  return Math.max(0, Math.min(1, v));
}

function stripJsonFences(text: string): string {
  const trimmed = text.trim();
  const fenceMatch = /^```(?:json)?\s*\n?([\s\S]*?)\n?```$/.exec(trimmed);
  if (fenceMatch) return fenceMatch[1].trim();
  return trimmed;
}
