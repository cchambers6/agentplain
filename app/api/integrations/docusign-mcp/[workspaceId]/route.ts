/**
 * app/api/integrations/docusign-mcp/[workspaceId]/route.ts
 *
 * Workspace-scoped HTTP entry to the DocuSign MCP server. Thin wrapper over
 * `lib/integrations/mcp-core/route.ts` — auth + envelope handling live there;
 * this file only binds the DocuSign server factory + tool registry.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { handleMcpGet, handleMcpPost, type McpRouteSpec } from '@/lib/integrations/mcp-core';
import {
  buildDocuSignMcpServer,
  DOCUSIGN_NAMESPACE,
  DOCUSIGN_TOOLS,
  type DocuSignMcpServer,
} from '@/lib/integrations/docusign-mcp';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SPEC: McpRouteSpec<DocuSignMcpServer> = {
  buildServer: buildDocuSignMcpServer,
  tools: DOCUSIGN_TOOLS,
  namespace: DOCUSIGN_NAMESPACE,
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
