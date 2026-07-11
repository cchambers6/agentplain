// Assessment — how a Mason educator knows the education is working. The
// frame is her own: "education is an atmosphere, a discipline, a life." The
// Headmaster reads this when writing the Friday report; none of it is a
// grade, a percentile, or a pages-per-week count.
import type { AssessmentSpec } from "./types";

export const assessment: AssessmentSpec = {
  triad: "atmosphere / discipline / life",

  triad_explained: {
    atmosphere:
      "The child is educated by the real life of the home — its honesty, " +
      "its conversation, its standards — not by a staged child-world " +
      "[vol6-no-child-environment]. Check: does the week feel like family " +
      "life with lessons in it, or like school theater staged at home?",
    discipline:
      "The habits are doing the carrying [vol1-habit-ten-natures]. Check: " +
      "is attention holding through short lessons, is work finished " +
      "carefully, is the current habit focus gaining ground without daily " +
      "battles?",
    life:
      "The mind is being fed on living ideas. Check: do narrations come " +
      "back rich and personal, do book characters and outdoor finds show " +
      "up in the child's free talk and play?",
  },

  signals_of_health: [
    {
      text: "Narrations are full, particular, and increasingly in the child's own voice.",
      basis: "mason",
      cite: ["vol1-art-of-narrating", "vol6-act-of-knowing"],
    },
    {
      text: "Short lessons end with attention still fresh — the child comes willingly to the next block.",
      basis: "mason",
      cite: ["vol1-short-lessons", "vol1-habit-of-attention"],
    },
    {
      text: "The nature notebook grows by the child's own wish, not by assignment pressure.",
      basis: "mason",
      cite: ["vol1-nature-notebook"],
    },
    {
      text: "Books and outdoor finds surface in unprompted talk — the feast is being eaten, relations are forming.",
      basis: "mason",
      cite: ["vol6-science-of-relations"],
    },
    {
      text: "The afternoon stays free and full — outdoor hours and handwork happening, not squeezed out by rollover lessons.",
      basis: "pneu-practice",
      cite: ["pneu-afternoons", "vol1-outdoor-hours"],
    },
  ],

  signals_of_drift: [
    {
      text: "Lessons stretching past their caps 'to finish' — coverage creeping in as the measure of a day.",
      basis: "mason",
      cite: ["vol1-short-lessons", "vol1-attention-quality"],
    },
    {
      text: "Narrations shrinking toward one-word answers, or passages needing a second reading — attention is being untrained.",
      basis: "mason",
      cite: ["vol1-single-reading", "vol1-habit-of-attention"],
    },
    {
      text: "Rewards, points, or prizes creeping in to buy compliance the material should be earning.",
      basis: "mason",
      cite: ["vol6-no-prizes"],
    },
    {
      text: "Several habits under correction at once — which in practice means none are being formed.",
      basis: "mason",
      cite: ["vol1-one-habit-at-a-time"],
    },
    {
      text: "The nature walk and afternoon outdoor time quietly disappearing week over week.",
      basis: "pneu-practice",
      cite: ["pneu-afternoons", "vol1-out-of-doors"],
    },
  ],

  exam_practice: {
    rule:
      "Term-end examinations are narration prompts answered from the term's " +
      "reading — a record of what the child can tell, meant to encourage. " +
      "Nothing is ranked, curved, or scored against other children.",
    cite: ["vol6-exams-by-narration"],
  },

  cite: ["vol6-atmosphere-discipline-life"],
};
