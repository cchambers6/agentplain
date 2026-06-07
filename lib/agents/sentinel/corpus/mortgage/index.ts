import type { CorpusBundle } from "../../types";
import { metadata } from "./_metadata";
import { rule as respaSection8 } from "./respa-section-8-literal";
import { rule as tridClosingDisclosure } from "./trid-closing-disclosure-literal";
import { rule as tridRedisclosure } from "./trid-redisclosure-literal";
import { rule as tilaDisclosure } from "./tila-disclosure-literal";
import { rule as safeActMlo } from "./nmls-safe-act-literal";
import { rule as gaResidentialMortgageAct } from "./ga-residential-mortgage-act-literal";
import { rule as ecoaRegBFairLending } from "./ecoa-reg-b-fair-lending-literal";
import { rule as hmdaRegC } from "./hmda-reg-c-literal";
import { rule as regZAdvertisingProhibited } from "./reg-z-advertising-prohibited-literal";
import { rule as regZAdvertisingTriggeringTerms } from "./reg-z-advertising-triggering-terms-literal";

export const mortgageCorpus: CorpusBundle = {
  verticalSlug: "mortgage",
  metadata,
  rules: [
    respaSection8,
    tridClosingDisclosure,
    tridRedisclosure,
    tilaDisclosure,
    safeActMlo,
    gaResidentialMortgageAct,
    ecoaRegBFairLending,
    hmdaRegC,
    regZAdvertisingProhibited,
    regZAdvertisingTriggeringTerms,
  ],
};
