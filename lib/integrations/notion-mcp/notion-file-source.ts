/**
 * lib/integrations/notion-mcp/notion-file-source.ts
 *
 * `IFileSource` adapter that exposes the customer's Notion pages to the
 * shared `ingestWorkspaceFiles` pipeline. Hooking Notion via this port
 * keeps the substrate-ingestion seam single — the same pipeline reads
 * Drive, OneDrive, and Notion the same way (per
 * `feedback_runner_portability.md`).
 *
 * Per `feedback_no_silent_vendor_lock.md`: this is the only NOTION-shaped
 * code the file-ingestion pipeline ever sees. Skills + cron speak the
 * `IFileSource` interface.
 *
 * Per `project_no_outbound_architecture.md`: this is a READ surface only.
 * The ingest pipeline writes into our own KnowledgeDocument table — it
 * never writes back to the customer's Notion.
 */

import { fileSourceError, fileSourceOk, type FileContent, type FileRef, type FileSourceResult, type IFileSource } from '@/lib/customer-files/types';
import { ProdNotionMcpServer } from './server';
import type { NotionMcpServer } from './types';

export interface NotionFileSourceOptions {
  /** Override the MCP. Production binds `ProdNotionMcpServer`; tests
   *  inject `RecordingNotionMcpServer`. */
  mcp?: NotionMcpServer;
  /** Cap on pages listed per sweep. Default 100 (Notion's max page size).
   *  Larger workspaces paginate later. */
  limit?: number;
  /** Workspace id the source serves — used to defend against cross-
   *  workspace bleed inside the ingest pipeline. */
  workspaceId: string;
}

export class NotionFileSource implements IFileSource {
  readonly name = 'notion' as const;
  private readonly mcp: NotionMcpServer;
  private readonly limit: number;
  private readonly workspaceIdOption: string;

  constructor(options: NotionFileSourceOptions) {
    this.workspaceIdOption = options.workspaceId;
    this.mcp = options.mcp ?? new ProdNotionMcpServer({ workspaceId: options.workspaceId });
    this.limit = options.limit ?? 100;
  }

  async listFiles(workspaceId: string): Promise<FileSourceResult<FileRef[]>> {
    if (workspaceId !== this.workspaceIdOption) {
      return fileSourceError(
        'INVALID_ARGUMENT',
        `NotionFileSource: workspaceId mismatch (constructed for ${this.workspaceIdOption}, called with ${workspaceId})`,
      );
    }
    const res = await this.mcp.listPages({ limit: this.limit });
    if (!res.ok) {
      if (res.error.code === 'CREDENTIAL_NOT_FOUND') {
        return fileSourceError('NOT_CONFIGURED', `Notion not connected for workspace ${workspaceId}: ${res.error.message}`, res.error.code);
      }
      return fileSourceError('PROVIDER_ERROR', `Notion listPages failed: ${res.error.message}`, res.error.code);
    }
    const refs: FileRef[] = res.value.pages
      .filter((p) => !p.archived)
      .map((p) => ({
        id: p.id,
        title: p.title,
        mimeType: 'text/markdown',
        sizeBytes: null,
        sourceUrl: p.url,
        modifiedAt: p.lastEditedAt ? new Date(p.lastEditedAt) : null,
        metadata: {
          source: 'notion',
          parentType: p.parentType,
          parentId: p.parentId,
        },
      }));
    return fileSourceOk(refs);
  }

  async fetchFile(workspaceId: string, fileRef: FileRef): Promise<FileSourceResult<FileContent>> {
    if (workspaceId !== this.workspaceIdOption) {
      return fileSourceError(
        'INVALID_ARGUMENT',
        `NotionFileSource: workspaceId mismatch (constructed for ${this.workspaceIdOption}, called with ${workspaceId})`,
      );
    }
    const res = await this.mcp.getPage({ pageId: fileRef.id });
    if (!res.ok) {
      if (res.error.code === 'NOT_FOUND') {
        return fileSourceError('NOT_FOUND', `Notion page ${fileRef.id} not found: ${res.error.message}`, res.error.code);
      }
      if (res.error.code === 'CREDENTIAL_NOT_FOUND') {
        return fileSourceError('NOT_CONFIGURED', `Notion not connected for workspace ${workspaceId}`, res.error.code);
      }
      return fileSourceError('PROVIDER_ERROR', `Notion getPage failed: ${res.error.message}`, res.error.code);
    }
    return fileSourceOk({
      ref: fileRef,
      text: res.value.content.text,
    });
  }
}
