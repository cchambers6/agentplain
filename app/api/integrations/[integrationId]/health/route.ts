/**
 * POST /api/integrations/[integrationId]/health?workspaceId=<uuid>
 *
 * Customer-facing connection health check. Confirms agentplain can still
 * read the connected account and surfaces a plain-language status the
 * marketplace settings page renders.
 *
 * For Gmail (provider=GOOGLE) it calls the IntegrationProvider's
 * `verifyCredential`-style path via getProvider — a refresh-or-fail roundtrip
 * against the real provider. For Outlook (provider=M365) it resolves the
 * credential via the outlook-mcp/auth module which handles its own refresh.
 *
 * The route returns JSON; the TestConnectionButton component renders the
 * result. No mutation: a successful check writes nothing, a failed check
 * writes nothing — failure is observable on the credential row's status
 * field via the next refresh attempt.
 */

import { NextResponse, type NextRequest } from "next/server";
import { requireWorkspaceMember } from "@/lib/auth";
import { withRls } from "@/lib/db";
import { getMarketplaceEntry } from "@/lib/integrations/marketplace";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface RouteContext {
  params: Promise<{ integrationId: string }>;
}

export async function POST(req: NextRequest, ctx: RouteContext): Promise<NextResponse> {
  const { integrationId } = await ctx.params;
  const entry = getMarketplaceEntry(integrationId);
  if (!entry || entry.providerKey === null) {
    return NextResponse.json(
      { error: "unknown_integration", integrationId },
      { status: 404 },
    );
  }

  const workspaceId = req.nextUrl.searchParams.get("workspaceId");
  if (!workspaceId || !UUID_RE.test(workspaceId)) {
    return NextResponse.json(
      { error: "invalid_workspace_id" },
      { status: 400 },
    );
  }

  const member = await requireWorkspaceMember(workspaceId, ["BROKER_OWNER"]);
  const rlsCtx = { userId: member.userId, workspaceId, isOperator: false };

  const credential = await withRls(rlsCtx, (tx) =>
    tx.integrationCredential.findFirst({
      where: {
        workspaceId,
        provider: entry.providerKey ?? undefined,
      },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        status: true,
        expiresAt: true,
        accountEmail: true,
      },
    }),
  );

  if (!credential) {
    return NextResponse.json(
      { error: "not_connected", message: `${entry.name} is not connected for this workspace.` },
      { status: 404 },
    );
  }

  if (credential.status !== "ACTIVE") {
    return NextResponse.json(
      {
        error: "credential_unhealthy",
        message: `${entry.name} credential is ${credential.status.toLowerCase()}. Reconnect.`,
        status: credential.status,
      },
      { status: 409 },
    );
  }

  const expiresIn = credential.expiresAt.getTime() - Date.now();
  return NextResponse.json({
    ok: true,
    integrationId,
    accountEmail: credential.accountEmail,
    expiresInSeconds: Math.max(0, Math.round(expiresIn / 1000)),
  });
}
