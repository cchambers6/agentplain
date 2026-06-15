/**
 * lib/integrations/buildium-mcp/buildium-dispatch.test.ts
 *
 * Dispatch smoke test for the Buildium MCP via the in-process MCP client +
 * fixture server. Exercises the exact dispatcher the HTTP route runs. Pure, no
 * network, no DB. (Buildium fixtures-by-default means this runs without the
 * BUILDIUM_ADAPTER_LIVE flag or a live credential.)
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { InProcessMcpClient } from '@/lib/integrations/mcp-core';
import { TestBuildiumMcpServer } from './test-server';
import { BUILDIUM_NAMESPACE, BUILDIUM_TOOLS } from './tools';

function client() {
  const server = new TestBuildiumMcpServer({ workspaceId: 'ws-1' });
  return new InProcessMcpClient({ server, tools: BUILDIUM_TOOLS, namespace: BUILDIUM_NAMESPACE });
}

describe('buildium-mcp dispatch', () => {
  it('tools/list exposes the Buildium dispatch tool, namespaced', async () => {
    const tools = await client().listTools();
    assert.equal(tools.length, 1);
    assert.equal(tools[0].name, 'buildium.list_delinquent_leases');
  });

  it('list_delinquent_leases dispatches and returns fixtures (non-500)', async () => {
    const res = (await client().call('list_delinquent_leases', {})) as { leases: unknown[] };
    assert.ok(Array.isArray(res.leases));
  });

  it('respects a limit through the dispatch path', async () => {
    const res = (await client().call('list_delinquent_leases', { limit: 1 })) as {
      leases: unknown[];
    };
    assert.ok(res.leases.length <= 1);
  });
});
