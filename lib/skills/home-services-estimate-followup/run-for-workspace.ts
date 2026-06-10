/**
 * lib/skills/home-services-estimate-followup/run-for-workspace.ts
 *
 * Production entry point for the home-services estimate follow-up sweep.
 * Wires together:
 *
 *   1. `QuickbooksEstimateLookup` — fetches open (Pending) estimates from
 *      the workspace's QuickBooks Online account via the live QB MCP server.
 *   2. `runSkill` — classifies estimates by follow-up stage (day 2/5/10),
 *      renders polite nudge drafts, and builds a cold-handoff summary.
 *   3. `PrismaEstimateApprovalSink` — stages each draft as a
 *      WorkApprovalQueueItem (kind=FOLLOW_UP_NUDGE, status=PENDING) with the
 *      estimate $ in the payload.  The operator approves; the shop's own
 *      email client sends.
 *   4. `gateSkillFire` — vacation / schedule-window gate (same pattern as
 *      the chief-of-staff-scheduler and follow-up-chaser-general callers).
 *
 * Cold-start safe: every call constructs fresh instances; no state is reused
 * across fires.
 *
 * No-outbound: the skill DRAFTS.  No Twilio/SendGrid/direct-send surface.
 *
 * Per `feedback_parallel_waves_use_worktrees.md` / the memory rule:
 * this file is the production caller.  The hourly (or daily) Inngest cron
 * should invoke `runEstimateFollowupForWorkspace` for each home-services
 * workspace.
 */

import type { Prisma, PrismaClient } from '@prisma/client';
import { gateSkillFire } from '../fire-gate';
import { runSkill } from './skill';
import { PrismaEstimateApprovalSink } from './prisma-approval-sink';
import { QuickbooksEstimateLookup } from '@/lib/integrations/quickbooks-mcp/estimate-lookup';
import { buildQuickbooksMcpServer } from '@/lib/integrations/quickbooks-mcp';
import type { SkillResult } from '../types';
import type {
  EstimateApprovalSink,
  EstimateFollowupOutput,
  EstimateLookup,
} from './types';

export const ESTIMATE_FOLLOWUP_SKILL_SLUG = 'home-services-estimate-followup';
export const ESTIMATE_FOLLOWUP_DISCIPLINE_ID = 'sales-enablement';

export interface RunEstimateFollowupForWorkspaceInput {
  workspaceId: string;
  /** Rep / shop owner — signs the follow-up drafts.  Sourced from the
   *  workspace operator profile.  Phone is optional (used only if the
   *  operator wants it on the cold-handoff card). */
  rep: { name: string; email: string; phone: string | null };
  /** Override the lookup — defaults to `QuickbooksEstimateLookup`. Tests
   *  pass a `JsonEstimateLookup` seeded with deterministic fixtures. */
  lookup?: EstimateLookup;
  /** Override the sink — defaults to `PrismaEstimateApprovalSink`. Pass
   *  null to disable staging (dry-run). */
  sink?: EstimateApprovalSink | null;
  /** Prisma client override for tests (otherwise the sink opens its own
   *  RLS-scoped connection). */
  prismaClient?: PrismaClient;
  /** Transaction client — when provided, both the gate query and the sink
   *  write run inside the caller's transaction (useful for atomic cron
   *  runs that want to roll back on error). */
  tx?: Prisma.TransactionClient;
  now?: Date;
}

export async function runEstimateFollowupForWorkspace(
  input: RunEstimateFollowupForWorkspaceInput,
): Promise<SkillResult<EstimateFollowupOutput>> {
  const now = input.now ?? new Date();

  // ── 1. Fire gate ──────────────────────────────────────────────────────────
  // Honour the operator's vacation pause + schedule window before making any
  // QB API call or staging any draft.
  if (input.tx) {
    const gate = await gateSkillFire({
      tx: input.tx,
      workspaceId: input.workspaceId,
      skillSlug: ESTIMATE_FOLLOWUP_SKILL_SLUG,
      disciplineId: ESTIMATE_FOLLOWUP_DISCIPLINE_ID,
      now,
    });
    if (!gate.allowed) {
      // Non-error skip — the operator deliberately paused the skill.
      // Return an empty-but-valid output so callers don't need to handle
      // a gate-denied case specially.
      return {
        ok: true,
        value: {
          estimates: [],
          stageCounts: {
            fresh: 0,
            'soft-nudge': 0,
            'check-in': 0,
            'last-call': 0,
            cold: 0,
          },
          drafts: [],
          coldHandoff: {
            needed: false,
            coldEstimateIds: [],
            message: `Skill skipped — gate denied: ${gate.reason}.`,
          },
        },
      };
    }
  }

  // ── 2. Resolve lookup ─────────────────────────────────────────────────────
  const lookup: EstimateLookup =
    input.lookup ??
    new QuickbooksEstimateLookup({
      serverFactory: buildQuickbooksMcpServer,
      rep: input.rep,
    });

  // ── 3. Resolve sink ───────────────────────────────────────────────────────
  const sink: EstimateApprovalSink | null =
    input.sink === undefined
      ? new PrismaEstimateApprovalSink(
          input.prismaClient ? { client: input.prismaClient } : input.tx ? { tx: input.tx } : {},
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
