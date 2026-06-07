// POST /api/mobile/workspace/[id]/approvals/[itemId]/reject
//
// Reject a pending item, optional `{ reason }`. A reason is captured as a
// preference signal so the next draft reflects the pushback (shared core with
// the web server actions — lib/approvals/decisions).

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireMobileWorkspaceMember } from "@/lib/auth";
import { decideApproval, ApprovalDecisionError } from "@/lib/approvals/decisions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ParamsSchema = z.object({
  id: z.string().uuid(),
  itemId: z.string().uuid(),
});
const BodySchema = z.object({ reason: z.string().trim().max(2000).optional() });

interface RouteContext {
  params: Promise<{ id: string; itemId: string }>;
}

function errStatus(e: ApprovalDecisionError): number {
  switch (e.code) {
    case "NOT_FOUND":
      return 404;
    case "ALREADY_DECIDED":
      return 409;
    default:
      return 400;
  }
}

export async function POST(
  req: NextRequest,
  context: RouteContext,
): Promise<NextResponse> {
  const params = ParamsSchema.safeParse(await context.params);
  if (!params.success) {
    return NextResponse.json({ error: "invalid ids" }, { status: 400 });
  }
  const { id: workspaceId, itemId } = params.data;

  const member = await requireMobileWorkspaceMember(req, workspaceId, [
    "BROKER_OWNER",
  ]);
  if (!member) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let reason: string | null = null;
  try {
    const raw = await req.json();
    const parsed = BodySchema.safeParse(raw ?? {});
    if (parsed.success && parsed.data.reason) reason = parsed.data.reason;
  } catch {
    // no body — plain reject
  }

  const ctx = { userId: member.userId, workspaceId, isOperator: false };
  try {
    await decideApproval(ctx, { workspaceId, itemId, decision: "REJECTED", reason });
  } catch (e) {
    if (e instanceof ApprovalDecisionError) {
      return NextResponse.json({ error: e.message }, { status: errStatus(e) });
    }
    throw e;
  }

  return NextResponse.json({ ok: true });
}
