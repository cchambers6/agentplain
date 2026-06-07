// POST /api/mobile/workspace/[id]/approvals/[itemId]/approve
//
// Approve a pending item. Optional `{ body }` first edits the draft (re-
// encrypted on write + captured as a preference signal) then approves — this
// is the "Approve edited" path from the mobile edit drawer. Shares the exact
// decision core with the web /approvals server actions (lib/approvals/
// decisions) so audit + signal capture never drift between surfaces.

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireMobileWorkspaceMember } from "@/lib/auth";
import {
  decideApproval,
  editApprovalDraft,
  ApprovalDecisionError,
} from "@/lib/approvals/decisions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ParamsSchema = z.object({
  id: z.string().uuid(),
  itemId: z.string().uuid(),
});
const BodySchema = z.object({ body: z.string().max(50_000).optional() });

interface RouteContext {
  params: Promise<{ id: string; itemId: string }>;
}

function errStatus(e: ApprovalDecisionError): number {
  switch (e.code) {
    case "NOT_FOUND":
      return 404;
    case "ALREADY_DECIDED":
      return 409;
    case "TOO_LONG":
      return 413;
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

  // Body is optional; tolerate an empty/absent JSON body.
  let editBody: string | undefined;
  try {
    const raw = await req.json();
    const parsed = BodySchema.safeParse(raw ?? {});
    if (parsed.success) editBody = parsed.data.body;
  } catch {
    // no body — plain approve
  }

  const ctx = { userId: member.userId, workspaceId, isOperator: false };
  try {
    if (typeof editBody === "string") {
      await editApprovalDraft(ctx, { workspaceId, itemId, body: editBody });
    }
    await decideApproval(ctx, { workspaceId, itemId, decision: "APPROVED" });
  } catch (e) {
    if (e instanceof ApprovalDecisionError) {
      return NextResponse.json({ error: e.message }, { status: errStatus(e) });
    }
    throw e;
  }

  return NextResponse.json({ ok: true });
}
