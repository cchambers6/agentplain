/**
 * lib/integrations/gmail-mcp/index.ts
 *
 * Public entrypoint for the workspace-scoped Gmail MCP server. The
 * factory returns either the prod Gmail-backed impl or the deterministic
 * fixture impl based on env (`TEST_GMAIL_MCP=true` routes to the test
 * impl). Callers — the HTTP route handler, the smoke test, the skill
 * runner — speak the `GmailMcpServer` interface only.
 *
 * Per `feedback_runner_portability.md`: the per-call selector lives here.
 * No call site outside this file branches on impl name.
 */

import { ProdGmailMcpServer } from './server';
import { TestGmailMcpServer, type TestGmailSeed } from './test-server';
import type { GmailMcpServer } from './types';

export interface GmailMcpFactoryArgs {
  workspaceId: string;
  /** When true, return the deterministic test impl regardless of env. */
  preferTestImpl?: boolean;
  /** Optional seed for the test impl. Ignored by prod. */
  testSeed?: TestGmailSeed;
}

export function buildGmailMcpServer(args: GmailMcpFactoryArgs): GmailMcpServer {
  const useTest =
    args.preferTestImpl === true ||
    process.env.TEST_GMAIL_MCP === 'true' ||
    process.env.INTEGRATIONS_PROVIDER === 'test';
  if (useTest) {
    return new TestGmailMcpServer({
      workspaceId: args.workspaceId,
      seed: args.testSeed,
    });
  }
  return new ProdGmailMcpServer({ workspaceId: args.workspaceId });
}

export type { GmailMcpServer } from './types';
export {
  ProdGmailMcpServer,
} from './server';
export {
  TestGmailMcpServer,
  type TestGmailSeed,
} from './test-server';
export {
  dispatch,
  InProcessMcpClient,
  McpClientError,
  gmailErrorCodeToHttpStatus,
} from './json-rpc';
export {
  resolveCredential,
  __resetInFlightRefreshesForTests,
} from './auth';
export {
  GMAIL_TOOL_NAMES,
  JSON_RPC_ERROR,
  gmailError,
  gmailOk,
  type DraftMessageInput,
  type DraftMessageOutput,
  type FullMessage,
  type GetMessageInput,
  type GetMessageOutput,
  type GmailMcpError,
  type GmailMcpErrorCode,
  type GmailMcpResult,
  type GmailToolName,
  type JsonRpcError,
  type JsonRpcRequest,
  type JsonRpcResponse,
  type JsonRpcSuccess,
  type LabelDescriptor,
  type LabelMessageInput,
  type LabelMessageOutput,
  type ListLabelsOutput,
  type ListMessagesInput,
  type ListMessagesOutput,
  type MessageAttachment,
  type MessageSummary,
  type ReadResourceInput,
  type ReadResourceOutput,
  type ResourceDescriptor,
  type SearchThreadsInput,
  type SearchThreadsOutput,
  type ThreadSummary,
} from './types';
