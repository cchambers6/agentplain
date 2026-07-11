// Nature study — daily out-of-door life plus the weekly focused walk and the
// child-kept nature notebook. For Mason this is not an enrichment: for young
// children it is the largest single block of the day.
import type { NatureStudySpec } from "./types";

export const natureStudy: NatureStudySpec = {
  weekly_walk: {
    cadence: "at least 1/week as a focused observation outing",
    duration: "30–60 min of deliberate looking inside a longer afternoon out",
    parent_role:
      "Set the children looking, then stand back. The parent names less and " +
      "asks more; identification can wait, attention cannot. The walk is " +
      "not a lecture route.",
    cite: ["vol1-out-of-doors", "vol1-sight-seeing"],
  },

  daily_outdoor_time: {
    rule:
      "Young children spend hours out of doors daily whenever it can be " +
      "managed — Mason asks for entire afternoons outside for the under-nines, " +
      "in winter as well as summer. The planner protects this time; it never " +
      "backfills it with lessons.",
    cite: ["vol1-outdoor-hours", "vol1-out-of-doors", "vol1-winter-walks"],
  },

  nature_notebook: {
    purpose:
      "The child's own first-hand record of what they have actually seen — " +
      "a growing personal relationship with the natural world, not an " +
      "assignment log.",
    technique:
      "The child draws or brush-paints the find from the thing itself " +
      "(Mason's word is 'brush drawings'; the dry-brush technique is later " +
      "PNEU practice), adds the date and place, and writes what they " +
      "observed. Entries follow real encounters; nothing is entered " +
      "secondhand from a book.",
    materials: ["a blank notebook", "watercolors and brush", "pencil"],
    never_graded:
      "The notebook is the child's own. Mason leaves it 'to his own " +
      "initiative' — it is not corrected, marked, or graded; the parent " +
      "may admire it, and that is all.",
    cite: ["vol1-nature-notebook"],
  },

  seasonal_focus: {
    spring: "nests, buds, blossom sequence, returning birds, tadpoles",
    summer: "wildflowers, insects, pond life, long light for evening walks",
    autumn: "seeds and fruits, leaf change, fungi, migration, harvest",
    winter:
      "tree silhouettes and bark, tracks, winter birds, weather itself — " +
      "the walk continues in cold and wet, dressed for it",
  },

  observation_games: [
    {
      name: "sight-seeing",
      how:
        "Send the child to look carefully at a defined patch — a hedgerow, " +
        "a tree, a stretch of stream — and come back and tell everything " +
        "they saw. Narration for the out-of-doors.",
      cite: ["vol1-sight-seeing"],
    },
    {
      name: "picture-painting",
      how:
        "Have the child look at a landscape until they hold it, then shut " +
        "their eyes and describe the whole scene from the mind's eye.",
      cite: ["vol1-sight-seeing"],
    },
  ],

  handbook:
    "Handbook of Nature Study (Anna Botsford Comstock, public domain) — the " +
    "standard parent's reference for identifying and following up finds.",
};
