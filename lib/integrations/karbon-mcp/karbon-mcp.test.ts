/**
 * lib/integrations/karbon-mcp/karbon-mcp.test.ts
 *
 * Smoke test for the Karbon MCP server via the in-process MCP client +
 * fixture server. Exercises the exact dispatcher the HTTP route runs.
 * Pure, no network, no DB.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { InProcessMcpClient, McpClientError } from '@/lib/integrations/mcp-core';
import { TestKarbonMcpServer } from './test-server';
import { KARBON_NAMESPACE, type KarbonMcpServer } from './types';
import { KARBON_TOOLS } from './tools';

function client() {
  const server: KarbonMcpServer = new TestKarbonMcpServer({ workspaceId: 'ws-1' });
  return new InProcessMcpClient({ server, tools: KARBON_TOOLS, namespace: KARBON_NAMESPACE });
}

describe('karbon-mcp dispatch', () => {
  it('tools/list exposes the six Karbon tools', async () => {
    const tools = await client().listTools();
    const names = tools.map((t) => t.name).sort();
    assert.deepEqual(names, [
      'karbon.get_client',
      'karbon.get_workflow',
      'karbon.list_clients',
      'karbon.list_jobs',
      'karbon.list_recurring_tasks',
      'karbon.list_workflows',
    ]);
  });

  it('list_clients returns fixtures', async () => {
    const res = (await client().call('list_clients', {})) as {
      clients: Array<{ id: string; kind: string }>;
    };
    assert.equal(res.clients.length, 3);
    const orgs = res.clients.filter((c) => c.kind === 'organization');
    assert.equal(orgs.length, 2);
  });

  it('get_client returns a known client and 404s an unknown one', async () => {
    const res = (await client().call('get_client', { clientId: 'k-cl-1' })) as {
      client: { id: string };
    };
    assert.equal(res.client.id, 'k-cl-1');
    await assert.rejects(
      () => client().call('get_client', { clientId: 'nope' }),
      (err: unknown) => err instanceof McpClientError && err.mcpErrorCode === 'NOT_FOUND',
    );
  });

  it('list_workflows filters by client + status', async () => {
    const all = (await client().call('list_workflows', {})) as {
      workflows: Array<{ id: string }>;
    };
    assert.equal(all.workflows.length, 3);
    const acme = (await client().call('list_workflows', { clientId: 'k-cl-1' })) as {
      workflows: Array<{ clientId: string }>;
    };
    assert.equal(acme.workflows.length, 1);
    assert.equal(acme.workflows[0].clientId, 'k-cl-1');
    const active = (await client().call('list_workflows', { status: 'active' })) as {
      workflows: Array<{ status: string }>;
    };
    assert.equal(active.workflows.length, 2);
    for (const w of active.workflows) assert.equal(w.status, 'active');
  });

  it('get_workflow returns last-activity days', async () => {
    const res = (await client().call('get_workflow', { workflowId: 'wf-1' })) as {
      workflow: { daysSinceLastActivity: number };
    };
    assert.equal(res.workflow.daysSinceLastActivity, 9);
  });

  it('list_jobs filters by workflow + status (blocked)', async () => {
    const blocked = (await client().call('list_jobs', { status: 'blocked' })) as {
      jobs: Array<{ status: string }>;
    };
    assert.equal(blocked.jobs.length, 1);
    assert.equal(blocked.jobs[0].status, 'blocked');

    const wf1 = (await client().call('list_jobs', { workflowId: 'wf-1' })) as {
      jobs: Array<{ workflowId: string }>;
    };
    assert.equal(wf1.jobs.length, 2);
    for (const j of wf1.jobs) assert.equal(j.workflowId, 'wf-1');
  });

  it('list_recurring_tasks returns fixtures with cadence', async () => {
    const res = (await client().call('list_recurring_tasks', {})) as {
      recurringTasks: Array<{ cadence: string }>;
    };
    assert.equal(res.recurringTasks.length, 2);
    const cadences = res.recurringTasks.map((r) => r.cadence).sort();
    assert.deepEqual(cadences, ['monthly', 'quarterly']);
  });
});
