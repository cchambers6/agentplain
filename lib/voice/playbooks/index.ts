/**
 * lib/voice/playbooks/index.ts
 *
 * Registry of voice playbooks, keyed by vertical slug. Resolution mirrors the
 * vertical content layer: a workspace's vertical selects its playbook, and any
 * vertical without a specialized flow falls back to the general receptionist.
 *
 * Adding a playbook: drop a `lib/voice/playbooks/<slug>/playbook.ts` exporting
 * a `VoicePlaybook`, then register it below. The test in this directory asserts
 * every registered playbook is well-formed and that each maps to a real
 * vertical slug (or the `general` sentinel).
 */

import type { Vertical } from '@prisma/client';
import { verticalSlugFromEnum } from '@/lib/auth/vertical-enum';
import type { VoicePlaybook } from '../types';
import { cpaAfterHoursIntake } from './cpa/playbook';
import { realEstateBuyerLeadCallback } from './real-estate/playbook';
import { lawInboundIntake } from './law/playbook';
import { propertyMgmtMaintenanceTriage } from './property-management/playbook';
import { generalReceptionist } from './general/playbook';

/** The default playbook for any vertical without a specialized flow. */
export const DEFAULT_PLAYBOOK = generalReceptionist;

/** Every playbook the layer ships, in display order. */
export const VOICE_PLAYBOOKS: readonly VoicePlaybook[] = [
  generalReceptionist,
  realEstateBuyerLeadCallback,
  cpaAfterHoursIntake,
  lawInboundIntake,
  propertyMgmtMaintenanceTriage,
];

const BY_SLUG: Record<string, VoicePlaybook> = Object.fromEntries(
  VOICE_PLAYBOOKS.map((p) => [p.verticalSlug, p]),
);

const BY_ID: Record<string, VoicePlaybook> = Object.fromEntries(
  VOICE_PLAYBOOKS.map((p) => [p.id, p]),
);

/** Resolve by the marketing vertical slug, falling back to general. */
export function playbookForVerticalSlug(slug: string | null | undefined): VoicePlaybook {
  if (!slug) return DEFAULT_PLAYBOOK;
  return BY_SLUG[slug] ?? DEFAULT_PLAYBOOK;
}

/** Resolve by the Prisma `Vertical` enum, falling back to general. */
export function playbookForVertical(vertical: Vertical | null | undefined): VoicePlaybook {
  if (!vertical) return DEFAULT_PLAYBOOK;
  return playbookForVerticalSlug(verticalSlugFromEnum(vertical));
}

/** Resolve by playbook id (used when an operator pins a specific flow). */
export function playbookById(id: string): VoicePlaybook | null {
  return BY_ID[id] ?? null;
}

export {
  cpaAfterHoursIntake,
  realEstateBuyerLeadCallback,
  lawInboundIntake,
  propertyMgmtMaintenanceTriage,
  generalReceptionist,
};
