/**
 * lib/integrations/notion-mcp/index.ts
 *
 * Builder + barrel for the Notion MCP. `buildNotionMcpServer` returns the prod
 * server, or the in-memory recording server when `INTEGRATIONS_PROVIDER=test`
 * (parity with the registry switch in `lib/integrations/index.ts`). Skills +
 * cron sweeps + the HTTP route import from here only.
 */

import { ProdNotionMcpServer } from './server';
import { RecordingNotionMcpServer } from './test-server';
import type { NotionMcpServer } from './types';

export function buildNotionMcpServer(args: { workspaceId: string }): NotionMcpServer {
  if (process.env.INTEGRATIONS_PROVIDER === 'test') {
    return new RecordingNotionMcpServer(args);
  }
  return new ProdNotionMcpServer(args);
}

export { NOTION_TOOLS, NOTION_NAMESPACE } from './tools';
export { ProdNotionMcpServer, __renderBlocksToText } from './server';
export { RecordingNotionMcpServer } from './test-server';
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
  SearchWorkspaceInput,
  SearchWorkspaceOutput,
} from './types';
