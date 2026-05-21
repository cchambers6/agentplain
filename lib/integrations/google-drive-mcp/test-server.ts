/**
 * lib/integrations/google-drive-mcp/test-server.ts
 *
 * Fixture-backed Google Drive MCP server — the second implementation that
 * satisfies the two-implementation rule (`feedback_runner_portability.md`).
 * Deterministic, no network, no credential resolution. Used by the smoke test
 * + by `INTEGRATIONS_PROVIDER=test` previews.
 */

import { mcpError, mcpOk, type McpResult } from '@/lib/integrations/mcp-core';
import {
  FOLDER_MIME_TYPE,
  type CreateFolderInput,
  type CreateFolderOutput,
  type DownloadFileInput,
  type DownloadFileOutput,
  type DriveFileSummary,
  type DriveMcpServer,
  type FileMetadata,
  type GetFileMetadataInput,
  type GetFileMetadataOutput,
  type ListFilesInput,
  type ListFilesOutput,
  type SearchFilesInput,
  type SearchFilesOutput,
  type ShareFileInput,
  type ShareFileOutput,
  type UploadFileInput,
  type UploadFileOutput,
} from './types';

const GOOGLE_NATIVE_PREFIX = 'application/vnd.google-apps.';

const FIXTURE_FILES: DriveFileSummary[] = [
  {
    id: 'file-1001',
    name: 'Listing Agreement — 123 Peachtree.pdf',
    mimeType: 'application/pdf',
    modifiedTime: '2026-05-10T14:00:00Z',
  },
  {
    id: 'file-1002',
    name: 'Closing Checklist',
    mimeType: 'application/vnd.google-apps.document',
    modifiedTime: '2026-05-18T16:00:00Z',
  },
];

export class TestDriveMcpServer implements DriveMcpServer {
  readonly name = 'google-drive-test' as const;
  readonly workspaceId: string;
  constructor(args: { workspaceId: string }) {
    this.workspaceId = args.workspaceId;
  }

  async listFiles(input: ListFilesInput): Promise<McpResult<ListFilesOutput>> {
    const files = input.query
      ? FIXTURE_FILES.filter((f) => f.name.toLowerCase().includes(input.query!.toLowerCase()))
      : FIXTURE_FILES;
    return mcpOk({ files, nextPageToken: null });
  }

  async getFileMetadata(input: GetFileMetadataInput): Promise<McpResult<GetFileMetadataOutput>> {
    const summary = FIXTURE_FILES.find((f) => f.id === input.fileId);
    if (!summary) return mcpError('NOT_FOUND', `No file ${input.fileId}`);
    const file: FileMetadata = {
      id: summary.id,
      name: summary.name,
      mimeType: summary.mimeType,
      modifiedTime: summary.modifiedTime,
      createdTime: '2026-05-01T00:00:00Z',
      size: summary.mimeType.startsWith(GOOGLE_NATIVE_PREFIX) ? null : '20480',
      parents: ['folder-root'],
      webViewLink: `https://drive.google.com/file/d/${summary.id}/view`,
      iconLink: null,
      trashed: false,
    };
    return mcpOk({ file });
  }

  async downloadFile(input: DownloadFileInput): Promise<McpResult<DownloadFileOutput>> {
    const summary = FIXTURE_FILES.find((f) => f.id === input.fileId);
    if (!summary) return mcpError('NOT_FOUND', `No file ${input.fileId}`);
    const isNative = summary.mimeType.startsWith(GOOGLE_NATIVE_PREFIX);
    const bytes = Buffer.from(isNative ? '%PDF-1.4 exported fixture' : 'binary fixture bytes', 'utf8');
    return mcpOk({
      fileId: input.fileId,
      mimeType: isNative ? 'application/pdf' : summary.mimeType,
      contentBase64: bytes.toString('base64'),
      sizeBytes: bytes.byteLength,
      exported: isNative,
    });
  }

  async uploadFile(input: UploadFileInput): Promise<McpResult<UploadFileOutput>> {
    if (!input.name) return mcpError('INVALID_ARGUMENT', 'uploadFile requires name');
    if (!input.contentBase64) return mcpError('INVALID_ARGUMENT', 'uploadFile requires contentBase64');
    return mcpOk({
      id: 'file-new-3001',
      name: input.name,
      mimeType: input.mimeType,
      parents: input.parentFolderId ? [input.parentFolderId] : [],
    });
  }

  async createFolder(input: CreateFolderInput): Promise<McpResult<CreateFolderOutput>> {
    if (!input.name) return mcpError('INVALID_ARGUMENT', 'createFolder requires name');
    return mcpOk({
      id: 'folder-new-4001',
      name: input.name,
      parents: input.parentFolderId ? [input.parentFolderId] : [],
    });
  }

  async searchFiles(input: SearchFilesInput): Promise<McpResult<SearchFilesOutput>> {
    if (!input.text) return mcpError('INVALID_ARGUMENT', 'searchFiles requires text');
    const files = FIXTURE_FILES.filter((f) =>
      f.name.toLowerCase().includes(input.text.toLowerCase()),
    );
    return mcpOk({ files, nextPageToken: null });
  }

  async shareFile(input: ShareFileInput): Promise<McpResult<ShareFileOutput>> {
    // Mirror the prod approval gate exactly: without a human-supplied
    // approvalToken this read-only fixture still refuses to "share".
    if (!input.approvalToken || input.approvalToken.trim().length === 0) {
      return mcpError(
        'APPROVAL_REQUIRED',
        'share_file changes who can access a file and requires human approval; pass approvalToken (a non-empty token supplied by an approval step) to proceed.',
      );
    }
    if (!FIXTURE_FILES.some((f) => f.id === input.fileId)) {
      return mcpError('NOT_FOUND', `No file ${input.fileId}`);
    }
    const type = input.type ?? 'user';
    if ((type === 'user' || type === 'group') && !input.emailAddress) {
      return mcpError('INVALID_ARGUMENT', `shareFile with type=${type} requires emailAddress`);
    }
    return mcpOk({
      fileId: input.fileId,
      permissionId: 'perm-5001',
      role: input.role,
      type,
    });
  }
}
