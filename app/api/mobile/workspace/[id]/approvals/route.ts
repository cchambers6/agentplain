// GET /api/mobile/workspace/[id]/approvals
//
// Returns PENDING approval-queue items for the workspace. Powers the read side
// of the mobile approvals queue (V1 screen #4). The mutation side (approve /
// edit / "doesn't sound like us" feedback) is intentionally NOT exposed here:
// the decision path runs through the closed-loop feedback substrate + RLS-gated
// decision actions, which warrant their own reviewed PR. V1 ships the queue
// read; the swipe actions wire in iteration 2.
//
// JSON twin of the web approvals page loader
// (app/(product)/app/workspace/[id]/approvals/page.tsx): same membership gate,
// same withRls read. payload is the customer's own work product, returned as-is
// for the detail view — RLS + the membership gate bound it to the owner.

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireMobileWorkspaceMember } from "@/lib/auth";
import { withRls } from "@/lib/db";
import { decryptPayloadForRead } from "@/lib/security/payload-crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ParamsSchema = z.object({ id: z.string().uuid() });

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(
  req: NextRequest,
  context: RouteContext,
): Promise<NextResponse> {
  const params = ParamsSchema.safeParse(await context.params);
  if (!params.success) {
    return NextResponse.json({ error: "invalid workspace id" }, { status: 400 });
  }
  const workspaceId = params.data.id;

  const member = await requireMobileWorkspaceMember(req, workspaceId, [
    "BROKER_OWNER",
  ]);
  if (!member) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const ctx = { userId: member.userId, workspaceId, isOperator: false };
  const rows = await withRls(ctx, (tx) =>
    tx.workApprovalQueueItem.findMany({
      where: { workspaceId, status: "PENDING" },
      orderBy: { proposedAt: "desc" },
      take: 50,
      select: {
        id: true,
        agentSlug: true,
        kind: true,
        discipline: true,
        payload: true,
        proposedAt: true,
      },
    }),
  );

  return NextResponse.json({
    approvals: rows.map((r) => ({
      id: r.id,
      agentSlug: r.agentSlug,
      kind: r.kind,
      discipline: r.discipline,
      // Decrypt the at-rest envelope so the app shows real draft text (and can
      // pre-fill the edit drawer). RLS + the membership gate already bound this
      // to the owner — same decrypt-for-read the web approvals page does.
      payload: decryptPayloadForRead(r.payload),
      proposedAt: r.proposedAt.toISOString(),
    })),
  });
}
