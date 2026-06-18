/**
 * lib/integrations/__tests__/marketplace-smoke-wave2.test.ts
 *
 * Stream B.1.2 — Marketplace MCP smoke / functional-verification, WAVE 2.
 *
 * WHY THIS EXISTS
 * ---------------
 * Wave 1 (`marketplace-smoke.test.ts`) pinned the contract every MCP
 * connector must pass before we call it functionally verified, and covered
 * the four M365 / Google connectors (Gmail, Outlook, OneDrive, Excel). It
 * left DocuSign, QuickBooks, HubSpot, and Slack in its `DEFERRED` set with a
 * TODO. This wave discharges that TODO for the three that expose a JSON-RPC
 * MCP dispatch surface (DocuSign, QuickBooks, Slack) and documents the one
 * that does not (HubSpot) instead of fabricating a stub for it.
 *
 * WHY A SEPARATE FILE (not new ADAPTERS in wave 1)
 * ------------------------------------------------
 * Two structural differences make a second file the honest home:
 *
 *   1. Dispatch shape. The wave-1 connectors each export a bespoke
 *      `dispatch(req, { server })`. These three ride the shared
 *      `mcp-core` dispatcher and are driven by `InProcessMcpClient`
 *      with `{ server, tools, namespace }` — the exact conduit their HTTP
 *      routes use. Reusing that native client keeps the test honest to how
 *      the route actually runs.
 *
 *   2. No-outbound shape. Wave 1 asserts a connector exposes *no* send tool
 *      at all — true for Gmail/Outlook/OneDrive/Excel. DocuSign, QuickBooks,
 *      and Slack legitimately WRITE BACK as the customer (send an envelope,
 *      record a payment, post a message). The no-outbound architecture
 *      (`project_no_outbound_architecture.md`) is honored here not by the
 *      absence of write tools but by the APPROVAL GATE: a customer-acting
 *      write must refuse (`APPROVAL_REQUIRED`) unless a human-supplied
 *      `approvalToken` is present — the same gate landed for Teams/Slack in
 *      the N3 fix. So this wave's no-outbound check is "every customer-
 *      outbound tool is approval-gated", which is stricter and more
 *      meaningful than "no send tool exists".
 *
 * THE CONTRACT (per dispatch connector)
 * -------------------------------------
 *   1. responds to JSON-RPC discovery (`tools/list`)
 *   2. exposes the expected read-tool surface
 *   3. every tool is classified read / gated-write / ungated-write, and
 *      every customer-outbound write is approval-gated (no-outbound)
 *   4. returns workspace-scoped data through a read-only value loop (test impl)
 *   5. prod impl refuses to serve data with no provisioned credential
 *   6. prod impl returns real workspace data when a credential IS provisioned
 *
 * Points 1–4 run against each connector's deterministic test impl (no DB, no
 * network). Point 5 builds the prod impl and pokes a read tool — with no
 * DATABASE_URL the credential lookup cannot resolve, so the call refuses,
 * which is exactly the property under test. Point 6 SKIPS honestly when no
 * IntegrationCredential is provisioned — it never passes on a fixture.
 *
 * Per `feedback_no_silent_vendor_lock.md`: every call goes through the
 * connector's JSON-RPC dispatch, never a vendor SDK.
 *
 * Per `feedback_integration_acceptance_is_functional.md`: the bar is the
 * value loop running end-to-end, not the handshake.
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
  DOCUSIGN_TOOLS,
  DOCUSIGN_NAMESPACE,
  TestDocuSignMcpServer,
  ProdDocuSignMcpServer,
} from '@/lib/integrations/docusign-mcp';
import {
  QUICKBOOKS_TOOLS,
  QUICKBOOKS_NAMESPACE,
  TestQuickbooksMcpServer,
  ProdQuickbooksMcpServer,
} from '@/lib/integrations/quickbooks-mcp';
import {
  SLACK_TOOLS,
  SLACK_NAMESPACE,
  TestSlackMcpServer,
  ProdSlackMcpServer,
} from '@/lib/integrations/slack-mcp';
import { RecordingHubspotMcpServer } from '@/lib/integrations/hubspot-mcp';

import {
  TEST_WORKSPACE_ID,
  OTHER_WORKSPACE_ID,
  hasProvisionedCredential,
} from '../../../tests/fixtures/seed-test-workspace';

// `ToolRegistration` is contravariant in its server param, so a registry
// typed to a concrete server (`ToolRegistration<SlackMcpServer>`) is not
// assignable to `ToolRegistration<McpServerBase>`. We erase to the base at
// the registry boundary (the per-connector tests already enforce the
// concrete types) — the dispatcher only ever calls `invoke(server, args)`.
type AnyTools = ReadonlyArray<ToolRegistration<McpServerBase>>;
const asBaseTools = (t: unknown): AnyTools => t as AnyTools;

// A customer-acting write the no-outbound gate must cover, plus the minimal
// args that reach the gate (validation passes, then the gate fires).
interface WriteProbe {
  tool: string;
  args: Record<string, unknown>;
}
// An ungated write — either a benign DRAFT (no money/message leaves the
// account) or a tracked no-outbound GAP (a customer-acting write that
// currently fires without an approval token, unlike its siblings).
interface UngatedWrite extends WriteProbe {
  kind: 'draft' | 'outbound-gap';
  /** Why it is ungated — surfaced in the test name so it is reviewable. */
  reason: string;
}

interface DispatchAdapter {
  id: string;
  /** IntegrationCredential.provider the prod impl resolves against. */
  providerKey: MarketplaceProviderKey;
  namespace: string;
  tools: AnyTools;
  buildTest(workspaceId: string): McpServerBase;
  buildProd(workspaceId: string): McpServerBase;
  /** Read tools (no approval needed) that must appear in tools/list. */
  readTools: string[];
  /** The lightest read tool used to poke the prod refusal path. */
  refusal: WriteProbe;
  /** Customer-outbound writes that MUST refuse without an approvalToken. */
  gatedWrites: WriteProbe[];
  /** Writes that intentionally (draft) or knowingly (gap) carry no gate. */
  ungatedWrites: UngatedWrite[];
  /** Read-only value loop — `no send` per the wave-2 spec. */
  runValueLoop(client: InProcessMcpClient<McpServerBase>): Promise<void>;
}

function configFor(a: DispatchAdapter, server: McpServerBase): DispatchConfig<McpServerBase> {
  return { server, tools: a.tools, namespace: a.namespace };
}

function clientFor(a: DispatchAdapter, prefer: boolean): InProcessMcpClient<McpServerBase> {
  const server = prefer ? a.buildTest(TEST_WORKSPACE_ID) : a.buildProd(TEST_WORKSPACE_ID);
  return new InProcessMcpClient(configFor(a, server));
}

const ADAPTERS: DispatchAdapter[] = [
  {
    id: 'docusign',
    providerKey: 'DOCUSIGN',
    namespace: DOCUSIGN_NAMESPACE,
    tools: asBaseTools(DOCUSIGN_TOOLS),
    buildTest: (workspaceId) => new TestDocuSignMcpServer({ workspaceId }),
    buildProd: (workspaceId) => new ProdDocuSignMcpServer({ workspaceId }),
    readTools: [
      'docusign.list_envelopes',
      'docusign.get_envelope_status',
      'docusign.get_recipient_status',
      'docusign.download_completed_document',
    ],
    refusal: { tool: 'list_envelopes', args: {} },
    gatedWrites: [],
    // KNOWN GAP: send_envelope + void_envelope act AS the customer (mail a
    // signature request / cancel an in-flight envelope) but — unlike Slack
    // post_message, QuickBooks record_payment, and Teams send — carry NO
    // approvalToken gate. Their arg schemas have no token field and the
    // server fires immediately. This wave PINS that current behavior and
    // flags the divergence from `project_no_outbound_architecture.md`; the
    // fix (add the approval gate, matching its siblings) is a follow-up so
    // this verification PR stays a pure test wave.
    ungatedWrites: [
      {
        tool: 'send_envelope',
        args: {
          emailSubject: 'Smoke — Listing Agreement',
          templateId: 'tpl-1',
          templateRoles: [{ roleName: 'Signer', name: 'Dana', email: 'dana@example.com' }],
        },
        kind: 'outbound-gap',
        reason: 'sends a signature request as the customer with no approvalToken gate (no-outbound parity gap)',
      },
      {
        tool: 'void_envelope',
        args: { envelopeId: 'env-1002', voidedReason: 'smoke' },
        kind: 'outbound-gap',
        reason: 'voids an in-flight envelope as the customer with no approvalToken gate (no-outbound parity gap)',
      },
    ],
    runValueLoop: async (client) => {
      const all = (await client.call('list_envelopes', {})) as {
        envelopes: Array<{ envelopeId: string; status: string }>;
      };
      assert.ok(Array.isArray(all.envelopes), 'list_envelopes returns an envelopes array');
      assert.ok(all.envelopes.length >= 1, 'fixture account has envelopes');

      // Status filter is a real query parameter, not client-side slicing.
      const sent = (await client.call('list_envelopes', { status: 'sent' })) as {
        envelopes: Array<{ status: string }>;
      };
      assert.ok(
        sent.envelopes.every((e) => e.status === 'sent'),
        'status filter is honored server-side',
      );

      const first = all.envelopes[0].envelopeId;
      const status = (await client.call('get_envelope_status', { envelopeId: first })) as {
        envelope: { envelopeId: string };
      };
      assert.equal(status.envelope.envelopeId, first, 'get_envelope_status round-trips the id');

      const recipients = (await client.call('get_recipient_status', { envelopeId: first })) as {
        recipients: Array<{ recipientId: string }>;
      };
      assert.ok(Array.isArray(recipients.recipients), 'get_recipient_status returns recipients');
    },
  },
  {
    id: 'quickbooks',
    providerKey: 'QUICKBOOKS',
    namespace: QUICKBOOKS_NAMESPACE,
    tools: asBaseTools(QUICKBOOKS_TOOLS),
    buildTest: (workspaceId) => new TestQuickbooksMcpServer({ workspaceId }),
    buildProd: (workspaceId) => new ProdQuickbooksMcpServer({ workspaceId }),
    readTools: [
      'quickbooks.list_invoices',
      'quickbooks.get_invoice',
      'quickbooks.list_customers',
      'quickbooks.get_profit_and_loss',
      'quickbooks.list_expenses',
      'quickbooks.list_estimates',
      'quickbooks.get_estimate',
    ],
    refusal: { tool: 'list_invoices', args: {} },
    // record_payment MOVES MONEY — the canonical gated write.
    gatedWrites: [{ tool: 'record_payment', args: { customerId: '1', amount: 100 } }],
    // create_invoice writes, but drafting an invoice moves no money and
    // sends nothing outbound — no gate is correct here.
    ungatedWrites: [
      {
        tool: 'create_invoice',
        args: { customerId: '1', lines: [{ amount: 100, description: 'smoke' }] },
        kind: 'draft',
        reason: 'drafts an invoice (no money movement, nothing leaves the account)',
      },
      {
        tool: 'create_customer',
        args: { displayName: 'Smoke Co' },
        kind: 'draft',
        reason: 'creates an internal customer record (no money movement, nothing outbound)',
      },
      {
        // send_invoice IS approval-gated — at the FACTORY seam
        // (withQuickbooksApproval / buildQuickbooksMcpServer). This wave drives
        // the un-wrapped inner TestQuickbooksMcpServer directly via dispatch,
        // which fires without a token; same shape as DocuSign send_envelope's
        // entry above. The factory gate is proven in
        // quickbooks-mcp/write-actions.test.ts.
        tool: 'send_invoice',
        args: { invoiceId: 'inv-1' },
        kind: 'outbound-gap',
        reason:
          'emails an invoice to the customer; gated at the factory decorator, ungated on this raw inner-server dispatch surface',
      },
    ],
    runValueLoop: async (client) => {
      const invoices = (await client.call('list_invoices', {})) as {
        invoices: Array<{ id: string; customerId: string }>;
      };
      assert.ok(invoices.invoices.length >= 1, 'fixture books have invoices');

      const filtered = (await client.call('list_invoices', { customerId: '1' })) as {
        invoices: Array<{ customerId: string }>;
      };
      assert.ok(
        filtered.invoices.every((i) => i.customerId === '1'),
        'customerId filter is honored server-side',
      );

      const first = invoices.invoices[0].id;
      const one = (await client.call('get_invoice', { invoiceId: first })) as {
        invoice: { id: string };
      };
      assert.equal(one.invoice.id, first, 'get_invoice round-trips the id');

      const pnl = (await client.call('get_profit_and_loss', {})) as {
        currency: string;
        rows: Array<{ label: string; amount: number }>;
      };
      assert.ok(pnl.rows.length >= 1, 'profit-and-loss returns flattened rows');
      assert.ok(typeof pnl.currency === 'string', 'profit-and-loss carries a currency');
    },
  },
  {
    id: 'slack',
    providerKey: 'SLACK',
    namespace: SLACK_NAMESPACE,
    tools: asBaseTools(SLACK_TOOLS),
    buildTest: (workspaceId) => new TestSlackMcpServer({ workspaceId }),
    buildProd: (workspaceId) => new ProdSlackMcpServer({ workspaceId }),
    readTools: ['slack.list_channels', 'slack.read_channel_history', 'slack.search_messages'],
    refusal: { tool: 'list_channels', args: {} },
    gatedWrites: [
      { tool: 'post_message', args: { channel: 'C1001', text: 'smoke' } },
      { tool: 'send_dm', args: { userId: 'U500', text: 'smoke' } },
    ],
    ungatedWrites: [],
    runValueLoop: async (client) => {
      const channels = (await client.call('list_channels', {})) as {
        channels: Array<{ id: string }>;
      };
      assert.ok(channels.channels.length >= 1, 'workspace has visible channels');
      const first = channels.channels[0].id;

      const history = (await client.call('read_channel_history', { channel: first })) as {
        messages: unknown[];
      };
      assert.ok(Array.isArray(history.messages), 'read_channel_history returns messages');

      const search = (await client.call('search_messages', { query: 'Peachtree' })) as {
        matches: Array<{ text: string }>;
      };
      assert.ok(Array.isArray(search.matches), 'search_messages returns matches');
    },
  },
];

// ── The contract, applied to every dispatch connector ───────────────────────

describe('Marketplace MCP contract — wave 2 (dispatch connectors)', () => {
  for (const adapter of ADAPTERS) {
    describe(`${adapter.id} (${adapter.providerKey})`, () => runContract(adapter));
  }

  // Guardrail: every connector this wave claims to cover must still be
  // marketplace-`available`. If one is flipped off, the claim is stale.
  it('covers only connectors that are still marketplace-available', () => {
    const available = new Set(
      listIntegrations()
        .filter((e) => e.status === 'available')
        .map((e) => e.id),
    );
    const notAvailable = ADAPTERS.map((a) => a.id).filter((id) => !available.has(id));
    assert.deepEqual(notAvailable, [], `wave-2 covers non-available connector(s): ${notAvailable.join(', ')}`);
  });
});

function runContract(adapter: DispatchAdapter): void {
  it('responds to JSON-RPC discovery (tools/list)', async () => {
    const tools = await clientFor(adapter, true).listTools();
    assert.ok(Array.isArray(tools) && tools.length >= 1, 'tools/list returns ≥1 tool');
  });

  it('exposes the expected read-tool surface', async () => {
    const names = new Set((await clientFor(adapter, true).listTools()).map((t) => t.name));
    for (const expected of adapter.readTools) {
      assert.ok(names.has(expected), `read tool "${expected}" present in tools/list`);
    }
  });

  it('classifies every tool as read / gated-write / ungated-write (surface guard)', async () => {
    const all = (await clientFor(adapter, true).listTools()).map((t) => t.name).sort();
    const classified = [
      ...adapter.readTools,
      ...adapter.gatedWrites.map((w) => qualify(adapter, w.tool)),
      ...adapter.ungatedWrites.map((w) => qualify(adapter, w.tool)),
    ].sort();
    assert.deepEqual(
      classified,
      all,
      'a new tool appeared with no read/gated/ungated classification — classify it (and gate it if it is customer-outbound)',
    );
  });

  it('approval-gates every customer-outbound write (no-outbound architecture)', async (t: TestContext) => {
    if (adapter.gatedWrites.length === 0) {
      t.skip(`${adapter.id} exposes no approval-gated write tools`);
      return;
    }
    const client = clientFor(adapter, true);
    for (const w of adapter.gatedWrites) {
      await assert.rejects(
        () => client.call(w.tool, w.args),
        (err: unknown) =>
          err instanceof McpClientError && err.mcpErrorCode === 'APPROVAL_REQUIRED',
        `${w.tool} must refuse with APPROVAL_REQUIRED when no approvalToken is supplied`,
      );
    }
  });

  // Pin the current behavior of any KNOWN-GAP outbound write so the
  // divergence is regression-tracked and visible in the test report,
  // rather than silently passing or silently failing CI.
  for (const w of adapter.ungatedWrites.filter((u) => u.kind === 'outbound-gap')) {
    it(`KNOWN GAP: ${w.tool} is NOT approval-gated — ${w.reason}`, async () => {
      const client = clientFor(adapter, true);
      const res = await client.call(w.tool, w.args);
      assert.ok(res, `${w.tool} currently executes without an approvalToken (tracked no-outbound gap)`);
    });
  }

  it('returns workspace-scoped data through the value loop (test impl)', async () => {
    await adapter.runValueLoop(clientFor(adapter, true));
  });

  it('binds the server to the workspace and leaks no cross-workspace resource', async () => {
    const bound = adapter.buildTest(TEST_WORKSPACE_ID) as McpServerBase & { workspaceId?: string };
    assert.equal(bound.workspaceId, TEST_WORKSPACE_ID, 'server is bound to the requested workspace id');

    const other = adapter.buildTest(OTHER_WORKSPACE_ID) as McpServerBase & { workspaceId?: string };
    assert.equal(other.workspaceId, OTHER_WORKSPACE_ID, 'a second server binds its own workspace id');

    // These connectors expose no MCP resources; the dispatcher returns an
    // empty list. Assert it is empty — a resource surface that ever appears
    // must be re-checked for workspace-id scoping (the wave-1 leak guard).
    const res = await dispatch(
      { jsonrpc: '2.0', id: 1, method: 'resources/list' },
      configFor(adapter, bound),
    );
    assert.ok(!('error' in res), 'resources/list does not error');
    const resources = (res.result as { resources?: unknown[] })?.resources ?? (res.result as unknown[]);
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

function qualify(adapter: DispatchAdapter, bare: string): string {
  return bare.includes('.') ? bare : `${adapter.namespace}.${bare}`;
}

// ── HubSpot: marketplace-available, but no JSON-RPC dispatch surface ─────────
//
// HubSpot is flagged `available` in the catalog and advertises
// `/api/integrations/hubspot-mcp/{workspaceId}`, but unlike DocuSign /
// QuickBooks / Slack it ships NO dispatch surface: there is no
// `HUBSPOT_TOOLS` registry, no `HUBSPOT_NAMESPACE`, and no
// `app/api/integrations/hubspot-mcp/[workspaceId]/route.ts`. It is consumed
// directly through the typed `HubspotMcpServer` interface by skills + the
// hourly sync sweep (`HubspotLeadFetcher`), not over JSON-RPC.
//
// So the dispatch contract above cannot apply to HubSpot without fabricating
// a tool registry — which `feedback_no_silent_vendor_lock.md` +
// "don't fabricate stubs" forbid. Instead we (a) document the gap as a guard
// test and (b) still prove the FUNCTIONAL value loop at the layer HubSpot
// actually exposes — read contacts, read a deal, write a triage note back —
// so its acceptance bar (`feedback_integration_acceptance_is_functional.md`)
// is met even though its JSON-RPC packaging is a follow-up.

describe('hubspot — interface-level value loop + dispatch-surface gap', () => {
  it('GAP: HubSpot is marketplace-available but ships no JSON-RPC MCP dispatch surface', () => {
    const hubspot = listIntegrations().find((e) => e.id === 'hubspot');
    assert.ok(hubspot, 'hubspot is a catalog entry');
    assert.equal(hubspot!.status, 'available', 'hubspot is flagged available');
    assert.equal(
      hubspot!.mcpEndpointTemplate,
      '/api/integrations/hubspot-mcp/{workspaceId}',
      'catalog advertises an hubspot-mcp endpoint',
    );
    // The follow-up: wrap HubspotMcpServer with a HUBSPOT_TOOLS registry +
    // namespace + an hubspot-mcp route, then move it into ADAPTERS above so
    // it takes the full dispatch contract like its peers.
  });

  it('runs the read → read → write-back value loop over the typed interface', async () => {
    const server = new RecordingHubspotMcpServer({
      workspaceId: TEST_WORKSPACE_ID,
      seed: {
        contacts: [
          {
            id: 'c-1',
            firstName: 'Sam',
            lastName: 'Buyer',
            email: 'sam@example.com',
            phone: '555-0100',
            company: null,
            lifecycleStage: 'lead',
            leadSource: 'Organic Search',
            createdAt: '2026-06-01T12:00:00Z',
            updatedAt: '2026-06-01T12:00:00Z',
          },
        ],
        deals: [
          {
            id: 'd-1',
            name: 'Buyer — 123 Peachtree',
            amount: 425000,
            pipeline: 'default',
            dealStage: 'qualifiedtobuy',
            closeDate: null,
            createdAt: null,
            updatedAt: null,
          },
        ],
      },
    });

    const contacts = await server.listContacts({ limit: 10 });
    assert.ok(contacts.ok, 'listContacts succeeds');
    assert.ok(contacts.value.contacts.length >= 1, 'seeded contact is returned');
    const contactId = contacts.value.contacts[0].id;

    const got = await server.getContact({ contactId });
    assert.ok(got.ok, 'getContact succeeds');
    assert.equal(got.value.contact.id, contactId, 'getContact round-trips the id');

    const deals = await server.listDeals({});
    assert.ok(deals.ok, 'listDeals succeeds');
    assert.ok(deals.value.deals.length >= 1, 'seeded deal is returned');

    // Write-back IS the value: a triage note onto the contact. HubSpot notes
    // are internal CRM records, not outbound messaging — no approval gate
    // applies (per `project_no_outbound_architecture.md`, the customer still
    // sends any actual reply from their own email).
    const note = await server.createNote({
      objectType: 'contacts',
      objectId: contactId,
      body: 'agentplain triage: hot — buyer pre-approved, 123 Peachtree.',
    });
    assert.ok(note.ok, 'createNote succeeds');
    assert.ok(note.value.noteId.length > 0, 'createNote returns a note id');
    assert.equal(
      server.calls.filter((c) => c.tool === 'createNote').length,
      1,
      'the write-back was recorded',
    );
  });
});
