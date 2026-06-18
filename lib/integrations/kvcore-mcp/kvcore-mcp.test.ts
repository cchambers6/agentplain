/**
 * lib/integrations/kvcore-mcp/kvcore-mcp.test.ts
 *
 * Smoke test for the kvCORE MCP server via the in-process MCP client + fixture
 * server. Exercises the exact dispatcher the HTTP route runs. Pure, no
 * network, no DB. Pins both the read surface and the approval gate on the three
 * mutating tools.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { InProcessMcpClient, McpClientError } from '@/lib/integrations/mcp-core';
import { TestKvcoreMcpServer } from './test-server';
import { KVCORE_NAMESPACE, type KvcoreMcpServer } from './types';
import { KVCORE_TOOLS } from './tools';

function client() {
  const server: KvcoreMcpServer = new TestKvcoreMcpServer({ workspaceId: 'ws-1' });
  return new InProcessMcpClient({ server, tools: KVCORE_TOOLS, namespace: KVCORE_NAMESPACE });
}

describe('kvcore-mcp dispatch', () => {
  it('tools/list exposes the four kvCORE tools', async () => {
    const tools = await client().listTools();
    const names = tools.map((t) => t.name).sort();
    assert.deepEqual(names, [
      'kvcore.create_lead',
      'kvcore.list_leads',
      'kvcore.log_activity',
      'kvcore.send_mass_message',
    ]);
  });

  it('list_leads returns fixtures and filters by query', async () => {
    const all = (await client().call('list_leads', {})) as {
      leads: Array<{ id: string; status: string }>;
    };
    assert.equal(all.leads.length, 3);

    const smith = (await client().call('list_leads', { query: 'smith' })) as {
      leads: Array<{ name: string }>;
    };
    assert.equal(smith.leads.length, 1);
    assert.match(smith.leads[0].name, /Smith/);
  });

  it('every mutating tool is approval-gated (APPROVAL_REQUIRED, kvCORE never called)', async () => {
    const mutations: Array<[string, Record<string, unknown>]> = [
      ['create_lead', { name: 'New Lead', email: 'new@example.com' }],
      ['send_mass_message', { leadIds: ['l-1', 'l-2'], message: 'Open house Saturday' }],
      ['log_activity', { leadId: 'l-1', note: 'Left voicemail' }],
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
