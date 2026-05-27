/**
 * lib/customer-files/index.ts
 *
 * Re-export surface for the per-customer file ingestion + retrieval
 * pipeline. Callers import from `@/lib/customer-files` only.
 */

export { FixtureFileSource } from './fixture-source';
export type { FixtureFileDescriptor, FixtureFileSourceConfig } from './fixture-source';

export {
  DriveFileSource,
  DEFAULT_DRIVE_QUERY,
  DRIVE_SUPPORTED_MIME_TYPES,
} from './drive-source';
export type { DriveFileSourceConfig } from './drive-source';

export { chunkText } from './chunk';
export type { ChunkOptions, TextChunk } from './chunk';

export { ingestWorkspaceFiles } from './ingest';
export type {
  IngestWorkspaceFilesArgs,
  IngestWorkspaceFilesResult,
  IngestFileReport,
} from './ingest';

export { retrieveCustomerContext } from './retrieve';
export type { RetrieveCustomerContextArgs } from './retrieve';

export { renderCustomerContextBlock } from './render';
export type { CustomerContextSnippet, RenderCustomerContextOptions } from './render';

export type {
  FileContent,
  FileRef,
  FileSourceError,
  FileSourceErrorCode,
  FileSourceResult,
  IFileSource,
} from './types';
export { fileSourceOk, fileSourceError } from './types';

export {
  customerFileSourceNamesForProvider,
  deleteIntegrationCustomerData,
  reapTombstonedDriveCustomerData,
  tearDownWorkspaceData,
} from './deletion';
export type {
  DeleteIntegrationCustomerDataArgs,
  DeleteIntegrationCustomerDataResult,
  ReapTombstonedArgs,
  ReapTombstonedResult,
  TearDownWorkspaceDataArgs,
  TearDownWorkspaceDataResult,
} from './deletion';
