/**
 * lib/demo/synthetic/index.ts
 *
 * Resolver for the per-vertical synthetic demo substrate. `syntheticDatasetFor`
 * is the single entry point the workflow runtime + vertical stories read from.
 *
 * Only the five verticals with an authored killer-workflow story have a bespoke
 * dataset (real estate, CPA, law, property management, general). Any other
 * vertical resolves to the general set — matching the killer-workflow fallback
 * in `lib/plaino/killer-workflow.ts`, so a brand-new workspace of any vertical
 * still gets a concrete, running demo.
 */

import type { Vertical } from "@prisma/client";
import type { SyntheticDataset } from "./types";
import {
  CPA_SYNTHETIC,
  GENERAL_SYNTHETIC,
  LAW_SYNTHETIC,
  PROPERTY_MANAGEMENT_SYNTHETIC,
  REAL_ESTATE_SYNTHETIC,
} from "./datasets";

export type { SyntheticDataset } from "./types";
export type {
  SyntheticClient,
  SyntheticMessage,
  SyntheticTransaction,
} from "./types";

const SYNTHETIC_DATASETS: Partial<Record<Vertical, SyntheticDataset>> = {
  REAL_ESTATE: REAL_ESTATE_SYNTHETIC,
  CPA: CPA_SYNTHETIC,
  LAW: LAW_SYNTHETIC,
  PROPERTY_MANAGEMENT: PROPERTY_MANAGEMENT_SYNTHETIC,
};

/**
 * Resolve the synthetic dataset for a workspace vertical. `null` / unmapped
 * resolves to the general dataset so every workspace gets a running demo.
 */
export function syntheticDatasetFor(
  vertical: Vertical | null | undefined,
): SyntheticDataset {
  if (!vertical) return GENERAL_SYNTHETIC;
  return SYNTHETIC_DATASETS[vertical] ?? GENERAL_SYNTHETIC;
}

/** Verticals that have a bespoke, authored synthetic dataset + story. */
export const VERTICALS_WITH_BESPOKE_DEMO: Vertical[] = [
  "REAL_ESTATE",
  "CPA",
  "LAW",
  "PROPERTY_MANAGEMENT",
];

export const __testing = {
  SYNTHETIC_DATASETS,
  GENERAL_SYNTHETIC,
};
