/**
 * lib/integrations/buildium-mcp/tools.ts
 *
 * The Buildium tool registry — zod arg schema + description + wiring to the
 * `BuildiumMcpServer` interface. Shared by the HTTP route
 * (`app/api/integrations/buildium-mcp/[workspaceId]/route.ts`) and the smoke
 * test via `lib/integrations/mcp-core/dispatch.ts`.
 *
 * The server's `healthCheck()` is a connection probe (returns BuildiumHealth,
 * not an McpResult) consumed by the fleet-health cron + the "Test connection"
 * button — it is NOT an MCP tool, so it is intentionally not registered here.
 * The dispatchable surface is `list_delinquent_leases` (read-only).
 */

import { z } from 'zod';
import type { ToolRegistration } from '@/lib/integrations/mcp-core';
import type { BuildiumMcpServer } from './types';

/** Namespace prefix for Buildium MCP tools (e.g. `buildium.list_delinquent_leases`). */
export const BUILDIUM_NAMESPACE = 'buildium';

const listDelinquentLeasesSchema = z.object({
  limit: z.number().int().positive().max(100).optional(),
  asOf: z.string().optional(),
});

export const BUILDIUM_TOOLS: ReadonlyArray<ToolRegistration<BuildiumMcpServer>> = [
  {
    name: `${BUILDIUM_NAMESPACE}.list_delinquent_leases`,
    description:
      'List delinquent leases (rent roll past-due). limit caps results; asOf (ISO date) sets the as-of date for daysPastDue. Read-only — drafting the tenant chase routes through /approvals.',
    schema: listDelinquentLeasesSchema,
    invoke: (s, a) => s.listDelinquentLeases(listDelinquentLeasesSchema.parse(a)),
  },
];
