/**
 * lib/integrations/onedrive-mcp/types.ts
 *
 * Provider-neutral tool surface for OneDrive / SharePoint files. Mirrors
 * the layout of `lib/integrations/outlook-mcp/types.ts`. Result and
 * envelope plumbing live in `lib/integrations/microsoft/mcp-common.ts`;
 * this file holds the file-specific DTOs and the implementation contract.
 *
 * OneDrive ↔ SharePoint vocabulary: Microsoft Graph exposes both behind
 * the same `/drive/items/...` namespace. The connected account's personal
 * OneDrive lives at `/me/drive`; SharePoint document libraries live at
 * `/sites/{site-id}/drives/{drive-id}`. This MCP scopes by drive — pass
 * `driveId` to target a SharePoint library, omit it to default to the
 * user's personal OneDrive.
 *
 * Per `feedback_no_silent_vendor_lock.md`: callers never see a Microsoft
 * Graph `driveItem` resource verbatim. The Graph → DTO translation lives
 * in `./server.ts`.
 *
 * Per `project_no_outbound_architecture.md`: there is no `email_file`,
 * `share_via_link_then_send`, etc. The `share_file` tool produces a
 * sharing link — agentplain hands it back to the customer system; the
 * customer's own client distributes the link.
 */

import type { McpResult } from '@/lib/integrations/microsoft/mcp-common';

// ── File DTOs ──────────────────────────────────────────────────────────

export interface ListFilesInput {
  /** Defaults to the personal OneDrive (`/me/drive`). Pass a SharePoint
   *  drive id to target a document library. */
  driveId?: string;
  /** Folder path RELATIVE to the drive root, e.g. `"Closings/2026"`. Omit
   *  to list the drive root. Supports nested paths; Graph URL-encodes them. */
  folderPath?: string;
  /** Page size, 1..100. Defaults to 25. */
  maxResults?: number;
  /** Opaque pagination token. */
  pageToken?: string;
}

export interface ListFilesOutput {
  items: FileItem[];
  nextPageToken: string | null;
}

export interface FileItem {
  /** Graph `driveItem.id`. */
  id: string;
  /** Drive the item lives in. `null` when it's the personal drive (Graph
   *  doesn't always echo `parentReference.driveId` for `/me/drive`). */
  driveId: string | null;
  name: string;
  /** Type discriminant; pass through from Graph. */
  itemType: 'file' | 'folder';
  /** MIME type for `file` items; `null` for folders. */
  mimeType: string | null;
  sizeBytes: number;
  /** ISO 8601 UTC. */
  createdAt: string;
  lastModifiedAt: string;
  /** Web URL the customer can open in the browser. */
  webUrl: string | null;
  /** Folder path RELATIVE to the drive root. */
  parentPath: string;
}

export interface GetFileMetadataInput {
  /** Graph `driveItem.id`. */
  itemId: string;
  driveId?: string;
}

export interface GetFileMetadataOutput {
  item: FileItem;
  /** Sharing links that already exist on the item. */
  sharingLinks: SharingLinkSummary[];
}

export interface SharingLinkSummary {
  id: string;
  /** `view` | `edit`. */
  type: string;
  /** `anonymous` | `organization` | `users`. */
  scope: string;
  webUrl: string;
  /** ISO 8601 UTC. `null` when the link doesn't expire. */
  expiresAt: string | null;
}

export interface DownloadFileInput {
  itemId: string;
  driveId?: string;
  /** Maximum body size in bytes the caller is willing to handle. Server
   *  refuses larger downloads with `INVALID_ARGUMENT` to keep skill
   *  budgets predictable. Defaults to 10 MiB. */
  maxBytes?: number;
}

export interface DownloadFileOutput {
  /** Base64-encoded content. Files larger than `maxBytes` fail upstream
   *  rather than truncate; partial bodies are never returned. */
  contentBase64: string;
  mimeType: string;
  filename: string;
  sizeBytes: number;
}

export interface UploadFileInput {
  driveId?: string;
  /** Target folder path RELATIVE to drive root. Empty string = drive root. */
  folderPath: string;
  /** Filename including extension. Graph creates intermediate folders. */
  filename: string;
  /** Base64-encoded file contents. */
  contentBase64: string;
  /** MIME type to set on the uploaded file. Optional — Graph infers from
   *  the extension when omitted. */
  mimeType?: string;
  /** `replace` | `rename` | `fail`. Defaults to `rename`. */
  conflictBehavior?: 'replace' | 'rename' | 'fail';
}

export interface UploadFileOutput {
  item: FileItem;
}

export interface CreateFolderInput {
  driveId?: string;
  /** Parent folder path RELATIVE to drive root. Empty = drive root. */
  parentPath: string;
  folderName: string;
  /** `rename` | `fail` (defaults to `fail`). Folders default to no-replace. */
  conflictBehavior?: 'rename' | 'fail';
}

export interface CreateFolderOutput {
  item: FileItem;
}

export interface ShareFileInput {
  itemId: string;
  driveId?: string;
  /** `view` | `edit`. Defaults to `view`. */
  type?: 'view' | 'edit';
  /** `anonymous` | `organization` | `users`. Defaults to `organization`
   *  (safer than anonymous; matches what most M365 tenants allow). */
  scope?: 'anonymous' | 'organization' | 'users';
  /** ISO 8601 UTC. Optional expiry. */
  expiresAt?: string;
}

export interface ShareFileOutput {
  link: SharingLinkSummary;
}

export interface SearchFilesInput {
  /** Free-text query passed to Graph's `/drive/root/search`. */
  query: string;
  driveId?: string;
  maxResults?: number;
}

export interface SearchFilesOutput {
  items: FileItem[];
}

export interface GetRecentFilesInput {
  /** Page size, 1..100. Defaults to 25. */
  maxResults?: number;
}

export interface GetRecentFilesOutput {
  items: FileItem[];
}

// ── MCP resources ──────────────────────────────────────────────────────

export interface ResourceDescriptor {
  uri: string;
  name: string;
  description: string;
  mimeType: string;
}

export interface ReadResourceInput {
  uri: string;
}

export interface ReadResourceOutput {
  uri: string;
  mimeType: string;
  text: string;
}

// ── Tool name discriminant ─────────────────────────────────────────────

export const ONEDRIVE_TOOL_NAMES = [
  'onedrive.list_files',
  'onedrive.get_file_metadata',
  'onedrive.download_file',
  'onedrive.upload_file',
  'onedrive.create_folder',
  'onedrive.share_file',
  'onedrive.search_files',
  'onedrive.get_recent_files',
] as const;

export type OneDriveToolName = (typeof ONEDRIVE_TOOL_NAMES)[number];

// ── The interface every implementation honors ──────────────────────────

export interface OneDriveMcpServer {
  readonly name: string;
  readonly workspaceId: string;

  listFiles(input: ListFilesInput): Promise<McpResult<ListFilesOutput>>;
  getFileMetadata(
    input: GetFileMetadataInput,
  ): Promise<McpResult<GetFileMetadataOutput>>;
  downloadFile(input: DownloadFileInput): Promise<McpResult<DownloadFileOutput>>;
  uploadFile(input: UploadFileInput): Promise<McpResult<UploadFileOutput>>;
  createFolder(input: CreateFolderInput): Promise<McpResult<CreateFolderOutput>>;
  shareFile(input: ShareFileInput): Promise<McpResult<ShareFileOutput>>;
  searchFiles(input: SearchFilesInput): Promise<McpResult<SearchFilesOutput>>;
  getRecentFiles(
    input: GetRecentFilesInput,
  ): Promise<McpResult<GetRecentFilesOutput>>;

  listResources(): Promise<McpResult<ResourceDescriptor[]>>;
  readResource(input: ReadResourceInput): Promise<McpResult<ReadResourceOutput>>;
}
