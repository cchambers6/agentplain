import type { CorpusBundle } from "../../types";
import { metadata } from "./_metadata";
import { rule as mrpc11 } from "./mrpc-1-1-competence-literal";
import { rule as mrpc16 } from "./mrpc-1-6-confidentiality-literal";
import { rule as mrpc118 } from "./mrpc-1-18-prospective-client-literal";
import { rule as mrpc55 } from "./mrpc-5-5-unauthorized-practice-literal";
import { rule as mrpc7 } from "./mrpc-7-advertising-literal";
import { rule as gaRpc } from "./ga-rules-professional-conduct-literal";
import { rule as attorneyClientPrivilege } from "./attorney-client-privilege-literal";
import { rule as mrpc71AdvertisingCandidates } from "./mrpc-7-1-advertising-candidates-literal";

export const lawCorpus: CorpusBundle = {
  verticalSlug: "law",
  metadata,
  rules: [
    mrpc11,
    mrpc16,
    mrpc118,
    mrpc55,
    mrpc7,
    gaRpc,
    attorneyClientPrivilege,
    mrpc71AdvertisingCandidates,
  ],
};
