// Production prompt for the Curriculum Integrator (heavy tier).
//
// Cache layout (see lib/ai/cache.ts and the #380 cost plan, doc 06): the
// system blocks below are the STABLE prefix — role, philosophy pack, catalog
// entries — identical across every Integrator call for a family, so both the
// integrate run and each weekly-plan run read the same cached prefix. All
// call-specific material (which output to produce, the family snapshot, the
// week) rides in the user message. Nothing timestamped may appear before the
// breakpoint.
import type { CacheableMessage } from "@/lib/ai/cache";
import type { CatalogEntry } from "@/lib/catalog";
import type { IntegrationMap } from "./schema";

export const INTEGRATOR_ROLE = `You are Chiron's Curriculum Integrator.

A homeschooling family owns two or more published curricula and follows a
teaching philosophy. Your job is to produce ONE coherent integrated plan —
not two schedules stapled together. You decide which curriculum leads each
subject, where materials naturally reinforce each other, what to defer, and
how the family's philosophy shapes every block.

Hard rules — these are product invariants, not preferences:

1. NEVER reproduce curriculum content. You reference material by unit/lesson
   identifiers only ("Chapter 3", "Lesson 12", "pp. 20-22") plus at most a
   one-line neutral description of what is happening. No passages, no lesson
   text, no reproduced instructions from any publisher.
2. Surface conflicts as choices, not silent decisions, when stakes are high.
   If two curricula pull in different directions (pacing models, duplicate
   coverage, clashing methods), name the choice, give both options, recommend
   one, and say why. Low-stakes calls you make yourself and note in "dropped"
   or "alignment_note".
3. The philosophy pack is binding. Lesson lengths respect its age caps.
   Subject ordering respects its variety rule. Its weekly rhythms appear in
   the plan as first-class blocks, not decoration.
4. The child is a person, not a grade level. Use the child model — strengths,
   struggles, pacing notes, interests — to shape pace and to channel
   interests into concrete moments in the plan.
5. Be specific. "Read the chapter aloud, then she narrates" is a plan;
   "do history" is not. Every block should be executable by a parent who has
   the materials on the shelf.
6. Never mention AI providers, model names, or tooling. You are Chiron
   speaking to a parent: first person, warm, plain, unhurried.

You respond with a single JSON object matching the schema in the request —
no prose before or after the JSON.`;

/**
 * Stable system prefix: role + philosophy pack + the catalog's view of the
 * family's curricula. Stable per family (changes only when curricula or
 * philosophy change), so the cache breakpoint sits on the last block.
 */
export function buildStableSystem(
  packMarkdown: string,
  catalogEntries: CatalogEntry[],
): CacheableMessage[] {
  return [
    { text: INTEGRATOR_ROLE, stable: true },
    {
      text: `PHILOSOPHY PACK (binding):\n\n${packMarkdown}`,
      stable: true,
    },
    {
      text:
        `CURRICULUM CATALOG ENTRIES (research metadata for the family's ` +
        `materials — pairings, conflicts, philosophy notes):\n\n` +
        JSON.stringify(catalogEntries, null, 2),
      stable: true,
    },
  ];
}

export interface IntegratorFamilyInput {
  family: {
    state: string;
    timezone: string;
    philosophy: string;
    school_days: number[]; // ISO weekday numbers
    goals: string | null;
  };
  child: {
    id: string;
    name: string;
    age: number;
    stage: string;
    model: unknown;
  };
  curricula: {
    id: string;
    name: string;
    publisher: string | null;
    subjects: string[];
    scope_sequence: unknown;
    pace: string | null;
    parent_notes: string | null;
  }[];
}

const INTEGRATION_MAP_SHAPE = `{
  "weeks": [{
    "week_number": 1,
    "theme": "headmaster-style framing for the week",
    "subjects": [{
      "subject_name": "history",
      "lead_curriculum_ref": {"id": "<curriculum row id>", "name": "<name>"},
      "merged_from": [{"id": "...", "name": "..."}],
      "dropped": ["we're deferring X because Y"],
      "alignment_note": "natural-alignment beat between curricula this week, or null"
    }],
    "conflicts_surfaced": [{
      "subject": "math",
      "choice_a": "...", "choice_b": "...",
      "recommendation": "a",
      "rationale": "..."
    }]
  }],
  "philosophy_applied": {
    "lesson_shape_rules": [{"subject": "math", "max_minutes": 15, "format": "...", "philosophy_note": "..."}],
    "daily_question_style": "narration",
    "weekly_rhythms": [{"activity": "nature walk", "cadence": "weekly"}]
  },
  "interests_channeled": [{"interest_ref": "birds", "week_number": 1, "how_it_shows_up": "..."}],
  "parent_review_required": ["items needing explicit parent sign-off"],
  "generated_by": "chiron-integrator",
  "generated_at": "<ISO timestamp>",
  "revision": 1
}`;

export function buildIntegrateRequest(
  input: IntegratorFamilyInput,
  weeksToPlan: number,
  nowIso: string,
): string {
  return `Produce the IntegrationMap for this family: ${weeksToPlan} weeks of
integrated structure across all curricula, applying the philosophy pack.

FAMILY SNAPSHOT (structured):
${JSON.stringify(input, null, 2)}

Set "generated_at" to "${nowIso}" and "revision" to 1.

Respond with ONLY a JSON object of this exact shape:
${INTEGRATION_MAP_SHAPE}`;
}

const WEEKLY_PLAN_SHAPE = `{
  "week_of": "YYYY-MM-DD (the Monday)",
  "vision": "2-3 sentences in Chiron's first-person voice, leading with WHY this week looks this way",
  "days": [{
    "date": "YYYY-MM-DD",
    "child_id": "<child id>",
    "blocks": [{
      "subject": "history",
      "curriculum_ref": {"id": "<curriculum row id>", "name": "<name>"} ,
      "lesson_ref": "identifier only, e.g. 'Vol. 1 · Chapter 3'",
      "duration_est": 15,
      "activity": "specific and executable — 'read chapter aloud + narrate', never 'do history'",
      "philosophy_note": "specific — e.g. 'narration expected: tell back the main event'",
      "kind": "lesson or rhythm (rhythm = nature walk, picture study — exempt from the lesson cap)",
      "combine_group": null
    }]
  }],
  "adjustments_from": []
}`;

export function buildWeeklyPlanRequest(
  input: IntegratorFamilyInput,
  map: IntegrationMap,
  weekNumber: number,
  weekOfIso: string,
  schoolDates: string[],
): string {
  const week = map.weeks.find((w) => w.week_number === weekNumber) ?? map.weeks[0];
  // Slim snapshot: the stable prefix already carries the catalog view of the
  // curricula and the map week carries the refs — re-sending the full
  // curricula rows here would just dilute the cache hit rate.
  const slim = {
    child: input.child,
    goals: input.family.goals,
    curricula: input.curricula.map((c) => ({ id: c.id, name: c.name, pace: c.pace, parent_notes: c.parent_notes })),
  };
  return `Produce the WeeklyPlan for week ${weekNumber} (week_of ${weekOfIso}).
School days this week (use exactly these dates): ${schoolDates.join(", ")}.

CHILD + GOALS (structured):
${JSON.stringify(slim, null, 2)}

THE INTEGRATION MAP'S WEEK ${weekNumber} (follow it — lead curricula, merges,
alignment beats — and honor philosophy_applied throughout):
${JSON.stringify({ week, philosophy_applied: map.philosophy_applied, interests_channeled: map.interests_channeled.filter((i) => i.week_number === weekNumber) }, null, 2)}

Every "duration_est" on a "lesson" block must respect the pack's
max_block_minutes_by_age for this child's age. Respect the variety rule when
ordering blocks within a day.

Respond with ONLY a JSON object of this exact shape:
${WEEKLY_PLAN_SHAPE}`;
}
