/**
 * app/api/integrations/kvcore-mcp/[workspaceId]/route.ts
 *
 * Workspace-scoped HTTP entry to the kvCORE MCP server. Thin wrapper over
 * `lib/integrations/mcp-core/route.ts` — auth + envelope handling live there.
 *
 * SCAFFOLD (2026-06-17): kvCORE is `coming-soon`. Read tools return
 * CREDENTIAL_NOT_FOUND until a credential lands; mutating tools are
 * approval-gated at the server seam (`kvcore-mcp/index.ts`) — they return
 * APPROVAL_REQUIRED and never call kvCORE without a recorded human approval.
 */

import { type NextRequest, NextResponse } from 'next/server';
import {
  handleMcpGet,
  handleMcpPost,
  type McpRouteSpec,
} from '@/lib/integrations/mcp-core';
import {
  buildKvcoreMcpServer,
  KVCORE_NAMESPACE,
  KVCORE_TOOLS,
  type KvcoreMcpServer,
} from '@/lib/integrations/kvcore-mcp';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SPEC: McpRouteSpec<KvcoreMcpServer> = {
  buildServer: buildKvcoreMcpServer,
  tools: KVCORE_TOOLS,
  namespace: KVCORE_NAMESPACE,
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
