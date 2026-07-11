// Canned Integrator output for CHIRON_AI_MODE=mock — the "look at this"
// surface for the seeded Hartfield family (Anna, 6, grammar, Charlotte Mason,
// Mon–Thu) running SOTW Vol. 1 + Math-U-See Primer + Explode the Code Book 1.
// Hand-written to the same bar the heavy tier is prompted to: identifiers
// only, conflicts as choices, philosophy applied structurally. Every lesson
// reference here is table-of-contents metadata (chapter/lesson/page numbers);
// SOTW Vol. 1 Ch. 3 "The First Writing" verified against the publisher's
// public materials. It passes the same Zod schema + content gate as live
// output, enforced by a smoke assertion in run.ts.
import type { CurriculumRef, IntegrationMap, WeeklyPlanOutput } from "./schema";

export interface MockRefs {
  history: CurriculumRef; // The Story of the World, Vol. 1
  math: CurriculumRef; // Math-U-See Primer
  phonics: CurriculumRef; // Explode the Code Book 1
}

export function mockIntegrationMap(refs: MockRefs, nowIso: string): IntegrationMap {
  const weekSubjects = (
    sotwChapter: number,
    musLesson: number,
    etcPages: string,
    alignment: string | null,
  ) => [
    {
      subject_name: "history",
      lead_curriculum_ref: refs.history,
      merged_from: [],
      dropped: [
        `Activity Book craft pages beyond the map work for Chapter ${sotwChapter} — a Charlotte Mason week keeps afternoons free, so one hands-on beat is enough`,
      ],
      alignment_note: alignment,
    },
    {
      subject_name: "math",
      lead_curriculum_ref: refs.math,
      merged_from: [],
      dropped: [],
      alignment_note: `Lesson ${musLesson} stays with the blocks all week — mastery means we don't move on until the blocks version feels easy in her hands`,
    },
    {
      subject_name: "phonics & copywork",
      lead_curriculum_ref: refs.phonics,
      merged_from: [refs.history],
      dropped: [],
      alignment_note: `Book 1 ${etcPages} as a short morning warm-up, then copywork borrows one line from the week's history reading — the workbook drills the sounds, the copywork makes them hers`,
    },
  ];

  return {
    weeks: [
      {
        week_number: 1,
        theme:
          "The week Anna meets the first writers — while her own hands are learning to write",
        subjects: weekSubjects(
          3,
          12,
          "pp. 20-22",
          "History and literature aligned this week: the Chapter 3 reading about the first writing pairs with this week's fable from The Aesop for Children — the AmblesideOnline Year 1 selection — so her narration muscle gets two very different kinds of story",
        ),
        conflicts_surfaced: [
          {
            subject: "math",
            choice_a:
              "Push Lesson 12's new material on Wednesday as scheduled — four teaching days, steady pace",
            choice_b:
              "Make Wednesday's math a 10-minute review with the blocks instead of new material",
            recommendation: "b",
            rationale:
              "Math-U-See is a mastery program, and your notes say number bonds past 10 have been tender since June. A lighter midweek touch consolidates Monday's new idea instead of stacking a second one on top — and it keeps math inside the 15-minute short-lesson rule on the day picture study also runs",
          },
        ],
      },
      {
        week_number: 2,
        theme: "Egypt builds, Anna counts — pyramids in history, structure in math",
        subjects: weekSubjects(4, 13, "pp. 23-25", null),
        conflicts_surfaced: [],
      },
      {
        week_number: 3,
        theme: "First cities, steady habits — the routine starts carrying itself",
        subjects: weekSubjects(5, 13, "pp. 26-28", null),
        conflicts_surfaced: [],
      },
      {
        week_number: 4,
        theme: "A travelling week — stories that move, sounds that settle",
        subjects: weekSubjects(6, 14, "pp. 29-31", null),
        conflicts_surfaced: [],
      },
      {
        week_number: 5,
        theme: "Laws and letters — order shows up in every subject at once",
        subjects: weekSubjects(7, 15, "pp. 32-34", null),
        conflicts_surfaced: [],
      },
      {
        week_number: 6,
        theme: "A gathering-up week — narrate the term so far, out loud and proud",
        subjects: weekSubjects(8, 15, "pp. 35-36", null),
        conflicts_surfaced: [],
      },
    ],
    philosophy_applied: {
      lesson_shape_rules: [
        {
          subject: "history",
          max_minutes: 15,
          format: "read-aloud from the sofa, single reading, then narration",
          philosophy_note:
            "One attentive reading, then she tells it back — no re-reading crutch, no comprehension quiz",
        },
        {
          subject: "math",
          max_minutes: 15,
          format: "manipulative blocks first, worksheet second",
          philosophy_note:
            "Short lessons train attention; end while the blocks are still fun, not after",
        },
        {
          subject: "phonics & copywork",
          max_minutes: 10,
          format: "workbook warm-up, then one line of best-hand copywork",
          philosophy_note:
            "Better six perfect letters than a page of careless ones — copywork is held to a finish standard",
        },
      ],
      daily_question_style: "narration",
      weekly_rhythms: [
        { activity: "nature walk", cadence: "weekly (Thursday), plus daily outdoor time" },
        { activity: "picture study", cadence: "weekly (Wednesday), one picture, then describe" },
        { activity: "poetry recitation", cadence: "daily, five minutes after morning lessons" },
      ],
    },
    interests_channeled: [
      {
        interest_ref: "birds",
        week_number: 1,
        how_it_shows_up:
          "Thursday's nature walk carries a bird list — she picks three birds to find and sketches one in her nature notebook",
      },
      {
        interest_ref: "baking",
        week_number: 2,
        how_it_shows_up:
          "Week 2's counting practice moves to the kitchen once — measuring for a bake IS the math that day",
      },
    ],
    parent_review_required: [
      "Wednesday math: new material or a 10-minute blocks review? I recommend the review — see the choice card",
      "Explode the Code is workbook drill, which Charlotte Mason homes use sparingly — keep it as a 10-minute warm-up three mornings a week, or drop to two? I've planned three for now",
    ],
    generated_by: "chiron-integrator/mock",
    generated_at: nowIso,
    revision: 1,
  };
}

export function mockWeeklyPlan(
  childId: string,
  weekOfIso: string,
  schoolDates: string[], // 4 dates, Mon–Thu
  refs: MockRefs,
): WeeklyPlanOutput {
  const [mon, tue, wed, thu] = schoolDates;
  return {
    week_of: weekOfIso,
    vision:
      "I've drafted this week around a happy accident: Anna meets the first writers in history at the very moment her own hands are learning to write. Every lesson stays short and ends with her telling something back, and Thursday afternoon belongs to the birds.",
    days: [
      {
        date: mon,
        child_id: childId,
        blocks: [
          {
            subject: "phonics & copywork",
            curriculum_ref: refs.phonics,
            lesson_ref: "Book 1 · pp. 20-21",
            duration_est: 10,
            activity: "Two workbook pages as a warm-up, then she copies her best word of the day in her best hand",
            philosophy_note: "Copywork standard: better one perfect line than three careless ones",
            kind: "lesson",
            combine_group: null,
          },
          {
            subject: "math",
            curriculum_ref: refs.math,
            lesson_ref: "Primer · Lesson 12",
            duration_est: 15,
            activity: "New lesson with the blocks on the table first — worksheet only if the blocks version felt easy",
            philosophy_note: "Hard stop at 15 minutes; end while attention is still fresh",
            kind: "lesson",
            combine_group: null,
          },
          {
            subject: "history",
            curriculum_ref: refs.history,
            lesson_ref: "Vol. 1 · Chapter 3 (“The First Writing”)",
            duration_est: 15,
            activity: "Read the chapter aloud on the sofa, one attentive reading, then she narrates",
            philosophy_note: "Narration expected: tell back what you learned about the first writers",
            kind: "lesson",
            combine_group: null,
          },
        ],
      },
      {
        date: tue,
        child_id: childId,
        blocks: [
          {
            subject: "phonics & copywork",
            curriculum_ref: refs.phonics,
            lesson_ref: "Book 1 · p. 22",
            duration_est: 10,
            activity: "One workbook page, then copy a short line from yesterday's history reading — writing about writing",
            philosophy_note: "The copywork line comes from a book she loves, not a drill sheet",
            kind: "lesson",
            combine_group: null,
          },
          {
            subject: "math",
            curriculum_ref: refs.math,
            lesson_ref: "Primer · Lesson 12",
            duration_est: 15,
            activity: "Same lesson, her hands do the work — she builds each problem with the blocks and says what she built",
            philosophy_note: "Mastery pace: we stay until it feels easy, and that is the plan working",
            kind: "lesson",
            combine_group: null,
          },
          {
            subject: "literature",
            curriculum_ref: null,
            lesson_ref: "The Aesop for Children · this week's fable (AmblesideOnline Year 1)",
            duration_est: 15,
            activity: "Read the fable aloud once, then she narrates — a short story makes a whole telling possible",
            philosophy_note: "Pairs with the history chapter: two different kinds of story, one narration habit",
            kind: "lesson",
            combine_group: null,
          },
        ],
      },
      {
        date: wed,
        child_id: childId,
        blocks: [
          {
            subject: "math",
            curriculum_ref: refs.math,
            lesson_ref: "Primer · Lesson 12 (review)",
            duration_est: 10,
            activity: "Ten minutes of blocks review, no worksheet — your call on the choice card can change this",
            philosophy_note: "A lighter midweek touch consolidates Monday's new idea instead of stacking another on top",
            kind: "lesson",
            combine_group: null,
          },
          {
            subject: "picture study",
            curriculum_ref: null,
            lesson_ref: "This term's artist · one picture",
            duration_est: 15,
            activity: "Look at the picture together in silence, turn it over, and she describes everything she remembers",
            philosophy_note: "One artist per term, one picture per week — describing is narration for the eyes",
            kind: "rhythm",
            combine_group: null,
          },
          {
            subject: "history",
            curriculum_ref: refs.history,
            lesson_ref: "Vol. 1 · Chapter 3 (map work)",
            duration_est: 15,
            activity: "Find Egypt and Sumer on the map from the chapter, then she tells Dad the story at dinner",
            philosophy_note: "A second telling to a new listener deepens the first — still narration, never a quiz",
            kind: "lesson",
            combine_group: null,
          },
        ],
      },
      {
        date: thu,
        child_id: childId,
        blocks: [
          {
            subject: "phonics & copywork",
            curriculum_ref: refs.phonics,
            lesson_ref: "Book 1 · review of pp. 20-22",
            duration_est: 10,
            activity: "Quick sound review out loud, then one line of copywork in her best hand to close the writing week",
            philosophy_note: "Short and done — the habit is the lesson",
            kind: "lesson",
            combine_group: null,
          },
          {
            subject: "math",
            curriculum_ref: refs.math,
            lesson_ref: "Primer · Lesson 12 (mastery check)",
            duration_est: 15,
            activity: "She teaches YOU the lesson with the blocks — if she can teach it, Lesson 13 opens Monday",
            philosophy_note: "The mastery check is her telling, not a test sheet",
            kind: "lesson",
            combine_group: null,
          },
          {
            subject: "nature study",
            curriculum_ref: null,
            lesson_ref: "Weekly nature walk · bird list",
            duration_est: 60,
            activity: "The long walk: three birds to find from her list, one sketched in the nature notebook when you're home",
            philosophy_note: "Afternoons belong outdoors — this is a first-class lesson, not a break",
            kind: "rhythm",
            combine_group: null,
          },
        ],
      },
    ],
    adjustments_from: [],
  };
}
