/**
 * lib/integrations/follow-up-boss-mcp/fub-dispatch.test.ts
 *
 * Dispatch smoke test for the Follow Up Boss MCP via the in-process MCP client
 * + recording server. Exercises the exact dispatcher the HTTP route runs. Pure,
 * no network, no DB.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { InProcessMcpClient } from '@/lib/integrations/mcp-core';
import { RecordingFollowUpBossMcpServer } from './test-server';
import { FOLLOW_UP_BOSS_NAMESPACE, FOLLOW_UP_BOSS_TOOLS } from './tools';

function client() {
  const server = new RecordingFollowUpBossMcpServer({
    workspaceId: 'ws-1',
    seed: {
      leads: [
        {
          id: 'l1',
          firstName: 'Sam',
          lastName: 'Lee',
          emails: ['sam@example.com'],
          phones: [],
          source: 'Zillow',
          stage: 'New',
          tags: [],
          lastActivityAt: null,
          createdAt: null,
        },
      ],
    },
  });
  return new InProcessMcpClient({
    server,
    tools: FOLLOW_UP_BOSS_TOOLS,
    namespace: FOLLOW_UP_BOSS_NAMESPACE,
  });
}

describe('follow-up-boss-mcp dispatch', () => {
  it('tools/list exposes the eight FUB tools, all namespaced', async () => {
    const tools = await client().listTools();
    assert.equal(tools.length, 8);
    assert.ok(tools.every((t) => t.name.startsWith('follow-up-boss.')));
  });

  it('list_leads dispatches and returns seeded fixtures (non-500)', async () => {
    const res = (await client().call('list_leads', {})) as { leads: unknown[] };
    assert.equal(res.leads.length, 1);
  });

  it('create_note dispatches the triage write-back to a known lead', async () => {
    const res = (await client().call('create_note', {
      leadId: 'l1',
      body: 'Triaged: hot',
    })) as { noteId: string };
    assert.ok(res.noteId.length > 0);
  });

  it('invalid params return a typed error, not a generic crash', async () => {
    await assert.rejects(() => client().call('add_tag', { leadId: 'l1' }));
  });
});
