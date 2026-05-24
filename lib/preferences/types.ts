/**
 * lib/preferences/types.ts
 *
 * Boundary types + zod schemas for the workspace-preferences module.
 * Per feedback_no_silent_vendor_lock + feedback_runner_portability: every
 * caller (onboarding action, approvals action, draft skill, runner)
 * speaks ONLY these types. Prisma rows are translated at the store
 * boundary.
 *
 * Per CLAUDE.md discipline: zod-validate at the API/server-action edge.
 */

import { z } from 'zod';

/** Three tone options the onboarding wizard surfaces. The draft skill
 *  inlines the selected value verbatim into the prompt's DEFAULT TONE
 *  line so the prod LLM and the test heuristic both see it. */
export const DRAFTING_TONES = [
  'plain',
  'warm-professional',
  'formal',
] as const;
export type DraftingTone = (typeof DRAFTING_TONES)[number];

/** Calendar-window selector — three onboarding options plus a literal
 *  passthrough for `custom:<free-form>` so future settings can keep
 *  using this column without a migration. */
export const CALENDAR_WINDOWS = [
  '9-5 weekdays',
  '8-7 + Sat AM',
  'custom',
] as const;
export type CalendarWindow = (typeof CALENDAR_WINDOWS)[number];

/** Cap on bullets we keep in `learnedDraftNotes`. Older entries fall off
 *  the front of the list — the append-only PreferenceSignal log is the
 *  source of truth for full history. */
export const LEARNED_NOTES_CAP = 20;

/** Cap on a single learnedDraftNote bullet — keeps the draft prompt
 *  from ballooning. Prose longer than this is truncated with an
 *  ellipsis. */
export const LEARNED_NOTE_MAX_CHARS = 240;

/** Cap on captured signal text we persist. Belt-and-suspenders against
 *  pathological inputs (e.g. someone pastes an entire email body into
 *  the rejection reason). */
export const SIGNAL_TEXT_MAX_CHARS = 4000;

export const onboardingPreferencesSchema = z.object({
  draftingTone: z.enum(DRAFTING_TONES).optional(),
  categorizationNotes: z
    .string()
    .max(2000, 'categorization notes capped at 2000 chars')
    .optional(),
  calendarWindow: z.enum(CALENDAR_WINDOWS).optional(),
});

export type OnboardingPreferencesInput = z.infer<
  typeof onboardingPreferencesSchema
>;

export interface WorkspacePreferenceView {
  workspaceId: string;
  draftingTone: DraftingTone | null;
  categorizationNotes: string | null;
  calendarWindow: CalendarWindow | string | null;
  learnedDraftNotes: string[];
  updatedAt: Date;
}

/** A captured signal in its persisted shape — what the audit log returns.
 *  The store boundary returns this; the runner does not see PreferenceSignal
 *  rows directly. */
export interface PreferenceSignalView {
  id: string;
  workspaceId: string;
  source: 'ONBOARDING_FORM' | 'DRAFT_EDIT' | 'DRAFT_REJECT';
  kind: string;
  text: string;
  refTable: string | null;
  refId: string | null;
  capturedAt: Date;
}
