/**
 * lib/skills/schedule.ts
 *
 * Step 4 of the value loop (conditional — only fires when categorize
 * returns `scheduling-needed`). Given an inbound message + customer
 * scheduling preferences, asks the LLM to propose 2–3 specific slots.
 *
 * Per `project_no_outbound_architecture.md` (load-bearing for this
 * skill): the schedule skill DOES NOT call calendar.events.insert,
 * calendar.events.patch, or send any RSVP. It produces a structured
 * proposal that the operator-facing surface displays so the customer's
 * own system can execute the booking. The interface here has no
 * "createEvent" method on purpose.
 *
 * Per `feedback_no_quick_fixes.md`: this skill is responsible for the
 * one rule that makes scheduling-proposals safe to surface — proposed
 * slots MUST fall within the customer's business-hour window. The
 * `validateProposal` post-check enforces this; the LLM's output is
 * filtered, not trusted.
 */

import type { LlmProvider } from '../llm/types';
import { MODEL_SONNET } from '../llm/model-tiers';
import type { VerticalPromptBundle } from './prompts/index';
import {
  DEFAULT_SCHEDULING_PREFERENCES,
  ISkill,
  ParsedMessage,
  ProposedSlot,
  SchedulingPreferences,
  SchedulingProposal,
  SkillResult,
  skillError,
  skillOk,
} from './types';

export interface ScheduleSkillInput {
  message: ParsedMessage;
  prompts: VerticalPromptBundle;
  preferences?: SchedulingPreferences;
  /** Telemetry context for the `llm.usage` log line. */
  workspaceId?: string;
}

export class ScheduleSkill implements ISkill<ScheduleSkillInput, SchedulingProposal> {
  readonly name = 'schedule' as const;
  constructor(private readonly llm: LlmProvider) {}

  async run(input: ScheduleSkillInput): Promise<SkillResult<SchedulingProposal>> {
    const prefs = input.preferences ?? DEFAULT_SCHEDULING_PREFERENCES;
    const userPrompt = renderUserPrompt(input.message, prefs);
    const res = await this.llm.complete({
      system: input.prompts.schedule,
      model: MODEL_SONNET,
      // Schedule's system prompt is the largest stable surface — vertical
      // scheduling rules + workspace business-hour preferences. Cache it
      // so back-to-back scheduling-needed fires (a common batch) hit the
      // cache on every call after the first.
      cacheSystem: true,
      messages: [{ role: 'user', content: userPrompt }],
      responseFormat: 'json',
      temperature: 0.1,
      maxTokens: 700,
      meta: {
        skill: 'schedule',
        workspaceId: input.workspaceId,
        verticalSlug: input.prompts.verticalSlug,
      },
    });
    if (!res.ok) {
      return skillError(
        'UPSTREAM_LLM_ERROR',
        `schedule LLM call failed: ${res.error.message}`,
        res.error.code,
      );
    }
    const parsed = parseSchedulingJson(res.value.text);
    if (!parsed.ok) return parsed;
    // Enforce business-hour + work-day rules post-hoc. An LLM that
    // proposes a Saturday 11pm slot is a bug we want to catch HERE,
    // not at the customer's calendar.
    const filtered = filterToBusinessHours(parsed.value.proposedSlots, prefs);
    return skillOk({
      ...parsed.value,
      proposedSlots: filtered,
    });
  }
}

function renderUserPrompt(m: ParsedMessage, prefs: SchedulingPreferences): string {
  return [
    `FROM: ${m.fromName ? `${m.fromName} <${m.fromEmail}>` : m.fromEmail}`,
    `SUBJECT: ${m.subject}`,
    '',
    'CUSTOMER SCHEDULING PREFERENCES:',
    `  business hours: ${prefs.businessHours.startLocal}–${prefs.businessHours.endLocal} local`,
    `  work days: ${prefs.workDays.join(', ')}`,
    `  default meeting length: ${prefs.defaultDurationMinutes} minutes`,
    prefs.bufferMinutes ? `  buffer between meetings: ${prefs.bufferMinutes} minutes` : null,
    '',
    'MESSAGE BODY:',
    m.bodyText,
  ]
    .filter((s) => s !== null)
    .join('\n');
}

function parseSchedulingJson(text: string): SkillResult<SchedulingProposal> {
  let raw: unknown;
  try {
    raw = JSON.parse(stripFences(text));
  } catch (err) {
    return skillError(
      'PARSE_ERROR',
      `schedule response not JSON: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
  if (!raw || typeof raw !== 'object') {
    return skillError('PARSE_ERROR', 'schedule response not an object');
  }
  const rec = raw as Record<string, unknown>;
  const needsResponse = typeof rec.needsResponse === 'boolean' ? rec.needsResponse : true;
  const proposedSlotsRaw = Array.isArray(rec.proposedSlots) ? rec.proposedSlots : [];
  const proposedSlots = proposedSlotsRaw
    .filter((s): s is Record<string, unknown> => typeof s === 'object' && s !== null)
    .map((s) => ({
      day: typeof s.day === 'string' ? s.day.toLowerCase() : '',
      startLocal: typeof s.startLocal === 'string' ? s.startLocal : '',
      endLocal: typeof s.endLocal === 'string' ? s.endLocal : '',
    }))
    .filter((s) => s.day && s.startLocal && s.endLocal);
  const reasoning = typeof rec.reasoning === 'string' ? rec.reasoning : '';
  const confidence =
    typeof rec.confidence === 'number' && Number.isFinite(rec.confidence)
      ? Math.max(0, Math.min(1, rec.confidence))
      : 0.5;
  return skillOk({ needsResponse, proposedSlots, reasoning, confidence });
}

function filterToBusinessHours(
  slots: ProposedSlot[],
  prefs: SchedulingPreferences,
): ProposedSlot[] {
  const workDays = new Set(prefs.workDays.map((d) => d.toLowerCase()));
  const startMins = toMinutes(prefs.businessHours.startLocal);
  const endMins = toMinutes(prefs.businessHours.endLocal);
  if (startMins === null || endMins === null) return slots;
  return slots.filter((s) => {
    if (!workDays.has(s.day.toLowerCase())) return false;
    const a = toMinutes(s.startLocal);
    const b = toMinutes(s.endLocal);
    if (a === null || b === null) return false;
    if (a < startMins || b > endMins) return false;
    if (a >= b) return false;
    return true;
  });
}

function toMinutes(hhmm: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm);
  if (!m) return null;
  const h = Number(m[1]);
  const mm = Number(m[2]);
  if (h < 0 || h > 24 || mm < 0 || mm >= 60) return null;
  return h * 60 + mm;
}

function stripFences(text: string): string {
  const trimmed = text.trim();
  const m = /^```(?:json)?\s*\n?([\s\S]*?)\n?```$/.exec(trimmed);
  return m ? m[1].trim() : trimmed;
}
