/**
 * lib/customer-files/drive-source.ts
 *
 * Google Drive file source — the second prod implementation of
 * `IFileSource` alongside `FixtureFileSource`. Lists the workspace's
 * Drive files via the per-workspace `DriveMcpServer`
 * (`lib/integrations/google-drive-mcp`) and downloads their bytes
 * through the same MCP. The MCP server is the one place that imports
 * `googleapis` (per `feedback_no_silent_vendor_lock.md`); this adapter
 * is the seam that translates between the MCP envelope and the
 * vendor-neutral `IFileSource` contract the ingestion pipeline speaks.
 *
 * Per `feedback_cold_start_safe_agents.md`: `buildMcpServer` is invoked
 * per call. The MCP server re-resolves the OAuth credential on every
 * Drive API call via `resolveDriveCredential`, which itself wraps reads
 * in `withSystemContext` so the row lookup honors the workspace-scoped
 * RLS policy on `IntegrationCredential`.
 *
 * NOT_CONFIGURED graceful path: when the workspace has no active GOOGLE
 * `IntegrationCredential` row the credential resolver returns
 * `CREDENTIAL_NOT_FOUND`; that maps to `NOT_CONFIGURED` and the
 * ingestion sweep counts the workspace as `workspacesSkippedUnconfigured`
 * — a clean zero rather than a failure. Every other MCP error surfaces
 * as a non-NOT_CONFIGURED `IFileSource` error so operator dashboards see
 * real problems instead of silent skips.
 *
 * V1 scope: only text-extractable mime types
 * (`text/plain | text/markdown | text/csv | text/html | application/json`)
 * are listed. The Drive query (`mimeType =` clauses) restricts upstream
 * so the per-workspace file list never includes binary blobs we cannot
 * yet extract. Google-native docs (Google Docs / Sheets) are deferred to
 * a follow-up that extends `DriveMcpServer.downloadFile` with a
 * `text/plain` export path — listing them today without that path would
 * generate per-file failures with no recovery.
 */

import {
  buildDriveMcpServer,
  type DriveMcpServer,
} from '@/lib/integrations/google-drive-mcp';
import type { McpError } from '@/lib/integrations/mcp-core';
import {
  FileContent,
  FileRef,
  FileSourceResult,
  IFileSource,
  fileSourceError,
  fileSourceOk,
} from './types';

/** Mime types this source can ingest. Anything else is filtered out at
 *  list time by `DEFAULT_DRIVE_QUERY` and rejected at fetch time as a
 *  defense in depth if a caller passes a hand-crafted ref. */
export const DRIVE_SUPPORTED_MIME_TYPES = [
  'text/plain',
  'text/markdown',
  'text/csv',
  'text/html',
  'application/json',
] as const;

/** Drive `q` clause restricting list_files to non-trashed, text mimes. */
export const DEFAULT_DRIVE_QUERY = [
  'trashed = false',
  `(${DRIVE_SUPPORTED_MIME_TYPES.map((m) => `mimeType = '${m}'`).join(' or ')})`,
].join(' and ');

const DEFAULT_PAGE_SIZE = 50;
const DEFAULT_MAX_FILES_PER_WORKSPACE = 200;
/** Hard ceiling per file to keep one giant CSV from torching an embed budget. */
const MAX_FILE_BYTES = 5 * 1024 * 1024;

export interface DriveFileSourceConfig {
  /**
   * Inject the per-workspace Drive MCP server factory. Defaults to the
   * shipped `buildDriveMcpServer` which returns `ProdDriveMcpServer`
   * (or `TestDriveMcpServer` when `INTEGRATIONS_PROVIDER=test`). Tests
   * pass a deterministic mock here; production never overrides.
   */
  buildMcpServer?: (args: { workspaceId: string }) => DriveMcpServer;
  /**
   * Hard kill-switch. When true, every call returns NOT_CONFIGURED
   * without touching the MCP layer. Lets a deployment force-disable
   * Drive ingestion (e.g. during incident response) without removing
   * IntegrationCredential rows.
   */
  forceUnconfigured?: boolean;
  /** Drive `q` clause. Defaults to `DEFAULT_DRIVE_QUERY`. */
  query?: string;
  /** Drive `list_files` page size (1..100). Default 50. */
  pageSize?: number;
  /** Safety cap on files per workspace per sweep. Default 200. */
  maxFiles?: number;
}

export class DriveFileSource implements IFileSource {
  readonly name = 'google-drive' as const;
  private readonly buildMcpServer: (args: { workspaceId: string }) => DriveMcpServer;
  private readonly forceUnconfigured: boolean;
  private readonly query: string;
  private readonly pageSize: number;
  private readonly maxFiles: number;

  constructor(config: DriveFileSourceConfig = {}) {
    this.buildMcpServer = config.buildMcpServer ?? buildDriveMcpServer;
    this.forceUnconfigured = config.forceUnconfigured === true;
    this.query = config.query ?? DEFAULT_DRIVE_QUERY;
    this.pageSize = config.pageSize ?? DEFAULT_PAGE_SIZE;
    this.maxFiles = config.maxFiles ?? DEFAULT_MAX_FILES_PER_WORKSPACE;
  }

  async listFiles(workspaceId: string): Promise<FileSourceResult<FileRef[]>> {
    if (this.forceUnconfigured) {
      return notConfigured('Drive file source disabled by config (forceUnconfigured=true).');
    }
    if (!workspaceId) {
      return fileSourceError('INVALID_ARGUMENT', 'DriveFileSource.listFiles requires a workspaceId');
    }
    const server = this.buildMcpServer({ workspaceId });
    const refs: FileRef[] = [];
    let pageToken: string | undefined;
    do {
      const remaining = this.maxFiles - refs.length;
      if (remaining <= 0) break;
      const page = await server.listFiles({
        query: this.query,
        pageSize: Math.min(this.pageSize, remaining),
        pageToken,
      });
      if (!page.ok) return mapMcpToFileSourceError(page.error);
      for (const summary of page.value.files) {
        refs.push({
          id: summary.id,
          title: summary.name,
          mimeType: summary.mimeType,
          // list_files does not return size — fetchFile fills it in.
          sizeBytes: null,
          sourceUrl: summary.id ? `https://drive.google.com/file/d/${summary.id}/view` : null,
          modifiedAt: summary.modifiedTime ? new Date(summary.modifiedTime) : null,
          metadata: { driveFileId: summary.id },
        });
        if (refs.length >= this.maxFiles) break;
      }
      pageToken = page.value.nextPageToken ?? undefined;
    } while (pageToken);
    return fileSourceOk(refs);
  }

  async fetchFile(
    workspaceId: string,
    fileRef: FileRef,
  ): Promise<FileSourceResult<FileContent>> {
    if (this.forceUnconfigured) {
      return notConfigured('Drive file source disabled by config (forceUnconfigured=true).');
    }
    if (!workspaceId) {
      return fileSourceError('INVALID_ARGUMENT', 'DriveFileSource.fetchFile requires a workspaceId');
    }
    if (!isSupportedMime(fileRef.mimeType)) {
      // Defense in depth: the Drive query already filters these out, but
      // a hand-built FileRef shouldn't slip a binary blob through.
      return fileSourceError(
        'PROVIDER_ERROR',
        `Drive file ${fileRef.id} has unsupported mimeType ${fileRef.mimeType} for text extraction in this PR.`,
      );
    }
    const server = this.buildMcpServer({ workspaceId });
    const downloaded = await server.downloadFile({ fileId: fileRef.id });
    if (!downloaded.ok) return mapMcpToFileSourceError(downloaded.error);
    if (downloaded.value.sizeBytes > MAX_FILE_BYTES) {
      return fileSourceError(
        'CONTENT_TOO_LARGE',
        `Drive file ${fileRef.id} is ${downloaded.value.sizeBytes} bytes — exceeds ${MAX_FILE_BYTES} cap.`,
      );
    }
    const text = Buffer.from(downloaded.value.contentBase64, 'base64').toString('utf8');
    return fileSourceOk({
      ref: { ...fileRef, sizeBytes: downloaded.value.sizeBytes },
      text,
    });
  }
}

function isSupportedMime(mimeType: string): boolean {
  return (DRIVE_SUPPORTED_MIME_TYPES as readonly string[]).includes(mimeType);
}

function notConfigured(message: string): FileSourceResult<never> {
  return fileSourceError('NOT_CONFIGURED', message);
}

/**
 * Translate an MCP error from the Drive layer into the IFileSource
 * vocabulary. The mapping is load-bearing:
 *   - `CREDENTIAL_NOT_FOUND` is the OAuth-not-connected signal — maps
 *     to NOT_CONFIGURED so the ingestion sweep treats the workspace as
 *     a clean skip.
 *   - Every other MCP error becomes a non-NOT_CONFIGURED IFileSource
 *     error so it surfaces in the sweep's `failures` list.
 */
function mapMcpToFileSourceError(err: McpError): FileSourceResult<never> {
  switch (err.code) {
    case 'CREDENTIAL_NOT_FOUND':
      return fileSourceError(
        'NOT_CONFIGURED',
        `Google Drive is not connected for this workspace: ${err.message}`,
        err.reference,
      );
    case 'UNAUTHORIZED':
    case 'FORBIDDEN':
    case 'GRANT_REVOKED':
    case 'TOKEN_EXPIRED':
      return fileSourceError('AUTHENTICATION', err.message, err.reference);
    case 'NOT_FOUND':
      return fileSourceError('NOT_FOUND', err.message, err.reference);
    case 'RATE_LIMITED':
    case 'NETWORK':
      return fileSourceError('NETWORK', err.message, err.reference);
    case 'INVALID_ARGUMENT':
      return fileSourceError('INVALID_ARGUMENT', err.message, err.reference);
    case 'APPROVAL_REQUIRED':
    case 'NOT_IMPLEMENTED':
    case 'MALFORMED_RESPONSE':
    case 'UPSTREAM_ERROR':
    case 'WORKSPACE_NOT_FOUND':
    default:
      return fileSourceError('PROVIDER_ERROR', err.message, err.reference);
  }
}
