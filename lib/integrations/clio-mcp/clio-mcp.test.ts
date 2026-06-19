/**
 * lib/integrations/clio-mcp/clio-mcp.test.ts
 *
 * Smoke test for the Clio MCP server via the in-process MCP client + fixture
 * server. Exercises the exact dispatcher the HTTP route runs. Pure, no
 * network, no DB. Pins both the read surface and the approval gate on the four
 * mutating tools.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { InProcessMcpClient, McpClientError } from '@/lib/integrations/mcp-core';
import { TestClioMcpServer } from './test-server';
import { CLIO_NAMESPACE, type ClioMcpServer } from './types';
import { CLIO_TOOLS } from './tools';

function client() {
  const server: ClioMcpServer = new TestClioMcpServer({ workspaceId: 'ws-1' });
  return new InProcessMcpClient({ server, tools: CLIO_TOOLS, namespace: CLIO_NAMESPACE });
}

describe('clio-mcp dispatch', () => {
  it('tools/list exposes the five Clio tools', async () => {
    const tools = await client().listTools();
    const names = tools.map((t) => t.name).sort();
    assert.deepEqual(names, [
      'clio.create_bill',
      'clio.create_matter',
      'clio.list_matters',
      'clio.log_time',
      'clio.send_secure_message',
    ]);
  });

  it('list_matters returns fixtures and filters by status + query', async () => {
    const all = (await client().call('list_matters', {})) as {
      matters: Array<{ id: string; status: string }>;
    };
    assert.equal(all.matters.length, 3);

    const open = (await client().call('list_matters', { status: 'open' })) as {
      matters: Array<{ status: string }>;
    };
    assert.equal(open.matters.length, 1);
    assert.equal(open.matters[0].status, 'open');

    const smith = (await client().call('list_matters', { query: 'smith' })) as {
      matters: Array<{ displayNumber: string }>;
    };
    assert.equal(smith.matters.length, 1);
    assert.match(smith.matters[0].displayNumber, /Smith/);
  });

  it('every mutating tool is approval-gated (APPROVAL_REQUIRED, Clio never called)', async () => {
    const mutations: Array<[string, Record<string, unknown>]> = [
      ['create_matter', { clientId: 'c-1', description: 'New retainer' }],
      ['log_time', { matterId: 'm-1', minutes: 30, description: 'Call with client' }],
      ['create_bill', { matterId: 'm-1' }],
      [
        'send_secure_message',
        { matterId: 'm-1', recipientContactId: 'c-1', subject: 'Update', body: 'Hello' },
      ],
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
