// GET /api/mobile/workspace/[id]/briefing
//
// Returns the last 14 daily briefings for the workspace, decrypted. Powers the
// mobile briefing inbox (V1 screen #3, the home tab). This is the JSON twin of
// the web briefings page loader (app/(product)/app/workspace/[id]/briefings/
// page.tsx) — same membership gate, same withRls read, same at-rest decrypt.

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireMobileWorkspaceMember } from "@/lib/auth";
import { withRls } from "@/lib/db";
import { decrypt } from "@/lib/security/encryption";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ParamsSchema = z.object({ id: z.string().uuid() });

interface RouteContext {
  params: Promise<{ id: string }>;
}

// Mirrors the web page's safeDecrypt — a single corrupt row must not 500 the
// whole inbox.
const safeDecrypt = (body: string): string => {
  try {
    return decrypt(body);
  } catch {
    return "";
  }
};

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
    tx.workspaceBriefing.findMany({
      where: { workspaceId },
      orderBy: { generatedAt: "desc" },
      take: 14,
      select: {
        id: true,
        forDate: true,
        body: true,
        summary: true,
        status: true,
        generatedAt: true,
      },
    }),
  );

  return NextResponse.json({
    briefings: rows.map((b) => ({
      id: b.id,
      forDate: b.forDate,
      body: safeDecrypt(b.body),
      summary: (b.summary as Record<string, unknown>) ?? {},
      status: b.status,
      generatedAt: b.generatedAt.toISOString(),
    })),
  });
}
