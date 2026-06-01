/**
 * Behavior tests for the wave-10 phase-3a seed-inbox seam.
 *
 * The wave-10 cut ships the SEAM only — the handler is intentionally a
 * no-op with an audit-row side effect. These tests pin the no-op
 * contract so wave-10b's real ingestion change is unmistakable in
 * review (the test for `outcome` flips from `'queued-no-op'` to
 * `'ingested'`, and new ingestion-stats assertions appear).
 *
 * The handler's audit write is wrapped in try/catch so a DB-unavailable
 * test environment still exercises the contract — the audit row write
 * is best-effort observability, not correctness. These tests skip the
 * audit-side effect and assert only the function's return shape.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  runMcpConnectedSeedInbox,
  MCP_CONNECTED_SEED_INBOX_EVENT,
  MCP_CONNECTED_SEED_INBOX_FUNCTION_ID,
  type McpConnectedSeedInboxEventData,
} from '../mcp-connected-seed-inbox';

describe('runMcpConnectedSeedInbox', () => {
  it('returns queued-no-op outcome for Google credentials', async () => {
    const data: McpConnectedSeedInboxEventData = {
      workspaceId: 'ws-1',
      provider: 'GOOGLE',
      credentialId: 'cred-1',
    };
    const out = await runMcpConnectedSeedInbox(data);
    assert.equal(out.outcome, 'queued-no-op');
    assert.equal(out.workspaceId, 'ws-1');
    assert.equal(out.provider, 'GOOGLE');
    assert.equal(out.credentialId, 'cred-1');
    assert.ok(
      out.note.includes('wave-10b'),
      'note should reference wave-10b deferral',
    );
  });

  it('returns queued-no-op outcome for M365 credentials', async () => {
    const data: McpConnectedSeedInboxEventData = {
      workspaceId: 'ws-2',
      provider: 'M365',
      credentialId: 'cred-2',
    };
    const out = await runMcpConnectedSeedInbox(data);
    assert.equal(out.outcome, 'queued-no-op');
    assert.equal(out.provider, 'M365');
  });

  it('note is operator-readable English mentioning the seam', async () => {
    const data: McpConnectedSeedInboxEventData = {
      workspaceId: 'ws-4',
      provider: 'GOOGLE',
      credentialId: 'cred-4',
    };
    const out = await runMcpConnectedSeedInbox(data);
    assert.match(out.note, /trigger seam/i);
  });

  it('event name + function id are stable strings', () => {
    // These ids are part of the Inngest contract — changing them silently
    // would mean dispatched events never reach the handler.
    assert.equal(
      MCP_CONNECTED_SEED_INBOX_EVENT,
      'agentplain/mcp.connected.seed-inbox',
    );
    assert.equal(
      MCP_CONNECTED_SEED_INBOX_FUNCTION_ID,
      'agentplain-mcp-connected-seed-inbox',
    );
  });
});
