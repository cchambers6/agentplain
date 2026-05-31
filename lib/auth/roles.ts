/**
 * lib/auth/roles.ts
 *
 * Wave-6 role policy. The Phase-1 schema shipped only two Role values
 * (BROKER_OWNER, AGENT). Wave-6 generalized that to a four-tier model
 * (OWNER, ADMIN, MEMBER, VIEWER) without breaking the existing two-value
 * data: the policy here treats BROKER_OWNER≡OWNER and AGENT≡MEMBER so
 * every Phase-1 membership row reads as the same effective tier under
 * the new policy.
 *
 * Tiers, lowest to highest:
 *
 *   VIEWER   — read-only on everything the user can see.
 *   MEMBER   — approve / configure within disciplines, edit own memory.
 *   ADMIN    — workspace settings, role assignment (cannot assign OWNER,
 *              cannot change billing, cannot delete workspace).
 *   OWNER    — everything: billing, deletion, role assignment to any
 *              tier including OWNER.
 *
 * `asRoleTier(role)` normalizes the DB enum to the tier integer; every
 * gate uses that integer comparison so legacy and new values both work.
 */

import type { Role } from '@prisma/client';

/** Numeric tier — higher = more privileged. */
export const enum RoleTier {
  VIEWER = 0,
  MEMBER = 1,
  ADMIN = 2,
  OWNER = 3,
}

/**
 * Normalize a DB Role to its policy tier. The legacy values
 * BROKER_OWNER and AGENT map to OWNER and MEMBER respectively so the
 * Phase-1 single-owner workspaces continue to behave as they always
 * have.
 */
export function asRoleTier(role: Role): RoleTier {
  switch (role) {
    case 'BROKER_OWNER':
    case 'OWNER':
      return RoleTier.OWNER;
    case 'ADMIN':
      return RoleTier.ADMIN;
    case 'AGENT':
    case 'MEMBER':
      return RoleTier.MEMBER;
    case 'VIEWER':
      return RoleTier.VIEWER;
    default: {
      // Exhaustiveness — surfaces a TS error if a new Role value lands
      // without an update here, so the policy stays in sync with the
      // schema.
      const _exhaustive: never = role;
      throw new Error(`asRoleTier: unhandled role ${_exhaustive as string}`);
    }
  }
}

/** True if `role` meets or exceeds the `min` tier. */
export function roleAtLeast(role: Role, min: RoleTier): boolean {
  return asRoleTier(role) >= min;
}

/**
 * Action policy — the truth table that maps an abstract action name to
 * a minimum tier. Every gated server action / page loader looks up the
 * action here so the policy is in one place.
 */
export type RoleAction =
  /** Read any workspace-visible surface (queue, scorecards, settings). */
  | 'workspace.read'
  /** Approve / reject / send-back work approval items the user can act on. */
  | 'work.approve'
  /** Configure a skill (install, uninstall, set per-skill params). */
  | 'skill.configure'
  /** Edit workspace-level settings that are NOT billing + NOT deletion. */
  | 'workspace.settings.write'
  /** Manage roster — invite, remove, change role of MEMBER / VIEWER. */
  | 'roster.write'
  /** Assign / unassign a DisciplineHead. */
  | 'discipline.head.assign'
  /** Promote a user to ADMIN, or assign / revoke the OWNER role. */
  | 'roster.write.owner'
  /** Billing surfaces — payment method, invoice download, plan change. */
  | 'billing.write'
  /** Initiate workspace closure / deletion. */
  | 'workspace.delete';

const ACTION_MIN_TIER: Record<RoleAction, RoleTier> = {
  'workspace.read': RoleTier.VIEWER,
  'work.approve': RoleTier.MEMBER,
  'skill.configure': RoleTier.ADMIN,
  'workspace.settings.write': RoleTier.ADMIN,
  'roster.write': RoleTier.ADMIN,
  'discipline.head.assign': RoleTier.OWNER,
  'roster.write.owner': RoleTier.OWNER,
  'billing.write': RoleTier.OWNER,
  'workspace.delete': RoleTier.OWNER,
};

/**
 * True if `role` is allowed to perform `action`. Synchronous + pure so
 * UI surfaces can use it for "is this button visible" rendering without
 * spawning extra DB reads.
 */
export function canPerform(role: Role, action: RoleAction): boolean {
  return asRoleTier(role) >= ACTION_MIN_TIER[action];
}

/** Human-readable label for a role — used in the roster + audit views. */
export function roleLabel(role: Role): string {
  switch (asRoleTier(role)) {
    case RoleTier.OWNER:
      return 'Owner';
    case RoleTier.ADMIN:
      return 'Admin';
    case RoleTier.MEMBER:
      return 'Member';
    case RoleTier.VIEWER:
      return 'Viewer';
  }
}
