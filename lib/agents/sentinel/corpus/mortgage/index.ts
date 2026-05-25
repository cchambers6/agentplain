import type { CorpusBundle } from "../../types";
import { metadata } from "./_metadata";
import { rule as respaSection8 } from "./respa-section-8-literal";
import { rule as tridClosingDisclosure } from "./trid-closing-disclosure-literal";
import { rule as tilaDisclosure } from "./tila-disclosure-literal";
import { rule as safeActMlo } from "./nmls-safe-act-literal";
import { rule as gaResidentialMortgageAct } from "./ga-residential-mortgage-act-literal";
import { rule as regZAdvertisingCandidates } from "./reg-z-advertising-candidates-literal";

export const mortgageCorpus: CorpusBundle = {
  verticalSlug: "mortgage",
  metadata,
  rules: [
    respaSection8,
    tridClosingDisclosure,
    tilaDisclosure,
    safeActMlo,
    gaResidentialMortgageAct,
    regZAdvertisingCandidates,
  ],
};
