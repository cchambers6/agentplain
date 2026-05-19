/**
 * lib/integrations/teams-mcp/index.ts
 *
 * Public entrypoint for the workspace-scoped Teams MCP server. Mirrors
 * `lib/integrations/outlook-mcp/index.ts`. The factory returns either the
 * prod Microsoft-Graph-backed impl or the deterministic fixture impl
 * based on env (`TEST_M365_MCP=true` or `INTEGRATIONS_PROVIDER=test`).
 *
 * Per `feedback_runner_portability.md`: the per-call selector lives here.
 * No call site outside this file branches on impl name.
 */

import { ProdTeamsMcpServer } from './server';
import { TestTeamsMcpServer, type TestTeamsSeed } from './test-server';
import type { TeamsMcpServer } from './types';

export interface TeamsMcpFactoryArgs {
  workspaceId: string;
  preferTestImpl?: boolean;
  testSeed?: TestTeamsSeed;
  fetchImpl?: typeof fetch;
}

export function buildTeamsMcpServer(args: TeamsMcpFactoryArgs): TeamsMcpServer {
  const useTest =
    args.preferTestImpl === true ||
    process.env.TEST_M365_MCP === 'true' ||
    process.env.TEST_TEAMS_MCP === 'true' ||
    process.env.INTEGRATIONS_PROVIDER === 'test';
  if (useTest) {
    return new TestTeamsMcpServer({
      workspaceId: args.workspaceId,
      seed: args.testSeed,
    });
  }
  return new ProdTeamsMcpServer({
    workspaceId: args.workspaceId,
    fetchImpl: args.fetchImpl,
  });
}

export type { TeamsMcpServer } from './types';
export { ProdTeamsMcpServer } from './server';
export { TestTeamsMcpServer, type TestTeamsSeed } from './test-server';
export {
  dispatch,
  InProcessTeamsMcpClient,
  TeamsMcpClientError,
  teamsErrorCodeToHttpStatus,
} from './json-rpc';
export { resolveCredential } from './auth';
export {
  TEAMS_TOOL_NAMES,
  type ChannelSummary,
  type ChatMessage,
  type ChatSummary,
  type GetChatMessagesInput,
  type GetChatMessagesOutput,
  type GetMeetingRecordingTranscriptInput,
  type GetMeetingRecordingTranscriptOutput,
  type ListChannelsInput,
  type ListChannelsOutput,
  type ListChatsInput,
  type ListChatsOutput,
  type ListMeetingsInput,
  type ListMeetingsOutput,
  type MeetingSummary,
  type MeetingTranscript,
  type PostToChannelInput,
  type PostToChannelOutput,
  type ReadResourceInput,
  type ReadResourceOutput,
  type ResourceDescriptor,
  type SendChatMessageInput,
  type SendChatMessageOutput,
  type TeamsToolName,
} from './types';
export {
  JSON_RPC_ERROR,
  mcpError,
  mcpOk,
  type McpError,
  type McpErrorCode,
  type McpResult,
  type JsonRpcError,
  type JsonRpcRequest,
  type JsonRpcResponse,
  type JsonRpcSuccess,
} from '@/lib/integrations/microsoft/mcp-common';
