/**
 * lib/customer-files/types.ts
 *
 * Boundary types for the per-workspace file-ingestion pipeline.
 * Implements the "it sounds like you because it works from your files /
 * past deals" claim from marketing/[vertical]/page.tsx.
 *
 * The IFileSource port — like every other adapter in the codebase per
 * feedback_no_silent_vendor_lock + feedback_runner_portability — has
 * two implementations:
 *   - FixtureFileSource: deterministic, on-disk JSON-described fixtures.
 *     Lets the pipeline be PROVED correct against synthetic data today.
 *   - DriveFileSource: OAuth-backed (Google Drive / OneDrive). Returns
 *     NOT_CONFIGURED until the workspace's IntegrationCredential row
 *     for that provider lands. The pipeline is identical on either; the
 *     adapter is the seam.
 *
 * Per project_no_outbound_architecture.md the source READS files — it
 * never writes to the customer's drive. The ingestion path WRITES rows
 * into our own KnowledgeDocument table; that's not outbound (the
 * customer-receive carve-out applies the other direction).
 */

export type FileSourceResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: FileSourceError };

export type FileSourceErrorCode =
  | 'NOT_CONFIGURED'
  | 'AUTHENTICATION'
  | 'NETWORK'
  | 'NOT_FOUND'
  | 'PROVIDER_ERROR'
  | 'INVALID_ARGUMENT'
  | 'CONTENT_TOO_LARGE';

export interface FileSourceError {
  code: FileSourceErrorCode;
  message: string;
  reference?: string;
}

export function fileSourceOk<T>(value: T): { ok: true; value: T } {
  return { ok: true, value };
}

export function fileSourceError(
  code: FileSourceErrorCode,
  message: string,
  reference?: string,
): { ok: false; error: FileSourceError } {
  return { ok: false, error: { code, message, reference } };
}

/** A file the source advertised in `listFiles()`. The pipeline calls
 *  back into `fetchFile()` per ref to pull the actual body — keeps the
 *  list cheap and lets the source paginate. */
export interface FileRef {
  /** Stable provider-side identifier (Drive fileId, OneDrive item id,
   *  fixture filename). Used as the dedupe key for re-ingestion. */
  id: string;
  /** Display title for the operator audit log + the KnowledgeDocument
   *  title column. */
  title: string;
  /** MIME type as reported by the source. Drives extraction strategy. */
  mimeType: string;
  /** Best-effort size in bytes. NULL when the source doesn't say. */
  sizeBytes: number | null;
  /** Optional source URL — surfaced in operator audit / future "where
   *  did this come from" UI. NULL when the source has no canonical URL. */
  sourceUrl: string | null;
  /** Optional last-modified timestamp from the source. */
  modifiedAt: Date | null;
  /** Provider-specific extras. Stored verbatim on the KnowledgeDocument
   *  metadata column so a future debug session has the raw signal. */
  metadata: Record<string, unknown>;
}

/** The content payload a source returned for one file. The pipeline
 *  expects plain text — sources that wrap rich formats (PDF, DOCX)
 *  extract to text BEFORE returning. Today the fixture source returns
 *  text directly; the OAuth-backed sources defer their extraction
 *  strategy to a later PR. */
export interface FileContent {
  ref: FileRef;
  text: string;
}

/** The IFileSource port. Each implementation owns a single integration
 *  provider (or a deterministic on-disk fixture) and is the ONLY file
 *  that knows that provider's API surface. */
export interface IFileSource {
  readonly name: string;
  /** List files in a workspace's connected source. Implementations
   *  should bound results — pagination is internal. */
  listFiles(workspaceId: string): Promise<FileSourceResult<FileRef[]>>;
  /** Fetch one file's extracted text body. The pipeline calls this once
   *  per ref returned by listFiles(). */
  fetchFile(
    workspaceId: string,
    fileRef: FileRef,
  ): Promise<FileSourceResult<FileContent>>;
}
