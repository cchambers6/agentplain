import type { CorpusBundle } from "../../types";
import { metadata } from "./_metadata";
import { rule as circular230Conflicts } from "./circular-230-conflicts-literal";
import { rule as circular230Fees } from "./circular-230-fees-literal";
import { rule as circular230Diligence } from "./circular-230-diligence-literal";
import { rule as aicpaConfidentiality } from "./aicpa-confidentiality-literal";
import { rule as aicpaDueCare } from "./aicpa-due-care-literal";
import { rule as gaBoardAccountancy } from "./ga-board-accountancy-literal";

export const cpaCorpus: CorpusBundle = {
  verticalSlug: "cpa",
  metadata,
  rules: [
    circular230Conflicts,
    circular230Fees,
    circular230Diligence,
    aicpaConfidentiality,
    aicpaDueCare,
    gaBoardAccountancy,
  ],
};
