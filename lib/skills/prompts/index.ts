/**
 * lib/skills/prompts/index.ts
 *
 * Registry of per-vertical prompt bundles. One per locked vertical
 * (10 total per `lib/verticals/index.ts`). The runner looks up by
 * `workspace.vertical` (Prisma enum) → slug → bundle.
 *
 * Per `feedback_no_quick_fixes.md`: each vertical bundle is hand-tuned
 * from that vertical's `lib/verticals/<slug>/content.ts` so the
 * categorization rules + draft tone reflect the JTBD + audience the
 * marketing pages promise. A CPA email about "tax prep deadline" is
 * high-intent for CPA but noise for a real-estate workspace — the
 * vertical-specific noise / lead / scheduling rules are what implement
 * that divergence.
 *
 * Per `feedback_no_guesses_no_estimates.md`: each bundle cites the
 * memory rule or content file that grounds its categorization choices.
 */

import type { Vertical } from '@prisma/client';
import { cpaPrompts } from './cpa';
import { homeServicesPrompts } from './home-services';
import { insurancePrompts } from './insurance';
import { lawPrompts } from './law';
import { mortgagePrompts } from './mortgage';
import { propertyManagementPrompts } from './property-management';
import { realEstatePrompts } from './real-estate';
import { recruitingPrompts } from './recruiting';
import { riaPrompts } from './ria';
import { titleEscrowPrompts } from './title-escrow';

export interface VerticalPromptBundle {
  /** Slug — matches `lib/verticals/<slug>/`. */
  verticalSlug: string;
  /** Human name. */
  verticalName: string;
  /** Categorize-skill system prompt. Includes marker for the test provider. */
  categorize: string;
  /** Draft-skill system prompt. */
  draft: string;
  /** Schedule-skill system prompt. */
  schedule: string;
  /** Coordinate-skill system prompt. */
  coordinate: string;
}

const BY_SLUG: Record<string, VerticalPromptBundle> = {
  'real-estate': realEstatePrompts,
  mortgage: mortgagePrompts,
  insurance: insurancePrompts,
  'property-management': propertyManagementPrompts,
  'title-escrow': titleEscrowPrompts,
  recruiting: recruitingPrompts,
  'home-services': homeServicesPrompts,
  cpa: cpaPrompts,
  law: lawPrompts,
  ria: riaPrompts,
};

const BY_ENUM: Record<Vertical, VerticalPromptBundle> = {
  REAL_ESTATE: realEstatePrompts,
  MORTGAGE: mortgagePrompts,
  INSURANCE: insurancePrompts,
  PROPERTY_MANAGEMENT: propertyManagementPrompts,
  TITLE_ESCROW: titleEscrowPrompts,
  RECRUITING: recruitingPrompts,
  HOME_SERVICES: homeServicesPrompts,
  CPA: cpaPrompts,
  LAW: lawPrompts,
  RIA: riaPrompts,
};

export function getPromptBundleBySlug(slug: string): VerticalPromptBundle | null {
  return BY_SLUG[slug] ?? null;
}

export function getPromptBundleByEnum(value: Vertical): VerticalPromptBundle {
  return BY_ENUM[value];
}

export const VERTICAL_PROMPT_SLUGS = Object.keys(BY_SLUG);
