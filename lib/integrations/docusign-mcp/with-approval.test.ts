/**
 * lib/integrations/docusign-mcp/with-approval.test.ts
 *
 * Smoke test for the DocuSign approval gate. Exercises the gated server
 * through the exact JSON-RPC dispatcher the HTTP route runs (InProcessMcpClient
 * → dispatch → tool schema → decorator → gate). Pure: no network, no DB.
 *
 * The security contract under test:
 *   - send/void WITHOUT an approved grant are rejected with APPROVAL_REQUIRED
 *     and the underlying DocuSign server is NEVER invoked.
 *   - send/void WITH a valid, unexpired, fingerprint-matching grant succeed.
 *   - an expired grant, or a grant for a different action, is rejected.
 *   - read methods are never gated.
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { InProcessMcpClient, McpClientError, type McpResult } from '@/lib/integrations/mcp-core';
import { TestDocuSignMcpServer } from './test-server';
import { DOCUSIGN_NAMESPACE, type DocuSignMcpServer } from './types';
import type {
  DownloadCompletedDocumentInput,
  DownloadCompletedDocumentOutput,
  SendEnvelopeInput,
  SendEnvelopeOutput,
  VoidEnvelopeInput,
  VoidEnvelopeOutput,
  GetEnvelopeStatusInput,
  GetEnvelopeStatusOutput,
  GetRecipientStatusInput,
  GetRecipientStatusOutput,
  ListEnvelopesInput,
  ListEnvelopesOutput,
} from './types';
import { DOCUSIGN_TOOLS } from './tools';
import {
  withDocuSignApproval,
  summarizeSend,
  summarizeVoid,
  type DocuSignGatedAction,
} from './with-approval';
import { InMemoryDocuSignApprovalGate } from './approval-gate-memory';

const WORKSPACE_ID = 'ws-1';
const FIXED_NOW = Date.parse('2026-06-15T12:00:00Z');

/**
 * Inner server that counts how many times the MUTATING methods are invoked, so
 * the test can prove the gate stops a call BEFORE it reaches DocuSign. Reads
 * delegate to the fixture server.
 */
class SpyDocuSignServer implements DocuSignMcpServer {
  readonly name = 'docusign-spy' as const;
  readonly workspaceId = WORKSPACE_ID;
  sendCalls = 0;
  voidCalls = 0;
  private readonly fixture = new TestDocuSignMcpServer({ workspaceId: WORKSPACE_ID });

  listEnvelopes(i: ListEnvelopesInput): Promise<McpResult<ListEnvelopesOutput>> {
    return this.fixture.listEnvelopes(i);
  }
  getEnvelopeStatus(i: GetEnvelopeStatusInput): Promise<McpResult<GetEnvelopeStatusOutput>> {
    return this.fixture.getEnvelopeStatus(i);
  }
  getRecipientStatus(i: GetRecipientStatusInput): Promise<McpResult<GetRecipientStatusOutput>> {
    return this.fixture.getRecipientStatus(i);
  }
  downloadCompletedDocument(
    i: DownloadCompletedDocumentInput,
  ): Promise<McpResult<DownloadCompletedDocumentOutput>> {
    return this.fixture.downloadCompletedDocument(i);
  }
  sendEnvelope(i: SendEnvelopeInput): Promise<McpResult<SendEnvelopeOutput>> {
    this.sendCalls += 1;
    return this.fixture.sendEnvelope(i);
  }
  voidEnvelope(i: VoidEnvelopeInput): Promise<McpResult<VoidEnvelopeOutput>> {
    this.voidCalls += 1;
    return this.fixture.voidEnvelope(i);
  }
}

let spy: SpyDocuSignServer;
let gate: InMemoryDocuSignApprovalGate;

function client() {
  const server = withDocuSignApproval(spy, gate);
  return new InProcessMcpClient({ server, tools: DOCUSIGN_TOOLS, namespace: DOCUSIGN_NAMESPACE });
}

// A valid template-path send the fixture server accepts.
const SEND_INPUT: SendEnvelopeInput = {
  emailSubject: 'Listing Agreement — 123 Peachtree',
  templateId: 'tpl-1',
  templateRoles: [{ roleName: 'Signer', name: 'Dana', email: 'dana@example.com' }],
};
// env-1002 is the fixture's in-flight (voidable) envelope.
const VOID_INPUT: VoidEnvelopeInput = { envelopeId: 'env-1002', voidedReason: 'duplicate' };

function sendAction(pendingApprovalId?: string): DocuSignGatedAction {
  return { type: 'send', pendingApprovalId, detail: summarizeSend(SEND_INPUT) };
}
function voidAction(pendingApprovalId?: string): DocuSignGatedAction {
  return { type: 'void', pendingApprovalId, detail: summarizeVoid(VOID_INPUT) };
}

async function expectApprovalRequired(fn: () => Promise<unknown>): Promise<McpClientError> {
  try {
    await fn();
  } catch (err) {
    assert.ok(err instanceof McpClientError, `expected McpClientError, got ${String(err)}`);
    assert.equal(err.mcpErrorCode, 'APPROVAL_REQUIRED');
    return err;
  }
  throw new Error('expected the call to be rejected with APPROVAL_REQUIRED');
}

describe('docusign approval gate', () => {
  beforeEach(() => {
    spy = new SpyDocuSignServer();
    gate = new InMemoryDocuSignApprovalGate({ now: () => FIXED_NOW });
  });

  it('send WITHOUT an approval token is rejected and never reaches DocuSign', async () => {
    await expectApprovalRequired(() => client().call('send_envelope', { ...SEND_INPUT }));
    assert.equal(spy.sendCalls, 0, 'DocuSign send must not be invoked without approval');
  });

  it('void WITHOUT an approval token is rejected and never reaches DocuSign', async () => {
    await expectApprovalRequired(() => client().call('void_envelope', { ...VOID_INPUT }));
    assert.equal(spy.voidCalls, 0, 'DocuSign void must not be invoked without approval');
  });

  it('send WITH a valid, unexpired, approved grant succeeds', async () => {
    gate.seedApproved({
      pendingApprovalId: 'appr-send-1',
      workspaceId: WORKSPACE_ID,
      action: sendAction(),
      approvedByUserId: 'user-owner',
      expiresAt: new Date(FIXED_NOW + 60_000).toISOString(),
    });
    const res = (await client().call('send_envelope', {
      ...SEND_INPUT,
      pendingApprovalId: 'appr-send-1',
    })) as { envelopeId: string; status: string };
    assert.equal(res.envelopeId, 'env-new-2001');
    assert.equal(spy.sendCalls, 1, 'an approved send must reach DocuSign exactly once');
  });

  it('void WITH a valid approved grant succeeds', async () => {
    gate.seedApproved({
      pendingApprovalId: 'appr-void-1',
      workspaceId: WORKSPACE_ID,
      action: voidAction(),
      approvedByUserId: 'user-owner',
    });
    const res = (await client().call('void_envelope', {
      ...VOID_INPUT,
      pendingApprovalId: 'appr-void-1',
    })) as { envelopeId: string; status: string };
    assert.equal(res.status, 'voided');
    assert.equal(spy.voidCalls, 1);
  });

  it('a still-PENDING grant does not let the send through', async () => {
    gate.seedPending({
      pendingApprovalId: 'appr-pending',
      workspaceId: WORKSPACE_ID,
      action: sendAction(),
    });
    await expectApprovalRequired(() =>
      client().call('send_envelope', { ...SEND_INPUT, pendingApprovalId: 'appr-pending' }),
    );
    assert.equal(spy.sendCalls, 0);
  });

  it('an EXPIRED grant is rejected', async () => {
    gate.seedApproved({
      pendingApprovalId: 'appr-expired',
      workspaceId: WORKSPACE_ID,
      action: sendAction(),
      approvedByUserId: 'user-owner',
      expiresAt: new Date(FIXED_NOW - 1).toISOString(),
    });
    await expectApprovalRequired(() =>
      client().call('send_envelope', { ...SEND_INPUT, pendingApprovalId: 'appr-expired' }),
    );
    assert.equal(spy.sendCalls, 0, 'an expired approval must not reach DocuSign');
  });

  it('a grant approved for a DIFFERENT envelope cannot be replayed', async () => {
    // Operator approved sending to dana@example.com; the agent then tries to
    // send the same subject to a different recipient using that approval id.
    gate.seedApproved({
      pendingApprovalId: 'appr-bound',
      workspaceId: WORKSPACE_ID,
      action: sendAction(),
      approvedByUserId: 'user-owner',
    });
    await expectApprovalRequired(() =>
      client().call('send_envelope', {
        ...SEND_INPUT,
        templateRoles: [{ roleName: 'Signer', name: 'Eve', email: 'eve@evil.example' }],
        pendingApprovalId: 'appr-bound',
      }),
    );
    assert.equal(spy.sendCalls, 0, 'a fingerprint mismatch must not reach DocuSign');
  });

  it('a grant from another workspace is rejected', async () => {
    gate.seedApproved({
      pendingApprovalId: 'appr-other-ws',
      workspaceId: 'ws-other',
      action: sendAction(),
      approvedByUserId: 'user-owner',
    });
    await expectApprovalRequired(() =>
      client().call('send_envelope', { ...SEND_INPUT, pendingApprovalId: 'appr-other-ws' }),
    );
    assert.equal(spy.sendCalls, 0);
  });

  it('read methods are NOT gated', async () => {
    const all = (await client().call('list_envelopes', {})) as { envelopes: unknown[] };
    assert.equal(all.envelopes.length, 2);
    const dl = (await client().call('download_completed_document', {
      envelopeId: 'env-1001',
    })) as { contentType: string };
    assert.equal(dl.contentType, 'application/pdf');
  });
});
