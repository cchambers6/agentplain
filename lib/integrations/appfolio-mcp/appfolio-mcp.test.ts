/**
 * lib/integrations/appfolio-mcp/appfolio-mcp.test.ts
 *
 * Smoke test for the AppFolio MCP server via the in-process MCP client +
 * fixture server. Exercises the exact dispatcher the HTTP route runs. Pure, no
 * network, no DB. Pins both the read surface and the approval gate on the three
 * mutating tools.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { InProcessMcpClient, McpClientError } from '@/lib/integrations/mcp-core';
import { TestAppfolioMcpServer } from './test-server';
import { APPFOLIO_NAMESPACE, type AppfolioMcpServer } from './types';
import { APPFOLIO_TOOLS } from './tools';

function client() {
  const server: AppfolioMcpServer = new TestAppfolioMcpServer({ workspaceId: 'ws-1' });
  return new InProcessMcpClient({
    server,
    tools: APPFOLIO_TOOLS,
    namespace: APPFOLIO_NAMESPACE,
  });
}

describe('appfolio-mcp dispatch', () => {
  it('tools/list exposes the four AppFolio tools', async () => {
    const tools = await client().listTools();
    const names = tools.map((t) => t.name).sort();
    assert.deepEqual(names, [
      'appfolio.charge_tenant',
      'appfolio.create_work_order',
      'appfolio.list_units',
      'appfolio.send_notice',
    ]);
  });

  it('list_units returns fixtures and filters by propertyId', async () => {
    const all = (await client().call('list_units', {})) as {
      units: Array<{ id: string; occupancy: string }>;
    };
    assert.equal(all.units.length, 3);

    const p1 = (await client().call('list_units', { propertyId: 'p-1' })) as {
      units: Array<{ propertyId: string }>;
    };
    assert.equal(p1.units.length, 2);
    assert.ok(p1.units.every((u) => u.propertyId === 'p-1'));

    const p2 = (await client().call('list_units', { propertyId: 'p-2' })) as {
      units: Array<{ propertyId: string }>;
    };
    assert.equal(p2.units.length, 1);
    assert.equal(p2.units[0].propertyId, 'p-2');
  });

  it('every mutating tool is approval-gated (APPROVAL_REQUIRED, AppFolio never called)', async () => {
    const mutations: Array<[string, Record<string, unknown>]> = [
      ['create_work_order', { unitId: 'u-1', description: 'Leaky faucet' }],
      ['charge_tenant', { unitId: 'u-1', amount: 75, memo: 'Late fee' }],
      ['send_notice', { unitId: 'u-1', noticeType: 'late-rent', body: 'Rent is past due.' }],
    ];
    for (const [tool, args] of mutations) {
      await assert.rejects(
        () => client().call(tool, args),
        (err: unknown) =>
          err instanceof McpClientError && err.mcpErrorCode === 'APPROVAL_REQUIRED',
        `${tool} must be approval-gated`,
      );
    }
  });
});
