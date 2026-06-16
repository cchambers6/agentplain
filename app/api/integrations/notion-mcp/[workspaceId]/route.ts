/**
 * app/api/integrations/notion-mcp/[workspaceId]/route.ts
 *
 * Workspace-scoped HTTP entry to the Notion MCP server. Thin wrapper over
 * `lib/integrations/mcp-core/route.ts` — auth + envelope handling live there;
 * this file only binds the Notion server factory + tool registry.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { handleMcpGet, handleMcpPost, type McpRouteSpec } from '@/lib/integrations/mcp-core';
import {
  buildNotionMcpServer,
  NOTION_NAMESPACE,
  NOTION_TOOLS,
} from '@/lib/integrations/notion-mcp';
import type { NotionMcpServer } from '@/lib/integrations/notion-mcp';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SPEC: McpRouteSpec<NotionMcpServer> = {
  buildServer: buildNotionMcpServer,
  tools: NOTION_TOOLS,
  namespace: NOTION_NAMESPACE,
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
