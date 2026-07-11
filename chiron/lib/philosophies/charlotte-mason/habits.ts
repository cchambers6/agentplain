// Habit formation — "education is a discipline" made concrete. One habit at
// a time, held by the parent's steady watchfulness for weeks until it runs by
// itself. In Chiron this is a background focus the Headmaster carries week to
// week, never a scheduled subject block.
import type { HabitFormationSpec } from "./types";

export const habitFormation: HabitFormationSpec = {
  principle:
    "Work on one habit at a time, and keep at it until the new way is the " +
    "easy way. Habit does the heavy lifting of education: what is made " +
    "automatic no longer costs the child (or the parent) a daily battle of " +
    "will. [vol1-habit-ten-natures, vol1-one-habit-at-a-time]",

  // Mason's own words: forming a good habit is "the work of a few weeks,"
  // guarded afterward by "incessant, but by no means anxious care." The
  // six-week planning default is our operational reading — long enough to
  // pass her bar, short enough to plan around.
  duration:
    "about six weeks of sustained focus per habit (Mason: 'the work of a " +
    "few weeks' [vol1-habit-few-weeks]), and never let a lapse pass " +
    "unnoticed in that window — one indulged exception undoes weeks of " +
    "setting.",

  method: [
    {
      text:
        "Pick the single habit, tell the child plainly what the new way is, " +
        "and secure their own buy-in — habit training works with the " +
        "child, not on them.",
      basis: "mason",
      cite: ["vol1-one-habit-at-a-time"],
    },
    {
      text:
        "Arrange the environment so the right act is easy and the lapse is " +
        "unlikely, especially in the first days.",
      basis: "mason",
      cite: ["vol1-one-habit-at-a-time"],
    },
    {
      text:
        "Watchfulness without nagging: when a lapse is coming, a look or a " +
        "quiet word before the failure beats a scolding after it. Constant " +
        "verbal reminders teach the child to wait for reminders.",
      basis: "mason",
      cite: ["vol1-habit-tact-not-nagging"],
    },
    {
      text:
        "Do not relax when the habit seems formed — the tail end of the " +
        "window, when everything looks won, is when habits are lost.",
      basis: "mason",
      cite: ["vol1-one-habit-at-a-time"],
    },
  ],

  starter_habits: [
    {
      habit: "attention",
      why:
        "The master habit — every short lesson is itself attention " +
        "training, so this one is always first for a new-to-Mason family.",
      cite: ["vol1-habit-of-attention"],
    },
    {
      habit: "perfect execution",
      why:
        "Best-effort finish on small tasks: six careful letters over a page " +
        "of careless ones. Pairs naturally with copywork.",
      cite: ["vol1-copywork-perfect-letters"],
    },
    {
      habit: "prompt obedience",
      why:
        "Doing the asked thing at the first asking — a classic first habit " +
        "for a peaceable home schoolroom.",
      cite: ["vol1-one-habit-at-a-time"],
    },
    {
      habit: "truthfulness",
      why:
        "Exactness in telling — no exaggeration or careless statement — " +
        "trained the same watchful way as any other habit.",
      cite: ["vol1-habit-ten-natures"],
    },
    {
      habit: "order",
      why:
        "Things returned to their places, work laid out before it begins — " +
        "a habit that pays the parent back daily.",
      cite: ["vol1-habit-ten-natures"],
    },
  ],

  parent_role:
    "The parent is the habit's keeper [vol5-habit-case]. The child supplies " +
    "the doing; the parent supplies the unbroken noticing. Chiron's part is only to keep " +
    "the current habit in view — named in the morning brief, asked after in " +
    "the debrief, reviewed in the Friday report — and to suggest when six " +
    "good weeks have earned a graduation.",

  scheduling:
    "Habit training is background, not a subject. It never takes a lesson " +
    "block; it colors how existing blocks run (e.g. an attention focus " +
    "shortens lessons rather than adding one).",

  cite: ["vol1-habit-ten-natures", "vol1-one-habit-at-a-time", "vol1-habit-tact-not-nagging"],
};
