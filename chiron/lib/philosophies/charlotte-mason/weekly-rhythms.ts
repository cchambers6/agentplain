// Weekly enrichment rhythms — the fixtures that make a week recognizably
// Charlotte Mason rather than a generic timetable. The Integrator schedules
// these as standing blocks; the Headmaster's Friday report checks they
// actually happened.
import type { WeeklyRhythm } from "./types";

export const weeklyRhythms: WeeklyRhythm[] = [
  {
    activity: "nature_walk",
    label: "Nature walk",
    cadence: "1/week (plus daily outdoor time)",
    typical_day: "midweek or Friday afternoon",
    duration: "30–60 min of focused observation inside a longer outing",
    applies_from: "grammar",
    technique:
      "A real walk, in every season and most weather. The parent points " +
      "little and asks much: the child looks first, then tells what was " +
      "seen. Finds go into the nature notebook afterward, by the child's " +
      "own hand. [vol1-out-of-doors, vol1-winter-walks, vol1-nature-notebook]",
    cite: ["vol1-out-of-doors", "vol1-winter-walks", "vol1-nature-notebook"],
  },
  {
    activity: "picture_study",
    label: "Picture study",
    cadence: "1/week, one artist per term (about six pictures a term)",
    typical_day: "any morning, as an inspirational block",
    duration: "10–15 min",
    applies_from: "grammar",
    technique:
      "The child studies one reproduction quietly until they can see it with " +
      "the eyes shut, then the picture is turned over and they describe it " +
      "from memory — narration for the eye. No lecture on the artist first. " +
      "[vol6-picture-study]",
    cite: ["vol6-picture-study"],
  },
  {
    activity: "composer_study",
    label: "Composer study",
    cadence: "1/week focused listening; the same composer all term",
    typical_day: "any morning, paired against an abstract block",
    duration: "10–15 min",
    applies_from: "grammar",
    technique:
      "One composer's works played and re-played across the term so the ear " +
      "learns the voice. Listening first; facts about the composer stay " +
      "brief and second. [vol6-composer-study]",
    cite: ["vol6-composer-study"],
  },
  {
    activity: "hymn_study",
    label: "Hymn and folk song",
    cadence: "1/week practice; singing also appears in daily slots",
    typical_day: "any morning, as a light block between heavy ones",
    duration: "10 min",
    applies_from: "grammar",
    technique:
      "One hymn and one folk song learned per term by singing them often, " +
      "not by drilling verses. Singing doubles as the change-of-effort " +
      "between two book lessons. [pneu-alternation]",
    cite: ["pneu-alternation"],
  },
  {
    activity: "poetry_recitation",
    label: "Poetry and recitation",
    cadence: "short daily slots on the PNEU time-tables",
    typical_day: "daily",
    duration: "5–10 min",
    applies_from: "grammar",
    technique:
      "Poems are learned by hearing them read beautifully and often — not " +
      "assigned as memorization homework. Recitation is telling a poem as " +
      "if it were the child's own. [pneu-lesson-lengths]",
    cite: ["pneu-lesson-lengths"],
  },
  {
    activity: "shakespeare",
    label: "Shakespeare",
    cadence: "1/week, roughly a play per term",
    typical_day: "a longer inspirational block",
    duration: "20–45 min by stage",
    applies_from: "logic",
    technique:
      "Read the play itself — aloud, parts shared around — and narrate " +
      "scene by scene. Retellings (Lamb's Tales) serve Form I; the real " +
      "text belongs to Form II and up. [vol6-shakespeare]",
    cite: ["vol6-shakespeare"],
  },
  {
    activity: "handicrafts",
    label: "Handicrafts",
    cadence: "afternoon practice, several times a week",
    typical_day: "afternoons",
    duration: "30–60 min",
    applies_from: "grammar",
    technique:
      "Real, useful work held to an adult standard of finish — no " +
      "make-and-throw-away crafts. See handicrafts.ts for the four " +
      "principles and the age ladder. [vol1-handicraft-points]",
    cite: ["vol1-handicraft-points", "pneu-afternoons"],
  },
  {
    activity: "habit_training_focus",
    label: "Habit focus",
    cadence: "one habit at a time, sustained for about six weeks",
    typical_day: null,
    duration: null,
    applies_from: "grammar",
    technique:
      "Not a scheduled subject — a background focus the parent holds. The " +
      "planner's job is only to surface the current habit in the morning " +
      "brief and ask about it in the debrief. See habit-formation.ts. " +
      "[vol1-one-habit-at-a-time]",
    cite: ["vol1-one-habit-at-a-time"],
  },
];
