/**
 * lib/integrations/marketplace.ts
 *
 * Customer-facing integration catalog. Each entry is a registered MCP
 * server the operator UI surfaces in the "Connect an integration" pane.
 * Per the MCP-first integration architecture (Phase A), every entry
 * resolves to a workspace-scoped MCP endpoint at
 * `/api/integrations/<slug>-mcp/{workspaceId}`.
 *
 * Per `feedback_runner_portability.md`: marketplace entries describe
 * abstractions (read/draft/label), not vendor primitives. The vendor
 * name appears once (in `name`) and otherwise stays inside the MCP
 * server's implementation.
 *
 * Per `project_no_outbound_architecture.md`: marketplace entries list
 * scopes the connection requests; no entry requests a `send` scope.
 */

export type MarketplaceStatus = 'available' | 'coming-soon' | 'beta';

export interface MarketplaceEntry {
  /** Slug used in the MCP endpoint path. */
  id: string;
  /** Display name in the operator UI. */
  name: string;
  /** One-sentence customer-facing description. */
  description: string;
  /** Endpoint template with `{workspaceId}` placeholder. The operator UI
   *  substitutes the active workspace id at click time. */
  mcpEndpointTemplate: string;
  /** OAuth scopes the connect flow requests. */
  scopes: string[];
  /** Env-var key (or prefix) that wires the provider's OAuth credentials. */
  oauthConfigKey: string;
  /** Connection lifecycle status surfaced in the UI. */
  status: MarketplaceStatus;
}

export const MARKETPLACE_ENTRIES: MarketplaceEntry[] = [
  {
    id: 'gmail',
    name: 'Gmail',
    description:
      'Connect your Gmail to read, categorize, coordinate, schedule, and draft replies.',
    mcpEndpointTemplate: '/api/integrations/gmail-mcp/{workspaceId}',
    scopes: ['gmail.readonly', 'gmail.modify', 'gmail.compose'],
    oauthConfigKey: 'GMAIL_OAUTH',
    status: 'available',
  },
];

/**
 * Resolve the marketplace entry for a slug. Returns null when no entry
 * matches; callers (operator UI, MCP discovery) decide whether to 404.
 */
export function getMarketplaceEntry(id: string): MarketplaceEntry | null {
  return MARKETPLACE_ENTRIES.find((e) => e.id === id) ?? null;
}

/**
 * Build the workspace-scoped MCP endpoint URL for an entry. Substitutes
 * `{workspaceId}` in the template.
 */
export function resolveMcpEndpoint(entry: MarketplaceEntry, workspaceId: string): string {
  return entry.mcpEndpointTemplate.replace('{workspaceId}', workspaceId);
}
