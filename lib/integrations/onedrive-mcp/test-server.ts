/**
 * lib/integrations/onedrive-mcp/test-server.ts
 *
 * Deterministic, in-memory implementation of `OneDriveMcpServer`. Symmetric
 * peer of `./server.ts` per `feedback_runner_portability.md`. Drives the
 * smoke test and local dev when OneDrive isn't OAuth-connected.
 */

import { mcpError, mcpOk, type McpResult } from '@/lib/integrations/microsoft/mcp-common';
import {
  type CreateFolderInput,
  type CreateFolderOutput,
  type DownloadFileInput,
  type DownloadFileOutput,
  type FileItem,
  type GetFileMetadataInput,
  type GetFileMetadataOutput,
  type GetRecentFilesInput,
  type GetRecentFilesOutput,
  type ListFilesInput,
  type ListFilesOutput,
  type OneDriveMcpServer,
  type ReadResourceInput,
  type ReadResourceOutput,
  type ResourceDescriptor,
  type SearchFilesInput,
  type SearchFilesOutput,
  type ShareFileInput,
  type ShareFileOutput,
  type SharingLinkSummary,
  type UploadFileInput,
  type UploadFileOutput,
} from './types';

export interface TestOneDriveSeed {
  items?: FileItem[];
  contentById?: Record<string, string>;
  permissionsById?: Record<string, SharingLinkSummary[]>;
}

interface StoredItem {
  item: FileItem;
  /** Base64-encoded contents for `file` items. */
  contentBase64: string;
}

export class TestOneDriveMcpServer implements OneDriveMcpServer {
  readonly name = 'onedrive-test' as const;
  readonly workspaceId: string;
  private readonly items: Map<string, StoredItem>;
  private readonly permissions: Map<string, SharingLinkSummary[]>;
  private itemCounter = 0;
  private permissionCounter = 0;

  readonly calls: Array<{ method: string; args: unknown }> = [];

  constructor(args: { workspaceId: string; seed?: TestOneDriveSeed }) {
    if (!args.workspaceId) {
      throw new Error('TestOneDriveMcpServer: workspaceId is required');
    }
    this.workspaceId = args.workspaceId;
    this.items = new Map();
    const seedItems = args.seed?.items ?? defaultItems();
    for (const item of seedItems) {
      this.items.set(item.id, {
        item,
        contentBase64: args.seed?.contentById?.[item.id] ?? defaultContent(item),
      });
    }
    this.permissions = new Map(
      Object.entries(args.seed?.permissionsById ?? {}),
    );
  }

  async listFiles(input: ListFilesInput): Promise<McpResult<ListFilesOutput>> {
    this.calls.push({ method: 'listFiles', args: input });
    const max = input.maxResults ?? 25;
    const folder = input.folderPath ?? '';
    const matching = Array.from(this.items.values())
      .filter((s) => s.item.parentPath === folder)
      .map((s) => s.item);
    return mcpOk({
      items: matching.slice(0, max),
      nextPageToken: matching.length > max ? `test-page-${max}` : null,
    });
  }

  async getFileMetadata(
    input: GetFileMetadataInput,
  ): Promise<McpResult<GetFileMetadataOutput>> {
    this.calls.push({ method: 'getFileMetadata', args: input });
    if (!input.itemId) {
      return mcpError('INVALID_ARGUMENT', 'getFileMetadata requires itemId');
    }
    const stored = this.items.get(input.itemId);
    if (!stored) return mcpError('NOT_FOUND', `No fixture item ${input.itemId}`);
    return mcpOk({
      item: stored.item,
      sharingLinks: this.permissions.get(input.itemId) ?? [],
    });
  }

  async downloadFile(
    input: DownloadFileInput,
  ): Promise<McpResult<DownloadFileOutput>> {
    this.calls.push({ method: 'downloadFile', args: input });
    if (!input.itemId) {
      return mcpError('INVALID_ARGUMENT', 'downloadFile requires itemId');
    }
    const stored = this.items.get(input.itemId);
    if (!stored) return mcpError('NOT_FOUND', `No fixture item ${input.itemId}`);
    if (stored.item.itemType !== 'file') {
      return mcpError('INVALID_ARGUMENT', `Item ${input.itemId} is a folder, not a file`);
    }
    const max = input.maxBytes ?? 10 * 1024 * 1024;
    const buf = Buffer.from(stored.contentBase64, 'base64');
    if (buf.byteLength > max) {
      return mcpError(
        'INVALID_ARGUMENT',
        `File size ${buf.byteLength} exceeds downloadFile maxBytes ${max}`,
      );
    }
    return mcpOk({
      contentBase64: stored.contentBase64,
      mimeType: stored.item.mimeType ?? 'application/octet-stream',
      filename: stored.item.name,
      sizeBytes: buf.byteLength,
    });
  }

  async uploadFile(input: UploadFileInput): Promise<McpResult<UploadFileOutput>> {
    this.calls.push({ method: 'uploadFile', args: input });
    if (!input.filename) {
      return mcpError('INVALID_ARGUMENT', 'uploadFile requires filename');
    }
    if (!input.contentBase64) {
      return mcpError('INVALID_ARGUMENT', 'uploadFile requires contentBase64');
    }
    this.itemCounter += 1;
    const id = `test-item-${this.itemCounter}`;
    const buf = Buffer.from(input.contentBase64, 'base64');
    const item: FileItem = {
      id,
      driveId: input.driveId ?? null,
      name: input.filename,
      itemType: 'file',
      mimeType: input.mimeType ?? 'application/octet-stream',
      sizeBytes: buf.byteLength,
      createdAt: new Date().toISOString(),
      lastModifiedAt: new Date().toISOString(),
      webUrl: `https://onedrive.example/test/${id}`,
      parentPath: input.folderPath ?? '',
    };
    this.items.set(id, { item, contentBase64: input.contentBase64 });
    return mcpOk({ item });
  }

  async createFolder(
    input: CreateFolderInput,
  ): Promise<McpResult<CreateFolderOutput>> {
    this.calls.push({ method: 'createFolder', args: input });
    if (!input.folderName) {
      return mcpError('INVALID_ARGUMENT', 'createFolder requires folderName');
    }
    this.itemCounter += 1;
    const id = `test-folder-${this.itemCounter}`;
    const item: FileItem = {
      id,
      driveId: input.driveId ?? null,
      name: input.folderName,
      itemType: 'folder',
      mimeType: null,
      sizeBytes: 0,
      createdAt: new Date().toISOString(),
      lastModifiedAt: new Date().toISOString(),
      webUrl: `https://onedrive.example/test/${id}`,
      parentPath: input.parentPath,
    };
    this.items.set(id, { item, contentBase64: '' });
    return mcpOk({ item });
  }

  async shareFile(input: ShareFileInput): Promise<McpResult<ShareFileOutput>> {
    this.calls.push({ method: 'shareFile', args: input });
    if (!input.itemId) {
      return mcpError('INVALID_ARGUMENT', 'shareFile requires itemId');
    }
    if (!this.items.has(input.itemId)) {
      return mcpError('NOT_FOUND', `No fixture item ${input.itemId}`);
    }
    this.permissionCounter += 1;
    const link: SharingLinkSummary = {
      id: `test-perm-${this.permissionCounter}`,
      type: input.type ?? 'view',
      scope: input.scope ?? 'organization',
      webUrl: `https://onedrive.example/share/${input.itemId}/${this.permissionCounter}`,
      expiresAt: input.expiresAt ?? null,
    };
    const existing = this.permissions.get(input.itemId) ?? [];
    existing.push(link);
    this.permissions.set(input.itemId, existing);
    return mcpOk({ link });
  }

  async searchFiles(
    input: SearchFilesInput,
  ): Promise<McpResult<SearchFilesOutput>> {
    this.calls.push({ method: 'searchFiles', args: input });
    if (!input.query) {
      return mcpError('INVALID_ARGUMENT', 'searchFiles requires query');
    }
    const max = input.maxResults ?? 25;
    const needle = input.query.toLowerCase();
    const matches = Array.from(this.items.values())
      .filter((s) => s.item.name.toLowerCase().includes(needle))
      .map((s) => s.item)
      .slice(0, max);
    return mcpOk({ items: matches });
  }

  async getRecentFiles(
    input: GetRecentFilesInput,
  ): Promise<McpResult<GetRecentFilesOutput>> {
    this.calls.push({ method: 'getRecentFiles', args: input });
    const max = input.maxResults ?? 25;
    const items = Array.from(this.items.values())
      .map((s) => s.item)
      .slice(0, max);
    return mcpOk({ items });
  }

  async listResources(): Promise<McpResult<ResourceDescriptor[]>> {
    return mcpOk([
      {
        uri: `onedrive://workspace/${this.workspaceId}/root`,
        name: 'OneDrive root (test)',
        description: 'Fixture-backed OneDrive root listing.',
        mimeType: 'application/json',
      },
      {
        uri: `onedrive://workspace/${this.workspaceId}/recent`,
        name: 'Recent files (test)',
        description: 'Fixture-backed recent files list.',
        mimeType: 'application/json',
      },
    ]);
  }

  async readResource(
    input: ReadResourceInput,
  ): Promise<McpResult<ReadResourceOutput>> {
    if (/^onedrive:\/\/workspace\/[0-9a-f-]+\/root/i.test(input.uri)) {
      const list = await this.listFiles({});
      if (!list.ok) return list;
      return mcpOk({
        uri: input.uri,
        mimeType: 'application/json',
        text: JSON.stringify(list.value),
      });
    }
    if (/^onedrive:\/\/workspace\/[0-9a-f-]+\/recent$/i.test(input.uri)) {
      const list = await this.getRecentFiles({});
      if (!list.ok) return list;
      return mcpOk({
        uri: input.uri,
        mimeType: 'application/json',
        text: JSON.stringify(list.value),
      });
    }
    return mcpError('INVALID_ARGUMENT', `Unknown resource URI: ${input.uri}`);
  }
}

function defaultItems(): FileItem[] {
  return [
    {
      id: 'test-item-fixture-001',
      driveId: null,
      name: 'Closing checklist — 123 Peachtree.pdf',
      itemType: 'file',
      mimeType: 'application/pdf',
      sizeBytes: 84_321,
      createdAt: '2026-05-12T10:00:00.000Z',
      lastModifiedAt: '2026-05-18T14:30:00.000Z',
      webUrl: 'https://onedrive.example/test/fixture-001',
      parentPath: 'Closings/2026',
    },
    {
      id: 'test-folder-fixture-001',
      driveId: null,
      name: '2026',
      itemType: 'folder',
      mimeType: null,
      sizeBytes: 0,
      createdAt: '2026-01-01T00:00:00.000Z',
      lastModifiedAt: '2026-05-18T14:30:00.000Z',
      webUrl: 'https://onedrive.example/test/folder-2026',
      parentPath: 'Closings',
    },
  ];
}

function defaultContent(item: FileItem): string {
  if (item.itemType !== 'file') return '';
  // 128 bytes of zero-ish PDF placeholder.
  return Buffer.from('Fixture content for ' + item.name).toString('base64');
}
