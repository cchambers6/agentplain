// Handicrafts — the afternoon handwork practice. Mason's test is usefulness
// and finish: children make real things, slowly and carefully, to a standard
// a grown-up would accept. The age ladder below follows PNEU programme
// practice where we have it and is otherwise labeled modern application.
import type { HandicraftsSpec } from "./types";

export const handicrafts: HandicraftsSpec = {
  afternoon_practice:
    "Handwork lives in the free afternoon, several sessions a week, " +
    "unhurried. One craft is carried long enough to reach real competence " +
    "before the next is introduced — the handicraft equivalent of one habit " +
    "at a time.",

  principles: [
    {
      text:
        "No futilities: children should not be set to make throwaway " +
        "novelties (Mason names pea-and-stick work); the thing made should " +
        "be of use.",
      basis: "mason",
      cite: ["vol1-handicraft-points"],
    },
    {
      text: "Each craft is taught slowly, step by step, with care.",
      basis: "mason",
      cite: ["vol1-handicraft-points"],
    },
    {
      text:
        "Slipshod work is not allowed; a piece is finished to the best the " +
        "child can do or done again.",
      basis: "mason",
      cite: ["vol1-handicraft-points"],
    },
    {
      text:
        "The work stays within the child's compass — hard enough to " +
        "stretch, never so hard that careful execution is impossible.",
      basis: "mason",
      cite: ["vol1-handicraft-points"],
    },
  ],

  // Options by starting age. PNEU programmes name sewing, knitting, weaving,
  // basketry, cardboard sloyd, clay and wood work for the young forms; the
  // exact age placement here is our application of "within their compass."
  age_appropriate: {
    6: ["simple sewing (large stitches, real cloth)", "clay modeling", "paper folding and weaving"],
    8: ["knitting", "basketry", "cardboard sloyd (ruled, cut, glued boxes and models)"],
    10: ["cross-stitch and embroidery", "simple woodwork", "gardening a real bed"],
    12: ["carpentry with tools", "leather work", "cooking and bread-making"],
    14: ["fine woodwork or carving", "garment sewing from a pattern", "bookbinding"],
    16: ["a sustained craft of the student's own choosing, carried to genuine skill"],
  },

  cite: ["vol1-handicraft-points", "pneu-handicrafts-named", "pneu-afternoons"],
};
