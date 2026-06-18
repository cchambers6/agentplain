/**
 * lib/integrations/notion-mcp/with-approval.ts
 *
 * The Notion approval gate — the connector-specific decorator that forces EVERY
 * mutating Notion method through the shared connector approval gate
 * (`lib/integrations/approval`) before the REST API is touched. Mirrors
 * `hubspot-mcp/with-approval.ts`, built on the generic gate so the connectors
 * share one fingerprint/persistence/audit core.
 *
 * Read methods (listPages / getPage / listDatabases / queryDatabase /
 * searchWorkspace) pass straight through. Mutations — the two pre-existing
 * page writes (createPage / updatePage) AND the new add_comment write — are
 * intercepted: a missing/invalid/expired grant returns APPROVAL_REQUIRED and
 * the Notion call never happens; a valid grant lets the call run and is
 * audit-logged.
 *
 * Installed at the factory seam (`buildNotionMcpServer`), so an ungated Notion
 * server cannot be obtained.
 */

import type { McpResult } from '@/lib/integrations/mcp-core';
import {
  gateAndRun,
  type ConnectorApprovalDeps,
  type GatedAction,
} from '@/lib/integrations/approval';
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
  NotionMcpServer,
  QueryDatabaseInput,
  QueryDatabaseOutput,
  SearchWorkspaceInput,
  SearchWorkspaceOutput,
  UpdatePageInput,
  UpdatePageOutput,
} from './types';
import { ADD_COMMENT, NOTION_CONNECTOR, notionAction, type WriteActionDescriptor } from './actions';

/** Wrap a Notion server so all mutating methods require an approved grant. */
export function withNotionApproval(
  inner: NotionMcpServer,
  deps: ConnectorApprovalDeps,
): NotionMcpServer {
  return new GatedNotionMcpServer(inner, deps);
}

class GatedNotionMcpServer implements NotionMcpServer {
  readonly name: string;
  readonly workspaceId: string;

  constructor(
    private readonly inner: NotionMcpServer,
    private readonly deps: ConnectorApprovalDeps,
  ) {
    this.name = inner.name;
    this.workspaceId = inner.workspaceId;
  }

  private gate<T>(action: GatedAction, execute: () => Promise<McpResult<T>>) {
    return gateAndRun({
      gate: this.deps.gate,
      audit: this.deps.audit,
      workspaceId: this.workspaceId,
      action,
      execute,
    });
  }

  // ── Reads: straight pass-through ───────────────────────────────────────

  listPages(input: ListPagesInput): Promise<McpResult<ListPagesOutput>> {
    return this.inner.listPages(input);
  }
  getPage(input: GetPageInput): Promise<McpResult<GetPageOutput>> {
    return this.inner.getPage(input);
  }
  listDatabases(input: ListDatabasesInput): Promise<McpResult<ListDatabasesOutput>> {
    return this.inner.listDatabases(input);
  }
  queryDatabase(input: QueryDatabaseInput): Promise<McpResult<QueryDatabaseOutput>> {
    return this.inner.queryDatabase(input);
  }
  searchWorkspace(input: SearchWorkspaceInput): Promise<McpResult<SearchWorkspaceOutput>> {
    return this.inner.searchWorkspace(input);
  }

  // ── Pre-existing page writes: now gated ────────────────────────────────

  createPage(input: CreatePageInput): Promise<McpResult<CreatePageOutput>> {
    const action: GatedAction = {
      connector: NOTION_CONNECTOR,
      action: 'create_page',
      pendingApprovalId: input.pendingApprovalId,
      discipline: 'operations',
      detail: {
        parentType: input.parentType,
        parentId: input.parentId,
        title: input.title,
        body: input.body ?? null,
      },
    };
    return this.gate(action, () => this.inner.createPage(input));
  }

  updatePage(input: UpdatePageInput): Promise<McpResult<UpdatePageOutput>> {
    const action: GatedAction = {
      connector: NOTION_CONNECTOR,
      action: 'update_page',
      pendingApprovalId: input.pendingApprovalId,
      discipline: 'operations',
      detail: {
        pageId: input.pageId,
        archived: input.archived ?? null,
        appendBody: input.appendBody ?? null,
      },
    };
    return this.gate(action, () => this.inner.updatePage(input));
  }

  // ── Write-action-depth mutations ───────────────────────────────────────

  addComment(input: AddCommentInput): Promise<McpResult<AddCommentOutput>> {
    return this.gate(notionAction(ADD_COMMENT, input), () => this.inner.addComment(input));
  }
}

// Re-export for symmetry with other connectors' approval modules.
export type { WriteActionDescriptor };
