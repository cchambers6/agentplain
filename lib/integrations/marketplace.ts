/**
 * lib/integrations/marketplace.ts
 *
 * Customer-facing integration catalog. Each entry is a registered MCP
 * server the operator and customer UIs surface in the "Connect an
 * integration" pane. Per the MCP-first integration architecture (Phase A),
 * every entry resolves to a workspace-scoped MCP endpoint at
 * `/api/integrations/<slug>-mcp/{workspaceId}`.
 *
 * Per `feedback_runner_portability.md`: marketplace entries describe
 * abstractions (read/draft/label), not vendor primitives. The vendor
 * name appears once (in `name`) and otherwise stays inside the MCP
 * server's implementation.
 *
 * Per `project_no_outbound_architecture.md`: marketplace entries list
 * scopes the connection requests; no entry requests a `send` scope.
 *
 * Per `feedback_no_silent_vendor_lock.md`: this is the single source of
 * truth for what integrations agentplain offers. Pages, OAuth routes,
 * settings panes — all read from `listIntegrations()` rather than
 * duplicating the catalog.
 */

export type MarketplaceStatus = 'available' | 'coming-soon' | 'beta';

/**
 * Provider key recorded on `IntegrationCredential.provider` for entries
 * whose status is `available`. `null` for `coming-soon` entries that
 * have no DB rows yet.
 */
export type MarketplaceProviderKey =
  | 'GOOGLE'
  | 'M365'
  | 'DOCUSIGN'
  | 'QUICKBOOKS'
  | 'SLACK'
  | null;

export interface MarketplaceEntry {
  /** Slug used in the MCP endpoint path. */
  id: string;
  /** Display name in the operator UI. */
  name: string;
  /** Category label rendered above the tile name. */
  category: 'Email' | 'Calendar' | 'CRM' | 'Accounting' | 'Documents' | 'Messaging' | 'Payments' | 'Creative';
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
  /** Which `IntegrationProvider` row this entry persists as. Null for
   *  Coming Soon — no rows exist until the connector ships. */
  providerKey: MarketplaceProviderKey;
}

export const MARKETPLACE_ENTRIES: MarketplaceEntry[] = [
  {
    id: 'gmail',
    name: 'Gmail',
    category: 'Email',
    description:
      'Your service partner connects your Gmail to read, categorize, coordinate, schedule, and draft replies.',
    mcpEndpointTemplate: '/api/integrations/gmail-mcp/{workspaceId}',
    scopes: ['gmail.readonly', 'gmail.modify', 'gmail.compose'],
    oauthConfigKey: 'GMAIL_OAUTH',
    status: 'available',
    providerKey: 'GOOGLE',
  },
  {
    id: 'outlook',
    name: 'Outlook',
    category: 'Email',
    description:
      'Your service partner connects your Outlook mailbox to read, categorize, coordinate, schedule, and draft replies.',
    mcpEndpointTemplate: '/api/integrations/outlook-mcp/{workspaceId}',
    // Microsoft Graph permission names. `Mail.ReadWrite` is the minimum
    // for creating drafts via POST /me/messages; we deliberately do NOT
    // request `Mail.Send` (Outlook equivalent of `gmail.send`) per the
    // no-outbound rule. `offline_access` is required for refresh tokens.
    scopes: ['Mail.Read', 'Mail.ReadWrite', 'offline_access'],
    oauthConfigKey: 'MICROSOFT_OAUTH',
    status: 'available',
    providerKey: 'M365',
  },
  // ── Coming soon: the next six connectors on the substrate. Each has a
  // waitlist CTA that funnels through /custom?type=integration-waitlist&id=…
  // so demand is observable before we commit to building. Order mirrors the
  // sequence in the MCP-first architecture spec.
  {
    id: 'quickbooks',
    name: 'QuickBooks',
    category: 'Accounting',
    description:
      'We keep your invoices straight, chase the ones that are overdue, and pull the books your bookkeeper actually needs.',
    mcpEndpointTemplate: '/api/integrations/quickbooks-mcp/{workspaceId}',
    scopes: ['com.intuit.quickbooks.accounting'],
    oauthConfigKey: 'QUICKBOOKS_OAUTH',
    status: 'available',
    providerKey: 'QUICKBOOKS',
  },
  {
    id: 'hubspot',
    name: 'HubSpot',
    category: 'CRM',
    description:
      'Your service partner keeps contacts, deals, and tasks clean — and surfaces what needs your attention.',
    mcpEndpointTemplate: '/api/integrations/hubspot-mcp/{workspaceId}',
    scopes: ['crm.objects.contacts.read', 'crm.objects.deals.read', 'tickets'],
    oauthConfigKey: 'HUBSPOT_OAUTH',
    status: 'coming-soon',
    providerKey: null,
  },
  {
    id: 'docusign',
    name: 'DocuSign',
    category: 'Documents',
    description:
      'We prepare your envelopes, send agreements out for signature, and flag the ones still waiting on a signer.',
    mcpEndpointTemplate: '/api/integrations/docusign-mcp/{workspaceId}',
    scopes: ['signature', 'extended'],
    oauthConfigKey: 'DOCUSIGN_OAUTH',
    status: 'available',
    providerKey: 'DOCUSIGN',
  },
  {
    id: 'google-drive',
    name: 'Google Drive',
    category: 'Documents',
    description:
      'We find your files, pull what we need, and file new documents where they belong. Sharing always waits for your go-ahead.',
    mcpEndpointTemplate: '/api/integrations/google-drive-mcp/{workspaceId}',
    // Drive reuses the Gmail Google OAuth app. These Drive scopes merge with
    // any already-granted Gmail scopes via include_granted_scopes, so one
    // Google account can power both connectors. `drive.file` covers files we
    // create/open; `drive.readonly` covers reading the customer's wider Drive.
    scopes: [
      'https://www.googleapis.com/auth/drive.file',
      'https://www.googleapis.com/auth/drive.readonly',
    ],
    oauthConfigKey: 'GOOGLE_OAUTH',
    status: 'available',
    providerKey: 'GOOGLE',
  },
  {
    id: 'slack',
    name: 'Slack',
    category: 'Messaging',
    description:
      'We read the channels you point us at and surface what matters. Anything we post waits for your say-so.',
    mcpEndpointTemplate: '/api/integrations/slack-mcp/{workspaceId}',
    // Slack user-token scopes. We request a user token (not a bot token) so
    // search works (Slack's search API is user-token-only) and any post acts
    // as the customer, per the no-outbound model. Posting still routes through
    // the approval queue — never auto-fired.
    scopes: [
      'channels:read',
      'channels:history',
      'groups:read',
      'groups:history',
      'chat:write',
      'im:write',
      'users:read',
      'search:read',
    ],
    oauthConfigKey: 'SLACK_OAUTH',
    status: 'available',
    providerKey: 'SLACK',
  },
  {
    id: 'paypal',
    name: 'PayPal',
    category: 'Payments',
    description:
      'Your service partner pulls transactions and disputes into the same place your books and inbox live.',
    mcpEndpointTemplate: '/api/integrations/paypal-mcp/{workspaceId}',
    scopes: ['openid', 'transactions.read'],
    oauthConfigKey: 'PAYPAL_OAUTH',
    status: 'coming-soon',
    providerKey: null,
  },
  {
    id: 'canva',
    name: 'Canva',
    category: 'Creative',
    description:
      'Your service partner drafts collateral in your Canva brand kit — you review, you publish.',
    mcpEndpointTemplate: '/api/integrations/canva-mcp/{workspaceId}',
    scopes: ['design:read', 'design:write', 'brandtemplate:meta:read'],
    oauthConfigKey: 'CANVA_OAUTH',
    status: 'coming-soon',
    providerKey: null,
  },
];

/**
 * Return every catalog entry. Pages call this rather than reaching into
 * `MARKETPLACE_ENTRIES` directly so the catalog is the single seam.
 */
export function listIntegrations(): readonly MarketplaceEntry[] {
  return MARKETPLACE_ENTRIES;
}

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

/**
 * The OAuth start URL the marketplace tile links to. Single source so the
 * tile, the per-integration settings page, and tests don't drift.
 *
 * `returnTo` lets the originating surface (onboarding step 2, the per-
 * integration settings page, etc.) ask the OAuth callback to land back on
 * THAT surface instead of the default `/integrations` index. The start
 * route validates the path is workspace-scoped before stashing it on the
 * sealed state cookie.
 */
export function oauthStartPath(
  entry: MarketplaceEntry,
  workspaceId: string,
  returnTo?: string,
): string {
  const base = `/api/integrations/${entry.id}/oauth/start?workspaceId=${encodeURIComponent(workspaceId)}`;
  return returnTo
    ? `${base}&returnTo=${encodeURIComponent(returnTo)}`
    : base;
}

/**
 * The waitlist CTA path for a coming-soon connector. Routes through the
 * existing /custom inquiry form so demand collection is uniform.
 */
export function waitlistPath(entry: MarketplaceEntry): string {
  return `/custom?type=integration-waitlist&id=${encodeURIComponent(entry.id)}`;
}
