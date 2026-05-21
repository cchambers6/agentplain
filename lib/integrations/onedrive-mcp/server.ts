/**
 * lib/integrations/onedrive-mcp/server.ts
 *
 * Production OneDrive / SharePoint MCP server. Wraps Microsoft Graph's
 * driveItem surface behind the `OneDriveMcpServer` interface in
 * `./types.ts`. One instance per `{workspaceId}` per request — workspace
 * boundary is the server's identity.
 *
 * Per `feedback_no_silent_vendor_lock.md`: every Graph hit goes through
 * `lib/integrations/microsoft/graph-client.ts`. Skill code consumes the
 * MCP interface only.
 *
 * Per `feedback_cold_start_safe_agents.md`: each method re-resolves the
 * credential. No decrypted token is memoised on the instance.
 *
 * Microsoft Graph endpoints used (read 2026-05-19):
 *   * `/me/drive/root/children`                      — list root
 *   * `/me/drive/root:/{path}:/children`             — list folder by path
 *   * `/me/drive/items/{id}`                         — item metadata
 *   * `/me/drive/items/{id}/permissions`             — sharing links
 *   * `/me/drive/items/{id}/content`                 — download (binary)
 *   * `/me/drive/root:/{path}:/content`              — upload (PUT, ≤4 MiB)
 *   * `/me/drive/root:/{parent}/{name}:/children`    — create folder
 *   * `/me/drive/items/{id}/createLink`              — share
 *   * `/me/drive/root/search(q='…')`                 — search
 *   * `/me/drive/recent`                             — recent files
 *
 * Upload-size caveat: the simple PUT endpoint caps at 4 MiB. Larger
 * uploads require Graph's upload-session protocol; this server refuses
 * payloads above the simple cap and returns `INVALID_ARGUMENT` so the
 * caller can chunk via a future variant.
 */

import { resolveCredential } from './auth';
import { MicrosoftGraphClient } from '@/lib/integrations/microsoft/graph-client';
import {
  extractSkipToken,
  mcpError,
  mcpOk,
  type McpResult,
} from '@/lib/integrations/microsoft/mcp-common';
import type { DecryptedCredential } from '@/lib/integrations/types';
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

const DEFAULT_MAX_RESULTS = 25;
const MAX_PAGE_SIZE = 100;
const DEFAULT_DOWNLOAD_MAX_BYTES = 10 * 1024 * 1024;
const SIMPLE_UPLOAD_MAX_BYTES = 4 * 1024 * 1024;
const RESOURCE_URI_ROOT_RE =
  /^onedrive:\/\/workspace\/([0-9a-f-]+)\/root(?:\?pageToken=([^&]+))?$/i;
const RESOURCE_URI_RECENT_RE =
  /^onedrive:\/\/workspace\/([0-9a-f-]+)\/recent$/i;

interface GraphDriveItem {
  id?: string;
  name?: string;
  webUrl?: string | null;
  size?: number;
  createdDateTime?: string;
  lastModifiedDateTime?: string;
  file?: { mimeType?: string };
  folder?: { childCount?: number };
  parentReference?: { driveId?: string; path?: string };
}

interface GraphListResponse<T> {
  value?: T[];
  '@odata.nextLink'?: string;
}

interface GraphPermission {
  id?: string;
  link?: { type?: string; scope?: string; webUrl?: string };
  expirationDateTime?: string | null;
}

export class ProdOneDriveMcpServer implements OneDriveMcpServer {
  readonly name = 'onedrive-graph' as const;
  readonly workspaceId: string;
  private readonly graph: MicrosoftGraphClient;

  constructor(args: { workspaceId: string; fetchImpl?: typeof fetch }) {
    if (!args.workspaceId) {
      throw new Error('ProdOneDriveMcpServer: workspaceId is required');
    }
    this.workspaceId = args.workspaceId;
    this.graph = new MicrosoftGraphClient({ fetchImpl: args.fetchImpl });
  }

  // ── Tools ────────────────────────────────────────────────────────────

  async listFiles(input: ListFilesInput): Promise<McpResult<ListFilesOutput>> {
    const max = clampMax(input.maxResults);
    return this.withCredential(async (cred) => {
      const driveSegment = driveSegmentFor(input.driveId);
      const folderSegment = input.folderPath
        ? `:/${encodePath(input.folderPath)}:`
        : '';
      const path = `${driveSegment}/root${folderSegment}/children`;
      const params = new URLSearchParams({ $top: String(max) });
      if (input.pageToken) params.set('$skiptoken', input.pageToken);
      const url = this.graph.url(`${path}?${params.toString()}`);
      const res = await this.graph.get<GraphListResponse<GraphDriveItem>>(cred, url);
      if (!res.ok) return res;
      const items: FileItem[] = (res.value.value ?? []).map(parseDriveItem);
      return mcpOk({
        items,
        nextPageToken: extractSkipToken(res.value['@odata.nextLink'] ?? null),
      });
    });
  }

  async getFileMetadata(
    input: GetFileMetadataInput,
  ): Promise<McpResult<GetFileMetadataOutput>> {
    if (!input.itemId) {
      return mcpError('INVALID_ARGUMENT', 'getFileMetadata requires itemId');
    }
    return this.withCredential(async (cred) => {
      const driveSegment = driveSegmentFor(input.driveId);
      const itemUrl = this.graph.url(
        `${driveSegment}/items/${encodeURIComponent(input.itemId)}`,
      );
      const itemRes = await this.graph.get<GraphDriveItem>(cred, itemUrl);
      if (!itemRes.ok) return itemRes;
      const permUrl = this.graph.url(
        `${driveSegment}/items/${encodeURIComponent(input.itemId)}/permissions`,
      );
      const permRes = await this.graph.get<GraphListResponse<GraphPermission>>(cred, permUrl);
      const sharingLinks: SharingLinkSummary[] = permRes.ok
        ? (permRes.value.value ?? [])
            .filter((p) => p.link?.webUrl)
            .map(parsePermission)
        : [];
      return mcpOk({
        item: parseDriveItem(itemRes.value),
        sharingLinks,
      });
    });
  }

  async downloadFile(
    input: DownloadFileInput,
  ): Promise<McpResult<DownloadFileOutput>> {
    if (!input.itemId) {
      return mcpError('INVALID_ARGUMENT', 'downloadFile requires itemId');
    }
    const maxBytes = input.maxBytes ?? DEFAULT_DOWNLOAD_MAX_BYTES;
    if (!Number.isFinite(maxBytes) || maxBytes <= 0) {
      return mcpError('INVALID_ARGUMENT', `downloadFile maxBytes must be positive`);
    }
    return this.withCredential(async (cred) => {
      const driveSegment = driveSegmentFor(input.driveId);
      const metaRes = await this.graph.get<GraphDriveItem>(
        cred,
        this.graph.url(`${driveSegment}/items/${encodeURIComponent(input.itemId)}`),
      );
      if (!metaRes.ok) return metaRes;
      const meta = metaRes.value;
      const size = typeof meta.size === 'number' ? meta.size : 0;
      if (size > maxBytes) {
        return mcpError(
          'INVALID_ARGUMENT',
          `File size ${size} exceeds downloadFile maxBytes ${maxBytes}. Raise maxBytes or stream via a future variant.`,
        );
      }
      const raw = await this.graph.fetchRaw(
        cred,
        this.graph.url(`${driveSegment}/items/${encodeURIComponent(input.itemId)}/content`),
        { method: 'GET' },
      );
      if (!raw.ok) return raw;
      const buf = Buffer.from(await raw.value.arrayBuffer());
      if (buf.byteLength > maxBytes) {
        return mcpError(
          'INVALID_ARGUMENT',
          `Downloaded body ${buf.byteLength} exceeds maxBytes ${maxBytes}`,
        );
      }
      return mcpOk({
        contentBase64: buf.toString('base64'),
        mimeType: meta.file?.mimeType ?? raw.value.headers.get('content-type') ?? 'application/octet-stream',
        filename: meta.name ?? '',
        sizeBytes: buf.byteLength,
      });
    });
  }

  async uploadFile(input: UploadFileInput): Promise<McpResult<UploadFileOutput>> {
    if (!input.filename) {
      return mcpError('INVALID_ARGUMENT', 'uploadFile requires filename');
    }
    if (!input.contentBase64) {
      return mcpError('INVALID_ARGUMENT', 'uploadFile requires contentBase64');
    }
    let body: Buffer;
    try {
      body = Buffer.from(input.contentBase64, 'base64');
    } catch (err) {
      return mcpError(
        'INVALID_ARGUMENT',
        `contentBase64 decode failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
    if (body.byteLength > SIMPLE_UPLOAD_MAX_BYTES) {
      return mcpError(
        'INVALID_ARGUMENT',
        `uploadFile payload ${body.byteLength} exceeds simple PUT cap ${SIMPLE_UPLOAD_MAX_BYTES}. ` +
          `Larger uploads require Graph's upload-session protocol (not yet wired).`,
      );
    }
    const conflict = input.conflictBehavior ?? 'rename';
    return this.withCredential(async (cred) => {
      const driveSegment = driveSegmentFor(input.driveId);
      const targetPath = combinePath(input.folderPath, input.filename);
      const params = new URLSearchParams({
        '@microsoft.graph.conflictBehavior': conflict,
      });
      const url = this.graph.url(
        `${driveSegment}/root:/${encodePath(targetPath)}:/content?${params.toString()}`,
      );
      const headers: Record<string, string> = {};
      if (input.mimeType) headers['Content-Type'] = input.mimeType;
      // DOM `BodyInit` accepts an `ArrayBuffer`; node's Buffer doesn't
      // satisfy it on the TS side. Copy into a typed slice so the body is
      // a concrete `ArrayBuffer` view fetch is happy with at compile time
      // (runtime cost is one memcpy of ≤4 MiB — the simple-upload cap).
      const ab = new ArrayBuffer(body.byteLength);
      new Uint8Array(ab).set(body);
      const res = await this.graph.request<GraphDriveItem>(cred, url, {
        method: 'PUT',
        headers,
        body: ab,
      });
      if (!res.ok) return res;
      return mcpOk({ item: parseDriveItem(res.value) });
    });
  }

  async createFolder(
    input: CreateFolderInput,
  ): Promise<McpResult<CreateFolderOutput>> {
    if (!input.folderName) {
      return mcpError('INVALID_ARGUMENT', 'createFolder requires folderName');
    }
    const conflict = input.conflictBehavior ?? 'fail';
    return this.withCredential(async (cred) => {
      const driveSegment = driveSegmentFor(input.driveId);
      const parentSegment = input.parentPath
        ? `:/${encodePath(input.parentPath)}:`
        : '';
      const url = this.graph.url(`${driveSegment}/root${parentSegment}/children`);
      const res = await this.graph.request<GraphDriveItem>(cred, url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: input.folderName,
          folder: {},
          '@microsoft.graph.conflictBehavior': conflict,
        }),
      });
      if (!res.ok) return res;
      return mcpOk({ item: parseDriveItem(res.value) });
    });
  }

  async shareFile(input: ShareFileInput): Promise<McpResult<ShareFileOutput>> {
    if (!input.itemId) {
      return mcpError('INVALID_ARGUMENT', 'shareFile requires itemId');
    }
    const type = input.type ?? 'view';
    const scope = input.scope ?? 'organization';
    return this.withCredential(async (cred) => {
      const driveSegment = driveSegmentFor(input.driveId);
      const url = this.graph.url(
        `${driveSegment}/items/${encodeURIComponent(input.itemId)}/createLink`,
      );
      const requestBody: Record<string, unknown> = { type, scope };
      if (input.expiresAt) requestBody.expirationDateTime = input.expiresAt;
      const res = await this.graph.request<GraphPermission>(cred, url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });
      if (!res.ok) return res;
      const perm = res.value;
      if (!perm.link?.webUrl) {
        return mcpError(
          'MALFORMED_RESPONSE',
          'createLink returned permission without link.webUrl',
        );
      }
      return mcpOk({ link: parsePermission(perm) });
    });
  }

  async searchFiles(
    input: SearchFilesInput,
  ): Promise<McpResult<SearchFilesOutput>> {
    if (!input.query || input.query.trim().length === 0) {
      return mcpError('INVALID_ARGUMENT', 'searchFiles requires query');
    }
    const max = clampMax(input.maxResults);
    return this.withCredential(async (cred) => {
      const driveSegment = driveSegmentFor(input.driveId);
      const url = this.graph.url(
        `${driveSegment}/root/search(q='${encodeURIComponent(input.query.replace(/'/g, "''"))}')?$top=${max}`,
      );
      const res = await this.graph.get<GraphListResponse<GraphDriveItem>>(cred, url);
      if (!res.ok) return res;
      return mcpOk({
        items: (res.value.value ?? []).map(parseDriveItem),
      });
    });
  }

  async getRecentFiles(
    input: GetRecentFilesInput,
  ): Promise<McpResult<GetRecentFilesOutput>> {
    const max = clampMax(input.maxResults);
    return this.withCredential(async (cred) => {
      const url = this.graph.url(`/me/drive/recent?$top=${max}`);
      const res = await this.graph.get<GraphListResponse<GraphDriveItem>>(cred, url);
      if (!res.ok) return res;
      return mcpOk({
        items: (res.value.value ?? []).map(parseDriveItem),
      });
    });
  }

  // ── Resources ────────────────────────────────────────────────────────

  async listResources(): Promise<McpResult<ResourceDescriptor[]>> {
    return mcpOk([
      {
        uri: `onedrive://workspace/${this.workspaceId}/root`,
        name: 'OneDrive root',
        description:
          "Paginated view of the connected OneDrive root. Pass `?pageToken=…` to paginate.",
        mimeType: 'application/json',
      },
      {
        uri: `onedrive://workspace/${this.workspaceId}/recent`,
        name: 'Recent files',
        description:
          "Files the connected account has touched recently across OneDrive + SharePoint.",
        mimeType: 'application/json',
      },
    ]);
  }

  async readResource(
    input: ReadResourceInput,
  ): Promise<McpResult<ReadResourceOutput>> {
    const rootMatch = RESOURCE_URI_ROOT_RE.exec(input.uri);
    if (rootMatch) {
      if (rootMatch[1] !== this.workspaceId) {
        return mcpError(
          'FORBIDDEN',
          `Resource workspace ${rootMatch[1]} does not match server workspace ${this.workspaceId}`,
        );
      }
      const list = await this.listFiles({
        maxResults: DEFAULT_MAX_RESULTS,
        pageToken: rootMatch[2],
      });
      if (!list.ok) return list;
      return mcpOk({
        uri: input.uri,
        mimeType: 'application/json',
        text: JSON.stringify(list.value),
      });
    }
    const recentMatch = RESOURCE_URI_RECENT_RE.exec(input.uri);
    if (recentMatch) {
      if (recentMatch[1] !== this.workspaceId) {
        return mcpError(
          'FORBIDDEN',
          `Resource workspace ${recentMatch[1]} does not match server workspace ${this.workspaceId}`,
        );
      }
      const list = await this.getRecentFiles({});
      if (!list.ok) return list;
      return mcpOk({
        uri: input.uri,
        mimeType: 'application/json',
        text: JSON.stringify(list.value),
      });
    }
    return mcpError(
      'INVALID_ARGUMENT',
      `Unknown resource URI: ${input.uri}. Expected onedrive://workspace/{workspaceId}/{root|recent}.`,
    );
  }

  // ── internals ────────────────────────────────────────────────────────

  private async withCredential<T>(
    fn: (credential: DecryptedCredential) => Promise<McpResult<T>>,
  ): Promise<McpResult<T>> {
    const resolved = await resolveCredential({ workspaceId: this.workspaceId });
    if (!resolved.ok) return resolved;
    return fn(resolved.value);
  }
}

// ── Helpers ────────────────────────────────────────────────────────────

function clampMax(value: number | undefined): number {
  if (value === undefined) return DEFAULT_MAX_RESULTS;
  if (!Number.isFinite(value) || value <= 0) return DEFAULT_MAX_RESULTS;
  return Math.min(MAX_PAGE_SIZE, Math.floor(value));
}

function driveSegmentFor(driveId: string | undefined): string {
  if (!driveId) return '/me/drive';
  return `/drives/${encodeURIComponent(driveId)}`;
}

/** Per Microsoft Graph docs, the addressable path segment uses
 *  `/root:/{path}:` and the `{path}` portion is URL-encoded as a regular
 *  URL path component (forward slashes preserved). */
function encodePath(path: string): string {
  return path
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
}

function combinePath(folder: string, filename: string): string {
  if (!folder) return filename;
  return `${folder.replace(/\/+$/, '')}/${filename}`;
}

function parseDriveItem(item: GraphDriveItem): FileItem {
  const isFolder = !!item.folder;
  const parentPath =
    item.parentReference?.path?.replace(/^\/drive\/root:/, '').replace(/^\//, '') ??
    '';
  return {
    id: item.id ?? '',
    driveId: item.parentReference?.driveId ?? null,
    name: item.name ?? '',
    itemType: isFolder ? 'folder' : 'file',
    mimeType: isFolder ? null : item.file?.mimeType ?? null,
    sizeBytes: typeof item.size === 'number' ? item.size : 0,
    createdAt: item.createdDateTime ?? new Date().toISOString(),
    lastModifiedAt: item.lastModifiedDateTime ?? new Date().toISOString(),
    webUrl: item.webUrl ?? null,
    parentPath,
  };
}

function parsePermission(perm: GraphPermission): SharingLinkSummary {
  return {
    id: perm.id ?? '',
    type: perm.link?.type ?? 'view',
    scope: perm.link?.scope ?? 'organization',
    webUrl: perm.link?.webUrl ?? '',
    expiresAt: perm.expirationDateTime ?? null,
  };
}
