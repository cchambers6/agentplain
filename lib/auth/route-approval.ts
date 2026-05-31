/**
 * lib/auth/route-approval.ts
 *
 * Wave-6 — central helper for the approval routing layer. Given a
 * (workspaceId, discipline), returns the userId that should be stamped
 * as `WorkApprovalQueueItem.requiredApproverUserId` — or null if no
 * head is assigned and routing should keep its default ("any qualified
 * member can approve").
 *
 * The helper lives here, NOT inside each skill's prisma-approval-sink,
 * so the wave-6b wave can wire the routing into every existing sink
 * without touching the per-skill logic. The sinks just call this once
 * per insert + pass the result into the create payload.
 *
 * Cold-start safe per `feedback_cold_start_safe_agents.md`: every call
 * reads the DisciplineHead row fresh — no in-memory cache. The lookup
 * is a single-row hit on the unique (workspaceId, discipline) index;
 * cheap.
 */

import type { Prisma } from '@prisma/client';
import { withSystemContext } from '../db';
import { asDisciplineId } from '../disciplines';

/**
 * Resolve the required approver for a new queue item in `discipline`.
 * Returns the head's userId, or null when no head is assigned.
 *
 * Pass `tx` to participate in an in-flight transaction; otherwise
 * `withSystemContext` opens one.
 */
export async function resolveRequiredApprover(
  workspaceId: string,
  discipline: string | null | undefined,
  tx?: Prisma.TransactionClient,
): Promise<string | null> {
  const id = asDisciplineId(discipline ?? null);
  if (!id) return null;

  const runner = async (
    client: Prisma.TransactionClient,
  ): Promise<string | null> => {
    const head = await client.disciplineHead.findUnique({
      where: { workspaceId_discipline: { workspaceId, discipline: id } },
      select: { userId: true },
    });
    return head?.userId ?? null;
  };

  if (tx) return runner(tx);
  return withSystemContext(runner);
}
