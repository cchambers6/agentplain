/**
 * lib/integrations/notion-mcp/server.ts
 *
 * Production Notion MCP server. Wraps Notion API v1 behind the
 * `NotionMcpServer` interface. One instance per `{workspaceId}` per
 * request. This file is the ONLY place that calls the Notion REST API;
 * route handlers + skills speak the MCP interface (per
 * `feedback_no_silent_vendor_lock.md`). Plain `fetch`, no SDK.
 *
 * Cold-start safe: every method re-resolves the credential; no token is
 * cached on the instance.
 *
 * Notion API conventions:
 *   - Base: https://api.notion.com/v1
 *   - Required header `Notion-Version: 2022-06-28`.
 *   - All search/query results paginate via `has_more` + `next_cursor`.
 *     The MCP returns the first page only (max_limit) — callers needing
 *     more open a Pro tier later.
 */

import { mcpError, mcpOk, type McpResult } from '@/lib/integrations/mcp-core';
import { NOTION_API_BASE, NOTION_API_VERSION } from '@/lib/integrations/notion/oauth';
import { resolveNotionCredential, type ResolvedNotion } from './auth';
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
  NotionSearchHit,
  QueryDatabaseInput,
  QueryDatabaseOutput,
  SearchWorkspaceInput,
  SearchWorkspaceOutput,
  UpdatePageInput,
  UpdatePageOutput,
} from './types';

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;

export class ProdNotionMcpServer implements NotionMcpServer {
  readonly name = 'notion-rest' as const;
  readonly workspaceId: string;

  constructor(args: { workspaceId: string }) {
    if (!args.workspaceId) throw new Error('ProdNotionMcpServer: workspaceId is required');
    this.workspaceId = args.workspaceId;
  }

  async listPages(input: ListPagesInput): Promise<McpResult<ListPagesOutput>> {
    const limit = clampLimit(input.limit);
    return this.withApi(async (api) => {
      const res = await api<RawSearchResponse>('POST', '/search', {
        query: input.query ?? '',
        filter: { value: 'page', property: 'object' },
        sort: { direction: 'descending', timestamp: 'last_edited_time' },
        page_size: limit,
      });
      if (!res.ok) return res;
      const pages = (res.value.results ?? [])
        .filter((r): r is RawPage => r.object === 'page')
        .map(toPageSummary);
      return mcpOk({ pages });
    });
  }

  async getPage(input: GetPageInput): Promise<McpResult<GetPageOutput>> {
    if (!input.pageId) return mcpError('INVALID_ARGUMENT', 'getPage requires pageId');
    return this.withApi(async (api) => {
      const pageRes = await api<RawPage>('GET', `/pages/${encodeURIComponent(input.pageId)}`);
      if (!pageRes.ok) return pageRes;
      const summary = toPageSummary(pageRes.value);
      // Fetch the first 100 blocks and render them to plain text.
      const blocksRes = await api<RawBlocksResponse>(
        'GET',
        `/blocks/${encodeURIComponent(input.pageId)}/children?page_size=100`,
      );
      if (!blocksRes.ok) return blocksRes;
      const text = renderBlocksToText(blocksRes.value.results ?? []);
      const content: NotionPageContent = { page: summary, text };
      return mcpOk({ content });
    });
  }

  async listDatabases(input: ListDatabasesInput): Promise<McpResult<ListDatabasesOutput>> {
    const limit = clampLimit(input.limit);
    return this.withApi(async (api) => {
      const res = await api<RawSearchResponse>('POST', '/search', {
        filter: { value: 'database', property: 'object' },
        sort: { direction: 'descending', timestamp: 'last_edited_time' },
        page_size: limit,
      });
      if (!res.ok) return res;
      const databases = (res.value.results ?? [])
        .filter((r): r is RawDatabase => r.object === 'database')
        .map(toDatabaseSummary);
      return mcpOk({ databases });
    });
  }

  async queryDatabase(input: QueryDatabaseInput): Promise<McpResult<QueryDatabaseOutput>> {
    if (!input.databaseId) return mcpError('INVALID_ARGUMENT', 'queryDatabase requires databaseId');
    const limit = clampLimit(input.limit);
    return this.withApi(async (api) => {
      const res = await api<RawDatabaseQueryResponse>(
        'POST',
        `/databases/${encodeURIComponent(input.databaseId)}/query`,
        { page_size: limit },
      );
      if (!res.ok) return res;
      const pages = (res.value.results ?? []).map(toPageSummary);
      return mcpOk({ pages });
    });
  }

  async createPage(input: CreatePageInput): Promise<McpResult<CreatePageOutput>> {
    if (!input.parentId) return mcpError('INVALID_ARGUMENT', 'createPage requires parentId');
    if (!input.title || input.title.trim().length === 0) {
      return mcpError('INVALID_ARGUMENT', 'createPage requires a non-empty title');
    }
    return this.withApi(async (api) => {
      const parent =
        input.parentType === 'database_id'
          ? { database_id: input.parentId }
          : { page_id: input.parentId };
      const properties =
        input.parentType === 'database_id'
          ? // For database pages, the title property is named whatever the
            // database's title column is — we use "Name" by convention; the
            // Notion API accepts any key here when the DB schema isn't
            // mapped, but Notion returns 400 for unknown columns. Callers
            // pinning a column name should use updatePage to rename after.
            { Name: { title: [{ text: { content: input.title } }] } }
          : { title: { title: [{ text: { content: input.title } }] } };
      const children = input.body && input.body.length > 0
        ? [
            {
              object: 'block',
              type: 'paragraph',
              paragraph: {
                rich_text: [{ type: 'text', text: { content: input.body } }],
              },
            },
          ]
        : undefined;
      const body: Record<string, unknown> = { parent, properties };
      if (children) body.children = children;
      const res = await api<RawPage>('POST', '/pages', body);
      if (!res.ok) return res;
      const created = toPageSummary(res.value);
      return mcpOk({ pageId: created.id, url: created.url });
    });
  }

  async updatePage(input: UpdatePageInput): Promise<McpResult<UpdatePageOutput>> {
    if (!input.pageId) return mcpError('INVALID_ARGUMENT', 'updatePage requires pageId');
    if (input.archived === undefined && !input.appendBody) {
      return mcpError('INVALID_ARGUMENT', 'updatePage requires archived or appendBody');
    }
    return this.withApi(async (api) => {
      if (input.archived !== undefined) {
        const res = await api<RawPage>(
          'PATCH',
          `/pages/${encodeURIComponent(input.pageId)}`,
          { archived: input.archived },
        );
        if (!res.ok) return res;
      }
      if (input.appendBody && input.appendBody.length > 0) {
        const res = await api<RawBlocksResponse>(
          'PATCH',
          `/blocks/${encodeURIComponent(input.pageId)}/children`,
          {
            children: [
              {
                object: 'block',
                type: 'paragraph',
                paragraph: {
                  rich_text: [{ type: 'text', text: { content: input.appendBody } }],
                },
              },
            ],
          },
        );
        if (!res.ok) return res;
      }
      return mcpOk({ pageId: input.pageId });
    });
  }

  async addComment(input: AddCommentInput): Promise<McpResult<AddCommentOutput>> {
    if (!input.pageId) return mcpError('INVALID_ARGUMENT', 'addComment requires pageId');
    if (!input.body || input.body.trim().length === 0) {
      return mcpError('INVALID_ARGUMENT', 'addComment requires a non-empty body');
    }
    return this.withApi(async (api) => {
      const res = await api<RawComment>('POST', '/comments', {
        parent: { page_id: input.pageId },
        rich_text: [{ type: 'text', text: { content: input.body } }],
      });
      if (!res.ok) return res;
      return mcpOk({ commentId: res.value.id ?? '' });
    });
  }

  async searchWorkspace(input: SearchWorkspaceInput): Promise<McpResult<SearchWorkspaceOutput>> {
    if (!input.query) return mcpError('INVALID_ARGUMENT', 'searchWorkspace requires query');
    const limit = clampLimit(input.limit);
    return this.withApi(async (api) => {
      const res = await api<RawSearchResponse>('POST', '/search', {
        query: input.query,
        sort: { direction: 'descending', timestamp: 'last_edited_time' },
        page_size: limit,
      });
      if (!res.ok) return res;
      const hits: NotionSearchHit[] = (res.value.results ?? []).map((r) => {
        if (r.object === 'database') {
          const db = r as RawDatabase;
          return {
            object: 'database' as const,
            id: db.id ?? '',
            title: extractDatabaseTitle(db),
            url: db.url ?? null,
          };
        }
        const page = r as RawPage;
        return {
          object: 'page' as const,
          id: page.id ?? '',
          title: extractPageTitle(page),
          url: page.url ?? null,
        };
      });
      return mcpOk({ hits });
    });
  }

  // ── internals ───────────────────────────────────────────────────────

  private async withApi<T>(
    fn: (api: ApiFn) => Promise<McpResult<T>>,
  ): Promise<McpResult<T>> {
    const resolved = await resolveNotionCredential({ workspaceId: this.workspaceId });
    if (!resolved.ok) return resolved;
    return fn(makeApiContext(resolved.value));
  }
}

type ApiFn = <T>(method: string, path: string, body?: unknown) => Promise<McpResult<T>>;

function makeApiContext(resolved: ResolvedNotion): ApiFn {
  const authHeader = `Bearer ${resolved.accessToken}`;
  return async <T>(method: string, path: string, body?: unknown) => {
    let res: Response;
    try {
      res = await fetch(`${NOTION_API_BASE}${path}`, {
        method,
        headers: {
          Authorization: authHeader,
          Accept: 'application/json',
          'Notion-Version': NOTION_API_VERSION,
          ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
    } catch (err) {
      return mcpError('NETWORK', `Notion network error: ${err instanceof Error ? err.message : String(err)}`);
    }
    const text = await res.text();
    if (!res.ok) return mapRestError(res, text);
    if (text.length === 0) return mcpOk({} as T);
    try {
      return mcpOk(JSON.parse(text) as T);
    } catch (err) {
      return mcpError('MALFORMED_RESPONSE', `Notion JSON parse failed: ${err instanceof Error ? err.message : String(err)}`, { status: res.status });
    }
  };
}

function mapRestError(res: Response, text: string): { ok: false; error: import('@/lib/integrations/mcp-core').McpError } {
  let detail = res.statusText || `HTTP ${res.status}`;
  let reference: string | undefined;
  try {
    const body = JSON.parse(text) as { message?: string; code?: string };
    detail = body.message ?? detail;
    reference = body.code;
  } catch {
    if (text) detail = text.slice(0, 240);
  }
  if (res.status === 401) return mcpError('TOKEN_EXPIRED', detail, { status: 401, reference });
  if (res.status === 403) return mcpError('FORBIDDEN', detail, { status: 403, reference });
  if (res.status === 404) return mcpError('NOT_FOUND', detail, { status: 404, reference });
  if (res.status === 429) return mcpError('RATE_LIMITED', detail, { status: 429, reference });
  return mcpError('UPSTREAM_ERROR', detail, { status: res.status, reference });
}

// ── Raw → DTO mappers + block-text renderer ─────────────────────────────

interface RawRichText {
  plain_text?: string;
  text?: { content?: string };
}

interface RawProperty {
  id?: string;
  type?: string;
  title?: RawRichText[];
  rich_text?: RawRichText[];
}

interface RawParent {
  type?: string;
  workspace?: boolean;
  page_id?: string;
  database_id?: string;
}

interface RawPage {
  object?: 'page';
  id?: string;
  url?: string | null;
  archived?: boolean;
  created_time?: string;
  last_edited_time?: string;
  parent?: RawParent;
  properties?: Record<string, RawProperty>;
}

interface RawDatabase {
  object?: 'database';
  id?: string;
  url?: string | null;
  created_time?: string;
  last_edited_time?: string;
  title?: RawRichText[];
  properties?: Record<string, { type?: string }>;
}

type RawSearchHit = (RawPage | RawDatabase) & { object?: 'page' | 'database' };

interface RawSearchResponse {
  results?: RawSearchHit[];
  has_more?: boolean;
  next_cursor?: string | null;
}

interface RawBlock {
  object?: 'block';
  id?: string;
  type?: string;
  has_children?: boolean;
  paragraph?: { rich_text?: RawRichText[] };
  heading_1?: { rich_text?: RawRichText[] };
  heading_2?: { rich_text?: RawRichText[] };
  heading_3?: { rich_text?: RawRichText[] };
  bulleted_list_item?: { rich_text?: RawRichText[] };
  numbered_list_item?: { rich_text?: RawRichText[] };
  to_do?: { rich_text?: RawRichText[]; checked?: boolean };
  quote?: { rich_text?: RawRichText[] };
  callout?: { rich_text?: RawRichText[] };
  code?: { rich_text?: RawRichText[]; language?: string };
}

interface RawBlocksResponse {
  results?: RawBlock[];
}

interface RawDatabaseQueryResponse {
  results?: RawPage[];
}

interface RawComment {
  object?: 'comment';
  id?: string;
}

function extractPageTitle(page: RawPage): string {
  if (!page.properties) return 'Untitled';
  // Notion returns a `title` property at an unknown key; find the one
  // whose type === 'title'.
  for (const prop of Object.values(page.properties)) {
    if (prop?.type === 'title' && Array.isArray(prop.title)) {
      const text = prop.title.map((t) => t.plain_text ?? t.text?.content ?? '').join('').trim();
      if (text) return text;
    }
  }
  return 'Untitled';
}

function extractDatabaseTitle(db: RawDatabase): string {
  if (Array.isArray(db.title)) {
    const text = db.title.map((t) => t.plain_text ?? t.text?.content ?? '').join('').trim();
    if (text) return text;
  }
  return 'Untitled database';
}

function toPageSummary(page: RawPage): NotionPageSummary {
  return {
    id: page.id ?? '',
    title: extractPageTitle(page),
    parentType: page.parent?.type ?? null,
    parentId: page.parent?.page_id ?? page.parent?.database_id ?? null,
    url: page.url ?? null,
    createdAt: page.created_time ?? null,
    lastEditedAt: page.last_edited_time ?? null,
    archived: page.archived === true,
  };
}

function toDatabaseSummary(db: RawDatabase): NotionDatabaseSummary {
  const propertyTypes: Record<string, string> = {};
  for (const [name, prop] of Object.entries(db.properties ?? {})) {
    if (prop?.type) propertyTypes[name] = prop.type;
  }
  return {
    id: db.id ?? '',
    title: extractDatabaseTitle(db),
    url: db.url ?? null,
    createdAt: db.created_time ?? null,
    lastEditedAt: db.last_edited_time ?? null,
    propertyTypes,
  };
}

function richTextToString(rt: RawRichText[] | undefined): string {
  if (!Array.isArray(rt)) return '';
  return rt.map((t) => t.plain_text ?? t.text?.content ?? '').join('');
}

/** Render Notion blocks to plain text. Skips media/embed blocks. */
function renderBlocksToText(blocks: RawBlock[]): string {
  const lines: string[] = [];
  for (const b of blocks) {
    switch (b.type) {
      case 'paragraph':
        lines.push(richTextToString(b.paragraph?.rich_text));
        break;
      case 'heading_1':
        lines.push(`# ${richTextToString(b.heading_1?.rich_text)}`);
        break;
      case 'heading_2':
        lines.push(`## ${richTextToString(b.heading_2?.rich_text)}`);
        break;
      case 'heading_3':
        lines.push(`### ${richTextToString(b.heading_3?.rich_text)}`);
        break;
      case 'bulleted_list_item':
        lines.push(`- ${richTextToString(b.bulleted_list_item?.rich_text)}`);
        break;
      case 'numbered_list_item':
        lines.push(`1. ${richTextToString(b.numbered_list_item?.rich_text)}`);
        break;
      case 'to_do':
        lines.push(`${b.to_do?.checked ? '[x]' : '[ ]'} ${richTextToString(b.to_do?.rich_text)}`);
        break;
      case 'quote':
        lines.push(`> ${richTextToString(b.quote?.rich_text)}`);
        break;
      case 'callout':
        lines.push(richTextToString(b.callout?.rich_text));
        break;
      case 'code':
        lines.push('```' + (b.code?.language ?? ''));
        lines.push(richTextToString(b.code?.rich_text));
        lines.push('```');
        break;
      default:
        // Skip unknown / media blocks.
        break;
    }
  }
  return lines.filter((l) => l.length > 0).join('\n');
}

function clampLimit(value: number | undefined): number {
  if (value === undefined) return DEFAULT_LIMIT;
  if (!Number.isFinite(value)) return DEFAULT_LIMIT;
  if (value < 1) return 1;
  if (value > MAX_LIMIT) return MAX_LIMIT;
  return Math.floor(value);
}

/** Exported for tests so they can re-use the renderer without touching
 *  the server's REST seam. */
export const __renderBlocksToText = renderBlocksToText;
