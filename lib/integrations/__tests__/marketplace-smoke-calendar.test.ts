/**
 * lib/integrations/__tests__/marketplace-smoke-calendar.test.ts
 *
 * Calendar wave — the marketplace MCP contract for the two calendar
 * connectors (`google-calendar`, `outlook-calendar`), which became
 * `available` catalog entries in the Google Workspace scheduling wave.
 * Follows the wave-2 dispatch pattern (`marketplace-smoke-wave2.test.ts`):
 * every call goes through the shared mcp-core JSON-RPC dispatch — never a
 * vendor SDK — exactly as the HTTP routes
 * (`app/api/integrations/{google,outlook}-calendar-mcp/[workspaceId]/route.ts`)
 * drive it.
 *
 * THE CONTRACT (per connector)
 *   1. responds to JSON-RPC discovery (tools/list) with the shared calendar
 *      tool surface — both providers expose IDENTICAL dotted tool names, so
 *      the scheduler skill never branches on vendor
 *   2. approval-gates every mutation (book / reschedule / update / cancel)
 *      per `project_no_outbound_architecture.md` — refused with
 *      APPROVAL_REQUIRED when no grant is recorded
 *   3. runs the read value loop (calendars → events → free/busy → proposed
 *      slots) against the deterministic test impl
 *   4. binds servers to one workspace and leaks no cross-workspace resource
 *   5. prod impl refuses to serve data with no provisioned credential
 *   6. prod impl returns real workspace data when a credential IS provisioned
 *      (skips honestly otherwise)
 *
 * The gate deps are injected in-memory (unseeded) so point 2 is
 * deterministic without a database — the same seam
 * `write-actions.test.ts` proves grant-by-grant.
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
import {
  InMemoryConnectorApprovalGate,
  InMemoryConnectorActionAuditSink,
} from '@/lib/integrations/approval';
import { listIntegrations, type MarketplaceProviderKey } from '@/lib/integrations/marketplace';

import {
  GOOGLE_CALENDAR_TOOLS,
  GOOGLE_CALENDAR_NAMESPACE,
  buildGoogleCalendarMcpServer,
  ProdGoogleCalendarMcpServer,
} from '@/lib/integrations/google-calendar-mcp';
import {
  OUTLOOK_CALENDAR_TOOLS,
  OUTLOOK_CALENDAR_NAMESPACE,
  buildOutlookCalendarMcpServer,
  ProdOutlookCalendarMcpServer,
} from '@/lib/integrations/outlook-calendar-mcp';

import {
  TEST_WORKSPACE_ID,
  OTHER_WORKSPACE_ID,
  hasProvisionedCredential,
} from '../../../tests/fixtures/seed-test-workspace';

// Same registry-boundary erasure as wave-2 — `ToolRegistration` is
// contravariant in its server param; the per-connector tests already enforce
// the concrete types and the dispatcher only calls `invoke(server, args)`.
type AnyTools = ReadonlyArray<ToolRegistration<McpServerBase>>;
const asBaseTools = (t: unknown): AnyTools => t as AnyTools;

/** The provider-neutral calendar tool surface BOTH connectors must expose. */
const CALENDAR_TOOL_SURFACE = [
  'calendar.calendars.list',
  'calendar.events.list',
  'calendar.events.get',
  'calendar.events.book',
  'calendar.events.reschedule',
  'calendar.events.update',
  'calendar.events.cancel',
  'calendar.freebusy.query',
  'calendar.slots.propose',
];

const SEED = {
  events: [
    {
      id: 'evt-1',
      title: 'Inspection — 123 Peachtree',
      startUtc: '2026-07-01T15:00:00.000Z',
      endUtc: '2026-07-01T16:00:00.000Z',
      isBusy: true,
    },
  ],
  busy: [{ start: '2026-07-01T15:00:00.000Z', end: '2026-07-01T16:00:00.000Z' }],
};

interface CalendarAdapter {
  id: 'google-calendar' | 'outlook-calendar';
  providerKey: MarketplaceProviderKey;
  namespace: string;
  tools: AnyTools;
  /** Gated factory build with the deterministic seed + in-memory gate. */
  buildTest(workspaceId: string): McpServerBase;
  /** Raw prod server (credential refusal happens before any vendor call). */
  buildProd(workspaceId: string): McpServerBase;
}

function inMemoryDeps() {
  return {
    gate: new InMemoryConnectorApprovalGate(),
    audit: new InMemoryConnectorActionAuditSink(),
  };
}

const ADAPTERS: CalendarAdapter[] = [
  {
    id: 'google-calendar',
    providerKey: 'GOOGLE',
    namespace: GOOGLE_CALENDAR_NAMESPACE,
    tools: asBaseTools(GOOGLE_CALENDAR_TOOLS),
    buildTest: (workspaceId) =>
      buildGoogleCalendarMcpServer({
        workspaceId,
        preferTestImpl: true,
        testSeed: SEED,
        deps: inMemoryDeps(),
      }) as unknown as McpServerBase,
    buildProd: (workspaceId) =>
      new ProdGoogleCalendarMcpServer({ workspaceId }) as unknown as McpServerBase,
  },
  {
    id: 'outlook-calendar',
    providerKey: 'M365',
    namespace: OUTLOOK_CALENDAR_NAMESPACE,
    tools: asBaseTools(OUTLOOK_CALENDAR_TOOLS),
    buildTest: (workspaceId) =>
      buildOutlookCalendarMcpServer({
        workspaceId,
        preferTestImpl: true,
        testSeed: SEED,
        deps: inMemoryDeps(),
      }) as unknown as McpServerBase,
    buildProd: (workspaceId) =>
      new ProdOutlookCalendarMcpServer({ workspaceId }) as unknown as McpServerBase,
  },
];

function configFor(a: CalendarAdapter, server: McpServerBase): DispatchConfig<McpServerBase> {
  return { server, tools: a.tools, namespace: a.namespace };
}

function clientFor(a: CalendarAdapter, prefer: boolean): InProcessMcpClient<McpServerBase> {
  const server = prefer ? a.buildTest(TEST_WORKSPACE_ID) : a.buildProd(TEST_WORKSPACE_ID);
  return new InProcessMcpClient(configFor(a, server));
}

const GATED_WRITES: { tool: string; args: Record<string, unknown> }[] = [
  {
    tool: 'events.book',
    args: { summary: 'Walkthrough', start: '2026-07-02T15:00:00.000Z', end: '2026-07-02T15:30:00.000Z' },
  },
  {
    tool: 'events.reschedule',
    args: { eventId: 'evt-1', start: '2026-07-02T16:00:00.000Z', end: '2026-07-02T16:30:00.000Z' },
  },
  { tool: 'events.update', args: { eventId: 'evt-1', summary: 'Walkthrough (updated)' } },
  { tool: 'events.cancel', args: { eventId: 'evt-1' } },
];

for (const adapter of ADAPTERS) {
  describe(`${adapter.id} (${adapter.providerKey})`, () => {
    it('is an available marketplace entry advertising its dispatch route', () => {
      const entry = listIntegrations().find((e) => e.id === adapter.id);
      assert.ok(entry, `${adapter.id} is a catalog entry`);
      assert.equal(entry!.status, 'available');
      assert.equal(
        entry!.mcpEndpointTemplate,
        `/api/integrations/${adapter.id}-mcp/{workspaceId}`,
        'catalog advertises the workspace-scoped dispatch route',
      );
    });

    it('responds to JSON-RPC discovery with the shared calendar tool surface', async () => {
      const tools = await clientFor(adapter, true).listTools();
      const names = new Set(tools.map((t) => t.name));
      for (const expected of CALENDAR_TOOL_SURFACE) {
        assert.ok(names.has(expected), `tool "${expected}" present in tools/list`);
      }
    });

    it('approval-gates every mutation (no-outbound architecture)', async () => {
      const client = clientFor(adapter, true);
      for (const w of GATED_WRITES) {
        await assert.rejects(
          () => client.call(w.tool, w.args),
          (err: unknown) =>
            err instanceof McpClientError && err.mcpErrorCode === 'APPROVAL_REQUIRED',
          `${w.tool} must refuse with APPROVAL_REQUIRED when no grant is recorded`,
        );
      }
    });

    it('runs the scheduling value loop: calendars → events → free/busy → proposals', async () => {
      const client = clientFor(adapter, true);

      const calendars = (await client.call('calendars.list', {})) as {
        calendars: Array<{ id: string; isPrimary: boolean }>;
      };
      assert.ok(calendars.calendars.length >= 1, 'account has at least one calendar');

      const events = (await client.call('events.list', {
        from: '2026-07-01T00:00:00.000Z',
        to: '2026-07-02T00:00:00.000Z',
      })) as { events: Array<{ id: string }> };
      assert.ok(events.events.some((e) => e.id === 'evt-1'), 'seeded event is in the window');

      const got = (await client.call('events.get', { eventId: 'evt-1' })) as {
        event: { id: string; title: string };
      };
      assert.equal(got.event.id, 'evt-1', 'events.get round-trips the id');

      const busy = (await client.call('freebusy.query', {
        timeMin: '2026-07-01T00:00:00.000Z',
        timeMax: '2026-07-02T00:00:00.000Z',
      })) as { busy: Array<{ start: string; end: string }> };
      assert.equal(busy.busy.length, 1, 'seeded busy block is reported');

      // The proposal must dodge the seeded 15:00–16:00 busy block — proving
      // the shared slot arithmetic runs identically behind both providers.
      const slots = (await client.call('slots.propose', {
        timeMin: '2026-07-01T15:00:00.000Z',
        timeMax: '2026-07-01T17:00:00.000Z',
        durationMinutes: 30,
        maxProposals: 1,
      })) as { proposals: Array<{ start: string; end: string }> };
      assert.deepEqual(
        slots.proposals,
        [{ start: '2026-07-01T16:00:00.000Z', end: '2026-07-01T16:30:00.000Z' }],
        'first proposed slot starts when the busy block ends',
      );
    });

    it('binds the server to the workspace and leaks no cross-workspace resource', async () => {
      const bound = adapter.buildTest(TEST_WORKSPACE_ID);
      assert.equal(bound.workspaceId, TEST_WORKSPACE_ID);
      const other = adapter.buildTest(OTHER_WORKSPACE_ID);
      assert.equal(other.workspaceId, OTHER_WORKSPACE_ID);

      const res = await dispatch(
        { jsonrpc: '2.0', id: 1, method: 'resources/list' },
        configFor(adapter, bound),
      );
      assert.ok(!('error' in res), 'resources/list does not error');
      const raw = (res.result as { resources?: { uri: string }[] })?.resources
        ?? ((res.result ?? []) as { uri: string }[]);
      assert.ok(
        raw.some((r) => r.uri.includes(TEST_WORKSPACE_ID)),
        'a resource URI is scoped to the bound workspace id',
      );
      assert.ok(
        !raw.some((r) => r.uri.includes(OTHER_WORKSPACE_ID)),
        'no resource URI leaks another workspace id',
      );
    });

    it('prod impl rejects calls with no provisioned credential', async (t: TestContext) => {
      if (await hasProvisionedCredential(adapter.providerKey, TEST_WORKSPACE_ID)) {
        t.skip(`credential provisioned for ${adapter.id} — refusal path not applicable`);
        return;
      }
      const client = clientFor(adapter, false);
      await assert.rejects(
        () =>
          client.call('events.list', {
            from: '2026-07-01T00:00:00.000Z',
            to: '2026-07-02T00:00:00.000Z',
          }),
        'prod impl must refuse to serve data without a credential',
      );
    });

    it('prod impl returns real workspace data when a credential is provisioned', async (t: TestContext) => {
      if (!(await hasProvisionedCredential(adapter.providerKey, TEST_WORKSPACE_ID))) {
        t.skip(`no test credentials provisioned for ${adapter.id}`);
        return;
      }
      const client = clientFor(adapter, false);
      const events = (await client.call('events.list', {
        from: new Date(Date.now() - 7 * 24 * 3600_000).toISOString(),
        to: new Date(Date.now() + 7 * 24 * 3600_000).toISOString(),
      })) as { events: unknown[] };
      assert.ok(Array.isArray(events.events), 'events.list returns real workspace data');
    });
  });
}
