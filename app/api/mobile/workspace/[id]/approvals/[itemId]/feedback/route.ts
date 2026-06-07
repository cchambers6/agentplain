// POST /api/mobile/workspace/[id]/approvals/[itemId]/feedback
//
// "Doesn't sound like us" — categorized feedback on a draft (PR #153 closed-
// loop substrate). Does NOT decide the item; the draft stays in the queue.
// Shares the web server-action core (lib/approvals/decisions).

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireMobileWorkspaceMember } from "@/lib/auth";
import { FEEDBACK_CATEGORIES, FEEDBACK_REASON_MAX_CHARS } from "@/lib/feedback";
import { submitDraftFeedback, ApprovalDecisionError } from "@/lib/approvals/decisions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ParamsSchema = z.object({
  id: z.string().uuid(),
  itemId: z.string().uuid(),
});
const BodySchema = z.object({
  targetSkillSlug: z.string().min(1).max(200),
  category: z.enum(FEEDBACK_CATEGORIES),
  reason: z.string().trim().min(1).max(FEEDBACK_REASON_MAX_CHARS),
});

interface RouteContext {
  params: Promise<{ id: string; itemId: string }>;
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

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json body" }, { status: 400 });
  }
  const parsed = BodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid feedback" }, { status: 400 });
  }

  const ctx = { userId: member.userId, workspaceId, isOperator: false };
  try {
    await submitDraftFeedback(ctx, {
      workspaceId,
      approvalItemId: itemId,
      targetSkillSlug: parsed.data.targetSkillSlug,
      category: parsed.data.category,
      reason: parsed.data.reason,
    });
  } catch (e) {
    if (e instanceof ApprovalDecisionError) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    throw e;
  }

  return NextResponse.json({ ok: true });
}
