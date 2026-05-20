/**
 * lib/integrations/docusign-mcp/docusign-mcp.test.ts
 *
 * Smoke test for the DocuSign MCP server via the in-process MCP client +
 * fixture server. Exercises the exact dispatcher the HTTP route runs. Pure,
 * no network, no DB.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { InProcessMcpClient } from '@/lib/integrations/mcp-core';
import { TestDocuSignMcpServer } from './test-server';
import { DOCUSIGN_NAMESPACE, type DocuSignMcpServer } from './types';
import { DOCUSIGN_TOOLS } from './tools';

function client() {
  const server: DocuSignMcpServer = new TestDocuSignMcpServer({ workspaceId: 'ws-1' });
  return new InProcessMcpClient({ server, tools: DOCUSIGN_TOOLS, namespace: DOCUSIGN_NAMESPACE });
}

describe('docusign-mcp dispatch', () => {
  it('tools/list exposes the six DocuSign tools', async () => {
    const tools = await client().listTools();
    const names = tools.map((t) => t.name).sort();
    assert.deepEqual(names, [
      'docusign.download_completed_document',
      'docusign.get_envelope_status',
      'docusign.get_recipient_status',
      'docusign.list_envelopes',
      'docusign.send_envelope',
      'docusign.void_envelope',
    ]);
  });

  it('list_envelopes returns fixtures and filters by status', async () => {
    const all = (await client().call('list_envelopes', {})) as { envelopes: unknown[] };
    assert.equal(all.envelopes.length, 2);
    const sent = (await client().call('list_envelopes', { status: 'sent' })) as {
      envelopes: { status: string }[];
    };
    assert.equal(sent.envelopes.length, 1);
    assert.equal(sent.envelopes[0].status, 'sent');
  });

  it('send_envelope rejects when neither template nor documents are given', async () => {
    await assert.rejects(
      () => client().call('send_envelope', { emailSubject: 'X' }),
      /EITHER templateId OR documents/,
    );
  });

  it('send_envelope from a template returns an envelopeId', async () => {
    const res = (await client().call('send_envelope', {
      emailSubject: 'Listing Agreement',
      templateId: 'tpl-1',
      templateRoles: [{ roleName: 'Signer', name: 'Dana', email: 'dana@example.com' }],
    })) as { envelopeId: string; status: string };
    assert.equal(res.envelopeId, 'env-new-2001');
    assert.equal(res.status, 'sent');
  });

  it('void_envelope refuses a completed envelope', async () => {
    await assert.rejects(() => client().call('void_envelope', { envelopeId: 'env-1001', voidedReason: 'dupe' }), /completed/);
  });

  it('download_completed_document returns base64 PDF bytes', async () => {
    const res = (await client().call('download_completed_document', { envelopeId: 'env-1001' })) as {
      contentBase64: string;
      contentType: string;
    };
    assert.equal(res.contentType, 'application/pdf');
    assert.ok(res.contentBase64.length > 0);
  });
});
