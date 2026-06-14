/**
 * lib/support/tickets/context.ts
 *
 * Auto-attach the workspace context a staff member needs to help WITHOUT
 * asking the customer to re-explain their setup: vertical, plan, which
 * integrations are connected, Plaino's recent state, and the last few action-
 * queue items. Captured at ticket-creation time as a point-in-time snapshot.
 *
 * BEST-EFFORT BY DESIGN: every lookup is individually guarded. Context
 * gathering must NEVER block or fail ticket creation — a customer in trouble
 * gets their ticket even if we can't read their integration list. Any field
 * we can't resolve is simply omitted.
 *
 * Reads under the system context (the caller has already asserted workspace
 * membership at the action layer).
 */

import { withSystemContext } from "../../db/rls";
import type { TicketContextSnapshot } from "./types";

export async function buildTicketContext(
  workspaceId: string,
  now: Date = new Date(),
): Promise<TicketContextSnapshot> {
  const snapshot: TicketContextSnapshot = {
    vertical: null,
    plan: null,
    integrationsConnected: [],
    recentQueueItems: [],
    plainoState: null,
    capturedAt: now.toISOString(),
  };

  try {
    await withSystemContext(async (tx) => {
      const ws = await tx.workspace.findUnique({
        where: { id: workspaceId },
        select: {
          vertical: true,
          verticalTier: true,
          setupDeactivatedAt: true,
          subscription: { select: { status: true } },
        },
      });
      if (ws) {
        snapshot.vertical = ws.vertical ?? null;
        snapshot.plan = ws.verticalTier ?? null;
        snapshot.plainoState = derivePlainoState(ws);
      }

      const integrations = await tx.integrationCredential.findMany({
        where: { workspaceId },
        select: { provider: true },
        orderBy: { createdAt: "asc" },
      });
      snapshot.integrationsConnected = Array.from(
        new Set(integrations.map((i) => String(i.provider))),
      );

      const queue = await tx.workApprovalQueueItem.findMany({
        where: { workspaceId },
        orderBy: { proposedAt: "desc" },
        take: 3,
        select: { kind: true, status: true, proposedAt: true },
      });
      snapshot.recentQueueItems = queue.map(
        (q) => `${q.kind} (${q.status})`,
      );
    });
  } catch {
    // Swallow — a context-read failure must not block the ticket. The
    // snapshot returns with whatever we managed to fill in.
  }

  return snapshot;
}

function derivePlainoState(ws: {
  setupDeactivatedAt: Date | null;
  subscription: { status: string } | null;
}): string {
  if (ws.setupDeactivatedAt) return "On standby — signup not completed (checkout abandoned).";
  const status = ws.subscription?.status;
  if (status === "PAUSED") return "Paused — billing paused.";
  if (status === "PAST_DUE") return "Paused — billing past due.";
  if (status) return `Active — subscription ${status}.`;
  return "Active.";
}
