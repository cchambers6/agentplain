// Zod validators for the Integrator's two outputs. These are the contract
// between the heavy-tier model and the database: nothing is persisted until
// it parses, and every freetext field additionally passes the content gate
// (content-gate.ts) so curriculum text can never ride in on a valid shape.
import { z } from "zod";

// A curriculum is always referenced by id + name — unit/lesson identifiers
// live in `lesson_ref` strings ("SOTW1 · Ch. 3"), never lesson text.
export const curriculumRefSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
});
export type CurriculumRef = z.infer<typeof curriculumRefSchema>;

const shortText = z.string().min(1).max(400);

export const integrationWeekSchema = z.object({
  week_number: z.number().int().min(1),
  /// Headmaster-style framing for the week; the Headmaster (M3) lifts this.
  theme: shortText,
  subjects: z.array(
    z.object({
      subject_name: z.string().min(1).max(60),
      lead_curriculum_ref: curriculumRefSchema,
      merged_from: z.array(curriculumRefSchema).default([]),
      /// One-liners: "we're deferring X because Y" — parent-visible honesty.
      dropped: z.array(shortText).default([]),
      /// Natural-alignment beats between curricula this week, if any.
      alignment_note: shortText.nullable().default(null),
    }),
  ),
  conflicts_surfaced: z
    .array(
      z.object({
        subject: z.string().min(1).max(60),
        choice_a: shortText,
        choice_b: shortText,
        recommendation: z.enum(["a", "b"]),
        rationale: shortText,
      }),
    )
    .default([]),
});

export const integrationMapSchema = z.object({
  weeks: z.array(integrationWeekSchema).min(1),
  philosophy_applied: z.object({
    lesson_shape_rules: z.array(
      z.object({
        subject: z.string().min(1).max(60),
        max_minutes: z.number().int().min(5).max(90),
        format: shortText,
        philosophy_note: shortText,
      }),
    ),
    daily_question_style: z.string().min(1).max(60),
    weekly_rhythms: z.array(
      z.object({
        activity: z.string().min(1).max(80),
        cadence: z.string().min(1).max(80),
      }),
    ),
  }),
  interests_channeled: z
    .array(
      z.object({
        interest_ref: z.string().min(1).max(60),
        week_number: z.number().int().min(1),
        how_it_shows_up: shortText,
      }),
    )
    .default([]),
  /// Items the Integrator wants explicit parent sign-off on before the plan
  /// hardens — rendered as the "Choices for you" section on /plan.
  parent_review_required: z.array(shortText).default([]),
  generated_by: z.string().min(1),
  generated_at: z.string().min(1),
  revision: z.number().int().min(1),
});
export type IntegrationMap = z.infer<typeof integrationMapSchema>;
export type IntegrationWeek = z.infer<typeof integrationWeekSchema>;

export const planBlockSchema = z.object({
  subject: z.string().min(1).max(60),
  curriculum_ref: curriculumRefSchema.nullable().default(null),
  /// Identifier only — "MUS Primer · Lesson 12", "ETC Book 1 · pp. 20-22".
  lesson_ref: z.string().max(120).nullable().default(null),
  duration_est: z.number().int().min(5).max(120),
  /// Specific parent-facing instruction ("read chapter aloud + narrate"),
  /// never reproduced curriculum text — content gate enforces.
  activity: shortText,
  philosophy_note: shortText.nullable().default(null),
  /// "lesson" blocks are capped by the pack's max_block_minutes_by_age;
  /// "rhythm" blocks (nature walk, picture study) may run long by design.
  kind: z.enum(["lesson", "rhythm"]).default("lesson"),
  /// Multi-child combining lands in M4; always null in the POC.
  combine_group: z.string().nullable().default(null),
});
export type PlanBlock = z.infer<typeof planBlockSchema>;

export const weeklyPlanSchema = z.object({
  week_of: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "week_of must be YYYY-MM-DD"),
  /// 2-3 sentences, Chiron voice, leads with WHY this week looks this way.
  vision: z.string().min(20).max(700),
  days: z.array(
    z.object({
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      child_id: z.string().min(1),
      blocks: z.array(planBlockSchema).min(1),
    }),
  ).min(1),
  /// Headmaster adjustments (M3+); the first plan of a map is always [].
  adjustments_from: z.array(z.string()).default([]),
});
export type WeeklyPlanOutput = z.infer<typeof weeklyPlanSchema>;

/** Tolerant JSON extraction: models occasionally fence their output. */
export function extractJson(text: string): unknown {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : trimmed;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("No JSON object in model output");
  return JSON.parse(candidate.slice(start, end + 1));
}
