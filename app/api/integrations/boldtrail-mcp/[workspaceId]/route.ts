/**
 * app/api/integrations/boldtrail-mcp/[workspaceId]/route.ts
 *
 * Workspace-scoped HTTP entry to the BoldTrail MCP server. Thin wrapper over
 * `lib/integrations/mcp-core/route.ts` — auth + envelope handling live there.
 *
 * SCAFFOLD (2026-06-17): BoldTrail is `coming-soon`. Read tools return
 * CREDENTIAL_NOT_FOUND until a credential lands; mutating tools are
 * approval-gated at the server seam (`boldtrail-mcp/index.ts`) — they return
 * APPROVAL_REQUIRED and never call BoldTrail without a recorded human approval.
 */

import { type NextRequest, NextResponse } from 'next/server';
import {
  handleMcpGet,
  handleMcpPost,
  type McpRouteSpec,
} from '@/lib/integrations/mcp-core';
import {
  buildBoldtrailMcpServer,
  BOLDTRAIL_NAMESPACE,
  BOLDTRAIL_TOOLS,
  type BoldtrailMcpServer,
} from '@/lib/integrations/boldtrail-mcp';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SPEC: McpRouteSpec<BoldtrailMcpServer> = {
  buildServer: buildBoldtrailMcpServer,
  tools: BOLDTRAIL_TOOLS,
  namespace: BOLDTRAIL_NAMESPACE,
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
