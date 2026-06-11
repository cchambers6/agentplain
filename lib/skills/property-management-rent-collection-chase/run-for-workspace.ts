/**
 * lib/skills/property-management-rent-collection-chase/run-for-workspace.ts
 *
 * Production entry point for the property-management rent-collection chase.
 * Wires together:
 *
 *   1. `BuildiumRentRollLookup` — fetches delinquent leases from the
 *      workspace's Buildium account via the live Buildium MCP server
 *      (gated by BUILDIUM_ADAPTER_LIVE=on; fixtures otherwise).
 *   2. `runSkill` — buckets each unit by days-past-due (grace / soft-chase /
 *      formal-notice / escalation), renders the per-tenant chase draft, and
 *      builds the owner-review queue for escalations.
 *   3. `PrismaRentChaseApprovalSink` — stages each draft as a
 *      WorkApprovalQueueItem (kind=FOLLOW_UP_NUDGE, status=PENDING) carrying
 *      the unit's outstanding balance. The PM approves; the customer's own
 *      mailbox sends.
 *   4. `gateSkillFire` — vacation / schedule-window gate (same pattern as the
 *      home-services estimate-followup caller).
 *
 * Cold-start safe: every call constructs fresh instances; no state is reused
 * across fires (`feedback_cold_start_safe_agents.md`).
 *
 * No-outbound: the skill DRAFTS. No Twilio/SendGrid/direct-send surface
 * (`project_no_outbound_architecture.md`).
 *
 * Honesty seam: when Buildium isn't connected (no credential / 401) the
 * BuildiumRentRollLookup returns a NOT_CONFIGURED skill error — the sweep
 * surfaces it rather than fabricating delinquent units.
 */

import type { Prisma, PrismaClient } from '@prisma/client';
import { gateSkillFire } from '../fire-gate';
import { runSkill } from './skill';
import { BuildiumRentRollLookup } from './buildium-lookup';
import { PrismaRentChaseApprovalSink } from './prisma-approval-sink';
import type { SkillResult } from '../types';
import type {
  RentChaseApprovalSink,
  RentCollectionChaseOutput,
  RentRollLookup,
} from './types';

export const RENT_COLLECTION_CHASE_SKILL_SLUG =
  'property-management-rent-collection-chase';
export const RENT_COLLECTION_CHASE_DISCIPLINE_ID = 'finance';

export interface RunRentCollectionChaseForWorkspaceInput {
  workspaceId: string;
  /** Override the lookup — defaults to `BuildiumRentRollLookup`. Tests pass a
   *  `JsonRentRollLookup` seeded with deterministic fixtures. */
  lookup?: RentRollLookup;
  /** Override the sink — defaults to `PrismaRentChaseApprovalSink`. Pass null
   *  to disable staging (dry-run). */
  sink?: RentChaseApprovalSink | null;
  /** Prisma client override for tests. */
  prismaClient?: PrismaClient;
  /** Transaction client — when provided, the gate query + sink writes run
   *  inside the caller's transaction. */
  tx?: Prisma.TransactionClient;
  now?: Date;
}

export async function runRentCollectionChaseForWorkspace(
  input: RunRentCollectionChaseForWorkspaceInput,
): Promise<SkillResult<RentCollectionChaseOutput>> {
  const now = input.now ?? new Date();

  // ── 1. Fire gate ──────────────────────────────────────────────────────────
  // Honour the operator's vacation pause + schedule window before any Buildium
  // call or staged draft.
  if (input.tx) {
    const gate = await gateSkillFire({
      tx: input.tx,
      workspaceId: input.workspaceId,
      skillSlug: RENT_COLLECTION_CHASE_SKILL_SLUG,
      disciplineId: RENT_COLLECTION_CHASE_DISCIPLINE_ID,
      now,
    });
    if (!gate.allowed) {
      // Non-error skip — the operator deliberately paused the skill. Return an
      // empty-but-valid output so callers don't special-case gate denial.
      return {
        ok: true,
        value: {
          units: [],
          bucketCounts: {
            grace: 0,
            'soft-chase': 0,
            'formal-notice': 0,
            escalation: 0,
          },
          drafts: [],
          ownerReview: [],
        },
      };
    }
  }

  // ── 2. Resolve lookup ─────────────────────────────────────────────────────
  const lookup: RentRollLookup =
    input.lookup ?? new BuildiumRentRollLookup({ workspaceId: input.workspaceId });

  // ── 3. Resolve sink ───────────────────────────────────────────────────────
  const sink: RentChaseApprovalSink | null =
    input.sink === undefined
      ? new PrismaRentChaseApprovalSink(
          input.prismaClient
            ? { client: input.prismaClient }
            : input.tx
              ? { tx: input.tx }
              : {},
        )
      : (input.sink ?? null);

  // ── 4. Run the skill ──────────────────────────────────────────────────────
  return runSkill({
    workspaceId: input.workspaceId,
    lookup,
    sink,
    now,
  });
}
