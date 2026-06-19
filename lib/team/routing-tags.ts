/**
 * lib/team/routing-tags.ts
 *
 * The work-label vocabulary that drives context-aware routing. A routing
 * tag is a coarse label the customer system (or a skill) stamps on a unit
 * of work — "this is a BILLING question", "this is URGENT" — that the
 * router maps to a person.
 *
 * Tags are deliberately separate from the 8 disciplines: a discipline is
 * what KIND of work it is (finance, legal); a tag is a routing SIGNAL
 * that may cut across disciplines (URGENT, INTAKE). Most tags map onto a
 * discipline so routing can reuse the existing DisciplineHead assignment
 * (`lib/auth/route-approval.ts`) with no new persistence; a few (URGENT,
 * INTAKE, ADMIN) are pure routing signals with no discipline home.
 *
 * Kept as a closed union so role-presets, the router, and the playbook
 * generator all reference the same names — a typo is a compile error.
 */

import type { DisciplineId } from '@/lib/disciplines';

export type RoutingTag =
  | 'URGENT'
  | 'BILLING'
  | 'FINANCE'
  | 'LEGAL'
  | 'DRAFTING'
  | 'INTAKE'
  | 'SCHEDULING'
  | 'MAINTENANCE'
  | 'TENANT'
  | 'LEASING'
  | 'MARKETING'
  | 'ADMIN';

/** Every tag, for validation + the routing-rules explainer UI. */
export const ROUTING_TAGS: readonly RoutingTag[] = [
  'URGENT',
  'BILLING',
  'FINANCE',
  'LEGAL',
  'DRAFTING',
  'INTAKE',
  'SCHEDULING',
  'MAINTENANCE',
  'TENANT',
  'LEASING',
  'MARKETING',
  'ADMIN',
] as const;

/**
 * Map a tag to the discipline whose head should receive it, when one
 * exists. Tags that are pure routing signals (URGENT escalates to owner;
 * INTAKE/ADMIN/SCHEDULING/MAINTENANCE are operational) resolve to
 * 'operations' or have no discipline home — the router handles those via
 * its rule order, not this map.
 */
export const TAG_TO_DISCIPLINE: Partial<Record<RoutingTag, DisciplineId>> = {
  BILLING: 'finance',
  FINANCE: 'finance',
  LEGAL: 'legal',
  DRAFTING: 'legal',
  MARKETING: 'marketing',
  SCHEDULING: 'operations',
  MAINTENANCE: 'operations',
  ADMIN: 'operations',
  INTAKE: 'customer-success',
  TENANT: 'customer-success',
  LEASING: 'sales-enablement',
};

/** Normalize free-text into a known tag (case-insensitive), else null. */
export function asRoutingTag(value: string | null | undefined): RoutingTag | null {
  if (!value) return null;
  const upper = value.trim().toUpperCase();
  return (ROUTING_TAGS as readonly string[]).includes(upper)
    ? (upper as RoutingTag)
    : null;
}
