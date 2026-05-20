/**
 * lib/integrations/google-drive-mcp/types.ts
 *
 * Google Drive MCP server tool surface. One instance per `{workspaceId}` per
 * request (never reused across workspaces). Built on
 * `lib/integrations/mcp-core` — the vendor-neutral JSON-RPC envelope + result
 * shapes — so the wire format matches the shipped Gmail/Outlook servers and
 * the DocuSign/QuickBooks/Slack MCP servers built on the same core.
 *
 * Drive REUSES the existing Gmail Google OAuth app + the same `GOOGLE`
 * `IntegrationCredential` row (same Google account; scopes merge via Google's
 * `include_granted_scopes`). It does NOT get its own `IntegrationProvider`
 * enum value. The marketplace slug is `google-drive`.
 *
 * Per `project_no_outbound_architecture.md` + the platform prohibited-actions
 * rule: agentplain NEVER auto-changes who can access a file. `share_file`
 * mutates permissions and is gated behind an explicit human-supplied
 * `approvalToken`; read/upload/create-folder tools do not need the gate.
 */

import type { McpResult, McpServerBase } from '@/lib/integrations/mcp-core';

export type DriveMcpResult<T> = McpResult<T>;

// ── DTOs ─────────────────────────────────────────────────────────────────

export interface DriveFileSummary {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime: string | null;
}

export interface ListFilesInput {
  /** Optional Drive query, mapped to the `q` parameter (Drive query syntax). */
  query?: string;
  /** 1..100, default 25. */
  pageSize?: number;
  /** Opaque continuation token from a previous page. */
  pageToken?: string;
}

export interface ListFilesOutput {
  files: DriveFileSummary[];
  nextPageToken: string | null;
}

export interface GetFileMetadataInput {
  fileId: string;
}

export interface FileMetadata {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime: string | null;
  createdTime: string | null;
  /** Stringified byte size; null for Google-native docs that have no size. */
  size: string | null;
  /** Parent folder ids. */
  parents: string[];
  webViewLink: string | null;
  iconLink: string | null;
  trashed: boolean | null;
}

export interface GetFileMetadataOutput {
  file: FileMetadata;
}

export interface DownloadFileInput {
  fileId: string;
}

export interface DownloadFileOutput {
  fileId: string;
  /** The effective content type returned (export type for Google-native docs). */
  mimeType: string;
  /** Base64-encoded file bytes. */
  contentBase64: string;
  sizeBytes: number;
  /** True when the file was a Google-native doc exported (e.g. to PDF). */
  exported: boolean;
}

export interface UploadFileInput {
  name: string;
  mimeType: string;
  /** Base64-encoded file bytes. */
  contentBase64: string;
  /** Optional parent folder id to place the file in. */
  parentFolderId?: string;
}

export interface UploadFileOutput {
  id: string;
  name: string;
  mimeType: string;
  parents: string[];
}

export interface CreateFolderInput {
  name: string;
  /** Optional parent folder id to nest the folder under. */
  parentFolderId?: string;
}

export interface CreateFolderOutput {
  id: string;
  name: string;
  parents: string[];
}

export interface SearchFilesInput {
  /** Free-text search term, wrapped into `fullText contains '...'`. */
  text: string;
  /** 1..100, default 25. */
  pageSize?: number;
  pageToken?: string;
}

export interface SearchFilesOutput {
  files: DriveFileSummary[];
  nextPageToken: string | null;
}

export interface ShareFileInput {
  fileId: string;
  /** Grantee email address (for `user`/`group` types). */
  emailAddress?: string;
  /** Permission role: reader | commenter | writer. */
  role: 'reader' | 'commenter' | 'writer';
  /** Permission type: user | group | domain | anyone. Defaults to `user`. */
  type?: 'user' | 'group' | 'domain' | 'anyone';
  /**
   * REQUIRED. Sharing changes who can access a file, so it is gated behind a
   * human approval step. A non-empty token, supplied only by that approval
   * step, must be passed or the call returns APPROVAL_REQUIRED.
   */
  approvalToken: string;
}

export interface ShareFileOutput {
  fileId: string;
  permissionId: string;
  role: string;
  type: string;
}

// ── Interface every implementation honors ──────────────────────────────────

export interface DriveMcpServer extends McpServerBase {
  listFiles(input: ListFilesInput): Promise<DriveMcpResult<ListFilesOutput>>;
  getFileMetadata(input: GetFileMetadataInput): Promise<DriveMcpResult<GetFileMetadataOutput>>;
  downloadFile(input: DownloadFileInput): Promise<DriveMcpResult<DownloadFileOutput>>;
  uploadFile(input: UploadFileInput): Promise<DriveMcpResult<UploadFileOutput>>;
  createFolder(input: CreateFolderInput): Promise<DriveMcpResult<CreateFolderOutput>>;
  searchFiles(input: SearchFilesInput): Promise<DriveMcpResult<SearchFilesOutput>>;
  shareFile(input: ShareFileInput): Promise<DriveMcpResult<ShareFileOutput>>;
}

export const DRIVE_NAMESPACE = 'google-drive';

/** MIME type for Google Drive folders. */
export const FOLDER_MIME_TYPE = 'application/vnd.google-apps.folder';
