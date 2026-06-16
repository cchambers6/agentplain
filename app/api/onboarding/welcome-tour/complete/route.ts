// POST /api/onboarding/welcome-tour/complete
//
// Marks the first-run Plaino walkthrough as seen for the CURRENT member of
// the given workspace. Called by <WelcomeTour /> when the customer finishes
// or skips the tour. Idempotent: stamps Membership.welcomeTourSeenAt once;
// re-posting is a no-op.
//
// Authorization mirrors the workspace layout that renders the tour
// (requireWorkspaceMember). The membership row is already resolved by that
// assertion, so we write back to its exact id via the system context — no
// second lookup, no chance of stamping the wrong seat.

import { NextResponse } from "next/server";
import { requireWorkspaceMember } from "@/lib/auth";
import { withSystemContext } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid body" }, { status: 400 });
  }

  const workspaceId =
    body && typeof body === "object" && "workspaceId" in body
      ? String((body as { workspaceId: unknown }).workspaceId ?? "")
      : "";
  if (!workspaceId) {
    return NextResponse.json(
      { ok: false, error: "workspaceId required" },
      { status: 400 },
    );
  }

  // Asserts an active membership in this workspace (redirects on miss). Also
  // hands back the resolved membership id + current tour state.
  const member = await requireWorkspaceMember(workspaceId);

  // Already seen → nothing to do. Keeps the first stamp's timestamp stable.
  if (member.welcomeTourSeenAt) {
    return NextResponse.json({ ok: true, alreadySeen: true });
  }

  await withSystemContext((tx) =>
    tx.membership.update({
      where: { id: member.membershipId },
      data: { welcomeTourSeenAt: new Date() },
    }),
  );

  return NextResponse.json({ ok: true });
}
