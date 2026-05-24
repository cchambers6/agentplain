/**
 * lib/customer-files/fixture-source.ts
 *
 * Deterministic on-disk file source. One workspace = one directory of
 * JSON-described files. Used by tests + by Conner's dogfood pass to
 * prove the ingestion pipeline END-TO-END before any OAuth-backed
 * provider lands.
 *
 * Layout:
 *   tests/fixtures/customer-files/<workspaceId>/<file>.json
 *   where each json file is { id, title, mimeType, sizeBytes, sourceUrl,
 *     modifiedAt, metadata, text }.
 *
 * Per feedback_runner_portability.md, this is the second-implementation
 * peer of every prod-OAuth file source.
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import {
  FileContent,
  FileRef,
  FileSourceResult,
  IFileSource,
  fileSourceError,
  fileSourceOk,
} from './types';

export interface FixtureFileDescriptor {
  id: string;
  title: string;
  mimeType?: string;
  sizeBytes?: number | null;
  sourceUrl?: string | null;
  modifiedAt?: string | null;
  metadata?: Record<string, unknown>;
  text: string;
}

export interface FixtureFileSourceConfig {
  /** Absolute path to the fixture root. Each subdirectory is one
   *  workspaceId; each file inside is one FixtureFileDescriptor JSON. */
  rootDir: string;
}

export class FixtureFileSource implements IFileSource {
  readonly name = 'fixture' as const;
  private readonly rootDir: string;

  constructor(config: FixtureFileSourceConfig) {
    this.rootDir = config.rootDir;
  }

  async listFiles(workspaceId: string): Promise<FileSourceResult<FileRef[]>> {
    const dir = path.join(this.rootDir, workspaceId);
    let entries: string[] = [];
    try {
      entries = await fs.readdir(dir);
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code === 'ENOENT') return fileSourceOk([]);
      return fileSourceError(
        'PROVIDER_ERROR',
        `failed to list fixture dir ${dir}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
    const refs: FileRef[] = [];
    for (const name of entries.sort()) {
      if (!name.endsWith('.json')) continue;
      const descriptor = await this.readDescriptor(workspaceId, name);
      if (!descriptor.ok) return descriptor;
      refs.push(toRef(descriptor.value));
    }
    return fileSourceOk(refs);
  }

  async fetchFile(
    workspaceId: string,
    fileRef: FileRef,
  ): Promise<FileSourceResult<FileContent>> {
    // The fixture source resolves a ref back to its descriptor JSON. The
    // ref.id field doubles as the filename stem (e.g. "ref-001" → "ref-001.json").
    const filename = fileRef.id.endsWith('.json')
      ? fileRef.id
      : `${fileRef.id}.json`;
    const descriptor = await this.readDescriptor(workspaceId, filename);
    if (!descriptor.ok) return descriptor;
    return fileSourceOk({
      ref: toRef(descriptor.value),
      text: descriptor.value.text,
    });
  }

  private async readDescriptor(
    workspaceId: string,
    filename: string,
  ): Promise<FileSourceResult<FixtureFileDescriptor>> {
    const filePath = path.join(this.rootDir, workspaceId, filename);
    let raw: string;
    try {
      raw = await fs.readFile(filePath, 'utf8');
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code === 'ENOENT') {
        return fileSourceError(
          'NOT_FOUND',
          `fixture file not found: ${filePath}`,
        );
      }
      return fileSourceError(
        'PROVIDER_ERROR',
        `failed to read fixture ${filePath}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (err) {
      return fileSourceError(
        'PROVIDER_ERROR',
        `fixture ${filePath} is not valid JSON: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
    if (!parsed || typeof parsed !== 'object') {
      return fileSourceError(
        'INVALID_ARGUMENT',
        `fixture ${filePath} did not deserialize to an object`,
      );
    }
    const obj = parsed as Record<string, unknown>;
    if (typeof obj.id !== 'string' || typeof obj.title !== 'string' || typeof obj.text !== 'string') {
      return fileSourceError(
        'INVALID_ARGUMENT',
        `fixture ${filePath} is missing required fields (id/title/text)`,
      );
    }
    return fileSourceOk({
      id: obj.id,
      title: obj.title,
      mimeType: typeof obj.mimeType === 'string' ? obj.mimeType : 'text/plain',
      sizeBytes:
        typeof obj.sizeBytes === 'number' && Number.isFinite(obj.sizeBytes)
          ? obj.sizeBytes
          : null,
      sourceUrl:
        typeof obj.sourceUrl === 'string' && obj.sourceUrl.length > 0
          ? obj.sourceUrl
          : null,
      modifiedAt:
        typeof obj.modifiedAt === 'string' && obj.modifiedAt.length > 0
          ? obj.modifiedAt
          : null,
      metadata:
        obj.metadata && typeof obj.metadata === 'object' && !Array.isArray(obj.metadata)
          ? (obj.metadata as Record<string, unknown>)
          : {},
      text: obj.text,
    });
  }
}

function toRef(descriptor: FixtureFileDescriptor): FileRef {
  return {
    id: descriptor.id,
    title: descriptor.title,
    mimeType: descriptor.mimeType ?? 'text/plain',
    sizeBytes: descriptor.sizeBytes ?? null,
    sourceUrl: descriptor.sourceUrl ?? null,
    modifiedAt: descriptor.modifiedAt ? new Date(descriptor.modifiedAt) : null,
    metadata: descriptor.metadata ?? {},
  };
}
