import type { CorpusBundle } from "../../types";
import { metadata } from "./_metadata";
import { rule as gaAntiRebating } from "./ga-anti-rebating-literal";
import { rule as gaProducerLicensing } from "./ga-producer-licensing-literal";
import { rule as gaCommissionerBasics } from "./ga-commissioner-basics-literal";
import { rule as producerEthics } from "./producer-ethics-literal";
import { rule as utpaAdvertisingCandidates } from "./unfair-trade-practices-candidates-literal";
import { rule as unfairClaimsSettlement } from "./unfair-claims-settlement-practices-literal";
import { rule as gaClaimHandlingTimelines } from "./ga-claim-handling-timelines-literal";
import { rule as replacementCostVsAcv } from "./replacement-cost-vs-acv-literal";

export const insuranceCorpus: CorpusBundle = {
  verticalSlug: "insurance",
  metadata,
  rules: [
    gaAntiRebating,
    gaProducerLicensing,
    gaCommissionerBasics,
    producerEthics,
    utpaAdvertisingCandidates,
    unfairClaimsSettlement,
    gaClaimHandlingTimelines,
    replacementCostVsAcv,
  ],
};
