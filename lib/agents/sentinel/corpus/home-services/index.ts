import type { CorpusBundle } from "../../types";
import { metadata } from "./_metadata";
import { rule as gaContractorLicensing } from "./ga-contractor-licensing-literal";
import { rule as ftcCoolingOff } from "./ftc-cooling-off-literal";
import { rule as gaMechanicsLien } from "./ga-mechanics-lien-literal";
import { rule as magnusonMoss } from "./magnuson-moss-warranty-literal";

export const homeServicesCorpus: CorpusBundle = {
  verticalSlug: "home-services",
  metadata,
  rules: [gaContractorLicensing, ftcCoolingOff, gaMechanicsLien, magnusonMoss],
};
