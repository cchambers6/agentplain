/**
 * /operator/leadership-board — auth-gated server page.
 *
 * The route group's layout (`app/(operator)/layout.tsx`) already enforces
 * `isOperator`; we re-assert here for defense in depth — the same pattern
 * `/operator/integrations` follows.
 *
 * Per `feedback_runner_portability.md`: the data is sourced through
 * `LeadershipDataSource`. The page never knows whether it came from a
 * JSON snapshot or a future DB-backed adapter.
 *
 * Per `project_no_outbound_architecture.md`: this route is read-only — no
 * mutations, no outbound vendor calls. `force-dynamic` re-reads the snapshot
 * on every render, so there is no manual "refresh" affordance (it would be a
 * no-op against an always-fresh page); the snapshot is regenerated out-of-band
 * by `scripts/snapshot-leadership-state.ts`.
 */

import { requireUser } from "@/lib/auth/server";
import {
  classifyBoard,
  type ClassifiedBoard,
} from "@/lib/operator/leadership-data";
import { defaultLeadershipDataSource } from "@/lib/operator/leadership-data-snapshot";
import LeadershipBoardView from "./LeadershipBoardView";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function OperatorLeadershipBoardPage() {
  const session = await requireUser();
  if (!session.isOperator) {
    return <div className="container-wide py-12">Forbidden.</div>;
  }

  const snapshot = await defaultLeadershipDataSource.load();
  const now = new Date();
  const board: ClassifiedBoard = classifyBoard(snapshot, now);

  return <LeadershipBoardView board={board} now={now} />;
}
