import type { CorpusBundle } from "../../types";
import { metadata } from "./_metadata";
import { rule as respaSection9 } from "./respa-closing-side-literal";
import { rule as respaSection8Crossref } from "./respa-section-8-crossref";
import { rule as gaTitleInsurance } from "./ga-title-insurance-literal";
import { rule as altaBestPractices } from "./alta-best-practices-literal";

export const titleEscrowCorpus: CorpusBundle = {
  verticalSlug: "title-escrow",
  metadata,
  rules: [respaSection9, respaSection8Crossref, gaTitleInsurance, altaBestPractices],
};
