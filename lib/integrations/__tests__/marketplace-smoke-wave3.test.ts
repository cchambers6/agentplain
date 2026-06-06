/**
 * lib/integrations/__tests__/marketplace-smoke-wave3.test.ts
 *
 * Stream B.1.3 — Marketplace MCP smoke / functional-verification, WAVE 3.
 *
 * WHY THIS EXISTS
 * ---------------
 * Wave 1 (`marketplace-smoke.test.ts`) pinned the contract every MCP
 * connector must pass and covered the four M365 / Google connectors. Wave 2
 * (`marketplace-smoke-wave2.test.ts`) discharged DocuSign / QuickBooks /
 * Slack through the shared `mcp-core` dispatch, and documented HubSpot's
 * missing dispatch surface instead of fabricating a stub. This wave does the
 * same for the six CRM / CPA connectors left in wave 1's `DEFERRED` set:
 *
 *   - TaxDome, Karbon — ship a real JSON-RPC dispatch surface
 *     (`*_TOOLS` registry + namespace + an `*-mcp/[workspaceId]` route),
 *     so they take the full dispatch contract via `InProcessMcpClient`,
 *     exactly as their HTTP routes run.
 *
 *   - Salesforce, Notion, Follow Up Boss, Sierra Interactive — ship the
 *     typed `*McpServer` interface + two impls (`Prod*` / `Recording*`)
 *     consumed directly by skills + the hourly lead/file sweeps, but NO
 *     JSON-RPC dispatch surface: no `*_TOOLS` registry, no namespace, and
 *     no `app/api/integrations/<id>-mcp/[workspaceId]/route.ts`. Their
 *     catalog `mcpEndpointTemplate` advertises an endpoint that 404s today
 *     — the same gap HubSpot carries. So, exactly as wave 2 did for HubSpot,
 *     we (a) document the dispatch-surface gap as a guard test and (b) still
 *     prove the FUNCTIONAL read value loop at the layer these connectors
 *     actually expose, so their acceptance bar
 *     (`feedback_integration_acceptance_is_functional.md`) is met even
 *     though their JSON-RPC packaging is a follow-up.
 *
 * WHY A SEPARATE FILE (matching wave 2)
 * -------------------------------------
 * The dispatch connectors here ride the shared `mcp-core` dispatcher driven
 * by `InProcessMcpClient` with `{ server, tools, namespace }` — a different
 * shape from wave 1's bespoke per-connector `dispatch(req, { server })`. And
 * the interface-layer connectors are not dispatch connectors at all. Keeping
 * wave 3 in its own file (a) avoids churning the working wave-1 ADAPTERS and
 * (b) keeps the honest "no dispatch surface yet" connectors documented next
 * to the ones that do.
 *
 * READ-ONLY BY DESIGN
 * -------------------
 * TaxDome + Karbon expose read-only tool surfaces today (no `create_*` /
 * `update_*` paths — see their `tools.ts`). So wave 1's stricter "connector
 * exposes NO send tool" guard applies here and is asserted. The four
 * interface connectors DO carry internal write-backs (createTask / createPage
 * / createNote / addTag) that annotate the customer's own CRM/workspace —
 * these are not customer-facing outbound (`project_no_outbound_architecture.md`)
 * — but this verification wave exercises only their READ value loop, which is
 * the per-connector scope for wave 3.
 *
 * Per `feedback_no_silent_vendor_lock.md`: every dispatch call goes through
 * the connector's JSON-RPC dispatch, never a vendor SDK. The interface
 * connectors are driven through their typed MCP interface, the only surface
 * they expose.
 */

import { describe, it, type TestContext } from 'node:test';
import assert from 'node:assert/strict';

import {
  dispatch,
  InProcessMcpClient,
  McpClientError,
  type DispatchConfig,
  type McpServerBase,
  type ToolRegistration,
} from '@/lib/integrations/mcp-core';

import { listIntegrations, type MarketplaceProviderKey } from '@/lib/integrations/marketplace';

import {
  TAXDOME_TOOLS,
  TAXDOME_NAMESPACE,
  TestTaxdomeMcpServer,
  ProdTaxdomeMcpServer,
} from '@/lib/integrations/taxdome-mcp';
import {
  KARBON_TOOLS,
  KARBON_NAMESPACE,
  TestKarbonMcpServer,
  ProdKarbonMcpServer,
} from '@/lib/integrations/karbon-mcp';

import { RecordingSalesforceMcpServer } from '@/lib/integrations/salesforce-mcp';
import { RecordingNotionMcpServer } from '@/lib/integrations/notion-mcp';
import { RecordingFollowUpBossMcpServer } from '@/lib/integrations/follow-up-boss-mcp';
import { RecordingSierraMcpServer } from '@/lib/integrations/sierra-mcp';

import {
  TEST_WORKSPACE_ID,
  OTHER_WORKSPACE_ID,
  hasProvisionedCredential,
} from '../../../tests/fixtures/seed-test-workspace';

// `ToolRegistration` is contravariant in its server param, so a registry
// typed to a concrete server is not assignable to
// `ToolRegistration<McpServerBase>`. We erase to the base at the registry
// boundary (the concrete types are enforced by each connector's own
// `tools.ts` + per-connector test); the dispatcher only ever calls
// `invoke(server, args)`. Mirrors wave 2.
type AnyTools = ReadonlyArray<ToolRegistration<McpServerBase>>;
const asBaseTools = (t: unknown): AnyTools => t as AnyTools;

// ── Read-only dispatch connectors (TaxDome, Karbon) ─────────────────────────

interface ReadOnlyDispatchAdapter {
  id: string;
  /** IntegrationCredential.provider the prod impl resolves against. */
  providerKey: MarketplaceProviderKey;
  namespace: string;
  tools: AnyTools;
  buildTest(workspaceId: string): McpServerBase;
  buildProd(workspaceId: string): McpServerBase;
  /** The full tool surface — every entry must be a read tool. */
  expectedTools: string[];
  /** The lightest read tool used to poke the prod refusal path. */
  refusal: { tool: string; args: Record<string, unknown> };
  runValueLoop(client: InProcessMcpClient<McpServerBase>): Promise<void>;
}

function configFor(
  a: ReadOnlyDispatchAdapter,
  server: McpServerBase,
): DispatchConfig<McpServerBase> {
  return { server, tools: a.tools, namespace: a.namespace };
}

function clientFor(a: ReadOnlyDispatchAdapter, prefer: boolean): InProcessMcpClient<McpServerBase> {
  const server = prefer ? a.buildTest(TEST_WORKSPACE_ID) : a.buildProd(TEST_WORKSPACE_ID);
  return new InProcessMcpClient(configFor(a, server));
}

const ADAPTERS: ReadOnlyDispatchAdapter[] = [
  {
    id: 'taxdome',
    providerKey: 'TAXDOME',
    namespace: TAXDOME_NAMESPACE,
    tools: asBaseTools(TAXDOME_TOOLS),
    buildTest: (workspaceId) => new TestTaxdomeMcpServer({ workspaceId }),
    buildProd: (workspaceId) => new ProdTaxdomeMcpServer({ workspaceId }),
    expectedTools: [
      'taxdome.list_clients',
      'taxdome.get_client',
      'taxdome.list_tax_documents',
      'taxdome.get_tax_document',
      'taxdome.list_engagement_letters',
      'taxdome.list_received_documents',
    ],
    refusal: { tool: 'list_clients', args: {} },
    runValueLoop: async (client) => {
      const clients = (await client.call('list_clients', {})) as {
        clients: Array<{ id: string; name: string }>;
      };
      assert.ok(Array.isArray(clients.clients), 'list_clients returns a clients array');
      assert.ok(clients.clients.length >= 1, 'fixture firm has clients');
      const first = clients.clients[0].id;

      const got = (await client.call('get_client', { clientId: first })) as {
        client: { id: string };
      };
      assert.equal(got.client.id, first, 'get_client round-trips the id');

      const docs = (await client.call('list_tax_documents', {})) as {
        documents: Array<{ id: string; status: string }>;
      };
      assert.ok(docs.documents.length >= 1, 'firm has tax documents');

      // status filter is a real server-side query parameter, not slicing.
      const pending = (await client.call('list_tax_documents', {
        status: 'pending-review',
      })) as { documents: Array<{ status: string }> };
      assert.ok(
        pending.documents.every((d) => d.status === 'pending-review'),
        'status filter is honored server-side',
      );

      const received = (await client.call('list_received_documents', {})) as {
        receivedDocuments: Array<{ kind: string }>;
      };
      assert.ok(
        received.receivedDocuments.every((d) => d.kind === 'received-doc'),
        'list_received_documents returns only client-uploaded docs',
      );
    },
  },
  {
    id: 'karbon',
    providerKey: 'KARBON',
    namespace: KARBON_NAMESPACE,
    tools: asBaseTools(KARBON_TOOLS),
    buildTest: (workspaceId) => new TestKarbonMcpServer({ workspaceId }),
    buildProd: (workspaceId) => new ProdKarbonMcpServer({ workspaceId }),
    expectedTools: [
      'karbon.list_clients',
      'karbon.get_client',
      'karbon.list_workflows',
      'karbon.get_workflow',
      'karbon.list_jobs',
      'karbon.list_recurring_tasks',
    ],
    refusal: { tool: 'list_clients', args: {} },
    runValueLoop: async (client) => {
      const clients = (await client.call('list_clients', {})) as {
        clients: Array<{ id: string }>;
      };
      assert.ok(clients.clients.length >= 1, 'fixture firm has clients');

      const workflows = (await client.call('list_workflows', {})) as {
        workflows: Array<{ id: string; clientId: string }>;
      };
      assert.ok(workflows.workflows.length >= 1, 'firm has workflows');
      const wf = workflows.workflows[0].id;

      // status filter is honored server-side.
      const active = (await client.call('list_workflows', { status: 'active' })) as {
        workflows: Array<{ status: string }>;
      };
      assert.ok(
        active.workflows.every((w) => w.status === 'active'),
        'workflow status filter is honored server-side',
      );

      const one = (await client.call('get_workflow', { workflowId: wf })) as {
        workflow: { id: string; daysSinceLastActivity: number };
      };
      assert.equal(one.workflow.id, wf, 'get_workflow round-trips the id');
      assert.equal(
        typeof one.workflow.daysSinceLastActivity,
        'number',
        'workflow carries days-since-last-activity (the "what is stalled" signal)',
      );

      const jobs = (await client.call('list_jobs', { workflowId: wf })) as {
        jobs: Array<{ workflowId: string }>;
      };
      assert.ok(
        jobs.jobs.every((j) => j.workflowId === wf),
        'list_jobs workflowId filter is honored server-side',
      );

      const recurring = (await client.call('list_recurring_tasks', {})) as {
        recurringTasks: Array<{ cadence: string }>;
      };
      assert.ok(recurring.recurringTasks.length >= 1, 'firm has recurring task templates');
    },
  },
];

describe('Marketplace MCP contract — wave 3 (dispatch connectors: TaxDome, Karbon)', () => {
  for (const adapter of ADAPTERS) {
    describe(`${adapter.id} (${adapter.providerKey})`, () => runReadOnlyContract(adapter));
  }

  // Guardrail: every connector this wave claims to cover must still be
  // marketplace-available. If one is flipped off, the claim is stale.
  it('covers only connectors that are still marketplace-available', () => {
    const available = new Set(
      listIntegrations()
        .filter((e) => e.status === 'available')
        .map((e) => e.id),
    );
    const notAvailable = [...ADAPTERS.map((a) => a.id), ...INTERFACE_CONNECTORS.map((c) => c.id)].filter(
      (id) => !available.has(id),
    );
    assert.deepEqual(
      notAvailable,
      [],
      `wave-3 covers non-available connector(s): ${notAvailable.join(', ')}`,
    );
  });
});

function runReadOnlyContract(adapter: ReadOnlyDispatchAdapter): void {
  it('responds to JSON-RPC discovery (tools/list)', async () => {
    const tools = await clientFor(adapter, true).listTools();
    assert.ok(Array.isArray(tools) && tools.length >= 1, 'tools/list returns ≥1 tool');
  });

  it('exposes exactly the expected read-tool surface (surface guard)', async () => {
    const all = (await clientFor(adapter, true).listTools()).map((t) => t.name).sort();
    assert.deepEqual(
      all,
      [...adapter.expectedTools].sort(),
      'a tool appeared/disappeared without updating expectedTools — if it is a write tool it must be approval-gated and classified (see wave 2)',
    );
  });

  it('exposes no outbound/send tool (read-only connector — honors no-outbound)', async () => {
    const names = (await clientFor(adapter, true).listTools()).map((t) => t.name.toLowerCase());
    const offenders = names.filter(
      (n) => /(^|[._])send([._]|$)/.test(n) || /(^|[._])(create|update|delete)([._]|$)/.test(n),
    );
    assert.deepEqual(
      offenders,
      [],
      `read-only connector must expose no write/send tool; found: ${offenders.join(', ')}`,
    );
  });

  it('returns workspace-scoped data through the read value loop (test impl)', async () => {
    await adapter.runValueLoop(clientFor(adapter, true));
  });

  it('binds the server to the workspace and leaks no cross-workspace resource', async () => {
    const bound = adapter.buildTest(TEST_WORKSPACE_ID) as McpServerBase & { workspaceId?: string };
    assert.equal(bound.workspaceId, TEST_WORKSPACE_ID, 'server is bound to the requested workspace id');

    const other = adapter.buildTest(OTHER_WORKSPACE_ID) as McpServerBase & { workspaceId?: string };
    assert.equal(other.workspaceId, OTHER_WORKSPACE_ID, 'a second server binds its own workspace id');

    // These connectors expose no MCP resources; the dispatcher returns an
    // empty list. A resource surface that ever appears must be re-checked
    // for workspace-id scoping (the wave-1 leak guard).
    const res = await dispatch(
      { jsonrpc: '2.0', id: 1, method: 'resources/list' },
      configFor(adapter, bound),
    );
    assert.ok(!('error' in res), 'resources/list does not error');
    const resources =
      (res.result as { resources?: unknown[] })?.resources ?? (res.result as unknown[]);
    assert.deepEqual(resources, [], 'connector exposes no resources (nothing to leak)');
  });

  it('prod impl rejects calls with no provisioned credential', async (t: TestContext) => {
    if (await hasProvisionedCredential(adapter.providerKey, TEST_WORKSPACE_ID)) {
      t.skip(`credential provisioned for ${adapter.id} — refusal path not applicable`);
      return;
    }
    const client = clientFor(adapter, false);
    await assert.rejects(
      () => client.call(adapter.refusal.tool, adapter.refusal.args),
      'prod impl must refuse to serve data without a credential',
    );
  });

  it('prod impl returns real workspace data when a credential is provisioned', async (t: TestContext) => {
    if (!(await hasProvisionedCredential(adapter.providerKey, TEST_WORKSPACE_ID))) {
      t.skip(`no test credentials provisioned for ${adapter.id}`);
      return;
    }
    await adapter.runValueLoop(clientFor(adapter, false));
  });
}

// ── Interface-layer connectors (Salesforce, Notion, FUB, Sierra) ────────────
//
// These four are marketplace-`available` and advertise an `<id>-mcp` endpoint,
// but ship NO JSON-RPC dispatch surface (no `*_TOOLS`, no namespace, no
// `app/api/integrations/<id>-mcp/[workspaceId]/route.ts`). They are consumed
// directly through their typed `*McpServer` interface by skills + the hourly
// lead/file sweeps. Following wave 2's HubSpot treatment, we document the gap
// as a guard test and prove the read value loop at the layer they expose,
// rather than fabricating a tool registry (`feedback_no_silent_vendor_lock.md`
// + "don't fabricate stubs").

interface InterfaceConnector {
  id: string;
  endpoint: string;
}

const INTERFACE_CONNECTORS: InterfaceConnector[] = [
  { id: 'salesforce', endpoint: '/api/integrations/salesforce-mcp/{workspaceId}' },
  { id: 'notion', endpoint: '/api/integrations/notion-mcp/{workspaceId}' },
  { id: 'follow-up-boss', endpoint: '/api/integrations/follow-up-boss-mcp/{workspaceId}' },
  { id: 'sierra', endpoint: '/api/integrations/sierra-mcp/{workspaceId}' },
];

/** Pins the advertised-but-unbuilt dispatch surface so the gap is tracked. */
function dispatchSurfaceGap(id: string, endpoint: string): void {
  it(`GAP: ${id} is marketplace-available but ships no JSON-RPC MCP dispatch surface`, () => {
    const entry = listIntegrations().find((e) => e.id === id);
    assert.ok(entry, `${id} is a catalog entry`);
    assert.equal(entry!.status, 'available', `${id} is flagged available`);
    assert.equal(
      entry!.mcpEndpointTemplate,
      endpoint,
      `catalog advertises the ${id}-mcp endpoint`,
    );
    // The follow-up: wrap the typed server with an `<X>_TOOLS` registry +
    // namespace + an `<id>-mcp/[workspaceId]` route, then move it into the
    // dispatch ADAPTERS above so it takes the full dispatch contract.
  });
}

describe('salesforce — interface-level read loop + dispatch-surface gap', () => {
  const { id, endpoint } = INTERFACE_CONNECTORS[0];
  dispatchSurfaceGap(id, endpoint);

  function server() {
    return new RecordingSalesforceMcpServer({
      workspaceId: TEST_WORKSPACE_ID,
      seed: {
        accounts: [
          {
            id: '001A',
            name: 'Acme Roofing',
            industry: 'Construction',
            website: 'https://acme.example',
            phone: '555-0100',
            createdAt: '2026-05-01T00:00:00Z',
            modifiedAt: '2026-06-01T00:00:00Z',
          },
        ],
        contacts: [
          {
            id: '003A',
            firstName: 'Dana',
            lastName: 'Owner',
            email: 'dana@acme.example',
            phone: '555-0101',
            accountId: '001A',
            title: 'Owner',
            createdAt: '2026-05-01T00:00:00Z',
            modifiedAt: '2026-06-01T00:00:00Z',
          },
        ],
        opportunities: [
          {
            id: '006A',
            name: 'Acme — Roof Replacement',
            amount: 42000,
            stage: 'Proposal/Price Quote',
            closeDate: '2026-07-15',
            accountId: '001A',
            probability: 60,
            createdAt: '2026-05-10T00:00:00Z',
            modifiedAt: '2026-06-02T00:00:00Z',
          },
        ],
        leads: [
          {
            id: '00QA',
            firstName: 'Sam',
            lastName: 'Buyer',
            email: 'sam@example.com',
            phone: '555-0200',
            company: 'Buyer LLC',
            status: 'Open - Not Contacted',
            leadSource: 'Web',
            rating: 'Hot',
            createdAt: '2026-06-01T12:00:00Z',
            modifiedAt: '2026-06-01T12:00:00Z',
          },
        ],
      },
    });
  }

  it('binds the server to the requested workspace', () => {
    assert.equal(server().workspaceId, TEST_WORKSPACE_ID, 'server is workspace-bound');
  });

  it('runs the list_leads → list_accounts → list_opportunities read loop over the typed interface', async () => {
    const s = server();

    const leads = await s.listLeads({ limit: 10 });
    assert.ok(leads.ok, 'listLeads succeeds');
    assert.ok(leads.value.leads.length >= 1, 'seeded lead is returned');
    const leadId = leads.value.leads[0].id;

    const lead = await s.getLead({ leadId });
    assert.ok(lead.ok, 'getLead succeeds');
    assert.equal(lead.value.lead.id, leadId, 'getLead round-trips the id');

    const accounts = await s.listAccounts({ limit: 10 });
    assert.ok(accounts.ok, 'listAccounts succeeds');
    assert.ok(accounts.value.accounts.length >= 1, 'seeded account is returned');
    const accountId = accounts.value.accounts[0].id;

    const account = await s.getAccount({ accountId });
    assert.ok(account.ok, 'getAccount succeeds');
    assert.equal(account.value.account.id, accountId, 'getAccount round-trips the id');

    // accountId filter is honored server-side, not client-sliced.
    const opps = await s.listOpportunities({ accountId });
    assert.ok(opps.ok, 'listOpportunities succeeds');
    assert.ok(opps.value.opportunities.length >= 1, 'account has an opportunity');
    assert.ok(
      opps.value.opportunities.every((o) => o.accountId === accountId),
      'accountId filter is honored server-side',
    );

    const contacts = await s.listContacts({ accountId });
    assert.ok(contacts.ok, 'listContacts succeeds');
    assert.ok(
      contacts.value.contacts.every((c) => c.accountId === accountId),
      'contacts roll up to the requested account',
    );

    // The loop touched only read tools — no createTask write-back.
    assert.ok(
      s.calls.every((c) => c.tool !== 'createTask'),
      'wave-3 Salesforce loop is read-only (no createTask)',
    );
  });
});

describe('notion — interface-level read loop + dispatch-surface gap', () => {
  const { id, endpoint } = INTERFACE_CONNECTORS[1];
  dispatchSurfaceGap(id, endpoint);

  function server() {
    return new RecordingNotionMcpServer({
      workspaceId: TEST_WORKSPACE_ID,
      seed: {
        databases: [
          {
            id: 'db-1',
            title: 'Standard Operating Procedures',
            url: 'https://www.notion.so/db1',
            createdAt: '2026-05-01T00:00:00Z',
            lastEditedAt: '2026-06-01T00:00:00Z',
            propertyTypes: { Name: 'title', Status: 'status' },
          },
        ],
        pages: [
          {
            id: 'pg-1',
            title: 'Listing Runbook',
            parentType: 'database_id',
            parentId: 'db-1',
            url: 'https://www.notion.so/pg1',
            createdAt: '2026-05-02T00:00:00Z',
            lastEditedAt: '2026-06-01T00:00:00Z',
            archived: false,
            body: 'Step 1: confirm seller paperwork. Step 2: schedule photos.',
          },
          {
            id: 'pg-2',
            title: 'Team Onboarding',
            parentType: 'workspace',
            parentId: null,
            url: 'https://www.notion.so/pg2',
            createdAt: '2026-05-03T00:00:00Z',
            lastEditedAt: '2026-06-01T00:00:00Z',
            archived: false,
            body: 'Welcome to the brokerage.',
          },
        ],
      },
    });
  }

  it('binds the server to the requested workspace', () => {
    assert.equal(server().workspaceId, TEST_WORKSPACE_ID, 'server is workspace-bound');
  });

  it('runs the list_databases → query_database → get_page read loop over the typed interface', async () => {
    const s = server();

    const dbs = await s.listDatabases({ limit: 10 });
    assert.ok(dbs.ok, 'listDatabases succeeds');
    assert.ok(dbs.value.databases.length >= 1, 'seeded database is returned');
    const databaseId = dbs.value.databases[0].id;

    const rows = await s.queryDatabase({ databaseId });
    assert.ok(rows.ok, 'queryDatabase succeeds');
    assert.ok(rows.value.pages.length >= 1, 'database has a page row');
    assert.ok(
      rows.value.pages.every((p) => p.parentId === databaseId),
      'query_database returns rows parented to the requested database',
    );
    const pageId = rows.value.pages[0].id;

    const page = await s.getPage({ pageId });
    assert.ok(page.ok, 'getPage succeeds');
    assert.equal(page.value.content.page.id, pageId, 'get_page round-trips the id');
    assert.ok(page.value.content.text.length > 0, 'get_page returns the page body text');

    const search = await s.searchWorkspace({ query: 'Runbook' });
    assert.ok(search.ok, 'searchWorkspace succeeds');
    assert.ok(
      search.value.hits.some((h) => h.id === pageId),
      'search surfaces the seeded runbook page',
    );

    // Read-only loop — no createPage / updatePage write-back.
    assert.ok(
      s.calls.every((c) => c.tool !== 'createPage' && c.tool !== 'updatePage'),
      'wave-3 Notion loop is read-only (no page writes)',
    );
  });
});

describe('follow-up-boss — interface-level read loop + dispatch-surface gap', () => {
  const { id, endpoint } = INTERFACE_CONNECTORS[2];
  dispatchSurfaceGap(id, endpoint);

  function server() {
    return new RecordingFollowUpBossMcpServer({
      workspaceId: TEST_WORKSPACE_ID,
      seed: {
        leads: [
          {
            id: 'p-1',
            firstName: 'Sam',
            lastName: 'Buyer',
            emails: ['sam@example.com'],
            phones: ['555-0200'],
            source: 'Zillow',
            stage: 'Lead',
            tags: ['new'],
            lastActivityAt: '2026-06-02T00:00:00Z',
            createdAt: '2026-06-01T00:00:00Z',
          },
        ],
        pipelines: [
          {
            id: 'pl-1',
            name: 'Buyer Pipeline',
            stages: [
              { id: 's-1', name: 'New', sortOrder: 0 },
              { id: 's-2', name: 'Active', sortOrder: 1 },
            ],
          },
        ],
        users: [
          {
            id: 'u-1',
            firstName: 'Agent',
            lastName: 'One',
            email: 'agent1@brokerage.example',
            role: 'Agent',
            active: true,
            groups: ['north fulton'],
          },
          {
            id: 'u-2',
            firstName: 'Former',
            lastName: 'Agent',
            email: 'former@brokerage.example',
            role: 'Agent',
            active: false,
            groups: [],
          },
        ],
        leadLists: [{ id: 'll-1', name: 'Nurture', isPublic: true }],
      },
    });
  }

  it('binds the server to the requested workspace', () => {
    assert.equal(server().workspaceId, TEST_WORKSPACE_ID, 'server is workspace-bound');
  });

  it('runs the list_leads → get_lead → list_users read loop over the typed interface', async () => {
    const s = server();

    const leads = await s.listLeads({ limit: 10 });
    assert.ok(leads.ok, 'listLeads succeeds');
    assert.ok(leads.value.leads.length >= 1, 'seeded lead is returned');
    const leadId = leads.value.leads[0].id;

    const lead = await s.getLead({ leadId });
    assert.ok(lead.ok, 'getLead succeeds');
    assert.equal(lead.value.lead.id, leadId, 'getLead round-trips the id');

    // activeOnly defaults true — the disabled user must NOT appear in the
    // roster the lead-triage skill routes against.
    const active = await s.listUsers({ activeOnly: true });
    assert.ok(active.ok, 'listUsers succeeds');
    assert.ok(active.value.users.length >= 1, 'roster has an active user');
    assert.ok(
      active.value.users.every((u) => u.active),
      'activeOnly excludes disabled users',
    );

    const all = await s.listUsers({ activeOnly: false });
    assert.ok(all.ok, 'listUsers (all) succeeds');
    assert.ok(
      all.value.users.length > active.value.users.length,
      'activeOnly:false surfaces the disabled user too',
    );

    const pipelines = await s.listPipelines({});
    assert.ok(pipelines.ok, 'listPipelines succeeds');
    assert.ok(pipelines.value.pipelines.length >= 1, 'account has a pipeline');

    // Read-only loop — no createNote / addTag write-back.
    assert.ok(
      s.calls.every((c) => c.tool !== 'createNote' && c.tool !== 'addTag'),
      'wave-3 FUB loop is read-only (no triage write-back)',
    );
  });
});

describe('sierra — interface-level read loop + dispatch-surface gap', () => {
  const { id, endpoint } = INTERFACE_CONNECTORS[3];
  dispatchSurfaceGap(id, endpoint);

  function server() {
    return new RecordingSierraMcpServer({
      workspaceId: TEST_WORKSPACE_ID,
      seed: {
        leads: [
          {
            id: 'c-1',
            firstName: 'Pat',
            lastName: 'Prospect',
            emails: ['pat@example.com'],
            phones: ['555-0300'],
            source: 'IDX',
            stage: 'New',
            tags: ['hot'],
            lastActivityAt: '2026-06-02T00:00:00Z',
            createdAt: '2026-06-01T00:00:00Z',
          },
        ],
        pipelines: [
          {
            id: 'sp-1',
            name: 'Default',
            stages: [
              { id: 'st-1', name: 'New', sortOrder: 0 },
              { id: 'st-2', name: 'Working', sortOrder: 1 },
            ],
          },
        ],
      },
    });
  }

  it('binds the server to the requested workspace', () => {
    assert.equal(server().workspaceId, TEST_WORKSPACE_ID, 'server is workspace-bound');
  });

  it('runs the list_leads → get_lead read loop over the typed interface', async () => {
    const s = server();

    const leads = await s.listLeads({ limit: 10 });
    assert.ok(leads.ok, 'listLeads succeeds');
    assert.ok(leads.value.leads.length >= 1, 'seeded lead is returned');
    const leadId = leads.value.leads[0].id;

    const lead = await s.getLead({ leadId });
    assert.ok(lead.ok, 'getLead succeeds');
    assert.equal(lead.value.lead.id, leadId, 'getLead round-trips the id');

    const pipelines = await s.listPipelines({});
    assert.ok(pipelines.ok, 'listPipelines succeeds');
    assert.ok(pipelines.value.pipelines.length >= 1, 'account has a pipeline');
    const pipelineId = pipelines.value.pipelines[0].id;
    const stageId = pipelines.value.pipelines[0].stages[0].id;

    const stage = await s.getPipelineStage({ pipelineId, stageId });
    assert.ok(stage.ok, 'getPipelineStage succeeds');
    assert.equal(stage.value.stage.id, stageId, 'getPipelineStage round-trips the stage id');

    // Read-only loop — no createNote / addTag write-back.
    assert.ok(
      s.calls.every((c) => c.tool !== 'createNote' && c.tool !== 'addTag'),
      'wave-3 Sierra loop is read-only (no triage write-back)',
    );
  });
});
