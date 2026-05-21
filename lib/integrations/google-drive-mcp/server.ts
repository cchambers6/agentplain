/**
 * lib/integrations/google-drive-mcp/server.ts
 *
 * Production Google Drive MCP server. Wraps the Drive API v3 (per
 * https://developers.google.com/drive/api/reference/rest/v3, read 2026-05-20)
 * behind the `DriveMcpServer` interface. One instance per `{workspaceId}` per
 * request. This file is the ONLY place that imports `googleapis` for Drive;
 * route handlers + skills speak the MCP interface (per
 * `feedback_no_silent_vendor_lock.md`).
 *
 * Cold-start safe: every method re-resolves the credential via
 * `resolveDriveCredential` inside `withDrive`; no token or client is cached on
 * the instance (per `feedback_cold_start_safe_agents.md`).
 */

import { Readable } from 'node:stream';
import { google, type drive_v3 } from 'googleapis';
import { mcpError, mcpOk, type McpError, type McpResult } from '@/lib/integrations/mcp-core';
import type { DecryptedCredential } from '@/lib/integrations/types';
import { resolveDriveCredential } from './auth';
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

const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;
const SUMMARY_FIELDS = 'files(id,name,mimeType,modifiedTime),nextPageToken';
const METADATA_FIELDS =
  'id,name,mimeType,modifiedTime,createdTime,size,parents,webViewLink,iconLink,trashed';
/** Google-native docs have no binary form; export them to PDF on download. */
const GOOGLE_NATIVE_PREFIX = 'application/vnd.google-apps.';
const EXPORT_PDF_MIME = 'application/pdf';

export class ProdDriveMcpServer implements DriveMcpServer {
  readonly name = 'google-drive-rest' as const;
  readonly workspaceId: string;

  constructor(args: { workspaceId: string }) {
    if (!args.workspaceId) throw new Error('ProdDriveMcpServer: workspaceId is required');
    this.workspaceId = args.workspaceId;
  }

  async listFiles(input: ListFilesInput): Promise<McpResult<ListFilesOutput>> {
    const size = clampPageSize(input.pageSize);
    if (!size.ok) return size;
    return this.withDrive(async (drive) => {
      try {
        const res = await drive.files.list({
          q: input.query,
          pageSize: size.value,
          pageToken: input.pageToken,
          fields: SUMMARY_FIELDS,
        });
        return mcpOk({
          files: (res.data.files ?? []).map(toFileSummary),
          nextPageToken: res.data.nextPageToken ?? null,
        });
      } catch (err) {
        return mapDriveError(err);
      }
    });
  }

  async getFileMetadata(input: GetFileMetadataInput): Promise<McpResult<GetFileMetadataOutput>> {
    if (!input.fileId) return mcpError('INVALID_ARGUMENT', 'getFileMetadata requires fileId');
    return this.withDrive(async (drive) => {
      try {
        const res = await drive.files.get({ fileId: input.fileId, fields: METADATA_FIELDS });
        return mcpOk({ file: toFileMetadata(res.data) });
      } catch (err) {
        return mapDriveError(err);
      }
    });
  }

  async downloadFile(input: DownloadFileInput): Promise<McpResult<DownloadFileOutput>> {
    if (!input.fileId) return mcpError('INVALID_ARGUMENT', 'downloadFile requires fileId');
    return this.withDrive(async (drive) => {
      try {
        // First learn the mimeType so we know whether to export (Google-native
        // docs) or stream the raw media.
        const meta = await drive.files.get({ fileId: input.fileId, fields: 'mimeType' });
        const sourceMime = meta.data.mimeType ?? 'application/octet-stream';
        const isNative = sourceMime.startsWith(GOOGLE_NATIVE_PREFIX);

        const res = isNative
          ? await drive.files.export(
              { fileId: input.fileId, mimeType: EXPORT_PDF_MIME },
              { responseType: 'arraybuffer' },
            )
          : await drive.files.get(
              { fileId: input.fileId, alt: 'media' },
              { responseType: 'arraybuffer' },
            );

        const buf = Buffer.from(res.data as ArrayBuffer);
        const mimeType = isNative
          ? EXPORT_PDF_MIME
          : headerContentType(res) ?? sourceMime;
        return mcpOk({
          fileId: input.fileId,
          mimeType,
          contentBase64: buf.toString('base64'),
          sizeBytes: buf.byteLength,
          exported: isNative,
        });
      } catch (err) {
        return mapDriveError(err);
      }
    });
  }

  async uploadFile(input: UploadFileInput): Promise<McpResult<UploadFileOutput>> {
    if (!input.name) return mcpError('INVALID_ARGUMENT', 'uploadFile requires name');
    if (!input.mimeType) return mcpError('INVALID_ARGUMENT', 'uploadFile requires mimeType');
    if (!input.contentBase64) return mcpError('INVALID_ARGUMENT', 'uploadFile requires contentBase64');
    const body = decodeBase64(input.contentBase64);
    if (!body.ok) return body;
    return this.withDrive(async (drive) => {
      try {
        const requestBody: drive_v3.Schema$File = { name: input.name };
        if (input.parentFolderId) requestBody.parents = [input.parentFolderId];
        const res = await drive.files.create({
          requestBody,
          media: { mimeType: input.mimeType, body: bufferToStream(body.value) },
          fields: 'id,name,mimeType,parents',
        });
        if (!res.data.id) return mcpError('MALFORMED_RESPONSE', 'files.create returned no id');
        return mcpOk({
          id: res.data.id,
          name: res.data.name ?? input.name,
          mimeType: res.data.mimeType ?? input.mimeType,
          parents: res.data.parents ?? [],
        });
      } catch (err) {
        return mapDriveError(err);
      }
    });
  }

  async createFolder(input: CreateFolderInput): Promise<McpResult<CreateFolderOutput>> {
    if (!input.name) return mcpError('INVALID_ARGUMENT', 'createFolder requires name');
    return this.withDrive(async (drive) => {
      try {
        const requestBody: drive_v3.Schema$File = {
          name: input.name,
          mimeType: FOLDER_MIME_TYPE,
        };
        if (input.parentFolderId) requestBody.parents = [input.parentFolderId];
        const res = await drive.files.create({ requestBody, fields: 'id,name,parents' });
        if (!res.data.id) return mcpError('MALFORMED_RESPONSE', 'files.create returned no folder id');
        return mcpOk({
          id: res.data.id,
          name: res.data.name ?? input.name,
          parents: res.data.parents ?? [],
        });
      } catch (err) {
        return mapDriveError(err);
      }
    });
  }

  async searchFiles(input: SearchFilesInput): Promise<McpResult<SearchFilesOutput>> {
    if (!input.text || input.text.trim().length === 0) {
      return mcpError('INVALID_ARGUMENT', 'searchFiles requires text');
    }
    const size = clampPageSize(input.pageSize);
    if (!size.ok) return size;
    // Escape single quotes so the term cannot break out of the quoted clause.
    const term = input.text.replace(/'/g, "\\'");
    return this.withDrive(async (drive) => {
      try {
        const res = await drive.files.list({
          q: `fullText contains '${term}'`,
          pageSize: size.value,
          pageToken: input.pageToken,
          fields: SUMMARY_FIELDS,
        });
        return mcpOk({
          files: (res.data.files ?? []).map(toFileSummary),
          nextPageToken: res.data.nextPageToken ?? null,
        });
      } catch (err) {
        return mapDriveError(err);
      }
    });
  }

  /**
   * Change who can access a file. GATED: sharing alters access, which the
   * platform never auto-performs (`project_no_outbound_architecture.md` +
   * prohibited-actions rule). The dispatcher cannot run this without a
   * non-empty `approvalToken` supplied by a human approval step; the guard
   * below is the load-bearing enforcement (the schema only marks it required).
   */
  async shareFile(input: ShareFileInput): Promise<McpResult<ShareFileOutput>> {
    if (!input.approvalToken || input.approvalToken.trim().length === 0) {
      return mcpError(
        'APPROVAL_REQUIRED',
        'share_file changes who can access a file and requires human approval; pass approvalToken (a non-empty token supplied by an approval step) to proceed.',
      );
    }
    if (!input.fileId) return mcpError('INVALID_ARGUMENT', 'shareFile requires fileId');
    const type = input.type ?? 'user';
    if ((type === 'user' || type === 'group') && !input.emailAddress) {
      return mcpError('INVALID_ARGUMENT', `shareFile with type=${type} requires emailAddress`);
    }
    return this.withDrive(async (drive) => {
      try {
        const requestBody: drive_v3.Schema$Permission = { role: input.role, type };
        if (input.emailAddress) requestBody.emailAddress = input.emailAddress;
        const res = await drive.permissions.create({
          fileId: input.fileId,
          requestBody,
          fields: 'id,role,type',
        });
        if (!res.data.id) return mcpError('MALFORMED_RESPONSE', 'permissions.create returned no id');
        return mcpOk({
          fileId: input.fileId,
          permissionId: res.data.id,
          role: res.data.role ?? input.role,
          type: res.data.type ?? type,
        });
      } catch (err) {
        return mapDriveError(err);
      }
    });
  }

  // ── internals ─────────────────────────────────────────────────────────

  /**
   * Re-resolves the credential on every call. We deliberately do NOT cache the
   * drive_v3.Drive client on the instance — caching plaintext tokens across
   * calls breaks `feedback_cold_start_safe_agents.md`.
   */
  private async withDrive<T>(
    fn: (drive: drive_v3.Drive) => Promise<McpResult<T>>,
  ): Promise<McpResult<T>> {
    const resolved = await resolveDriveCredential({ workspaceId: this.workspaceId });
    if (!resolved.ok) return resolved;
    return fn(makeDriveClient(resolved.value));
  }
}

// ── helpers ─────────────────────────────────────────────────────────────

function makeDriveClient(credential: DecryptedCredential): drive_v3.Drive {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({
    access_token: credential.accessToken,
    refresh_token: credential.refreshToken ?? undefined,
  });
  return google.drive({ version: 'v3', auth });
}

function bufferToStream(buf: Buffer): NodeJS.ReadableStream {
  // Readable.from yields the bytes the Drive media upload streams.
  return Readable.from(buf);
}

function headerContentType(res: { headers?: Record<string, unknown> }): string | null {
  const ct = res.headers?.['content-type'];
  if (typeof ct === 'string') return ct.split(';')[0].trim();
  return null;
}

function decodeBase64(value: string): McpResult<Buffer> {
  try {
    const buf = Buffer.from(value, 'base64');
    if (buf.length === 0 && value.length > 0) {
      return mcpError('INVALID_ARGUMENT', 'contentBase64 did not decode to any bytes');
    }
    return mcpOk(buf);
  } catch (err) {
    return mcpError('INVALID_ARGUMENT', `contentBase64 is not valid base64: ${errMessage(err)}`);
  }
}

function clampPageSize(value: number | undefined): McpResult<number> {
  if (value === undefined) return mcpOk(DEFAULT_PAGE_SIZE);
  if (!Number.isInteger(value) || value <= 0) {
    return mcpError('INVALID_ARGUMENT', `pageSize must be a positive integer, got ${value}`);
  }
  if (value > MAX_PAGE_SIZE) {
    return mcpError('INVALID_ARGUMENT', `pageSize must be <= ${MAX_PAGE_SIZE}, got ${value}`);
  }
  return mcpOk(value);
}

function toFileSummary(f: drive_v3.Schema$File): DriveFileSummary {
  return {
    id: f.id ?? '',
    name: f.name ?? '',
    mimeType: f.mimeType ?? 'application/octet-stream',
    modifiedTime: f.modifiedTime ?? null,
  };
}

function toFileMetadata(f: drive_v3.Schema$File): FileMetadata {
  return {
    id: f.id ?? '',
    name: f.name ?? '',
    mimeType: f.mimeType ?? 'application/octet-stream',
    modifiedTime: f.modifiedTime ?? null,
    createdTime: f.createdTime ?? null,
    size: f.size ?? null,
    parents: f.parents ?? [],
    webViewLink: f.webViewLink ?? null,
    iconLink: f.iconLink ?? null,
    trashed: typeof f.trashed === 'boolean' ? f.trashed : null,
  };
}

function errMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function mapDriveError(err: unknown): { ok: false; error: McpError } {
  if (!err || typeof err !== 'object') {
    return mcpError('UPSTREAM_ERROR', String(err));
  }
  const rec = err as {
    code?: number | string;
    message?: string;
    response?: { status?: number };
  };
  const message = typeof rec.message === 'string' ? rec.message : 'unknown Google Drive API error';
  const status =
    typeof rec.response?.status === 'number'
      ? rec.response.status
      : typeof rec.code === 'number'
      ? rec.code
      : undefined;
  if (status === 401) return mcpError('TOKEN_EXPIRED', message, { status });
  if (status === 403) return mcpError('FORBIDDEN', message, { status });
  if (status === 404) return mcpError('NOT_FOUND', message, { status });
  if (status === 429) return mcpError('RATE_LIMITED', message, { status });
  if (status && status >= 500) return mcpError('UPSTREAM_ERROR', message, { status });
  return mcpError('UPSTREAM_ERROR', message, status ? { status } : undefined);
}
