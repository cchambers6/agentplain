/**
 * lib/team/routing.ts
 *
 * Context-aware work routing for multi-employee workspaces (item 9 of the
 * 2026-06-17 strategic build). Given a unit of work and its context, decide
 * WHICH team member should handle it:
 *
 *   - if it's URGENT                       → the owner
 *   - if intake explicitly assigned a staff member → that person
 *   - if it carries a tag (BILLING, LEGAL…)→ that tag's discipline head
 *   - else if it has a discipline          → that discipline's head
 *   - else                                 → unrouted (any qualified member)
 *
 * This layers ON TOP of the existing wave-6 routing (`route-approval.ts`,
 * which resolves a discipline → its assigned head). The richer rules here
 * cover the cases discipline-alone can't: cross-discipline urgency and
 * intake-time staff assignment. Critically it requires NO new persistence
 * — the only durable inputs are Membership rows and DisciplineHead rows,
 * both of which already exist. Tag→person resolves through the discipline
 * head a tag maps to (`routing-tags.ts`).
 *
 * The core (`routeWork`) is a pure function: given the roster, the
 * discipline-head map, and the owner, it returns a decision with no I/O.
 * The DB-backed `resolveWorkRouting` reads those inputs fresh on every
 * call (cold-start safe per `feedback_cold_start_safe_agents`) and defers
 * to the core. Keeping the decision pure makes every rule unit-testable
 * without a database.
 */

import type { Prisma, Role } from '@prisma/client';
import { withSystemContext } from '@/lib/db';
import { asDisciplineId, type DisciplineId } from '@/lib/disciplines';
import { asRoleTier } from '@/lib/auth/roles';
import {
  asRoutingTag,
  TAG_TO_DISCIPLINE,
  type RoutingTag,
} from './routing-tags';

/** A workspace member as the router needs to see them. */
export interface RosterMember {
  userId: string;
  role: Role;
}

/** The context attached to a unit of work being routed. */
export interface RoutingContext {
  /** The work's discipline, if known (one of the 8, or null). */
  discipline?: string | null;
  /** Coarse routing labels (BILLING, URGENT…). Free-text is normalized;
   *  unknown tokens are ignored. */
  tags?: string[];
  /** True when the work is time-critical — escalates to the owner. Also
   *  inferred from an URGENT tag. */
  urgent?: boolean;
  /** A staff member intake explicitly assigned this work to. Honored only
   *  if that user is an active member. */
  assignedStaffUserId?: string | null;
}

/** Which rule produced the decision — surfaced in the UI + playbook. */
export type RoutingRule =
  | 'urgent-to-owner'
  | 'intake-assigned-staff'
  | 'tag-to-discipline-head'
  | 'discipline-head'
  | 'unrouted';

export interface RoutingDecision {
  /** The chosen member, or null when the work is left for any qualified
   *  member to pick up (the single-owner / no-head default). */
  targetUserId: string | null;
  /** The rule that fired. */
  rule: RoutingRule;
  /** Human-readable explanation, for the activity feed + routing-rules
   *  settings surface. */
  reason: string;
  /** The tag or discipline that drove the decision, when applicable. */
  via?: RoutingTag | DisciplineId | null;
}

/** Normalize a context's tags + urgent flag into a deduped tag list. */
function resolveTags(context: RoutingContext): RoutingTag[] {
  const out = new Set<RoutingTag>();
  for (const raw of context.tags ?? []) {
    const tag = asRoutingTag(raw);
    if (tag) out.add(tag);
  }
  if (context.urgent) out.add('URGENT');
  return [...out];
}

/** Highest-tier member (the owner), or null on an empty roster. */
function findOwner(roster: RosterMember[]): RosterMember | null {
  let best: RosterMember | null = null;
  for (const m of roster) {
    if (!best || asRoleTier(m.role) > asRoleTier(best.role)) best = m;
  }
  return best;
}

/**
 * Pure routing decision. No I/O — give it the roster, the discipline→head
 * map, and it returns who should handle the work.
 *
 * @param context        the work + its labels
 * @param roster         active members of the workspace
 * @param disciplineHeads map of discipline id → head userId (the wave-6
 *                        DisciplineHead assignments)
 */
export function routeWork(
  context: RoutingContext,
  roster: RosterMember[],
  disciplineHeads: ReadonlyMap<string, string>,
): RoutingDecision {
  const memberIds = new Set(roster.map((m) => m.userId));
  const tags = resolveTags(context);

  // Rule 1 — URGENT beats everything. Time-critical work goes to the
  // owner, who can triage or reassign. (Owner is the highest tier.)
  if (tags.includes('URGENT')) {
    const owner = findOwner(roster);
    if (owner) {
      return {
        targetUserId: owner.userId,
        rule: 'urgent-to-owner',
        reason: 'Marked urgent — routed to the owner to triage.',
        via: 'URGENT',
      };
    }
  }

  // Rule 2 — intake explicitly assigned a staff member. Honor it as long
  // as they're still an active member.
  if (context.assignedStaffUserId && memberIds.has(context.assignedStaffUserId)) {
    return {
      targetUserId: context.assignedStaffUserId,
      rule: 'intake-assigned-staff',
      reason: 'Intake assigned this directly to a team member.',
      via: null,
    };
  }

  // Rule 3 — a routing tag (other than URGENT) maps to a discipline whose
  // head, if assigned, receives it. This is how "BILLING → bookkeeper"
  // works: BILLING maps to the finance discipline; its head is the
  // bookkeeper the owner nominated.
  for (const tag of tags) {
    if (tag === 'URGENT') continue;
    const discipline = TAG_TO_DISCIPLINE[tag];
    if (!discipline) continue;
    const headId = disciplineHeads.get(discipline);
    if (headId && memberIds.has(headId)) {
      return {
        targetUserId: headId,
        rule: 'tag-to-discipline-head',
        reason: `Tagged ${tag} → routed to the ${discipline} lead.`,
        via: tag,
      };
    }
  }

  // Rule 4 — fall back to the work's own discipline head.
  const discipline = asDisciplineId(context.discipline ?? null);
  if (discipline) {
    const headId = disciplineHeads.get(discipline);
    if (headId && memberIds.has(headId)) {
      return {
        targetUserId: headId,
        rule: 'discipline-head',
        reason: `Routed to the ${discipline} lead.`,
        via: discipline,
      };
    }
  }

  // Rule 5 — nobody specific. Leave it open for any qualified member.
  return {
    targetUserId: null,
    rule: 'unrouted',
    reason: 'No specific owner — any qualified member can pick this up.',
    via: null,
  };
}

/**
 * DB-backed router. Reads the active roster + discipline-head assignments
 * fresh, then defers to the pure core. Pass `tx` to participate in an
 * in-flight transaction (e.g. the same insert that creates the queue
 * item); otherwise a system-context transaction is opened.
 *
 * Returns a decision whose `targetUserId` is suitable to stamp onto
 * `WorkApprovalQueueItem.requiredApproverUserId`.
 */
export async function resolveWorkRouting(
  workspaceId: string,
  context: RoutingContext,
  tx?: Prisma.TransactionClient,
): Promise<RoutingDecision> {
  const runner = async (
    client: Prisma.TransactionClient,
  ): Promise<RoutingDecision> => {
    const [members, heads] = await Promise.all([
      client.membership.findMany({
        where: { workspaceId, status: 'ACTIVE', removedAt: null },
        select: { userId: true, role: true },
      }),
      client.disciplineHead.findMany({
        where: { workspaceId },
        select: { discipline: true, userId: true },
      }),
    ]);
    const headMap = new Map(heads.map((h) => [h.discipline, h.userId]));
    return routeWork(context, members, headMap);
  };

  if (tx) return runner(tx);
  return withSystemContext(runner);
}
