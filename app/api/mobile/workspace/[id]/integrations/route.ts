// GET /api/mobile/workspace/[id]/integrations
//
// JSON twin of the web integrations page loader
// (app/(product)/app/workspace/[id]/integrations/page.tsx). Returns the
// per-vertical marketplace tiles with their live connection status so the
// native marketplace screen can render "connected / available / coming soon"
// without re-deriving the catalog. Per feedback_no_silent_vendor_lock the
// catalog stays the single source — this reads listIntegrations(), it does
// not duplicate it.
//
// Connect handoff: `connectPath` is the existing web OAuth start path. The
// app opens it in an in-app browser (the web flow owns the OAuth redirect +
// the sealed state cookie; we never re-implement OAuth natively). `webPath`
// is the per-integration manage/detail page used for api-key connectors and
// for managing an already-connected tile.

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireMobileWorkspaceMember } from "@/lib/auth";
import { withRls } from "@/lib/db";
import { verticalSlugFromEnum } from "@/lib/auth/vertical-enum";
import {
  entryAppliesToVertical,
  listIntegrations,
  oauthStartPath,
  type MarketplaceEntry,
} from "@/lib/integrations/marketplace";
import { isIntegrationConfigured } from "@/lib/integrations/config-status";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ParamsSchema = z.object({ id: z.string().uuid() });

interface RouteContext {
  params: Promise<{ id: string }>;
}

type TileStatus = "connected" | "available" | "coming-soon";

function tileStatusFor(
  entry: MarketplaceEntry,
  connected: Map<string, unknown>,
): TileStatus {
  if (entry.status === "coming-soon") return "coming-soon";
  if (entry.providerKey && connected.has(entry.providerKey)) return "connected";
  return "available";
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
  const [credentials, workspaceRow] = await Promise.all([
    withRls(ctx, (tx) =>
      tx.integrationCredential.findMany({
        where: { workspaceId },
        select: { provider: true, accountEmail: true, status: true },
        orderBy: { createdAt: "desc" },
      }),
    ),
    withRls(ctx, (tx) =>
      tx.workspace.findUniqueOrThrow({
        where: { id: workspaceId },
        select: { vertical: true },
      }),
    ),
  ]);

  const verticalSlug = verticalSlugFromEnum(workspaceRow.vertical);
  const connectedByProvider = new Map(
    credentials
      .filter((c) => c.status === "ACTIVE")
      .map((c) => [c.provider, c]),
  );

  const entries = listIntegrations().filter((e) =>
    entryAppliesToVertical(e, verticalSlug),
  );

  const webPath = (id: string) =>
    `/app/workspace/${workspaceId}/integrations/${id}`;

  const tiles = entries.map((entry) => {
    const status = tileStatusFor(entry, connectedByProvider);
    const cred =
      entry.providerKey !== null
        ? connectedByProvider.get(entry.providerKey)
        : undefined;
    const configured = isIntegrationConfigured(entry);
    const connectMode = entry.connectMode ?? "oauth";
    // OAuth tiles that are available + configured can hand off to the in-app
    // browser. api-key tiles connect via the web detail form (no OAuth
    // redirect), and coming-soon tiles can't connect at all.
    const connectPath =
      status === "available" && connectMode === "oauth" && configured
        ? oauthStartPath(entry, workspaceId, webPath(entry.id))
        : null;
    return {
      id: entry.id,
      name: entry.name,
      category: entry.category,
      description: entry.description,
      status,
      connectMode,
      configured,
      accountLabel:
        cred && typeof cred === "object" && "accountEmail" in cred
          ? ((cred as { accountEmail: string | null }).accountEmail ?? null)
          : null,
      connectPath,
      webPath: webPath(entry.id),
    };
  });

  return NextResponse.json({ verticalSlug, tiles });
}
