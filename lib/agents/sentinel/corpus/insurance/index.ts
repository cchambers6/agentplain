import type { CorpusBundle } from "../../types";
import { metadata } from "./_metadata";
import { rule as gaAntiRebating } from "./ga-anti-rebating-literal";
import { rule as gaProducerLicensing } from "./ga-producer-licensing-literal";
import { rule as gaCommissionerBasics } from "./ga-commissioner-basics-literal";
import { rule as producerEthics } from "./producer-ethics-literal";

export const insuranceCorpus: CorpusBundle = {
  verticalSlug: "insurance",
  metadata,
  rules: [gaAntiRebating, gaProducerLicensing, gaCommissionerBasics, producerEthics],
};
