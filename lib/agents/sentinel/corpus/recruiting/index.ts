import type { CorpusBundle } from "../../types";
import { metadata } from "./_metadata";
import { rule as titleVii } from "./title-vii-literal";
import { rule as ada } from "./ada-literal";
import { rule as adea } from "./adea-literal";
import { rule as fcra } from "./fcra-background-check-literal";
import { rule as flsa } from "./flsa-exemption-literal";
import { rule as gaRightToWork } from "./ga-right-to-work-literal";

export const recruitingCorpus: CorpusBundle = {
  verticalSlug: "recruiting",
  metadata,
  rules: [titleVii, ada, adea, fcra, flsa, gaRightToWork],
};
