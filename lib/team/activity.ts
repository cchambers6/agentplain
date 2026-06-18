/**
 * lib/team/activity.ts
 *
 * Per-member activity model + the role-based visibility rule (item 9 of
 * the 2026-06-17 strategic build). The owner asks "what did each person
 * handle?" — but a staff member should NOT see a teammate's customer
 * detail. So visibility is policy, not presentation:
 *
 *   - OWNER / ADMIN (owner + manager) → see the whole team's activity.
 *   - MEMBER (staff)                  → see their OWN activity + items
 *                                       routed/assigned to them.
 *   - VIEWER                          → see their own only.
 *
 * The filter is pure so it can be unit-tested and reused by both the team
 * page and any API. PII protection: when an entry is filtered out it is
 * REMOVED, not redacted — a staff member never receives a teammate's
 * customer-bearing payload at all (per the build's "don't expose other
 * members' PII to staff" constraint).
 */

import type { Role } from '@prisma/client';
import { asRoleTier, RoleTier } from '@/lib/auth/roles';

/** One handled unit of work, attributed to the member who handled it. */
export interface ActivityEntry {
  id: string;
  /** Who decided/handled this. Null = handled by the fleet (auto). */
  actorUserId: string | null;
  /** Display name for the actor (already resolved; never raw email PII
   *  beyond what the viewer may see). */
  actorLabel: string;
  /** What happened, customer-safe ("Approved a billing reminder"). */
  summary: string;
  /** Discipline tag, if any. */
  discipline: string | null;
  /** When it happened. */
  occurredAt: Date;
  /** The member this work was routed/assigned to (for staff "assigned to
   *  me" visibility). May equal actorUserId. */
  assignedUserId?: string | null;
}

/**
 * Filter a full activity list down to what `viewer` is allowed to see.
 * Pure — no I/O.
 *
 * @param viewerRole   the viewer's workspace Role
 * @param viewerUserId the viewer's user id
 * @param entries      the complete, unfiltered activity list
 */
export function visibleActivityFor(
  viewerRole: Role,
  viewerUserId: string,
  entries: ActivityEntry[],
): ActivityEntry[] {
  // Managers and owners see everything.
  if (asRoleTier(viewerRole) >= RoleTier.ADMIN) return entries;

  // Staff + viewers see only what they acted on or that's assigned to them.
  return entries.filter(
    (e) => e.actorUserId === viewerUserId || e.assignedUserId === viewerUserId,
  );
}

/** True if `viewerRole` may see the whole team's activity. */
export function canSeeAllActivity(viewerRole: Role): boolean {
  return asRoleTier(viewerRole) >= RoleTier.ADMIN;
}
