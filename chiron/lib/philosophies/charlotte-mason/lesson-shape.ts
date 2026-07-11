// Lesson shape: hard caps and ordering rules the Integrator enforces.
//
// The minute caps come from two places: Mason's own words for the under-eights
// ("seldom more than twenty minutes in length", Home Education, Part IV) and
// the printed PNEU Parents' Union School time-tables for the older Forms.
// Ages Mason never named directly (17–18) extend the Form V–VI band and are
// labeled modern-application in interpretation_notes.
import type { LessonShape } from "./types";

export const lessonShape: LessonShape = {
  // 0 = no formal scheduled lesson blocks at this age. Mason held formal
  // lessons back until six; before that the child's business is out-of-door
  // life and informal habit-forming. [vol1-lessons-at-six]
  max_block_minutes_by_age: {
    5: 0,
    6: 15,
    7: 20,
    8: 20, // "seldom more than twenty minutes" under eight [vol1-short-lessons]
    9: 20,
    10: 30, // Form II band on the PNEU time-tables [pneu-lesson-lengths]
    11: 30,
    12: 30,
    13: 40, // Forms III–IV band [pneu-lesson-lengths]
    14: 45,
    15: 45,
    16: 45, // Forms V–VI averaged about 40–45 minutes [pneu-lesson-lengths]
    17: 45, // extension of the Form V–VI band — modern application
    18: 45,
  },

  variety_rule:
    "Alternate kinds of effort. A demanding, abstract lesson (arithmetic, " +
    "grammar, a foreign language) is followed by an inspirational or " +
    "physical one (poetry, singing, drill, drawing, handwork). Never " +
    "schedule two abstract lessons back-to-back for the same child; the " +
    "change of subject is what keeps attention fresh through a short " +
    "morning. [pneu-alternation, vol1-habit-of-attention]",

  subject_order: [
    {
      slot: 1,
      kind: "disciplinary",
      examples: ["Bible lesson with narration", "arithmetic"],
      note:
        "The hardest attention work goes first, while the child is " +
        "freshest; the Bible lesson holds first place in Mason's own " +
        "curriculum. [vol6-bible]",
    },
    {
      slot: 2,
      kind: "inspirational",
      examples: ["reading from a living book, then narration", "poetry"],
      note: "Story-shaped work follows number work — a change of effort, not a break.",
    },
    {
      slot: 3,
      kind: "physical",
      examples: ["drill", "dancing", "play outside", "singing"],
      note: "Movement between book lessons is on the original PNEU time-tables, not our addition.",
    },
    {
      slot: 4,
      kind: "disciplinary",
      examples: ["copywork or dictation", "foreign language"],
      note: "A second short stretch of exact work, ended while execution is still careful.",
    },
    {
      slot: 5,
      kind: "inspirational",
      examples: ["history or geography reading with narration", "natural history"],
      note: "The morning closes on reading and telling-back, not on drill.",
    },
  ],

  stage_notes: {
    grammar:
      "Ages ~6–9 (Mason's Form I). Lessons 10–20 minutes, all narration oral, " +
      "reading lessons short, writing limited to a few perfectly-formed " +
      "letters or words [vol1-copywork-perfect-letters]. Mornings end by " +
      "about 11:30; the afternoon belongs to outdoor life and handwork.",
    logic:
      "Ages ~10–13 (Forms II–III). Lessons 20–30 minutes, written narration " +
      "begins and gradually joins oral telling, prepared dictation replaces " +
      "simple transcription [vol1-dictation], and the child starts keeping " +
      "his own written record of work.",
    rhetoric:
      "Ages ~14+ (Forms IV–VI). Lessons 40–45 minutes, narration is mostly " +
      "written and essay-shaped, the reading load is heavy and the single " +
      "reading still holds — the discipline never relaxes into re-reading " +
      "and cramming.",
  },

  forms: [
    { form: "Form I", ages: "6–9", app_stage: "grammar", typical_lesson_minutes: "10–20" },
    { form: "Form II", ages: "9–12", app_stage: "logic", typical_lesson_minutes: "20–30" },
    { form: "Forms III–IV", ages: "12–15", app_stage: "logic", typical_lesson_minutes: "30–45" },
    { form: "Forms V–VI", ages: "15–18", app_stage: "rhetoric", typical_lesson_minutes: "~40–45" },
  ],
};

/** Hard cap for a lesson block at this age. The Integrator trims or rotates
 *  any curriculum block that exceeds it. Ages outside 5–18 clamp to the
 *  nearest band. */
export function maxBlockMinutesForAge(age: number): number {
  const ages = Object.keys(lessonShape.max_block_minutes_by_age)
    .map(Number)
    .sort((a, b) => a - b);
  const clamped = Math.min(Math.max(Math.round(age), ages[0]), ages[ages.length - 1]);
  return lessonShape.max_block_minutes_by_age[clamped];
}
