// Vertical content registry.
//
// Single read path for the dynamic `[vertical]/page.tsx` route. New verticals
// land here AND in `lib/verticals/<slug>/content.ts` — the registry keeps the
// route from importing 10 files individually.
//
// Per `project_vertical_tier_mapping.md` + the 2026-05-15 three-tier
// ratification in `memory/project_stripe_both_surfaces.md`: this list is
// locked at 10 active verticals split by RECOMMENDED tier — Regular: 6,
// Partner (schema-side `plus`): 2, Max: 2. Medical is parked. Adding an
// eleventh requires a memory ratification, not a code change.
//
// The on-disk schema enum values stay `regular` / `plus` / `max` for
// stable identity (see `lib/pricing/tiers.ts` and `prisma/schema.prisma`).
// Customer-facing copy goes through `tierDisplayName()` so `plus` reads as
// "Partner" everywhere a customer can see it.
//
// On-ramp surfaces (currently just `/general`) live in a SEPARATE registry
// below. They are NOT in `REGISTRY`, do NOT appear in `VERTICAL_SLUGS`, and
// do NOT count toward the 10 — per `feedback_no_new_verticals_finish_locked.md`,
// the ten-vertical lock is intact. They share the route shape and resolve
// through `getVerticalContent()`, but every surface that enumerates the
// "ten verticals" (homepage chip row, footer "Verticals" column, the
// `/verticals` index grid) reads from `getAllVerticals()` and therefore
// stays at ten. Surfaces that want both (e.g. `generateStaticParams`)
// read from `getAllVerticalsIncludingOnRamps()` or merge slug lists
// explicitly.

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
import { general } from "./general/content";

// The locked ten — every customer-facing "verticals" surface enumerates
// these and only these. Do NOT add `general` here.
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

// On-ramp surfaces — honest landing pages for businesses outside the locked
// ten that share the same service partnership with lighter scaffolding. See
// `lib/verticals/general/content.ts` for the framing rationale.
const ON_RAMP_REGISTRY: Record<string, VerticalContent> = {
  general: general,
};

export const VERTICAL_SLUGS = Object.keys(REGISTRY);
export const ON_RAMP_SLUGS = Object.keys(ON_RAMP_REGISTRY);

/**
 * Resolve a slug to its content. Checks the locked ten first, then on-ramp
 * surfaces. The route page uses this — `/general` and `/real-estate` both
 * resolve through one call without the route caring which registry they
 * came from.
 */
export function getVerticalContent(slug: string): VerticalContent | null {
  return REGISTRY[slug] ?? ON_RAMP_REGISTRY[slug] ?? null;
}

/**
 * The ten ratified verticals. Used by every surface that enumerates the
 * "verticals" — homepage chip row, footer column, `/verticals` index grid.
 * On-ramps are excluded by design.
 */
export function getAllVerticals(): VerticalContent[] {
  return VERTICAL_SLUGS.map((s) => REGISTRY[s]);
}

/**
 * The ten ratified verticals plus on-ramp surfaces. Used by the dynamic
 * route's `generateStaticParams` so `/general` builds at compile time too.
 */
export function getAllVerticalsIncludingOnRamps(): VerticalContent[] {
  return [...getAllVerticals(), ...ON_RAMP_SLUGS.map((s) => ON_RAMP_REGISTRY[s])];
}

/**
 * Tier mapping is asserted by the test in `tests/vertical-routes.test.ts`.
 * Keeping the source of truth inside each `content.ts` file means moving a
 * vertical between tiers is a one-line content edit, not a registry change.
 *
 * On-ramp surfaces are reachable through this helper too — `getVerticalTier`
 * doesn't care which registry the slug lives in. The on-ramp's tier is
 * Regular, same as nine of the ten ratified verticals.
 */
export function getVerticalTier(slug: string): VerticalTier | null {
  return getVerticalContent(slug)?.tier ?? null;
}
