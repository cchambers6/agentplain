import type { CorpusBundle } from "../../types";
import { metadata } from "./_metadata";
import { rule as fhaAdvertising } from "./fair-housing-advertising-literal";
import { rule as fhaHudLiteral } from "./fair-housing-hud-literal";

export const realEstateCorpus: CorpusBundle = {
  verticalSlug: "real-estate",
  metadata,
  rules: [fhaAdvertising, fhaHudLiteral],
};
