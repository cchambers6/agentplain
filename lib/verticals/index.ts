// Vertical content registry.
//
// Single read path for the dynamic `[vertical]/page.tsx` route. New verticals
// land here AND in `lib/verticals/<slug>/content.ts` — the registry keeps the
// route from importing 10 files individually.
//
// Per `project_vertical_tier_mapping.md`: this list is locked at 10 active
// verticals (Regular: 6, Plus: 2, Max: 2). Medical is parked. Adding an
// eleventh requires a memory ratification, not a code change.

import type { VerticalContent, VerticalTier } from "./types";

import { realEstate } from "./real-estate/content";
import { mortgage } from "./mortgage/content";
import { insurance } from "./insurance/content";
import { propertyManagement } from "./property-management/content";
import { titleEscrow } from "./title-escrow/content";
import { recruiting } from "./recruiting/content";
import { homeServices } from "./home-services/content";
import { cpa } from "./cpa/content";
import { law } from "./law/content";
import { ria } from "./ria/content";

const REGISTRY: Record<string, VerticalContent> = {
  "real-estate": realEstate,
  mortgage: mortgage,
  insurance: insurance,
  "property-management": propertyManagement,
  "title-escrow": titleEscrow,
  recruiting: recruiting,
  "home-services": homeServices,
  cpa: cpa,
  law: law,
  ria: ria,
};

export const VERTICAL_SLUGS = Object.keys(REGISTRY);

export function getVerticalContent(slug: string): VerticalContent | null {
  return REGISTRY[slug] ?? null;
}

export function getAllVerticals(): VerticalContent[] {
  return VERTICAL_SLUGS.map((s) => REGISTRY[s]);
}

/**
 * Tier mapping is asserted by the test in `tests/vertical-routes.test.ts`.
 * Keeping the source of truth inside each `content.ts` file means moving a
 * vertical between tiers is a one-line content edit, not a registry change.
 */
export function getVerticalTier(slug: string): VerticalTier | null {
  return REGISTRY[slug]?.tier ?? null;
}
