/**
 * lib/integrations/boldtrail-mcp/boldtrail-mcp.test.ts
 *
 * Smoke test for the BoldTrail MCP server via the in-process MCP client +
 * fixture server. Exercises the exact dispatcher the HTTP route runs. Pure, no
 * network, no DB. Pins both the read surface and the approval gate on the two
 * mutating tools.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { InProcessMcpClient, McpClientError } from '@/lib/integrations/mcp-core';
import { TestBoldtrailMcpServer } from './test-server';
import { BOLDTRAIL_NAMESPACE, type BoldtrailMcpServer } from './types';
import { BOLDTRAIL_TOOLS } from './tools';

function client() {
  const server: BoldtrailMcpServer = new TestBoldtrailMcpServer({ workspaceId: 'ws-1' });
  return new InProcessMcpClient({
    server,
    tools: BOLDTRAIL_TOOLS,
    namespace: BOLDTRAIL_NAMESPACE,
  });
}

describe('boldtrail-mcp dispatch', () => {
  it('tools/list exposes the three BoldTrail tools', async () => {
    const tools = await client().listTools();
    const names = tools.map((t) => t.name).sort();
    assert.deepEqual(names, [
      'boldtrail.list_leads',
      'boldtrail.send_template',
      'boldtrail.update_pipeline',
    ]);
  });

  it('list_leads returns fixtures and filters by query', async () => {
    const all = (await client().call('list_leads', {})) as {
      leads: Array<{ id: string; stage: string }>;
    };
    assert.equal(all.leads.length, 3);

    const ava = (await client().call('list_leads', { query: 'ava' })) as {
      leads: Array<{ name: string }>;
    };
    assert.equal(ava.leads.length, 1);
    assert.match(ava.leads[0].name, /Ava/);
  });

  it('every mutating tool is approval-gated (APPROVAL_REQUIRED, BoldTrail never called)', async () => {
    const mutations: Array<[string, Record<string, unknown>]> = [
      ['update_pipeline', { leadId: 'l-1', pipelineId: 'p-1', stage: 'Active' }],
      ['send_template', { leadId: 'l-1', templateId: 't-1' }],
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
