/**
 * lib/integrations/mycase-mcp/mycase-mcp.test.ts
 *
 * Smoke test for the MyCase MCP server via the in-process MCP client + fixture
 * server. Exercises the exact dispatcher the HTTP route runs. Pure, no
 * network, no DB. Pins both the read surface and the approval gate on the
 * three mutating tools.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { InProcessMcpClient, McpClientError } from '@/lib/integrations/mcp-core';
import { TestMyCaseMcpServer } from './test-server';
import { MYCASE_NAMESPACE, type MyCaseMcpServer } from './types';
import { MYCASE_TOOLS } from './tools';

function client() {
  const server: MyCaseMcpServer = new TestMyCaseMcpServer({ workspaceId: 'ws-1' });
  return new InProcessMcpClient({ server, tools: MYCASE_TOOLS, namespace: MYCASE_NAMESPACE });
}

describe('mycase-mcp dispatch', () => {
  it('tools/list exposes the four MyCase tools', async () => {
    const tools = await client().listTools();
    const names = tools.map((t) => t.name).sort();
    assert.deepEqual(names, [
      'mycase.create_case',
      'mycase.list_cases',
      'mycase.send_invoice',
      'mycase.update_status',
    ]);
  });

  it('list_cases returns fixtures and filters by status + query', async () => {
    const all = (await client().call('list_cases', {})) as {
      cases: Array<{ id: string; status: string }>;
    };
    assert.equal(all.cases.length, 3);

    const open = (await client().call('list_cases', { status: 'open' })) as {
      cases: Array<{ status: string }>;
    };
    assert.equal(open.cases.length, 1);
    assert.equal(open.cases[0].status, 'open');

    const smith = (await client().call('list_cases', { query: 'smith' })) as {
      cases: Array<{ name: string }>;
    };
    assert.equal(smith.cases.length, 1);
    assert.match(smith.cases[0].name, /Smith/);
  });

  it('every mutating tool is approval-gated (APPROVAL_REQUIRED, MyCase never called)', async () => {
    const mutations: Array<[string, Record<string, unknown>]> = [
      ['create_case', { clientId: 'c-1', name: 'New retainer' }],
      ['send_invoice', { caseId: 'cs-1' }],
      ['update_status', { caseId: 'cs-1', status: 'closed' }],
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
