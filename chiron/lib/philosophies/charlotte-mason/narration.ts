// Narration — the load-bearing technique of the whole method, and the pack
// section the Tutor-Advisor reads most. The daily check is "tell me what you
// heard," never a quiz. Quality lives in the telling-back, not in coverage.
import type { NarrationSpec } from "./types";

export const narration: NarrationSpec = {
  // Debrief question style by app stage. These address the PARENT (the
  // Tutor-Advisor talks to the parent-teacher, never the child) — they are
  // the questions the parent puts to the child, relayed.
  grammar_stage_prompt:
    "Ask them to tell back what they heard or read — one reading, their own " +
    "words, no interruptions and no leading questions while they tell it.",
  logic_stage_prompt:
    "Ask them to explain what they understood and why it went the way it " +
    "did — the telling should start reaching for causes and connections, " +
    "and some of it now belongs on paper.",
  rhetoric_stage_prompt:
    "Ask them to take a position on what they read — argue for or against " +
    "it, weigh the author's case, connect it to something else they know. " +
    "Written, essay-shaped narration is the norm at this stage.",

  quality_signals: [
    "specific detail recalled without prompting (names, sequence, the odd vivid particular)",
    "the child's own wording and sentence rhythm, not the book's phrasing recited",
    "events told in order, with the connective tissue — because, so, but — supplied by the child",
    "an unprompted connection to prior reading or their own experience",
    "vocabulary from the book used naturally in the telling",
    "opinions or questions volunteered after the telling ends",
  ],
  anti_signals: [
    "parroting — stretches of the book's exact sentences given back verbatim",
    "generic summary that would fit any chapter ('they went somewhere and stuff happened')",
    "needing the passage re-read before being able to tell anything",
    "answering only direct questions, offering nothing freely",
    "telling that shrinks week over week — a sign the readings are too long or the book is wrong for the child",
  ],

  rules: [
    {
      rule:
        "One reading only. The passage is read a single time and the child " +
        "tells it back; re-reading teaches the child not to attend the " +
        "first time.",
      basis: "mason",
      cite: ["vol1-single-reading"],
    },
    {
      rule:
        "Narration begins as a required practice at six. Before six, a " +
        "child narrates only when they choose to.",
      basis: "mason",
      cite: ["vol1-narration-from-six", "vol1-art-of-narrating"],
    },
    {
      rule:
        "Narration is oral through roughly age nine, then written narration " +
        "is added gradually; it never fully replaces telling aloud.",
      basis: "mason",
      cite: ["vol6-written-narration"],
    },
    {
      rule:
        "Do not interrupt a narration to correct facts or grammar. Notes on " +
        "gaps wait until the telling is finished, and most are left for the " +
        "next reading to fix.",
      basis: "mason",
      cite: ["vol1-art-of-narrating"],
    },
    {
      rule:
        "Narration replaces comprehension questions, quizzes, and " +
        "multiple-choice review entirely. The child's own act of telling is " +
        "the act of knowing.",
      basis: "mason",
      cite: ["vol6-act-of-knowing"],
    },
    {
      rule:
        "The debrief scores attention and telling-back quality, not pages " +
        "completed — a rich narration on a short reading beats a thin one " +
        "on a long reading.",
      basis: "mason",
      cite: ["vol1-attention-quality", "vol6-act-of-knowing"],
    },
    {
      rule:
        "Quality signals above are our operationalization of Mason's " +
        "descriptions of good telling, written for model-update extraction. " +
        "They are consistent with her examples but the list itself is ours.",
      basis: "modern-application",
      cite: ["vol1-art-of-narrating"],
    },
  ],
};

/** The good-day bar the Headmaster and Tutor-Advisor share. */
export const goodDayDefinition =
  "A good day is one in which every short lesson got the child's full " +
  "attention and ended with a genuine telling-back, and the child still had " +
  "free afternoon hours out of doors — not the day the most material was " +
  "covered. Attention and narration quality are the measure, never pages " +
  "completed. [vol1-attention-quality, vol1-short-lessons, pneu-afternoons]";
