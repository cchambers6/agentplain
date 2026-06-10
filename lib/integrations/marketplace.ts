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

import type { DisciplineId } from '@/lib/disciplines';

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
  | 'FOLLOW_UP_BOSS'
  | 'SIERRA_INTERACTIVE'
  | 'BOLDTRAIL'
  | 'TAXDOME'
  | 'KARBON'
  | 'HUBSPOT'
  | 'SALESFORCE'
  | 'NOTION'
  | null;

/** How a connector authenticates. `oauth` = the existing OAuth start /
 *  callback flow at `/api/integrations/<slug>/oauth/*`. `api-key` = the
 *  workspace pastes a per-account API key into a connect form; we
 *  validate by calling the provider's "/me" endpoint then persist the
 *  key encrypted in IntegrationCredential.accessTokenEncrypted. */
export type MarketplaceConnectMode = 'oauth' | 'api-key';

/**
 * How load-bearing a connector is to the workflows that use it — read by the
 * integration self-heal layer (pfd-2) to decide whether a broken integration
 * blocks the primary action or merely holds a side-effect.
 *
 *   'critical'     — the integration is the system of RECORD for the action.
 *                    Gmail/Outlook (the inbox we draft into), QuickBooks (the
 *                    invoices we chase), the CRMs we triage leads from. If it's
 *                    down the primary action genuinely cannot complete, so the
 *                    failed action queues durably + resumes on reconnect.
 *   'non-critical' — the integration only NOTIFIES or MIRRORS a result the
 *                    primary action already produced (Slack pings, Notion
 *                    mirrors). If it's down the primary action STILL HAPPENS;
 *                    only the notification is held in the retry queue and
 *                    flushed on reconnect (degraded mode).
 *
 * Defaults to 'critical' when unset — the safe default is "treat a broken
 * integration as load-bearing" so we never silently drop work by assuming a
 * connector was decorative.
 */
export type IntegrationCriticality = 'critical' | 'non-critical';

/**
 * Per-vertical relevance. A connector tile is only shown to a workspace
 * whose vertical is in this list. The sentinel `'all'` means horizontal —
 * relevant across every vertical (Gmail, Slack, QuickBooks, etc.).
 *
 * Verticals match `lib/auth/vertical-enum.ts → SLUG_TO_ENUM` keys (the
 * customer-facing slug). Keeping this as a sibling field on the marketplace
 * entry (rather than a separate registry) means the catalog stays the one
 * source of truth — per `feedback_no_silent_vendor_lock.md`.
 */
export type VerticalRelevance = 'all' | readonly string[];

export interface MarketplaceEntry {
  /** Slug used in the MCP endpoint path. */
  id: string;
  /** Display name in the operator UI. */
  name: string;
  /** Category label rendered above the tile name. */
  category:
    | 'Email'
    | 'Calendar'
    | 'CRM'
    | 'Accounting'
    | 'Documents'
    | 'Messaging'
    | 'Payments'
    | 'Creative'
    | 'Spreadsheets';
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
  /** Disciplines this connector serves (Strand 1 UX wedge, 2026-05-28).
   *  A single connector can serve multiple disciplines — Slack lands in
   *  both customer-success and operations; HubSpot in marketing,
   *  sales-enablement, and customer-success. The Discipline panel + the
   *  marketplace facet read this to bucket and filter tiles. */
  disciplines: readonly DisciplineId[];
  /** Per-vertical relevance. The marketplace UI hides tiles whose
   *  `verticalRelevance` does not include the workspace's vertical (or
   *  is not `'all'`). Lets a CPA workspace stop seeing realty-only AMS
   *  tiles by default. */
  verticalRelevance: VerticalRelevance;
  /** How this connector authenticates. Defaults to `'oauth'` for back-
   *  compat (the existing connectors all use OAuth). Wave-3 adds the
   *  `'api-key'` variant for connectors whose providers issue a long-
   *  lived API key (Follow Up Boss). */
  connectMode?: MarketplaceConnectMode;
  /** How load-bearing this connector is (pfd-2 integration self-heal).
   *  Omitted = `'critical'` (the safe default — never silently drop work by
   *  assuming a connector was decorative). Slack/Notion are tagged
   *  `'non-critical'` because they notify/mirror rather than own the record. */
  criticality?: IntegrationCriticality;
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
    // Email is the substrate every discipline reads from — inbox triage
    // is the operations spine; sales follow-ups, customer-success checks,
    // and marketing reply drafts all sit on top of it.
    disciplines: ['operations', 'sales-enablement', 'customer-success', 'marketing'],
    verticalRelevance: 'all',
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
    disciplines: ['operations', 'sales-enablement', 'customer-success', 'marketing'],
    verticalRelevance: 'all',
  },
  {
    id: 'teams',
    name: 'Microsoft Teams',
    category: 'Messaging',
    description:
      'Your service partner reads the chats and channels you point us at, surfaces what needs your attention, and writes back into the threads you already work in.',
    mcpEndpointTemplate: '/api/integrations/teams-mcp/{workspaceId}',
    // Chat.ReadWrite covers list/get/post on 1:1 + group chats.
    // ChannelMessage.Send + ChannelMessage.Read.All cover team channels.
    // OnlineMeetings.ReadWrite lists meetings; OnlineMeetingTranscript.Read.All
    // reads transcripts (gated by tenant policy at consent time). Shares the
    // Outlook OAuth app — same client id / secret in Vercel env.
    scopes: [
      'Chat.ReadWrite',
      'ChannelMessage.Send',
      'ChannelMessage.Read.All',
      'OnlineMeetings.ReadWrite',
      'OnlineMeetingTranscript.Read.All',
      'offline_access',
    ],
    oauthConfigKey: 'MICROSOFT_OAUTH',
    status: 'available',
    providerKey: 'M365',
    disciplines: ['operations', 'customer-success', 'sales-enablement'],
    verticalRelevance: 'all',
  },
  {
    id: 'onedrive',
    name: 'OneDrive & SharePoint',
    category: 'Documents',
    description:
      'Your service partner reads the closing docs, contracts, and working files in your OneDrive and SharePoint libraries — then drops the next version back where you keep them.',
    mcpEndpointTemplate: '/api/integrations/onedrive-mcp/{workspaceId}',
    // Files.ReadWrite.All covers the user's personal OneDrive plus any
    // SharePoint files they have access to via membership. Sites.ReadWrite.All
    // is needed for SharePoint site-level operations (library listing,
    // metadata reads) that ride alongside the file API. Shares the
    // Outlook OAuth app.
    scopes: [
      'Files.ReadWrite.All',
      'Sites.ReadWrite.All',
      'offline_access',
    ],
    oauthConfigKey: 'MICROSOFT_OAUTH',
    status: 'available',
    providerKey: 'M365',
    disciplines: ['operations', 'legal', 'finance'],
    verticalRelevance: 'all',
  },
  {
    id: 'excel',
    name: 'Excel',
    category: 'Spreadsheets',
    description:
      'Your service partner reads the workbooks you keep your books, pipelines, and pricing in — writes new rows when the work is done, never overwrites the cells you maintain by hand.',
    mcpEndpointTemplate: '/api/integrations/excel-mcp/{workspaceId}',
    // Excel-via-Graph is file-typed; the same Files.ReadWrite.All scope
    // OneDrive uses unlocks workbook reads + writes. Shares the OneDrive
    // consent — connecting one connects the file surface for both.
    scopes: [
      'Files.ReadWrite.All',
      'offline_access',
    ],
    oauthConfigKey: 'MICROSOFT_OAUTH',
    status: 'available',
    providerKey: 'M365',
    disciplines: ['analytics', 'finance', 'operations'],
    verticalRelevance: 'all',
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
    disciplines: ['finance', 'analytics'],
    verticalRelevance: 'all',
  },
  {
    id: 'hubspot',
    name: 'HubSpot',
    category: 'CRM',
    description:
      'Your service partner reads your contacts, deals, and companies, drafts updates into /approvals, and writes triage decisions back to HubSpot as notes — you decide what to send from your own email.',
    mcpEndpointTemplate: '/api/integrations/hubspot-mcp/{workspaceId}',
    // HubSpot fine-grained scopes. `oauth` is required as the base scope;
    // the per-object scopes unlock CRM v3 reads + writes. We do NOT
    // request mail/messaging scopes per the no-outbound rule.
    scopes: [
      'oauth',
      'crm.objects.contacts.read',
      'crm.objects.contacts.write',
      'crm.objects.deals.read',
      'crm.objects.deals.write',
      'crm.objects.companies.read',
      'crm.objects.companies.write',
    ],
    oauthConfigKey: 'HUBSPOT_OAUTH',
    status: 'available',
    providerKey: 'HUBSPOT',
    disciplines: ['sales-enablement', 'marketing', 'customer-success'],
    verticalRelevance: 'all',
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
    disciplines: ['legal', 'sales-enablement', 'operations'],
    verticalRelevance: 'all',
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
    disciplines: ['operations', 'legal', 'research'],
    verticalRelevance: 'all',
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
    disciplines: ['customer-success', 'operations'],
    verticalRelevance: 'all',
    // Slack is a NOTIFY channel, not a system of record — if it's down the
    // primary action (the draft, the triage) still lands; the Slack ping is
    // held in the retry queue and flushed on reconnect (degraded mode).
    criticality: 'non-critical',
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
    disciplines: ['finance'],
    verticalRelevance: 'all',
  },
  {
    id: 'taxdome',
    name: 'TaxDome',
    category: 'Documents',
    description:
      'Your service partner reads the docs your clients upload — surfaces what is pending review, and brings client-document state into your month-end close drafts.',
    mcpEndpointTemplate: '/api/integrations/taxdome-mcp/{workspaceId}',
    // API-key flow — the customer pastes the key from Account → API
    // Keys in TaxDome. We do not request OAuth scopes.
    scopes: [],
    oauthConfigKey: 'TAXDOME_API_KEY',
    status: 'available',
    providerKey: 'TAXDOME',
    disciplines: ['finance', 'operations'],
    // CPA + small bookkeeping firms; hidden for realty workspaces by
    // default. The vertical slug here matches the SLUG_TO_ENUM key.
    // CPA + future bookkeeping vertical (`cpa` is the current slug;
    // when a `bookkeeping` slug lands the tile auto-applies).
    verticalRelevance: ['cpa'],
  },
  {
    id: 'karbon',
    name: 'Karbon',
    category: 'Documents',
    description:
      'Your service partner reads workflows, jobs, and recurring tasks so you can see what is in flight and what is blocked — and so close drafts reflect what is actually happening.',
    mcpEndpointTemplate: '/api/integrations/karbon-mcp/{workspaceId}',
    scopes: [],
    oauthConfigKey: 'KARBON_API_KEY',
    status: 'available',
    providerKey: 'KARBON',
    disciplines: ['finance', 'operations'],
    // CPA + future bookkeeping vertical (`cpa` is the current slug;
    // when a `bookkeeping` slug lands the tile auto-applies).
    verticalRelevance: ['cpa'],
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
    disciplines: ['marketing'],
    verticalRelevance: 'all',
  },
  // ── Wave-3 realty CRMs ──────────────────────────────────────────────
  // Follow Up Boss is the most-shared realty CRM among small independent
  // brokerages and exposes a self-serve API key (no OAuth partner
  // enrollment required) — wired end-to-end via the FUB MCP server at
  // `lib/integrations/follow-up-boss-mcp/`.
  {
    id: 'follow-up-boss',
    name: 'Follow Up Boss',
    category: 'CRM',
    description:
      'Plaino reads your Follow Up Boss leads, triages each one (hot / warm / cold / nurture), drafts a first-touch reply into /approvals, and writes the triage decision back to FUB as a note + tag — you decide what to send from your own email.',
    mcpEndpointTemplate: '/api/integrations/follow-up-boss-mcp/{workspaceId}',
    // FUB authenticates with a per-account API key, not OAuth — the
    // `scopes` field is decorative here (kept for the catalog UI to
    // show "what we read / write" verbatim).
    scopes: [
      'people:read',
      'people:write',
      'notes:write',
      'pipelines:read',
    ],
    oauthConfigKey: 'FOLLOW_UP_BOSS_API',
    status: 'available',
    providerKey: 'FOLLOW_UP_BOSS',
    disciplines: ['sales-enablement', 'customer-success'],
    verticalRelevance: ['real-estate'],
    connectMode: 'api-key',
  },
  // kvCORE — the second-most-named realty CRM, but its API requires
  // partner-program enrollment that agentplain has NOT completed.
  // Listed as `coming-soon` so the catalog stays honest; customers
  // can join the waitlist via the existing /custom inquiry flow.
  {
    id: 'kvcore',
    name: 'kvCORE',
    category: 'CRM',
    description:
      'Plaino will read your kvCORE leads and write back triage decisions once we complete the kvCORE partner-program API enrollment. Join the waitlist below.',
    mcpEndpointTemplate: '/api/integrations/kvcore-mcp/{workspaceId}',
    scopes: ['contacts:read', 'contacts:write', 'notes:write'],
    oauthConfigKey: 'KVCORE_OAUTH',
    status: 'coming-soon',
    providerKey: null,
    disciplines: ['sales-enablement', 'customer-success'],
    verticalRelevance: ['real-estate'],
  },
  // ── Wave-4 realty CRMs ──────────────────────────────────────────────
  // Sierra Interactive — public REST API with bearer-token auth. Fully
  // wired end-to-end via the MCP server at `lib/integrations/sierra-mcp/`.
  {
    id: 'sierra',
    name: 'Sierra Interactive',
    category: 'CRM',
    description:
      'Plaino reads your Sierra Interactive contacts, triages each lead (hot / warm / cold / nurture), drafts a first-touch reply into /approvals, and writes the triage decision back to Sierra as a private note + tag.',
    mcpEndpointTemplate: '/api/integrations/sierra-mcp/{workspaceId}',
    scopes: [
      'contacts:read',
      'contacts:write',
      'notes:write',
      'pipelines:read',
    ],
    oauthConfigKey: 'SIERRA_API',
    status: 'available',
    providerKey: 'SIERRA_INTERACTIVE',
    disciplines: ['sales-enablement', 'customer-success'],
    verticalRelevance: ['real-estate'],
    connectMode: 'api-key',
  },
  // BoldTrail (formerly Inside Real Estate's BoldTrail) — public API
  // access requires a developer-partner agreement that agentplain has
  // NOT completed. The MCP server scaffolding lives at
  // `lib/integrations/boldtrail-mcp/` (six-tool surface mirroring
  // Sierra + FUB), but the catalog stays HONEST: `coming-soon` until
  // the partner enrollment lands. Customers can join the waitlist via
  // /custom?type=integration-waitlist.
  {
    id: 'boldtrail',
    name: 'BoldTrail',
    category: 'CRM',
    description:
      'Plaino will read your BoldTrail leads and write back triage decisions once we complete BoldTrail\'s developer-partner enrollment. The MCP server scaffolding is in place; the credential path opens with the enrollment. Join the waitlist below.',
    mcpEndpointTemplate: '/api/integrations/boldtrail-mcp/{workspaceId}',
    scopes: [
      'contacts:read',
      'contacts:write',
      'notes:write',
      'pipelines:read',
    ],
    oauthConfigKey: 'BOLDTRAIL_API',
    status: 'coming-soon',
    providerKey: null,
    disciplines: ['sales-enablement', 'customer-success'],
    verticalRelevance: ['real-estate'],
    connectMode: 'api-key',
  },
  // Lofty + Real Geeks — named in the audit as the next realty-CRM
  // tier. Both require partner-program enrollment; left for wave 5.
  {
    id: 'lofty',
    name: 'Lofty (formerly Chime)',
    category: 'CRM',
    description:
      'Plaino will read your Lofty contacts and write back triage decisions once we complete the Lofty partner-program API enrollment. Join the waitlist below.',
    mcpEndpointTemplate: '/api/integrations/lofty-mcp/{workspaceId}',
    scopes: ['contacts:read', 'contacts:write', 'notes:write'],
    oauthConfigKey: 'LOFTY_API',
    status: 'coming-soon',
    providerKey: null,
    disciplines: ['sales-enablement', 'customer-success'],
    verticalRelevance: ['real-estate'],
  },
  {
    id: 'real-geeks',
    name: 'Real Geeks',
    category: 'CRM',
    description:
      'Plaino will read your Real Geeks leads and write back triage decisions once we complete the Real Geeks partner-program API enrollment. Join the waitlist below.',
    mcpEndpointTemplate: '/api/integrations/real-geeks-mcp/{workspaceId}',
    scopes: ['contacts:read', 'contacts:write', 'notes:write'],
    oauthConfigKey: 'REAL_GEEKS_API',
    status: 'coming-soon',
    providerKey: null,
    disciplines: ['sales-enablement', 'customer-success'],
    verticalRelevance: ['real-estate'],
  },
  // ── Wave-7 universal MCPs ───────────────────────────────────────────
  // Salesforce + Notion join HubSpot (above) as the three customer-
  // installable, universal MCPs. They serve every vertical and unlock
  // the SMB market beyond realty/CPA. All three use OAuth 2.0.
  //
  // HONEST CONCESSION (Salesforce): customer-installed dev apps work
  // without partner-program enrollment. Production SHARING/distribution
  // through Salesforce AppExchange does require Connected App security
  // review; until that lands, each customer installs their own Connected
  // App and pastes its client id/secret. The wiring + degraded mode
  // tolerate that path.
  {
    id: 'salesforce',
    name: 'Salesforce',
    category: 'CRM',
    description:
      'Your service partner reads your leads, opportunities, and accounts, drafts updates into /approvals, and writes tasks back to Salesforce — you decide what to send from your own email.',
    mcpEndpointTemplate: '/api/integrations/salesforce-mcp/{workspaceId}',
    // Salesforce OAuth scopes. `api` covers the standard data API;
    // `refresh_token` issues a long-lived refresh token; `offline_access`
    // is alias-equivalent on newer Salesforce orgs. We do NOT request
    // `full` to keep the grant minimal.
    scopes: ['api', 'refresh_token'],
    oauthConfigKey: 'SALESFORCE_OAUTH',
    status: 'available',
    providerKey: 'SALESFORCE',
    disciplines: ['sales-enablement', 'customer-success', 'marketing'],
    verticalRelevance: 'all',
  },
  {
    id: 'notion',
    name: 'Notion',
    category: 'Documents',
    description:
      'Your service partner reads your Notion pages and databases, ingests them into your workspace knowledge base, and surfaces what is relevant when you ask — and drafts new pages back when there is work to file.',
    mcpEndpointTemplate: '/api/integrations/notion-mcp/{workspaceId}',
    // Notion does not use granular OAuth scopes — capability is set by
    // the integration type configured on the Notion side (internal vs
    // public) + which pages the user shares. The scopes array is kept
    // decorative for the catalog UI.
    scopes: [
      'workspace:read',
      'page:read',
      'page:write',
      'database:read',
    ],
    oauthConfigKey: 'NOTION_OAUTH',
    status: 'available',
    providerKey: 'NOTION',
    disciplines: ['operations', 'research', 'marketing'],
    verticalRelevance: 'all',
    // Notion MIRRORS pages into the substrate; it is not the system of record
    // for any primary draft/triage action. Held-and-flushed when down.
    criticality: 'non-critical',
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

/**
 * Whether a marketplace entry is relevant to the given vertical slug.
 * `verticalRelevance === 'all'` is always relevant; otherwise the slug
 * must appear in the list. The marketplace facet uses this to hide tiles
 * a workspace would not connect (e.g. realty-only AMS tiles in a CPA
 * workspace).
 */
export function entryAppliesToVertical(
  entry: MarketplaceEntry,
  verticalSlug: string,
): boolean {
  if (entry.verticalRelevance === 'all') return true;
  return entry.verticalRelevance.includes(verticalSlug);
}

/**
 * Marketplace entries that serve a given discipline. Used by the
 * discipline detail page and by the panel card's connector-count badge.
 */
export function entriesForDiscipline(
  disciplineId: string,
): readonly MarketplaceEntry[] {
  return MARKETPLACE_ENTRIES.filter((e) =>
    (e.disciplines as readonly string[]).includes(disciplineId),
  );
}

/**
 * Criticality of a marketplace entry. Omitted on the entry = `'critical'`
 * (the safe default). The integration self-heal layer reads this to decide
 * whether a broken integration blocks the primary action (critical → queue
 * + resume) or just holds the side-effect (non-critical → hold + flush).
 */
export function entryCriticality(entry: MarketplaceEntry): IntegrationCriticality {
  return entry.criticality ?? 'critical';
}

/**
 * Resolve the marketplace entry that persists as a given `IntegrationProvider`
 * row. The integration self-heal cron walks `IntegrationCredential` rows
 * (which carry the provider enum) and needs the customer-facing display name,
 * the reconnect surface, and the criticality — all of which live on the
 * marketplace entry.
 *
 * Several entries can share one provider key (Gmail + Google Drive both map to
 * GOOGLE; Outlook/Teams/OneDrive/Excel to M365). We return the FIRST entry for
 * the provider — its name is the customer-recognizable one for the account
 * ("Gmail", "Outlook") and its reconnect path is the right landing page.
 * Returns null for a provider that no `available` entry advertises (e.g. the
 * vertical-adapter providers BUILDIUM/QUALIA/EZLYNX/ENCOMPASS that have no
 * marketplace tile yet) so the caller can fall back to the raw provider key.
 */
export function entryForProviderKey(
  providerKey: NonNullable<MarketplaceProviderKey>,
): MarketplaceEntry | null {
  return (
    MARKETPLACE_ENTRIES.find(
      (e) => e.status === 'available' && e.providerKey === providerKey,
    ) ?? null
  );
}
