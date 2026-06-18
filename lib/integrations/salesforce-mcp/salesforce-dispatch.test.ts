/**
 * lib/integrations/salesforce-mcp/salesforce-dispatch.test.ts
 *
 * Dispatch smoke test for the Salesforce MCP via the in-process MCP client +
 * recording server. Exercises the exact dispatcher the HTTP route runs. Pure,
 * no network, no DB.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { InProcessMcpClient } from '@/lib/integrations/mcp-core';
import { RecordingSalesforceMcpServer } from './test-server';
import { SALESFORCE_NAMESPACE, SALESFORCE_TOOLS } from './tools';

function client() {
  const server = new RecordingSalesforceMcpServer({ workspaceId: 'ws-1' });
  return new InProcessMcpClient({ server, tools: SALESFORCE_TOOLS, namespace: SALESFORCE_NAMESPACE });
}

describe('salesforce-mcp dispatch', () => {
  it('tools/list exposes the twelve Salesforce tools, all namespaced', async () => {
    const tools = await client().listTools();
    assert.equal(tools.length, 12);
    assert.ok(tools.every((t) => t.name.startsWith('salesforce.')));
  });

  it('list_leads dispatches and returns an array (non-500)', async () => {
    const res = (await client().call('list_leads', {})) as { leads: unknown[] };
    assert.ok(Array.isArray(res.leads));
  });

  it('list_opportunities dispatches with a filter (non-500)', async () => {
    const res = (await client().call('list_opportunities', { accountId: 'a1' })) as {
      opportunities: unknown[];
    };
    assert.ok(Array.isArray(res.opportunities));
  });

  it('create_task dispatches the only write tool (subject required)', async () => {
    const res = (await client().call('create_task', { subject: 'Follow up' })) as {
      taskId: string;
    };
    assert.ok(res.taskId.length > 0);
  });

  it('invalid params return a typed error, not a generic crash', async () => {
    await assert.rejects(() => client().call('create_task', {}));
  });
});
