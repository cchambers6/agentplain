// Living books vs. twaddle — Mason's own selection doctrine. The Integrator
// uses this to rank a family's materials for philosophy fit and to explain,
// in the conflicts list, why a workbook-heavy program sits awkwardly in a
// Charlotte Mason week. "Twaddle" is her word, not ours.
import type { LivingBooksSpec } from "./types";

export const livingBooks: LivingBooksSpec = {
  criteria: [
    {
      text:
        "Written by an author who knows and loves the subject — a work " +
        "with the 'imaginative grasp' and 'touch of originality' that, in " +
        "Mason's own line, distinguish a book from a text-book.",
      basis: "mason",
      cite: ["vol6-textbook-criticism", "vol6-literary-form"],
    },
    {
      text:
        "Literary in form: whole, well-made prose that carries ideas, " +
        "because the mind feeds on ideas and refuses dry summary.",
      basis: "mason",
      cite: ["vol6-literary-form", "vol6-mind-feeds-on-ideas"],
    },
    {
      text:
        "Narrative-driven and concrete — persons, places, and particulars " +
        "rather than abstract survey. A child can narrate a story; nobody " +
        "can narrate a bullet list.",
      basis: "mason",
      cite: ["vol6-mind-feeds-on-ideas"],
    },
    {
      text:
        "Vocabulary and sentence structure a step above the child — books " +
        "the child grows into, never books that talk down.",
      basis: "mason",
      cite: ["vol1-twaddle"],
    },
    {
      text:
        "Worth a single attentive reading: dense enough that the one-reading " +
        "rule is a fair test, rich enough to reward it.",
      basis: "modern-application",
      cite: ["vol1-single-reading"],
    },
  ],

  twaddle_signals: [
    {
      text: "Dumbed-down retellings and diluted 'reading-level' versions of real books.",
      basis: "mason",
      cite: ["vol1-twaddle"],
    },
    {
      text: "A condescending, goody-goody tone — writing at children instead of for them.",
      basis: "mason",
      cite: ["vol1-twaddle"],
    },
    {
      text:
        "Text-book compilations of predigested facts — the ideas boiled " +
        "out, no single mind on the page.",
      basis: "mason",
      cite: ["vol6-textbook-criticism"],
    },
    {
      text:
        "Busywork wrappers — fill-in-the-blank workbooks and recognition " +
        "drill standing in for the child's own telling.",
      basis: "mason",
      cite: ["vol6-act-of-knowing"],
    },
    {
      text:
        "Reward-bait framing: stickers, points, and prizes doing the work " +
        "that the book itself should do.",
      basis: "mason",
      cite: ["vol6-no-prizes"],
    },
  ],

  // Public-domain examples of the kind Mason's own PNEU programmes set —
  // named so the Integrator can give the parent a concrete picture, not so
  // Chiron can supply content (it never does).
  qualifying_examples: [
    "Robinson Crusoe (Defoe)",
    "The Pilgrim's Progress (Bunyan)",
    "Just So Stories and The Jungle Book (Kipling)",
    "Tales from Shakespeare (Lamb) — Form I; the plays themselves from Form II",
    "Plutarch's Lives (North's or Dryden's translation)",
    "The Handbook of Nature Study (Comstock) — the parent's reference, not a child's textbook",
  ],

  disqualified_shapes: [
    "graded readers built from controlled word lists",
    "textbook survey chapters ending in review questions",
    "abridgments that keep the plot and lose the prose",
    "workbook pages as the primary contact with a subject",
  ],
};
