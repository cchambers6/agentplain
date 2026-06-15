/**
 * app/api/integrations/hubspot-mcp/[workspaceId]/route.ts
 *
 * Workspace-scoped HTTP entry to the HubSpot MCP server. Thin wrapper over
 * `lib/integrations/mcp-core/route.ts` — auth + envelope handling live there;
 * this file only binds the HubSpot server factory + tool registry.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { handleMcpGet, handleMcpPost, type McpRouteSpec } from '@/lib/integrations/mcp-core';
import {
  buildHubspotMcpServer,
  HUBSPOT_NAMESPACE,
  HUBSPOT_TOOLS,
} from '@/lib/integrations/hubspot-mcp';
import type { HubspotMcpServer } from '@/lib/integrations/hubspot-mcp';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SPEC: McpRouteSpec<HubspotMcpServer> = {
  buildServer: buildHubspotMcpServer,
  tools: HUBSPOT_TOOLS,
  namespace: HUBSPOT_NAMESPACE,
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
