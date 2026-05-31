/**
 * lib/integrations/taxdome-mcp/taxdome-mcp.test.ts
 *
 * Smoke test for the TaxDome MCP server via the in-process MCP client +
 * fixture server. Exercises the exact dispatcher the HTTP route runs.
 * Pure, no network, no DB.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { InProcessMcpClient, McpClientError } from '@/lib/integrations/mcp-core';
import { TestTaxdomeMcpServer } from './test-server';
import { TAXDOME_NAMESPACE, type TaxdomeMcpServer } from './types';
import { TAXDOME_TOOLS } from './tools';

function client() {
  const server: TaxdomeMcpServer = new TestTaxdomeMcpServer({ workspaceId: 'ws-1' });
  return new InProcessMcpClient({ server, tools: TAXDOME_TOOLS, namespace: TAXDOME_NAMESPACE });
}

describe('taxdome-mcp dispatch', () => {
  it('tools/list exposes the six TaxDome tools', async () => {
    const tools = await client().listTools();
    const names = tools.map((t) => t.name).sort();
    assert.deepEqual(names, [
      'taxdome.get_client',
      'taxdome.get_tax_document',
      'taxdome.list_clients',
      'taxdome.list_engagement_letters',
      'taxdome.list_received_documents',
      'taxdome.list_tax_documents',
    ]);
  });

  it('list_clients returns fixtures', async () => {
    const res = (await client().call('list_clients', {})) as {
      clients: Array<{ id: string }>;
    };
    assert.equal(res.clients.length, 3);
  });

  it('get_client returns a known client and 404s an unknown one', async () => {
    const res = (await client().call('get_client', { clientId: 'cl-1' })) as {
      client: { id: string; name: string };
    };
    assert.equal(res.client.id, 'cl-1');
    assert.equal(res.client.name, 'Acme Roofing');
    await assert.rejects(() => client().call('get_client', { clientId: 'nope' }), /No client nope/);
  });

  it('list_tax_documents returns fixtures and filters by client + status', async () => {
    const all = (await client().call('list_tax_documents', {})) as {
      documents: unknown[];
    };
    assert.equal(all.documents.length, 5);
    const acme = (await client().call('list_tax_documents', { clientId: 'cl-1' })) as {
      documents: Array<{ clientId: string }>;
    };
    assert.equal(acme.documents.length, 3);
    for (const d of acme.documents) assert.equal(d.clientId, 'cl-1');
    const pending = (await client().call('list_tax_documents', {
      status: 'pending-review',
    })) as {
      documents: Array<{ status: string }>;
    };
    assert.equal(pending.documents.length, 2);
    for (const d of pending.documents) assert.equal(d.status, 'pending-review');
  });

  it('get_tax_document returns a known doc and 404s an unknown one', async () => {
    const res = (await client().call('get_tax_document', { documentId: 'doc-1' })) as {
      document: { id: string; kind: string };
    };
    assert.equal(res.document.id, 'doc-1');
    assert.equal(res.document.kind, 'engagement-letter');
    await assert.rejects(
      () => client().call('get_tax_document', { documentId: 'nope' }),
      (err: unknown) => err instanceof McpClientError && err.mcpErrorCode === 'NOT_FOUND',
    );
  });

  it('list_engagement_letters returns only engagement-letter docs', async () => {
    const res = (await client().call('list_engagement_letters', {})) as {
      engagementLetters: Array<{ kind: string }>;
    };
    assert.equal(res.engagementLetters.length, 2);
    for (const d of res.engagementLetters) assert.equal(d.kind, 'engagement-letter');
  });

  it('list_received_documents returns client-uploaded docs with date filter', async () => {
    const all = (await client().call('list_received_documents', {})) as {
      receivedDocuments: Array<{ kind: string }>;
    };
    assert.equal(all.receivedDocuments.length, 2);
    for (const d of all.receivedDocuments) assert.equal(d.kind, 'received-doc');
    const recent = (await client().call('list_received_documents', {
      uploadedSince: '2026-04-13',
    })) as { receivedDocuments: Array<{ uploadedAt: string }> };
    assert.equal(recent.receivedDocuments.length, 1);
    assert.ok(recent.receivedDocuments[0].uploadedAt >= '2026-04-13');
  });

  it('rejects invalid count at the zod boundary', async () => {
    await assert.rejects(
      () => client().call('list_clients', { count: 999 }),
      (err: unknown) => err instanceof McpClientError,
    );
  });
});
