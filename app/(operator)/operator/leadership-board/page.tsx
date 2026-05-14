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
 * Per `project_no_outbound_architecture.md`: the only mutation is
 * `revalidatePath('/operator/leadership-board')`. No outbound vendor
 * calls fire from this route.
 */

import { revalidatePath } from "next/cache";
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

  return (
    <LeadershipBoardView
      board={board}
      now={now}
      refreshAction={refreshAction}
    />
  );
}

async function refreshAction(): Promise<void> {
  "use server";
  // The snapshot file is regenerated out-of-band by
  // `scripts/snapshot-leadership-state.ts`. The action's job is to drop
  // any Next.js data cache so the page re-reads the file on next
  // render. Re-running the build-time script from inside a serverless
  // function is intentionally out of scope — the v2 DB-backed adapter
  // makes this action a no-op for cache busting only.
  revalidatePath("/operator/leadership-board");
}
