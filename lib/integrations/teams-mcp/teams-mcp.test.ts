/**
 * lib/integrations/teams-mcp/teams-mcp.test.ts
 *
 * Smoke test for the Teams MCP server via the in-process JSON-RPC client
 * + fixture server. Exercises the same dispatcher the HTTP route runs.
 * Pure, no network, no DB. Critically asserts the approval gate on
 * `send_chat_message` and `post_to_channel` — mirrors the Slack MCP test
 * (`lib/integrations/slack-mcp/slack-mcp.test.ts`) so the no-outbound
 * boundary is consistent across integrations.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { InProcessTeamsMcpClient, TeamsMcpClientError } from './json-rpc';
import { TestTeamsMcpServer } from './test-server';
import { JSON_RPC_ERROR } from '@/lib/integrations/microsoft/mcp-common';

function client() {
  const server = new TestTeamsMcpServer({ workspaceId: 'ws-1' });
  return { server, rpc: new InProcessTeamsMcpClient(server) };
}

describe('teams-mcp dispatch', () => {
  it('tools/list exposes the seven Teams tools', async () => {
    const tools = await client().rpc.listTools();
    const names = tools.map((t) => t.name).sort();
    assert.deepEqual(names, [
      'teams.get_chat_messages',
      'teams.get_meeting_recording_transcript',
      'teams.list_channels',
      'teams.list_chats',
      'teams.list_meetings',
      'teams.post_to_channel',
      'teams.send_chat_message',
    ]);
  });

  it('list_chats returns fixtures', async () => {
    const res = (await client().rpc.call('teams', 'list_chats', {})) as {
      chats: { id: string }[];
    };
    assert.equal(res.chats.length, 2);
    assert.equal(res.chats[0].id, '19:chat-fixture-001@thread.v2');
  });

  it('send_chat_message WITHOUT approvalToken is rejected with APPROVAL_REQUIRED', async () => {
    const { server, rpc } = client();
    await assert.rejects(
      () =>
        rpc.call('teams', 'send_chat_message', {
          chatId: '19:chat-fixture-001@thread.v2',
          body: 'hello',
        }),
      (err: unknown) => {
        assert.ok(err instanceof TeamsMcpClientError);
        assert.equal((err as TeamsMcpClientError).teamsErrorCode, 'APPROVAL_REQUIRED');
        assert.equal(
          (err as TeamsMcpClientError).jsonRpcCode,
          JSON_RPC_ERROR.APPROVAL_REQUIRED,
        );
        return true;
      },
    );
    // Gate short-circuits BEFORE any send is recorded.
    assert.equal(server.getSentMessages().length, 0);
  });

  it('send_chat_message WITH a non-empty approvalToken succeeds', async () => {
    const { server, rpc } = client();
    const res = (await rpc.call('teams', 'send_chat_message', {
      chatId: '19:chat-fixture-001@thread.v2',
      body: 'hello',
      approvalToken: 'appr-123',
    })) as { messageId: string; chatId: string };
    assert.equal(res.chatId, '19:chat-fixture-001@thread.v2');
    assert.ok(res.messageId.length > 0);
    assert.equal(server.getSentMessages().length, 1);
  });

  it('send_chat_message with a whitespace-only approvalToken is rejected', async () => {
    await assert.rejects(
      () =>
        client().rpc.call('teams', 'send_chat_message', {
          chatId: '19:chat-fixture-001@thread.v2',
          body: 'hello',
          approvalToken: '   ',
        }),
      (err: unknown) => {
        assert.ok(err instanceof TeamsMcpClientError);
        assert.equal((err as TeamsMcpClientError).teamsErrorCode, 'APPROVAL_REQUIRED');
        return true;
      },
    );
  });

  it('post_to_channel WITHOUT approvalToken is rejected with APPROVAL_REQUIRED', async () => {
    const { server, rpc } = client();
    await assert.rejects(
      () =>
        rpc.call('teams', 'post_to_channel', {
          teamId: 'team-fixture-001',
          channelId: '19:channel-general@thread.tacv2',
          body: 'hello channel',
        }),
      (err: unknown) => {
        assert.ok(err instanceof TeamsMcpClientError);
        assert.equal((err as TeamsMcpClientError).teamsErrorCode, 'APPROVAL_REQUIRED');
        assert.equal(
          (err as TeamsMcpClientError).jsonRpcCode,
          JSON_RPC_ERROR.APPROVAL_REQUIRED,
        );
        return true;
      },
    );
    assert.equal(server.getSentMessages().length, 0);
  });

  it('post_to_channel WITH a non-empty approvalToken succeeds', async () => {
    const { server, rpc } = client();
    const res = (await rpc.call('teams', 'post_to_channel', {
      teamId: 'team-fixture-001',
      channelId: '19:channel-general@thread.tacv2',
      body: 'hello channel',
      approvalToken: 'appr-123',
    })) as { messageId: string; channelId: string };
    assert.equal(res.channelId, '19:channel-general@thread.tacv2');
    assert.ok(res.messageId.length > 0);
    assert.equal(server.getSentMessages().length, 1);
  });
});
