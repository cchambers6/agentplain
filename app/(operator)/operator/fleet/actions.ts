"use server";

// Server actions for the /operator/fleet activity inspector.
//
// Three actions, all operator-gated and all reading fresh from the DB on every
// call (no cached snapshot that can drift between page load and drill-in):
//
//   - loadMoreFleetActivityAction   — infinite-scroll pagination (cursor).
//   - loadFleetActivityDetailAction — drawer detail for one run.
//   - saveFleetEntryToMemoryAction  — "Save to memory" durable note.
//
// Per project_no_outbound_architecture.md these actions never send anything;
// they read, and the save action writes an internal AuditLog row only.

import { requireUser } from "@/lib/auth/server";
import { withSystemContext } from "@/lib/db/rls";
import type { Prisma } from "@prisma/client";
import {
  loadFleetActivityDetail,
  loadFleetActivityFeed,
  type FleetActivityDetail,
  type FleetActivityPage,
} from "@/lib/operator/fleet-activity";
import { parseFleetFilters } from "@/lib/operator/fleet-activity-filters";

async function assertOperator(): Promise<{ userId: string }> {
  const session = await requireUser();
  if (!session.isOperator) {
    throw new Error("Forbidden — operator only.");
  }
  return { userId: session.userId };
}

/**
 * Next page of the feed. The client passes the serialized filter query string
 * (so the server re-parses the exact same filters the URL encodes) plus the
 * opaque cursor from the previous page.
 */
export async function loadMoreFleetActivityAction(
  filterQuery: string,
  cursor: string,
): Promise<FleetActivityPage> {
  await assertOperator();
  const params = Object.fromEntries(new URLSearchParams(filterQuery));
  const filters = parseFleetFilters(params);
  return loadFleetActivityFeed({ filters, cursor, limit: 50 });
}

/** Full drawer detail for one run — fetched fresh on open. */
export async function loadFleetActivityDetailAction(
  skillRunId: string,
): Promise<FleetActivityDetail | null> {
  await assertOperator();
  return loadFleetActivityDetail(skillRunId);
}

/**
 * "Save to memory" — there is no agent/memory DB table in this codebase, so the
 * honest durable sink is an AuditLog row (the same append-only operator-notes
 * trail the inquiries triage surface writes to). Returns the saved note's id
 * so the client can confirm.
 */
export async function saveFleetEntryToMemoryAction(
  skillRunId: string,
  note: string,
): Promise<{ ok: true; auditLogId: string }> {
  const { userId } = await assertOperator();
  const detail = await loadFleetActivityDetail(skillRunId);
  if (!detail) {
    throw new Error(`Run ${skillRunId} not found.`);
  }
  const trimmed = note.trim().slice(0, 1000);

  const created = await withSystemContext((tx) =>
    tx.auditLog.create({
      data: {
        actorUserId: userId,
        workspaceId: detail.run.workspaceId,
        action: "operator.fleet.save_to_memory",
        targetTable: "SkillRun",
        targetId: skillRunId,
        payload: {
          skillSlug: detail.run.skillSlug,
          agentSlug: detail.run.agentSlug,
          status: detail.run.status,
          outcomeLine: detail.run.outcomeLine,
          firedAt: detail.run.firedAt,
          note: trimmed.length > 0 ? trimmed : null,
        } satisfies Prisma.InputJsonValue,
      },
      select: { id: true },
    }),
  );

  return { ok: true, auditLogId: created.id };
}
