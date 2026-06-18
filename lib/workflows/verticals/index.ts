/**
 * lib/workflows/verticals/index.ts
 *
 * Resolver for the per-vertical killer-workflow STORIES — the runnable,
 * step-by-step narratives the visible runtime plays. One authored story per
 * vertical in the activation mandate (real estate, CPA, law, property
 * management, general); any other vertical falls back to the general story so
 * every workspace gets a running demo.
 *
 * Stories are built lazily (each is a pure builder) so the synthetic data and
 * killer-workflow registry are read on every resolve — cold-start safe, no
 * module-load side effects.
 */

import type { Vertical } from "@prisma/client";
import type { WorkflowStory } from "../runtime";
import { realEstateStory } from "./real-estate";
import { cpaStory } from "./cpa";
import { lawStory } from "./law";
import { propertyManagementStory } from "./property-management";
import { generalStory } from "./general";

const STORY_BUILDERS: Partial<Record<Vertical, () => WorkflowStory>> = {
  REAL_ESTATE: realEstateStory,
  CPA: cpaStory,
  LAW: lawStory,
  PROPERTY_MANAGEMENT: propertyManagementStory,
};

/**
 * Resolve the killer-workflow story for a workspace vertical. `null` /
 * unmapped resolves to the general story.
 */
export function killerWorkflowStoryFor(
  vertical: Vertical | null | undefined,
): WorkflowStory {
  if (!vertical) return generalStory();
  const build = STORY_BUILDERS[vertical];
  return build ? build() : generalStory();
}

/** Verticals with a bespoke authored story (the five killer workflows). */
export const VERTICALS_WITH_STORY: Vertical[] = [
  "REAL_ESTATE",
  "CPA",
  "LAW",
  "PROPERTY_MANAGEMENT",
];

export {
  realEstateStory,
  cpaStory,
  lawStory,
  propertyManagementStory,
  generalStory,
};
