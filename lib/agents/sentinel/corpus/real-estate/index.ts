import type { CorpusBundle } from "../../types";
import { metadata } from "./_metadata";
import { rule as fhaAdvertising } from "./fair-housing-advertising-literal";

export const realEstateCorpus: CorpusBundle = {
  verticalSlug: "real-estate",
  metadata,
  rules: [fhaAdvertising],
};
