/**
 * app/api/integrations/appfolio-mcp/[workspaceId]/route.ts
 *
 * Workspace-scoped HTTP entry to the AppFolio MCP server. Thin wrapper over
 * `lib/integrations/mcp-core/route.ts` — auth + envelope handling live there.
 *
 * SCAFFOLD (2026-06-17): AppFolio is `coming-soon`. Read tools return
 * CREDENTIAL_NOT_FOUND until a credential lands (gated on partner-program
 * approval); mutating tools are approval-gated at the server seam
 * (`appfolio-mcp/index.ts`) — they return APPROVAL_REQUIRED and never call
 * AppFolio without a recorded human approval.
 */

import { type NextRequest, NextResponse } from 'next/server';
import {
  handleMcpGet,
  handleMcpPost,
  type McpRouteSpec,
} from '@/lib/integrations/mcp-core';
import {
  buildAppfolioMcpServer,
  APPFOLIO_NAMESPACE,
  APPFOLIO_TOOLS,
  type AppfolioMcpServer,
} from '@/lib/integrations/appfolio-mcp';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SPEC: McpRouteSpec<AppfolioMcpServer> = {
  buildServer: buildAppfolioMcpServer,
  tools: APPFOLIO_TOOLS,
  namespace: APPFOLIO_NAMESPACE,
};

interface RouteContext {
  params: Promise<{ workspaceId: string }>;
}

export async function POST(req: NextRequest, ctx: RouteContext): Promise<NextResponse> {
  const { workspaceId } = await ctx.params;
  return handleMcpPost(req, workspaceId, SPEC);
}

export async function GET(req: NextRequest, ctx: RouteContext): Promise<NextResponse> {
  const { workspaceId } = await ctx.params;
  return handleMcpGet(req, workspaceId, SPEC);
}
