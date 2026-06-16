/**
 * lib/integrations/hubspot-mcp/hubspot-dispatch.test.ts
 *
 * Dispatch smoke test for the HubSpot MCP via the in-process MCP client +
 * recording server. Exercises the exact dispatcher the HTTP route runs. Pure,
 * no network, no DB. This is the test the connector-dispatch-coverage gate
 * pairs with: a connector that is "available" in the marketplace must both
 * route AND dispatch without 500ing.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { InProcessMcpClient } from '@/lib/integrations/mcp-core';
import { RecordingHubspotMcpServer } from './test-server';
import type { HubspotMcpServer } from './types';
import { HUBSPOT_NAMESPACE, HUBSPOT_TOOLS } from './tools';

function client(server?: HubspotMcpServer) {
  const s =
    server ??
    new RecordingHubspotMcpServer({
      workspaceId: 'ws-1',
      seed: {
        contacts: [
          {
            id: 'c1',
            firstName: 'Dana',
            lastName: 'Reyes',
            email: 'dana@example.com',
            phone: null,
            company: 'Reyes Realty',
            lifecycleStage: 'lead',
            leadSource: 'Web',
            createdAt: null,
            updatedAt: null,
          },
        ],
      },
    });
  return new InProcessMcpClient({ server: s, tools: HUBSPOT_TOOLS, namespace: HUBSPOT_NAMESPACE });
}

describe('hubspot-mcp dispatch', () => {
  it('tools/list exposes the nine HubSpot tools, all namespaced', async () => {
    const tools = await client().listTools();
    assert.equal(tools.length, 9);
    assert.ok(tools.every((t) => t.name.startsWith('hubspot.')));
  });

  it('list_contacts dispatches and returns seeded fixtures (non-500)', async () => {
    const res = (await client().call('list_contacts', {})) as { contacts: unknown[] };
    assert.equal(res.contacts.length, 1);
  });

  it('get_contact dispatches a write-adjacent read and resolves a known id', async () => {
    const res = (await client().call('get_contact', { contactId: 'c1' })) as {
      contact: { id: string };
    };
    assert.equal(res.contact.id, 'c1');
  });

  it('create_note dispatches an internal annotation write', async () => {
    const res = (await client().call('create_note', {
      objectType: 'contacts',
      objectId: 'c1',
      body: 'Triaged: warm lead',
    })) as { noteId: string };
    assert.ok(res.noteId.length > 0);
  });

  it('invalid params return a typed error, not a generic crash', async () => {
    await assert.rejects(() => client().call('get_contact', {}));
  });
});
