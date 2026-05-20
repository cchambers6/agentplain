/**
 * app/api/integrations/slack-mcp/[workspaceId]/route.ts
 *
 * Workspace-scoped HTTP entry to the Slack MCP server. Thin wrapper over
 * `lib/integrations/mcp-core/route.ts` — auth + envelope handling live there;
 * this file only binds the Slack server factory + tool registry.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { handleMcpGet, handleMcpPost, type McpRouteSpec } from '@/lib/integrations/mcp-core';
import {
  buildSlackMcpServer,
  SLACK_NAMESPACE,
  SLACK_TOOLS,
  type SlackMcpServer,
} from '@/lib/integrations/slack-mcp';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SPEC: McpRouteSpec<SlackMcpServer> = {
  buildServer: buildSlackMcpServer,
  tools: SLACK_TOOLS,
  namespace: SLACK_NAMESPACE,
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
