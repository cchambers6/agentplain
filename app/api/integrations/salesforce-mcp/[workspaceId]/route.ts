/**
 * app/api/integrations/salesforce-mcp/[workspaceId]/route.ts
 *
 * Workspace-scoped HTTP entry to the Salesforce MCP server. Thin wrapper over
 * `lib/integrations/mcp-core/route.ts` — auth + envelope handling live there;
 * this file only binds the Salesforce server factory + tool registry.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { handleMcpGet, handleMcpPost, type McpRouteSpec } from '@/lib/integrations/mcp-core';
import {
  buildSalesforceMcpServer,
  SALESFORCE_NAMESPACE,
  SALESFORCE_TOOLS,
} from '@/lib/integrations/salesforce-mcp';
import type { SalesforceMcpServer } from '@/lib/integrations/salesforce-mcp';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SPEC: McpRouteSpec<SalesforceMcpServer> = {
  buildServer: buildSalesforceMcpServer,
  tools: SALESFORCE_TOOLS,
  namespace: SALESFORCE_NAMESPACE,
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
