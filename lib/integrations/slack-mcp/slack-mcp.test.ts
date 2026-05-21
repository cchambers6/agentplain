/**
 * lib/integrations/slack-mcp/slack-mcp.test.ts
 *
 * Smoke test for the Slack MCP server via the in-process MCP client + fixture
 * server. Exercises the exact dispatcher the HTTP route runs. Pure, no network,
 * no DB. Critically asserts the approval gate on `post_message`.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { InProcessMcpClient, McpClientError } from '@/lib/integrations/mcp-core';
import { TestSlackMcpServer } from './test-server';
import { SLACK_NAMESPACE, type SlackMcpServer } from './types';
import { SLACK_TOOLS } from './tools';

function client() {
  const server: SlackMcpServer = new TestSlackMcpServer({ workspaceId: 'ws-1' });
  return new InProcessMcpClient({ server, tools: SLACK_TOOLS, namespace: SLACK_NAMESPACE });
}

describe('slack-mcp dispatch', () => {
  it('tools/list exposes the five Slack tools', async () => {
    const tools = await client().listTools();
    const names = tools.map((t) => t.name).sort();
    assert.deepEqual(names, [
      'slack.list_channels',
      'slack.post_message',
      'slack.read_channel_history',
      'slack.search_messages',
      'slack.send_dm',
    ]);
  });

  it('list_channels returns fixtures', async () => {
    const res = (await client().call('list_channels', {})) as { channels: { id: string }[] };
    assert.equal(res.channels.length, 3);
    assert.equal(res.channels[0].id, 'C1001');
  });

  it('read_channel_history returns messages for a known channel', async () => {
    const res = (await client().call('read_channel_history', { channel: 'C1001' })) as {
      messages: unknown[];
    };
    assert.equal(res.messages.length, 2);
  });

  it('search_messages matches fixture text', async () => {
    const res = (await client().call('search_messages', { query: 'Peachtree' })) as {
      matches: { text: string }[];
    };
    assert.equal(res.matches.length, 1);
    assert.match(res.matches[0].text, /Peachtree/);
  });

  it('post_message WITHOUT approvalToken is rejected with APPROVAL_REQUIRED', async () => {
    await assert.rejects(
      () => client().call('post_message', { channel: 'C1001', text: 'hello' }),
      (err: unknown) => {
        assert.ok(err instanceof McpClientError);
        assert.equal((err as McpClientError).mcpErrorCode, 'APPROVAL_REQUIRED');
        return true;
      },
    );
  });

  it('post_message WITH a non-empty approvalToken succeeds', async () => {
    const res = (await client().call('post_message', {
      channel: 'C1001',
      text: 'hello',
      approvalToken: 'appr-123',
    })) as { channel: string; ts: string };
    assert.equal(res.channel, 'C1001');
    assert.ok(res.ts.length > 0);
  });

  it('send_dm WITHOUT approvalToken is rejected with APPROVAL_REQUIRED', async () => {
    await assert.rejects(
      () => client().call('send_dm', { userId: 'U500', text: 'hi' }),
      (err: unknown) => {
        assert.ok(err instanceof McpClientError);
        assert.equal((err as McpClientError).mcpErrorCode, 'APPROVAL_REQUIRED');
        return true;
      },
    );
  });

  it('send_dm WITH a non-empty approvalToken succeeds', async () => {
    const res = (await client().call('send_dm', {
      userId: 'U500',
      text: 'hi',
      approvalToken: 'appr-123',
    })) as { ts: string };
    assert.ok(res.ts.length > 0);
  });
});
