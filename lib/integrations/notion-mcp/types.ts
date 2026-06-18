/**
 * lib/integrations/notion-mcp/types.ts
 *
 * Wave-7 Notion MCP. The biggest demand-unlock for non-CRM workspaces:
 * Notion is where customer SOPs, runbooks, project plans, meeting notes,
 * and product specs live. Universal — `vertical: ['all']`.
 *
 * Per `feedback_no_silent_vendor_lock.md`: this file is the ONLY place
 * that names Notion's API shape. Skills + sweeps speak the typed MCP
 * interface below.
 *
 * Per `project_no_outbound_architecture.md`: write paths (`create_page`,
 * `update_page`) are INTERNAL annotations on the customer's own Notion —
 * they do not send anything outbound. The customer reviews drafts in
 * /approvals before they touch Notion.
 */

import type { McpResult } from '@/lib/integrations/mcp-core';

// ── DTOs the MCP returns ──────────────────────────────────────────────

export interface NotionPageSummary {
  /** Notion page id (UUID). */
  id: string;
  /** Display title — extracted from the `title` property if present. */
  title: string;
  /** Parent type ('workspace', 'page_id', 'database_id'). */
  parentType: string | null;
  /** Parent id when parentType !== 'workspace'. */
  parentId: string | null;
  /** Public URL the customer can open. */
  url: string | null;
  /** ISO timestamp. */
  createdAt: string | null;
  lastEditedAt: string | null;
  archived: boolean;
}

export interface NotionDatabaseSummary {
  id: string;
  title: string;
  url: string | null;
  createdAt: string | null;
  lastEditedAt: string | null;
  /** Property schema (property name → type id). Useful for the operator
   *  UI to show what fields the database carries. */
  propertyTypes: Record<string, string>;
}

export interface NotionPageContent {
  page: NotionPageSummary;
  /** Best-effort plain-text rendering of the page's blocks. Empty when
   *  the page has no readable text blocks. */
  text: string;
}

export interface NotionSearchHit {
  /** Notion object type — 'page' or 'database'. */
  object: 'page' | 'database';
  id: string;
  title: string;
  url: string | null;
}

// ── Tool I/O shapes ───────────────────────────────────────────────────

export interface ListPagesInput {
  /** Cap on results. Default 25, max 100. */
  limit?: number;
  /** Optional free-text query — falls through to Notion's search endpoint
   *  filtered to pages. */
  query?: string;
}
export interface ListPagesOutput {
  pages: NotionPageSummary[];
}

export interface GetPageInput {
  pageId: string;
}
export interface GetPageOutput {
  /** Page metadata + plain-text body. */
  content: NotionPageContent;
}

export interface ListDatabasesInput {
  limit?: number;
}
export interface ListDatabasesOutput {
  databases: NotionDatabaseSummary[];
}

export interface QueryDatabaseInput {
  databaseId: string;
  limit?: number;
}
export interface QueryDatabaseOutput {
  /** Page rows in the database (Notion database rows ARE pages). */
  pages: NotionPageSummary[];
}

export interface CreatePageInput {
  /** Parent id (page or database) the new page belongs under. */
  parentId: string;
  /** Whether the parent is a `page_id` or `database_id`. */
  parentType: 'page_id' | 'database_id';
  title: string;
  /** Plain-text body — the MCP wraps it in a `paragraph` block. */
  body?: string;
  /** Approval token once the operator has approved this exact page. */
  pendingApprovalId?: string;
}
export interface CreatePageOutput {
  pageId: string;
  url: string | null;
}

export interface UpdatePageInput {
  pageId: string;
  /** When set, archives the page. */
  archived?: boolean;
  /** Append a plain-text block to the end of the page. */
  appendBody?: string;
  /** Approval token once the operator has approved this exact update. */
  pendingApprovalId?: string;
}
export interface UpdatePageOutput {
  pageId: string;
}

export interface AddCommentInput {
  /** Page (or block) the comment is attached to. */
  pageId: string;
  /** Plain-text comment body. */
  body: string;
  /** Approval token once the operator has approved this exact comment. */
  pendingApprovalId?: string;
}
export interface AddCommentOutput {
  commentId: string;
}

export interface SearchWorkspaceInput {
  query: string;
  limit?: number;
}
export interface SearchWorkspaceOutput {
  hits: NotionSearchHit[];
}

// ── Server interface ──────────────────────────────────────────────────

export interface NotionMcpServer {
  readonly name: string;
  readonly workspaceId: string;

  listPages(input: ListPagesInput): Promise<McpResult<ListPagesOutput>>;
  getPage(input: GetPageInput): Promise<McpResult<GetPageOutput>>;
  listDatabases(input: ListDatabasesInput): Promise<McpResult<ListDatabasesOutput>>;
  queryDatabase(input: QueryDatabaseInput): Promise<McpResult<QueryDatabaseOutput>>;
  createPage(input: CreatePageInput): Promise<McpResult<CreatePageOutput>>;
  updatePage(input: UpdatePageInput): Promise<McpResult<UpdatePageOutput>>;
  addComment(input: AddCommentInput): Promise<McpResult<AddCommentOutput>>;
  searchWorkspace(input: SearchWorkspaceInput): Promise<McpResult<SearchWorkspaceOutput>>;
}
