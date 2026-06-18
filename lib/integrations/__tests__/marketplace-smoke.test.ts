/**
 * lib/integrations/__tests__/marketplace-smoke.test.ts
 *
 * Stream B.1.1 — Marketplace MCP smoke / functional-verification suite.
 *
 * WHY THIS EXISTS
 * ---------------
 * `lib/integrations/marketplace.ts` flags 15+ connectors as
 * `status: 'available'`, but "available" only ever meant "the OAuth wires
 * up". Per `feedback_integration_acceptance_is_functional.md`, an
 * integration is only DONE when the value loop runs against a connected
 * workspace — read + categorize + coordinate + draft — not when the
 * handshake completes. This suite is the contract every MCP connector must
 * pass before we call it functionally verified.
 *
 * THE CONTRACT (per connector)
 * ----------------------------
 *   1. responds to JSON-RPC discovery (`tools/list`)
 *   2. lists its tool surface without error (and exposes the expected tools)
 *   3. exposes no outbound/send tool (honors `project_no_outbound_architecture.md`)
 *   4. returns workspace-scoped data through the value loop (test impl)
 *   5. prod impl refuses to serve data with no provisioned credential
 *   6. prod impl returns real workspace data when a credential IS provisioned
 *
 * HOW IT RUNS HONESTLY
 * --------------------
 * Points 1–4 run against each connector's *test-impl* server — the
 * deterministic in-memory peer mandated by the two-implementation rule
 * (`feedback_runner_portability.md`). These need no DB and no network, so
 * the suite is green in CI without provisioning anything.
 *
 * Point 5 (refusal) and point 6 (real data) touch the *prod* impl, which
 * needs a stored IntegrationCredential. When no credential row exists for
 * the test workspace (or there is no reachable database), point 6 SKIPS
 * with "no test credentials provisioned for <id>" — it does NOT pass on a
 * fixture and pretend the loop ran. A skip is honest; a fixture dressed up
 * as real data is not.
 *
 * WAVE 1 covers Gmail, Outlook, OneDrive, and Excel — the four connectors
 * that share the M365 / Google credential rails and have real test-server
 * impls. Every other `available` connector emits a single skipped test
 * carrying a TODO, until a later wave adds its fixture + real-data leg.
 *
 * Per `feedback_no_silent_vendor_lock.md`: every call here goes through the
 * connector's JSON-RPC `dispatch`, never a vendor SDK.
 */

import { describe, it, type TestContext } from 'node:test';
import assert from 'node:assert/strict';

import { listIntegrations, type MarketplaceEntry } from '@/lib/integrations/marketplace';

import {
  buildGmailMcpServer,
  dispatch as dispatchGmail,
  type GmailMcpServer,
} from '@/lib/integrations/gmail-mcp';
import {
  buildOutlookMcpServer,
  dispatch as dispatchOutlook,
  type OutlookMcpServer,
} from '@/lib/integrations/outlook-mcp';
import {
  buildOneDriveMcpServer,
  dispatch as dispatchOneDrive,
  type OneDriveMcpServer,
} from '@/lib/integrations/onedrive-mcp';
import {
  buildExcelMcpServer,
  dispatch as dispatchExcel,
  type ExcelMcpServer,
} from '@/lib/integrations/excel-mcp';
import { buildOutlookCalendarMcpServer } from '@/lib/integrations/outlook-calendar-mcp';

import {
  TEST_WORKSPACE_ID,
  OTHER_WORKSPACE_ID,
  EXCEL_TEST_WORKBOOK_ID,
  excelSmokeSeed,
  hasProvisionedCredential,
} from '../../../tests/fixtures/seed-test-workspace';

// ── A uniform in-process JSON-RPC client over a connector's dispatch ────────
//
// All four connectors expose `dispatch(req, { server })` (their per-connector
// in-process client classes are uneven — gmail/outlook carry listTools while
// onedrive/excel carry only `call`), so we drive `dispatch` directly. This
// gives every connector the same tools/list + resources/list + tools/call
// surface, exactly as the HTTP route would.

interface JsonRpcError {
  jsonrpc: '2.0';
  id: string | number | null;
  error: { code: number; message: string; data?: unknown };
}
type DispatchFn = (
  req: { jsonrpc: '2.0'; id: number; method: string; params?: unknown },
  opts: { server: unknown },
) => Promise<{ result: unknown } | JsonRpcError>;

class SmokeRpcError extends Error {
  constructor(
    message: string,
    readonly jsonRpcCode: number,
    readonly mcpCode?: string,
  ) {
    super(message);
    this.name = 'SmokeRpcError';
  }
}

class SmokeClient {
  private nextId = 1;
  constructor(
    private readonly namespace: string,
    private readonly dispatch: DispatchFn,
    private readonly server: unknown,
  ) {}

  private async rpc(method: string, params?: unknown): Promise<unknown> {
    const res = await this.dispatch(
      { jsonrpc: '2.0', id: this.nextId++, method, params },
      { server: this.server },
    );
    if ('error' in res) {
      const data = res.error.data as { code?: string } | undefined;
      throw new SmokeRpcError(res.error.message, res.error.code, data?.code);
    }
    return res.result;
  }

  async listTools(): Promise<{ name: string; description: string }[]> {
    const r = (await this.rpc('tools/list')) as { tools: { name: string; description: string }[] };
    return r.tools;
  }

  async listResources(): Promise<{ uri: string }[]> {
    const r = await this.rpc('resources/list');
    if (Array.isArray(r)) return r as { uri: string }[];
    return ((r as { resources?: { uri: string }[] })?.resources ?? []) as { uri: string }[];
  }

  /** Invoke a tool by its bare name (namespace is prepended). */
  call(tool: string, args: Record<string, unknown> = {}): Promise<unknown> {
    return this.rpc(`${this.namespace}.${tool}`, args);
  }
}

// ── Per-connector smoke adapters ────────────────────────────────────────────

interface SmokeAdapter {
  id: string;
  /** IntegrationCredential.provider the prod impl resolves against. */
  providerKey: 'GOOGLE' | 'M365';
  namespace: string;
  dispatch: DispatchFn;
  /** Build a workspace-bound server; `prefer` true ⇒ deterministic test impl. */
  buildServer(workspaceId: string, prefer: boolean): unknown;
  expectedTools: string[];
  /**
   * Customer-outbound write tools that ARE present but are approval-gated at
   * the factory seam (`withGmailApproval` etc., per the wave-2 model). They are
   * exempt from the "no send tool" guard because the no-outbound guarantee is
   * honored by the GATE, not the tool's absence; each is proven to refuse
   * without an approval in the connector's own `write-actions.test.ts`.
   */
  gatedWriteTools?: string[];
  /** The lightest read tool to poke the prod refusal path with. */
  refusalTool: string;
  refusalArgs: Record<string, unknown>;
  runValueLoop(client: SmokeClient): Promise<void>;
}

function clientFor(adapter: SmokeAdapter, workspaceId: string, prefer: boolean): SmokeClient {
  return new SmokeClient(
    adapter.namespace,
    adapter.dispatch,
    adapter.buildServer(workspaceId, prefer),
  );
}

const ADAPTERS: SmokeAdapter[] = [
  {
    id: 'gmail',
    providerKey: 'GOOGLE',
    namespace: 'gmail',
    dispatch: dispatchGmail as unknown as DispatchFn,
    buildServer: (workspaceId, prefer): GmailMcpServer =>
      buildGmailMcpServer({ workspaceId, preferTestImpl: prefer }),
    expectedTools: ['gmail.list_messages', 'gmail.get_message', 'gmail.label_message', 'gmail.list_labels'],
    // compose_from_template + schedule_send SEND mail — approval-gated at the
    // factory (withGmailApproval), proven in gmail-mcp/write-actions.test.ts.
    gatedWriteTools: ['gmail.compose_from_template', 'gmail.schedule_send'],
    refusalTool: 'list_messages',
    refusalArgs: { maxResults: 5 },
    runValueLoop: async (client) => {
      const list = (await client.call('list_messages', { maxResults: 10 })) as {
        messages: Array<{ id: string }>;
      };
      assert.ok(Array.isArray(list.messages), 'list_messages returns a messages array');
      assert.ok(list.messages.length >= 1, 'fixture inbox is non-empty');
      const first = list.messages[0].id;

      const got = (await client.call('get_message', { messageId: first })) as {
        message: { id: string };
      };
      assert.equal(got.message.id, first, 'get_message round-trips the id');

      // label_message is the single bidirectional label tool — there is no
      // add_label/remove_label. Add then remove a smoke label, asserting the
      // mutation is observable and reversible.
      const added = (await client.call('label_message', {
        messageId: first,
        addLabelIds: ['SMOKE_TEST'],
      })) as { labels: string[] };
      assert.ok(added.labels.includes('SMOKE_TEST'), 'label added');
      const removed = (await client.call('label_message', {
        messageId: first,
        removeLabelIds: ['SMOKE_TEST'],
      })) as { labels: string[] };
      assert.ok(!removed.labels.includes('SMOKE_TEST'), 'label removed (cleanup)');
    },
  },
  {
    id: 'outlook',
    providerKey: 'M365',
    namespace: 'outlook',
    dispatch: dispatchOutlook as unknown as DispatchFn,
    buildServer: (workspaceId, prefer): OutlookMcpServer =>
      buildOutlookMcpServer({ workspaceId, preferTestImpl: prefer }),
    expectedTools: [
      'outlook.list_messages',
      'outlook.get_message',
      'outlook.label_message',
      'outlook.list_categories',
    ],
    refusalTool: 'list_messages',
    refusalArgs: { maxResults: 5 },
    runValueLoop: async (client) => {
      const list = (await client.call('list_messages', { maxResults: 10 })) as {
        messages: Array<{ id: string }>;
      };
      assert.ok(Array.isArray(list.messages), 'list_messages returns a messages array');
      assert.ok(list.messages.length >= 1, 'fixture inbox is non-empty');
      const first = list.messages[0].id;

      const got = (await client.call('get_message', { messageId: first })) as {
        message: { id: string };
      };
      assert.equal(got.message.id, first, 'get_message round-trips the id');

      // Outlook categories ride the same bidirectional label tool.
      const added = (await client.call('label_message', {
        messageId: first,
        addLabelIds: ['Smoke'],
      })) as { labels: string[] };
      assert.ok(added.labels.includes('Smoke'), 'category added');
      const removed = (await client.call('label_message', {
        messageId: first,
        removeLabelIds: ['Smoke'],
      })) as { labels: string[] };
      assert.ok(!removed.labels.includes('Smoke'), 'category removed (cleanup)');
    },
  },
  {
    id: 'onedrive',
    providerKey: 'M365',
    namespace: 'onedrive',
    dispatch: dispatchOneDrive as unknown as DispatchFn,
    buildServer: (workspaceId, prefer): OneDriveMcpServer =>
      buildOneDriveMcpServer({ workspaceId, preferTestImpl: prefer }),
    expectedTools: ['onedrive.list_files', 'onedrive.get_file_metadata'],
    refusalTool: 'get_recent_files',
    refusalArgs: { maxResults: 5 },
    runValueLoop: async (client) => {
      // list_files at root scopes by folderPath; fixture files live under
      // "Closings/…", so root may be empty — assert the SHAPE there.
      const listed = (await client.call('list_files', {})) as { items: unknown[] };
      assert.ok(Array.isArray(listed.items), 'list_files returns an items array');

      // get_recent_files ignores folder scoping and surfaces the fixtures —
      // use it to obtain a real item id, then round-trip its metadata.
      const recent = (await client.call('get_recent_files', { maxResults: 10 })) as {
        items: Array<{ id: string; itemType: string }>;
      };
      assert.ok(recent.items.length >= 1, 'fixture drive is non-empty');
      const file = recent.items.find((i) => i.itemType === 'file') ?? recent.items[0];

      const meta = (await client.call('get_file_metadata', { itemId: file.id })) as {
        item: { id: string };
      };
      assert.equal(meta.item.id, file.id, 'get_file_metadata round-trips the id');
    },
  },
  {
    id: 'excel',
    providerKey: 'M365',
    namespace: 'excel',
    dispatch: dispatchExcel as unknown as DispatchFn,
    buildServer: (workspaceId, prefer): ExcelMcpServer =>
      buildExcelMcpServer({
        workspaceId,
        preferTestImpl: prefer,
        testSeed: prefer ? excelSmokeSeed() : undefined,
      }),
    expectedTools: ['excel.list_sheets', 'excel.read_range'],
    refusalTool: 'list_sheets',
    refusalArgs: { workbookId: EXCEL_TEST_WORKBOOK_ID },
    runValueLoop: async (client) => {
      const sheets = (await client.call('list_sheets', {
        workbookId: EXCEL_TEST_WORKBOOK_ID,
      })) as { sheets: Array<{ name: string }> };
      assert.ok(sheets.sheets.length >= 1, 'workbook has at least one sheet');
      assert.ok(sheets.sheets.some((s) => s.name === 'P&L'), 'seeded P&L sheet is present');

      const range = (await client.call('read_range', {
        workbookId: EXCEL_TEST_WORKBOOK_ID,
        sheet: 'P&L',
        address: 'A1:C1',
      })) as { values: Array<Array<unknown>> };
      assert.deepEqual(
        range.values[0],
        ['Month', 'Revenue', 'Cost'],
        'read_range returns the seeded header row',
      );
    },
  },
];

const ADAPTERS_BY_ID = new Map(ADAPTERS.map((a) => [a.id, a]));

// Connectors covered by the wave-2 dispatch suite
// (`marketplace-smoke-wave2.test.ts`). They expose the shared mcp-core
// JSON-RPC dispatch surface and take the same contract there, plus a read-
// only real-data value loop. Listed here so this file's coverage guardrail
// counts them as covered (not silently deferred).
const COVERED_IN_WAVE_2 = new Set(['docusign', 'quickbooks', 'slack']);

// Connectors that are `available` but still awaiting a fixture + real-data
// leg. NOTE: `hubspot` is available but ships no JSON-RPC dispatch surface
// (no HUBSPOT_TOOLS / namespace / route); it is consumed via its typed
// interface and is exercised + its gap documented in the wave-2 suite.
const DEFERRED = new Set([
  'teams',
  'hubspot',
  'google-drive',
  'taxdome',
  'karbon',
  'follow-up-boss',
  'sierra',
  'salesforce',
  'notion',
  // Buildium ships its own dedicated dispatch + contract coverage
  // (`lib/integrations/buildium-mcp/buildium-dispatch.test.ts` +
  // `buildium-mcp.test.ts`) plus approval-gated write actions + a
  // `write-actions.test.ts`, rather than a fixture in this manual registry —
  // it has no wave-1/wave-2 marketplace smoke fixture yet, so it is deferred
  // here to keep the coverage guardrail honest (counted as covered, not
  // silently missed) until that fixture lands.
  'buildium',
]);

// ── The contract, applied to every `available` marketplace entry ────────────

describe('Marketplace MCP contract', () => {
  const available = listIntegrations().filter((e) => e.status === 'available');

  for (const entry of available) {
    describe(`${entry.id} (${entry.providerKey ?? 'no-provider'})`, () => {
      const adapter = ADAPTERS_BY_ID.get(entry.id);
      if (!adapter) {
        it('has a wave-1 smoke fixture', (t: TestContext) => {
          t.skip(
            `TODO(stream-b.1): no smoke fixture for "${entry.id}" yet — added in a later wave`,
          );
        });
        return;
      }
      runContract(entry, adapter);
    });
  }

  // Guardrail: a newly-flipped `available` connector with neither coverage
  // nor an explicit deferral fails here, so a fixture gets written rather
  // than silently skipped forever.
  it('every available connector is either covered or explicitly deferred', () => {
    const uncovered = available
      .map((e) => e.id)
      .filter((id) => !ADAPTERS_BY_ID.has(id) && !DEFERRED.has(id) && !COVERED_IN_WAVE_2.has(id));
    assert.deepEqual(
      uncovered,
      [],
      `New available connector(s) with no smoke coverage and no deferral: ${uncovered.join(', ')}`,
    );
  });
});

function runContract(entry: MarketplaceEntry, adapter: SmokeAdapter): void {
  it('responds to JSON-RPC discovery (tools/list)', async () => {
    const tools = await clientFor(adapter, TEST_WORKSPACE_ID, true).listTools();
    assert.ok(Array.isArray(tools) && tools.length >= 1, 'tools/list returns ≥1 tool');
  });

  it('exposes the expected tool surface', async () => {
    const names = new Set((await clientFor(adapter, TEST_WORKSPACE_ID, true).listTools()).map((t) => t.name));
    for (const expected of adapter.expectedTools) {
      assert.ok(names.has(expected), `tool "${expected}" present in tools/list`);
    }
  });

  it('exposes no UNGATED outbound/send tool (honors no-outbound architecture)', async () => {
    // No-outbound is honored either by the absence of a send tool OR (per the
    // wave-2 model) by a send tool being approval-gated at the factory. Any
    // send-shaped tool that is NOT declared in `gatedWriteTools` is an offender.
    const gated = new Set((adapter.gatedWriteTools ?? []).map((n) => n.toLowerCase()));
    const names = (await clientFor(adapter, TEST_WORKSPACE_ID, true).listTools()).map((t) =>
      t.name.toLowerCase(),
    );
    const offenders = names.filter((n) => /(^|[._])send([._]|$)/.test(n) && !gated.has(n));
    assert.deepEqual(
      offenders,
      [],
      `connector must expose no UNGATED send tool; found: ${offenders.join(', ')}`,
    );
  });

  it('returns workspace-scoped data through the value loop (test impl)', async () => {
    const client = clientFor(adapter, TEST_WORKSPACE_ID, true);
    await adapter.runValueLoop(client);

    // Scoping proof: the bound server's resource URIs embed THIS workspace id
    // and never another workspace's id.
    const resources = await client.listResources();
    assert.ok(
      resources.some((r) => r.uri.includes(TEST_WORKSPACE_ID)),
      'a resource URI is scoped to the bound workspace id',
    );
    assert.ok(
      !resources.some((r) => r.uri.includes(OTHER_WORKSPACE_ID)),
      'no resource URI leaks another workspace id',
    );
  });

  it('prod impl rejects calls with no provisioned credential', async (t: TestContext) => {
    if (await hasProvisionedCredential(adapter.providerKey, TEST_WORKSPACE_ID)) {
      t.skip(`credential provisioned for ${entry.id} — refusal path not applicable`);
      return;
    }
    const client = clientFor(adapter, TEST_WORKSPACE_ID, false);
    await assert.rejects(
      () => client.call(adapter.refusalTool, adapter.refusalArgs),
      'prod impl must refuse to serve data without a credential',
    );
  });

  it('prod impl returns real workspace data when a credential is provisioned', async (t: TestContext) => {
    if (!(await hasProvisionedCredential(adapter.providerKey, TEST_WORKSPACE_ID))) {
      t.skip(`no test credentials provisioned for ${entry.id}`);
      return;
    }
    await adapter.runValueLoop(clientFor(adapter, TEST_WORKSPACE_ID, false));
  });
}

// ── Calendar: the wave-1 spec named "M365 Calendar" as the 4th connector,
// but the catalog has NO calendar entry, and `outlook-calendar-mcp` is
// read-only BY DESIGN (no get_event / propose_event — that would violate
// `project_no_outbound_architecture.md`). Rather than invent a connector or
// a send-shaped tool, we pin the read-only contract as tested truth and
// guard against a calendar connector silently appearing without coverage.

describe('outlook-calendar-mcp — read-only contract (not yet a marketplace entry)', () => {
  it('is intentionally NOT an available marketplace connector yet', () => {
    const ids = listIntegrations()
      .filter((e) => e.status === 'available')
      .map((e) => e.id);
    for (const candidate of ['outlook-calendar', 'm365-calendar', 'calendar']) {
      assert.ok(
        !ids.includes(candidate),
        `"${candidate}" became available — register it as a SmokeAdapter and give it a real-data leg`,
      );
    }
  });

  it('lists events over a window on the test impl (deterministic)', async () => {
    const server = buildOutlookCalendarMcpServer({ workspaceId: TEST_WORKSPACE_ID, preferTestImpl: true });
    const res = await server.listEvents({
      from: new Date('2026-06-05T00:00:00.000Z'),
      to: new Date('2026-06-19T00:00:00.000Z'),
    });
    assert.equal(res.ok, true, 'listEvents succeeds over a valid window');
    if (res.ok) assert.ok(Array.isArray(res.value.events), 'events is an array');
  });

  it('rejects an inverted window (from >= to)', async () => {
    const server = buildOutlookCalendarMcpServer({ workspaceId: TEST_WORKSPACE_ID, preferTestImpl: true });
    const d = new Date('2026-06-05T00:00:00.000Z');
    const res = await server.listEvents({ from: d, to: d });
    assert.equal(res.ok, false, 'an empty/inverted window is rejected');
  });

  it('exposes no event-creation method (honors no-outbound architecture)', () => {
    const server = buildOutlookCalendarMcpServer({
      workspaceId: TEST_WORKSPACE_ID,
      preferTestImpl: true,
    }) as unknown as Record<string, unknown>;
    for (const forbidden of ['proposeEvent', 'createEvent', 'updateEvent', 'deleteEvent', 'sendInvite', 'getEvent']) {
      assert.equal(
        typeof server[forbidden],
        'undefined',
        `calendar server must not expose ${forbidden} (read-only by design)`,
      );
    }
  });
});
