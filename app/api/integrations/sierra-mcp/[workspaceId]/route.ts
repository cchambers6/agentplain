/**
 * app/api/integrations/sierra-mcp/[workspaceId]/route.ts
 *
 * Workspace-scoped HTTP entry to the Sierra Interactive MCP server. Thin
 * wrapper over `lib/integrations/mcp-core/route.ts` — auth + envelope handling
 * live there; this file only binds the Sierra server factory + tool registry.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { handleMcpGet, handleMcpPost, type McpRouteSpec } from '@/lib/integrations/mcp-core';
import {
  buildSierraMcpServer,
  SIERRA_NAMESPACE,
  SIERRA_TOOLS,
} from '@/lib/integrations/sierra-mcp';
import type { SierraMcpServer } from '@/lib/integrations/sierra-mcp';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SPEC: McpRouteSpec<SierraMcpServer> = {
  buildServer: buildSierraMcpServer,
  tools: SIERRA_TOOLS,
  namespace: SIERRA_NAMESPACE,
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
