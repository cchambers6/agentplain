/**
 * lib/integrations/notion-mcp/index.ts
 *
 * Public surface for the Notion MCP. Skills + cron sweeps import from
 * here only.
 */

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
