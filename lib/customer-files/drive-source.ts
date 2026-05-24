/**
 * lib/customer-files/drive-source.ts
 *
 * Google Drive file source — the second prod implementation of
 * IFileSource alongside FixtureFileSource. Returns NOT_CONFIGURED until
 * the workspace's IntegrationCredential row for GOOGLE lands with drive
 * scopes; once present, this is the path that ships customer files into
 * the knowledge substrate.
 *
 * The actual Drive API call lives behind `lib/integrations/google/`
 * (per feedback_no_silent_vendor_lock.md — googleapis stays in that
 * folder). This file is the IFileSource adapter that translates between
 * Drive's shape and the IFileSource boundary.
 *
 * Today the body is a stub that returns NOT_CONFIGURED — that flips to
 * a real call when the Drive adapter under lib/integrations/google/
 * lands its `listFiles` + `getFileText` helpers. Pipeline + tests will
 * not need to change: the ingestion path already speaks IFileSource.
 */

import {
  FileContent,
  FileRef,
  FileSourceResult,
  IFileSource,
  fileSourceError,
} from './types';

export interface DriveFileSourceConfig {
  /** When true, the source rejects ALL calls with NOT_CONFIGURED — used
   *  until the OAuth scopes land. Default true (safe state). Flip false
   *  when the prod Drive helper is wired. */
  unwired?: boolean;
}

export class DriveFileSource implements IFileSource {
  readonly name = 'google-drive' as const;
  private readonly unwired: boolean;

  constructor(config: DriveFileSourceConfig = {}) {
    this.unwired = config.unwired !== false;
  }

  async listFiles(_workspaceId: string): Promise<FileSourceResult<FileRef[]>> {
    if (this.unwired) {
      return fileSourceError(
        'NOT_CONFIGURED',
        'Drive file source is not wired yet — connect Google Drive on /integrations to enable.',
      );
    }
    // Future: route to lib/integrations/google/drive.listFiles(workspaceId).
    return fileSourceError(
      'NOT_CONFIGURED',
      'Drive list path is wired but not implemented in this PR.',
    );
  }

  async fetchFile(
    _workspaceId: string,
    _fileRef: FileRef,
  ): Promise<FileSourceResult<FileContent>> {
    if (this.unwired) {
      return fileSourceError(
        'NOT_CONFIGURED',
        'Drive file source is not wired yet.',
      );
    }
    return fileSourceError(
      'NOT_CONFIGURED',
      'Drive fetch path is wired but not implemented in this PR.',
    );
  }
}
