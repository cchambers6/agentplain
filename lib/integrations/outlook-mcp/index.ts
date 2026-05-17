/**
 * lib/integrations/outlook-mcp/index.ts
 *
 * Public entrypoint for the workspace-scoped Outlook MCP server. Mirrors
 * `lib/integrations/gmail-mcp/index.ts`. The factory returns either the
 * prod Microsoft-Graph-backed impl or the deterministic fixture impl
 * based on env (`TEST_OUTLOOK_MCP=true` routes to the test impl).
 * Callers — the HTTP route handler, the smoke test, the skill runner —
 * speak the `OutlookMcpServer` interface only.
 *
 * Per `feedback_runner_portability.md`: the per-call selector lives here.
 * No call site outside this file branches on impl name.
 */

import { ProdOutlookMcpServer } from './server';
import { TestOutlookMcpServer, type TestOutlookSeed } from './test-server';
import type { OutlookMcpServer } from './types';

export interface OutlookMcpFactoryArgs {
  workspaceId: string;
  /** When true, return the deterministic test impl regardless of env. */
  preferTestImpl?: boolean;
  /** Optional seed for the test impl. Ignored by prod. */
  testSeed?: TestOutlookSeed;
  /** Optional `fetch` override (prod only). Tests can stub Microsoft
   *  Graph here without touching the test impl. */
  fetchImpl?: typeof fetch;
}

export function buildOutlookMcpServer(args: OutlookMcpFactoryArgs): OutlookMcpServer {
  const useTest =
    args.preferTestImpl === true ||
    process.env.TEST_OUTLOOK_MCP === 'true' ||
    process.env.INTEGRATIONS_PROVIDER === 'test';
  if (useTest) {
    return new TestOutlookMcpServer({
      workspaceId: args.workspaceId,
      seed: args.testSeed,
    });
  }
  return new ProdOutlookMcpServer({
    workspaceId: args.workspaceId,
    fetchImpl: args.fetchImpl,
  });
}

export type { OutlookMcpServer } from './types';
export {
  ProdOutlookMcpServer,
} from './server';
export {
  TestOutlookMcpServer,
  type TestOutlookSeed,
} from './test-server';
export {
  dispatch,
  InProcessOutlookMcpClient,
  OutlookMcpClientError,
  outlookErrorCodeToHttpStatus,
} from './json-rpc';
export {
  resolveCredential,
  __resetInFlightRefreshesForTests,
} from './auth';
export {
  OUTLOOK_TOOL_NAMES,
  JSON_RPC_ERROR,
  outlookError,
  outlookOk,
  type DraftMessageInput,
  type DraftMessageOutput,
  type FullMessage,
  type GetMessageInput,
  type GetMessageOutput,
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
  type OutlookMcpError,
  type OutlookMcpErrorCode,
  type OutlookMcpResult,
  type OutlookToolName,
  type ReadResourceInput,
  type ReadResourceOutput,
  type ResourceDescriptor,
  type SearchThreadsInput,
  type SearchThreadsOutput,
  type ThreadSummary,
} from './types';
