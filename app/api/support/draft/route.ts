// POST /api/support/draft — the in-app support chat's draft-into-review
// hand-off. When the support chat can't resolve a question (the customer
// wants a human, or it needs an account-specific change), the widget posts
// the issue here.
//
// This REUSES the shipped support draft-into-review pipeline rather than
// forking a parallel one: it calls submitSupportRequest, which persists a
// SupportRequest and fires `agentplain/support-request.created`. The
// support-handler fleet (lib/inngest/functions/support-handler-on-create)
// then drafts a first-touch reply into the operator approval queue as a
// WorkApprovalQueueItem of kind SUPPORT_HANDLER_REPLY_DRAFT — the
// "support response" draft the operator reviews at /operator/support.
//
// Why reuse the existing kind instead of adding a new `support_response`
// enum value: the operator review surface, the resolve-reply flow, the
// recent-status banner, and the analytics all already key on
// SUPPORT_HANDLER_REPLY_DRAFT. A second near-identical kind would fork that
// surface and leave a half-wired review path — the cheap fix, not the best
// one (feedback_no_quick_fixes). The chat is simply a second intake into
// the one review queue.
//
// No-outbound (project_no_outbound_architecture): nothing is sent to the
// customer here. The draft lands in the operator queue for review.

import { NextResponse } from "next/server";
import { z } from "zod";
import { readSession } from "@/lib/auth/session";
import { withSystemContext } from "@/lib/db/rls";
import { servicePartnerForWorkspace } from "@/lib/onboarding/service-partner";
import { submitSupportRequest } from "@/lib/support";

export const runtime = "nodejs";

const draftSchema = z.object({
  workspaceId: z.string().uuid(),
  subject: z.string().trim().min(3).max(200),
  body: z.string().trim().min(10).max(5000),
  // Soft link back to the conversation that produced the request (logged
  // on the SupportRequest's audit trail, not required).
  conversationId: z.string().uuid().optional(),
});

export async function POST(req: Request) {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, formError: "Invalid request body." },
      { status: 400 },
    );
  }

  const parsed = draftSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0];
      if (typeof key === "string" && !(key in fieldErrors)) {
        fieldErrors[key] = issue.message;
      }
    }
    return NextResponse.json({ ok: false, fieldErrors }, { status: 400 });
  }
  const input = parsed.data;

  const session = await readSession();
  if (!session) {
    return NextResponse.json({ ok: false, formError: "Not signed in." }, { status: 401 });
  }

  const membership = await withSystemContext((tx) =>
    tx.membership.findFirst({
      where: { userId: session.userId, workspaceId: input.workspaceId, status: "ACTIVE" },
      select: { id: true },
    }),
  );
  if (!membership) {
    return NextResponse.json({ ok: false, formError: "Not a member." }, { status: 403 });
  }

  const workspace = await withSystemContext((tx) =>
    tx.workspace.findUnique({
      where: { id: input.workspaceId },
      select: { name: true },
    }),
  );

  const result = await submitSupportRequest({
    raw: { subject: input.subject, body: input.body },
    workspaceId: input.workspaceId,
    fromUserId: session.userId,
    fromEmail: session.email,
    workspaceName: workspace?.name ?? "your workspace",
    partnerName: servicePartnerForWorkspace(input.workspaceId),
  });

  if (result.ok) {
    return NextResponse.json(
      { ok: true, requestId: result.requestId },
      { status: 200 },
    );
  }
  const status = result.fieldErrors ? 400 : 500;
  return NextResponse.json(result, { status });
}
