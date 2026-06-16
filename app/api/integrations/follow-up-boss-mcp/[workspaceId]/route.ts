/**
 * app/api/integrations/follow-up-boss-mcp/[workspaceId]/route.ts
 *
 * Workspace-scoped HTTP entry to the Follow Up Boss MCP server. Thin wrapper
 * over `lib/integrations/mcp-core/route.ts` — auth + envelope handling live
 * there; this file only binds the FUB server factory + tool registry.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { handleMcpGet, handleMcpPost, type McpRouteSpec } from '@/lib/integrations/mcp-core';
import {
  buildFollowUpBossMcpServer,
  FOLLOW_UP_BOSS_NAMESPACE,
  FOLLOW_UP_BOSS_TOOLS,
} from '@/lib/integrations/follow-up-boss-mcp';
import type { FollowUpBossMcpServer } from '@/lib/integrations/follow-up-boss-mcp';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SPEC: McpRouteSpec<FollowUpBossMcpServer> = {
  buildServer: buildFollowUpBossMcpServer,
  tools: FOLLOW_UP_BOSS_TOOLS,
  namespace: FOLLOW_UP_BOSS_NAMESPACE,
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
