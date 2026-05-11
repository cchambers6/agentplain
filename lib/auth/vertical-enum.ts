// Marketing slug ↔ Prisma `Vertical` enum bridge.
//
// `lib/verticals/` deliberately does not import from `@prisma/client` — it
// is the marketing/content layer, kept DB-agnostic so it can ship as a
// content adapter (per `feedback_runner_portability.md`). The persistence
// layer needs the Prisma enum on `Workspace.vertical`. This file is the
// SINGLE boundary that translates between the two.
//
// Adding a vertical: add it to `prisma/schema.prisma` Vertical enum, add a
// `lib/verticals/<slug>/content.ts` file + registry entry, and add the
// slug ↔ enum pair below. The shape is checked at compile time against the
// Prisma `Vertical` union, so a forgotten entry surfaces as a type error
// rather than a runtime miss.

import type { Vertical } from "@prisma/client";

const SLUG_TO_ENUM: Record<string, Vertical> = {
  "real-estate": "REAL_ESTATE",
  mortgage: "MORTGAGE",
  insurance: "INSURANCE",
  "property-management": "PROPERTY_MANAGEMENT",
  "title-escrow": "TITLE_ESCROW",
  recruiting: "RECRUITING",
  "home-services": "HOME_SERVICES",
  cpa: "CPA",
  law: "LAW",
  ria: "RIA",
};

const ENUM_TO_SLUG: Record<Vertical, string> = {
  REAL_ESTATE: "real-estate",
  MORTGAGE: "mortgage",
  INSURANCE: "insurance",
  PROPERTY_MANAGEMENT: "property-management",
  TITLE_ESCROW: "title-escrow",
  RECRUITING: "recruiting",
  HOME_SERVICES: "home-services",
  CPA: "cpa",
  LAW: "law",
  RIA: "ria",
};

export function verticalEnumFromSlug(slug: string): Vertical | null {
  return SLUG_TO_ENUM[slug] ?? null;
}

export function verticalSlugFromEnum(value: Vertical): string {
  return ENUM_TO_SLUG[value];
}

/** Tier alignment: lib/verticals content uses lowercase tier strings
 *  ("regular" | "plus" | "max"); the Prisma `WorkspaceVerticalTier` enum
 *  is uppercase. This is the same boundary translation. */
import type { WorkspaceVerticalTier } from "@prisma/client";

export function verticalTierFromContentTier(
  tier: "regular" | "plus" | "max",
): WorkspaceVerticalTier {
  if (tier === "regular") return "REGULAR";
  if (tier === "plus") return "PLUS";
  return "MAX";
}
