import type { CorpusBundle } from "../../types";
import { metadata } from "./_metadata";
import { rule as circular230Conflicts } from "./circular-230-conflicts-literal";
import { rule as circular230Fees } from "./circular-230-fees-literal";
import { rule as circular230Diligence } from "./circular-230-diligence-literal";
import { rule as aicpaConfidentiality } from "./aicpa-confidentiality-literal";
import { rule as aicpaDueCare } from "./aicpa-due-care-literal";
import { rule as gaBoardAccountancy } from "./ga-board-accountancy-literal";
import { rule as circular230SolicitationCandidates } from "./circular-230-solicitation-candidates-literal";
import { rule as irc6694PreparerPenalty } from "./irc-6694-preparer-penalty-literal";
import { rule as irc7216Disclosure } from "./irc-7216-disclosure-literal";
import { rule as pcaobAs1015Skepticism } from "./pcaob-as-1015-skepticism-literal";

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
    circular230SolicitationCandidates,
    irc6694PreparerPenalty,
    irc7216Disclosure,
    pcaobAs1015Skepticism,
  ],
};
