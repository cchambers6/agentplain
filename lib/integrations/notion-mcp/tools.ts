/**
 * lib/integrations/notion-mcp/tools.ts
 *
 * The Notion tool registry — zod arg schemas + descriptions + wiring to the
 * `NotionMcpServer` interface. Shared by the HTTP route
 * (`app/api/integrations/notion-mcp/[workspaceId]/route.ts`) and the smoke
 * test via `lib/integrations/mcp-core/dispatch.ts`.
 *
 * Per `project_no_outbound_architecture.md`: write tools (`create_page`,
 * `update_page`) are INTERNAL annotations on the customer's own Notion. The
 * customer reviews drafts in /approvals before they touch Notion.
 */

import { z } from 'zod';
import type { ToolRegistration } from '@/lib/integrations/mcp-core';
import type { NotionMcpServer } from './types';

/** Namespace prefix for Notion MCP tools (e.g. `notion.list_pages`). */
export const NOTION_NAMESPACE = 'notion';

const listPagesSchema = z.object({
  limit: z.number().int().positive().max(100).optional(),
  query: z.string().optional(),
});
const pageIdSchema = z.object({ pageId: z.string().min(1) });

const listDatabasesSchema = z.object({
  limit: z.number().int().positive().max(100).optional(),
});
const queryDatabaseSchema = z.object({
  databaseId: z.string().min(1),
  limit: z.number().int().positive().max(100).optional(),
});

const createPageSchema = z.object({
  parentId: z.string().min(1),
  parentType: z.enum(['page_id', 'database_id']),
  title: z.string().min(1),
  body: z.string().optional(),
  pendingApprovalId: z.string().optional(),
});

const updatePageSchema = z.object({
  pageId: z.string().min(1),
  archived: z.boolean().optional(),
  appendBody: z.string().optional(),
  pendingApprovalId: z.string().optional(),
});

const addCommentSchema = z.object({
  pageId: z.string().min(1),
  body: z.string().min(1),
  pendingApprovalId: z.string().optional(),
});

const searchWorkspaceSchema = z.object({
  query: z.string().min(1),
  limit: z.number().int().positive().max(100).optional(),
});

export const NOTION_TOOLS: ReadonlyArray<ToolRegistration<NotionMcpServer>> = [
  {
    name: `${NOTION_NAMESPACE}.list_pages`,
    description: 'List pages, optionally filtered by a free-text query. limit is 1..100 (default 25).',
    schema: listPagesSchema,
    invoke: (s, a) => s.listPages(listPagesSchema.parse(a)),
  },
  {
    name: `${NOTION_NAMESPACE}.get_page`,
    description: 'Get a page with its metadata + plain-text body by page id.',
    schema: pageIdSchema,
    invoke: (s, a) => s.getPage(pageIdSchema.parse(a)),
  },
  {
    name: `${NOTION_NAMESPACE}.list_databases`,
    description: 'List databases. limit is 1..100 (default 25).',
    schema: listDatabasesSchema,
    invoke: (s, a) => s.listDatabases(listDatabasesSchema.parse(a)),
  },
  {
    name: `${NOTION_NAMESPACE}.query_database`,
    description: 'Query the rows (pages) of a database by databaseId. limit is 1..100 (default 25).',
    schema: queryDatabaseSchema,
    invoke: (s, a) => s.queryDatabase(queryDatabaseSchema.parse(a)),
  },
  {
    name: `${NOTION_NAMESPACE}.create_page`,
    description:
      'Create a page under a parent (parentId + parentType page_id|database_id) with a title and optional plain-text body. Internal annotation; the customer reviews in /approvals. Approval-gated.',
    schema: createPageSchema,
    invoke: (s, a) => s.createPage(createPageSchema.parse(a)),
  },
  {
    name: `${NOTION_NAMESPACE}.update_page`,
    description: 'Update a page — archive it and/or append a plain-text block (internal annotation). Approval-gated.',
    schema: updatePageSchema,
    invoke: (s, a) => s.updatePage(updatePageSchema.parse(a)),
  },
  {
    name: `${NOTION_NAMESPACE}.add_comment`,
    description:
      'Add a comment to a page (pageId + body). Internal annotation on the customer\'s own Notion. Approval-gated.',
    schema: addCommentSchema,
    invoke: (s, a) => s.addComment(addCommentSchema.parse(a)),
  },
  {
    name: `${NOTION_NAMESPACE}.search_workspace`,
    description: 'Search the workspace for pages and databases matching a query. limit is 1..100 (default 25).',
    schema: searchWorkspaceSchema,
    invoke: (s, a) => s.searchWorkspace(searchWorkspaceSchema.parse(a)),
  },
];
