/**
 * app/api/integrations/taxdome-mcp/[workspaceId]/route.ts
 *
 * Workspace-scoped HTTP entry to the TaxDome MCP server. Thin wrapper
 * over `lib/integrations/mcp-core/route.ts` — auth + envelope handling
 * live there; this file only binds the TaxDome server factory + tool
 * registry.
 */

import { type NextRequest, NextResponse } from 'next/server';
import {
  handleMcpGet,
  handleMcpPost,
  type McpRouteSpec,
} from '@/lib/integrations/mcp-core';
import {
  buildTaxdomeMcpServer,
  TAXDOME_NAMESPACE,
  TAXDOME_TOOLS,
  type TaxdomeMcpServer,
} from '@/lib/integrations/taxdome-mcp';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SPEC: McpRouteSpec<TaxdomeMcpServer> = {
  buildServer: buildTaxdomeMcpServer,
  tools: TAXDOME_TOOLS,
  namespace: TAXDOME_NAMESPACE,
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
