/**
 * lib/integrations/notion-mcp/test-server.ts
 *
 * In-memory Notion MCP for tests. Tests seed pages + databases;
 * assertions read back captured write-side calls.
 */

import { mcpError, mcpOk, type McpResult } from '@/lib/integrations/mcp-core';
import type {
  AddCommentInput,
  AddCommentOutput,
  CreatePageInput,
  CreatePageOutput,
  GetPageInput,
  GetPageOutput,
  ListDatabasesInput,
  ListDatabasesOutput,
  ListPagesInput,
  ListPagesOutput,
  NotionDatabaseSummary,
  NotionMcpServer,
  NotionPageContent,
  NotionPageSummary,
  QueryDatabaseInput,
  QueryDatabaseOutput,
  SearchWorkspaceInput,
  SearchWorkspaceOutput,
  UpdatePageInput,
  UpdatePageOutput,
} from './types';

export interface SeededPage extends NotionPageSummary {
  /** Plain-text body the tester seeded — get_page returns this. */
  body?: string;
}

export interface TestNotionSeed {
  pages?: SeededPage[];
  databases?: NotionDatabaseSummary[];
}

export interface RecordedNotionCall {
  tool:
    | 'listPages'
    | 'getPage'
    | 'listDatabases'
    | 'queryDatabase'
    | 'createPage'
    | 'updatePage'
    | 'addComment'
    | 'searchWorkspace';
  input: unknown;
}

export class RecordingNotionMcpServer implements NotionMcpServer {
  readonly name = 'recording' as const;
  readonly workspaceId: string;
  readonly calls: RecordedNotionCall[] = [];
  private readonly pages: Map<string, SeededPage>;
  private readonly databases: Map<string, NotionDatabaseSummary>;
  private nextPageId = 5000;
  private nextCommentId = 9000;

  constructor(args: { workspaceId: string; seed?: TestNotionSeed }) {
    this.workspaceId = args.workspaceId;
    this.pages = new Map((args.seed?.pages ?? []).map((p) => [p.id, { ...p }]));
    this.databases = new Map((args.seed?.databases ?? []).map((d) => [d.id, { ...d }]));
  }

  async listPages(input: ListPagesInput): Promise<McpResult<ListPagesOutput>> {
    this.calls.push({ tool: 'listPages', input });
    const limit = input.limit ?? 25;
    const all = [...this.pages.values()].filter((p) => !p.archived);
    const filtered = input.query
      ? all.filter((p) => p.title.toLowerCase().includes(input.query!.toLowerCase()))
      : all;
    return mcpOk({ pages: filtered.slice(0, limit).map(stripBody) });
  }

  async getPage(input: GetPageInput): Promise<McpResult<GetPageOutput>> {
    this.calls.push({ tool: 'getPage', input });
    const p = this.pages.get(input.pageId);
    if (!p) return mcpError('NOT_FOUND', `No page ${input.pageId}`);
    const content: NotionPageContent = {
      page: stripBody(p),
      text: p.body ?? '',
    };
    return mcpOk({ content });
  }

  async listDatabases(input: ListDatabasesInput): Promise<McpResult<ListDatabasesOutput>> {
    this.calls.push({ tool: 'listDatabases', input });
    const limit = input.limit ?? 25;
    return mcpOk({ databases: [...this.databases.values()].slice(0, limit) });
  }

  async queryDatabase(input: QueryDatabaseInput): Promise<McpResult<QueryDatabaseOutput>> {
    this.calls.push({ tool: 'queryDatabase', input });
    if (!this.databases.has(input.databaseId)) {
      return mcpError('NOT_FOUND', `No database ${input.databaseId}`);
    }
    const limit = input.limit ?? 25;
    const rows = [...this.pages.values()]
      .filter((p) => p.parentType === 'database_id' && p.parentId === input.databaseId)
      .slice(0, limit)
      .map(stripBody);
    return mcpOk({ pages: rows });
  }

  async createPage(input: CreatePageInput): Promise<McpResult<CreatePageOutput>> {
    this.calls.push({ tool: 'createPage', input });
    if (!input.parentId) return mcpError('INVALID_ARGUMENT', 'createPage requires parentId');
    if (!input.title || input.title.trim().length === 0) {
      return mcpError('INVALID_ARGUMENT', 'createPage requires title');
    }
    if (input.parentType === 'database_id' && !this.databases.has(input.parentId)) {
      return mcpError('NOT_FOUND', `No database ${input.parentId}`);
    }
    if (input.parentType === 'page_id' && !this.pages.has(input.parentId)) {
      return mcpError('NOT_FOUND', `No page ${input.parentId}`);
    }
    const id = `page-${this.nextPageId++}`;
    const url = `https://www.notion.so/${id.replace(/-/g, '')}`;
    const page: SeededPage = {
      id,
      title: input.title,
      parentType: input.parentType,
      parentId: input.parentId,
      url,
      createdAt: new Date('2026-05-31T00:00:00Z').toISOString(),
      lastEditedAt: new Date('2026-05-31T00:00:00Z').toISOString(),
      archived: false,
      body: input.body ?? '',
    };
    this.pages.set(id, page);
    return mcpOk({ pageId: id, url });
  }

  async updatePage(input: UpdatePageInput): Promise<McpResult<UpdatePageOutput>> {
    this.calls.push({ tool: 'updatePage', input });
    if (input.archived === undefined && !input.appendBody) {
      return mcpError('INVALID_ARGUMENT', 'updatePage requires archived or appendBody');
    }
    const p = this.pages.get(input.pageId);
    if (!p) return mcpError('NOT_FOUND', `No page ${input.pageId}`);
    if (input.archived !== undefined) {
      p.archived = input.archived;
    }
    if (input.appendBody) {
      p.body = (p.body ?? '') + '\n' + input.appendBody;
    }
    this.pages.set(input.pageId, p);
    return mcpOk({ pageId: input.pageId });
  }

  async addComment(input: AddCommentInput): Promise<McpResult<AddCommentOutput>> {
    this.calls.push({ tool: 'addComment', input });
    if (!input.pageId) return mcpError('INVALID_ARGUMENT', 'addComment requires pageId');
    if (!input.body || input.body.trim().length === 0) {
      return mcpError('INVALID_ARGUMENT', 'addComment requires body');
    }
    return mcpOk({ commentId: `comment-${this.nextCommentId++}` });
  }

  async searchWorkspace(input: SearchWorkspaceInput): Promise<McpResult<SearchWorkspaceOutput>> {
    this.calls.push({ tool: 'searchWorkspace', input });
    const limit = input.limit ?? 25;
    const needle = input.query.toLowerCase();
    const hits = [
      ...[...this.pages.values()]
        .filter((p) => !p.archived && p.title.toLowerCase().includes(needle))
        .map((p) => ({ object: 'page' as const, id: p.id, title: p.title, url: p.url })),
      ...[...this.databases.values()]
        .filter((d) => d.title.toLowerCase().includes(needle))
        .map((d) => ({ object: 'database' as const, id: d.id, title: d.title, url: d.url })),
    ];
    return mcpOk({ hits: hits.slice(0, limit) });
  }
}

function stripBody(p: SeededPage): NotionPageSummary {
  const { body: _body, ...summary } = p;
  void _body;
  return summary;
}
