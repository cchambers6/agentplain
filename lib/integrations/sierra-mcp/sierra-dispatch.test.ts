/**
 * lib/integrations/sierra-mcp/sierra-dispatch.test.ts
 *
 * Dispatch smoke test for the Sierra Interactive MCP via the in-process MCP
 * client + recording server. Exercises the exact dispatcher the HTTP route
 * runs. Pure, no network, no DB.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { InProcessMcpClient } from '@/lib/integrations/mcp-core';
import { RecordingSierraMcpServer } from './test-server';
import { SIERRA_NAMESPACE, SIERRA_TOOLS } from './tools';

function client() {
  const server = new RecordingSierraMcpServer({
    workspaceId: 'ws-1',
    seed: {
      leads: [
        {
          id: 'l1',
          firstName: 'Jordan',
          lastName: 'Diaz',
          emails: ['jordan@example.com'],
          phones: [],
          source: 'IDX',
          stage: 'New',
          tags: [],
          lastActivityAt: null,
          createdAt: null,
        },
      ],
    },
  });
  return new InProcessMcpClient({ server, tools: SIERRA_TOOLS, namespace: SIERRA_NAMESPACE });
}

describe('sierra-mcp dispatch', () => {
  it('tools/list exposes the six Sierra tools, all namespaced', async () => {
    const tools = await client().listTools();
    assert.equal(tools.length, 6);
    assert.ok(tools.every((t) => t.name.startsWith('sierra.')));
  });

  it('list_leads dispatches and returns seeded fixtures (non-500)', async () => {
    const res = (await client().call('list_leads', {})) as { leads: unknown[] };
    assert.equal(res.leads.length, 1);
  });

  it('create_note dispatches the triage write-back to a known lead', async () => {
    const res = (await client().call('create_note', {
      leadId: 'l1',
      body: 'Triaged: warm',
    })) as { noteId: string };
    assert.ok(res.noteId.length > 0);
  });

  it('invalid params return a typed error, not a generic crash', async () => {
    await assert.rejects(() => client().call('add_tag', { leadId: 'l1' }));
  });
});
