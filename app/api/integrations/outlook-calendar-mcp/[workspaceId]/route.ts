/**
 * app/api/integrations/outlook-calendar-mcp/[workspaceId]/route.ts
 *
 * Workspace-scoped HTTP entry to the Outlook Calendar MCP server. Thin wrapper
 * over `lib/integrations/mcp-core/route.ts` — auth + envelope handling live
 * there; this file only binds the Calendar server factory + tool registry.
 *
 * The server the factory returns is approval-gated at its seam, so the
 * mutating tools (`calendar.events.book` / `.reschedule` / `.update` /
 * `.cancel`) answer APPROVAL_REQUIRED over this route until the operator
 * records a grant on /approvals.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { handleMcpGet, handleMcpPost, type McpRouteSpec } from '@/lib/integrations/mcp-core';
import { buildOutlookCalendarMcpServer } from '@/lib/integrations/outlook-calendar-mcp';
import {
  OUTLOOK_CALENDAR_NAMESPACE,
  OUTLOOK_CALENDAR_TOOLS,
} from '@/lib/integrations/outlook-calendar-mcp/tools';
import type { OutlookCalendarMcpServer } from '@/lib/integrations/outlook-calendar-mcp';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SPEC: McpRouteSpec<OutlookCalendarMcpServer> = {
  buildServer: buildOutlookCalendarMcpServer,
  tools: OUTLOOK_CALENDAR_TOOLS,
  namespace: OUTLOOK_CALENDAR_NAMESPACE,
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
