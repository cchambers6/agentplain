// The shape of a Charlotte Mason school day and year.
//
// Source: the printed PNEU Parents' Union School time-tables (9:00 start,
// Form I released by ~11:30, upper forms by ~1:00; afternoons free of book
// lessons) and Home Education Part II on out-of-door life.
import type { DailyRhythm } from "./types";

export const dailyRhythm: DailyRhythm = {
  // Afternoons-free is structural, not slack. [vol6-afternoon-work]
  morning_lessons_only: true,

  school_start: "9:00", // printed on the PNEU time-tables [pneu-start-times]

  morning_end_by_stage: {
    grammar: "~11:30 [pneu-start-times]",
    logic: "~12:30 [pneu-start-times]",
    rhetoric: "~13:00 [pneu-start-times]",
  },

  afternoon:
    "No book lessons after the midday meal. The afternoon belongs to outdoor " +
    "time, the nature walk, handicrafts held to a real standard of finish, " +
    "and free play. A planner that backfills the afternoon with leftover " +
    "lessons is breaking the method, not flexing it. " +
    "[vol6-afternoon-work, pneu-afternoons]",

  term_structure:
    "Three terms of roughly twelve weeks. Each term carries its own artist, " +
    "composer, and hymn selections, and ends in an examination week whose " +
    "questions are answered by narration — a record of what the child can " +
    "tell, not a ranked score. [terms-three-per-year, vol6-exams-by-narration]",

  ordering_rules: [
    "The morning is a sequence of short blocks, each ended on time even mid-lesson — the cap trains attention. [vol1-short-lessons]",
    "Alternate disciplinary, inspirational, and physical work; no two abstract subjects touch. [pneu-alternation]",
    "Movement (drill, dancing, outdoor play) and singing sit between book lessons on the original time-tables. [pneu-alternation]",
    "Reading-and-narration blocks and writing blocks alternate so the same faculty is never worked twice running.",
    "Unfinished work rolls to its next scheduled slot. Nothing extends a block past its cap to finish a page.",
  ],
};
