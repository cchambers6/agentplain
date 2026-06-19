/**
 * app/api/integrations/clio-mcp/[workspaceId]/route.ts
 *
 * Workspace-scoped HTTP entry to the Clio MCP server. Thin wrapper over
 * `lib/integrations/mcp-core/route.ts` — auth + envelope handling live there.
 *
 * SCAFFOLD (2026-06-17): Clio is `coming-soon`. Read tools return
 * CREDENTIAL_NOT_FOUND until a credential lands; mutating tools are
 * approval-gated at the server seam (`clio-mcp/index.ts`) — they return
 * APPROVAL_REQUIRED and never call Clio without a recorded human approval.
 */

import { type NextRequest, NextResponse } from 'next/server';
import {
  handleMcpGet,
  handleMcpPost,
  type McpRouteSpec,
} from '@/lib/integrations/mcp-core';
import {
  buildClioMcpServer,
  CLIO_NAMESPACE,
  CLIO_TOOLS,
  type ClioMcpServer,
} from '@/lib/integrations/clio-mcp';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SPEC: McpRouteSpec<ClioMcpServer> = {
  buildServer: buildClioMcpServer,
  tools: CLIO_TOOLS,
  namespace: CLIO_NAMESPACE,
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
