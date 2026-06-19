/**
 * lib/integrations/notion-mcp/index.ts
 *
 * Builder + barrel for the Notion MCP. `buildNotionMcpServer` returns the prod
 * server, or the in-memory recording server when `INTEGRATIONS_PROVIDER=test`
 * (parity with the registry switch in `lib/integrations/index.ts`). Skills +
 * cron sweeps + the HTTP route import from here only.
 */

import {
  buildConnectorApprovalDeps,
  type ConnectorApprovalDeps,
} from '@/lib/integrations/approval';
import { ProdNotionMcpServer } from './server';
import { RecordingNotionMcpServer } from './test-server';
import { withNotionApproval } from './with-approval';
import type { NotionMcpServer } from './types';

/**
 * Build the Notion MCP server. Every mutating method is approval-gated at this
 * seam — an ungated server can't be obtained. Tests inject `deps` carrying an
 * in-memory gate + audit sink so they can seed grants deterministically.
 */
export function buildNotionMcpServer(args: {
  workspaceId: string;
  deps?: ConnectorApprovalDeps;
}): NotionMcpServer {
  const deps = args.deps ?? buildConnectorApprovalDeps();
  if (process.env.INTEGRATIONS_PROVIDER === 'test') {
    return withNotionApproval(new RecordingNotionMcpServer({ workspaceId: args.workspaceId }), deps);
  }
  return withNotionApproval(new ProdNotionMcpServer({ workspaceId: args.workspaceId }), deps);
}

export { NOTION_TOOLS, NOTION_NAMESPACE } from './tools';
export { ProdNotionMcpServer, __renderBlocksToText } from './server';
export { RecordingNotionMcpServer } from './test-server';
export { withNotionApproval } from './with-approval';
export {
  NOTION_CONNECTOR,
  ADD_COMMENT,
  notionAction,
  type WriteActionDescriptor,
} from './actions';
export { NotionFileSource } from './notion-file-source';
export { resolveNotionCredential, type ResolvedNotion } from './auth';
export type {
  NotionMcpServer,
  NotionPageSummary,
  NotionDatabaseSummary,
  NotionPageContent,
  NotionSearchHit,
  ListPagesInput,
  ListPagesOutput,
  GetPageInput,
  GetPageOutput,
  ListDatabasesInput,
  ListDatabasesOutput,
  QueryDatabaseInput,
  QueryDatabaseOutput,
  CreatePageInput,
  CreatePageOutput,
  UpdatePageInput,
  UpdatePageOutput,
  AddCommentInput,
  AddCommentOutput,
  SearchWorkspaceInput,
  SearchWorkspaceOutput,
} from './types';
