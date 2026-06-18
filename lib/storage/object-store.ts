/**
 * lib/storage/object-store.ts
 *
 * The object-storage seam for the memory-scale layer. Cold-tier memory
 * blobs, exported archives, and generated artifacts are written through
 * `IObjectStore` — never a direct vendor call. Per
 * `feedback_no_silent_vendor_lock.md` + `project_living_portable_architecture.md`,
 * swapping Vercel Blob ↔ a customer's S3 bucket ↔ R2/MinIO/Wasabi is
 * "construct a different IObjectStore", not a rewrite.
 *
 * THREE implementations ship here:
 *
 *   • InMemoryObjectStore   — process-local map. The test + local-dev
 *                             fallback. Always available, no deps.
 *   • VercelBlobObjectStore  — the managed AGENTPLAIN default. Lazy-loads
 *                             `@vercel/blob` at call time.
 *   • S3CompatibleObjectStore — the customer-hosted (BYO) backend. Lazy-
 *                             loads `@aws-sdk/client-s3` at call time and
 *                             talks to any S3-compatible endpoint.
 *
 * WHY LAZY-LOAD: neither `@vercel/blob` nor `@aws-sdk/client-s3` is in
 * package.json yet (see docs/strategic-build-2026-06-17/TODOS-FOR-CONNER.md
 * — the cold-tier-storage decision is Conner's). Importing them statically
 * would break `build:no-migrate`. Instead each adapter dynamically imports
 * its SDK through a *variable* specifier (so `tsc` doesn't try to resolve
 * it) and returns a typed NOT_CONFIGURED error if the dep is absent. Adding
 * the dependency activates the adapter with no code change — the seam is
 * already wired.
 */

export type ObjectStoreErrorCode =
  | 'NOT_CONFIGURED'
  | 'NOT_FOUND'
  | 'AUTHENTICATION'
  | 'NETWORK'
  | 'INVALID_ARGUMENT'
  | 'UPSTREAM_ERROR';

export interface ObjectStoreError {
  code: ObjectStoreErrorCode;
  message: string;
}

export type ObjectStoreResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: ObjectStoreError };

export function storageOk<T>(value: T): { ok: true; value: T } {
  return { ok: true, value };
}

export function storageError(
  code: ObjectStoreErrorCode,
  message: string,
): { ok: false; error: ObjectStoreError } {
  return { ok: false, error: { code, message } };
}

export interface PutOptions {
  contentType?: string;
  /**
   * Server-side-encryption KMS key id / ARN to pass through to the backend
   * (S3 SSE-KMS). Ignored by stores that don't support it. For BYO-raw-key
   * envelope encryption, the caller encrypts the bytes BEFORE calling put —
   * this field is only the pass-through SSE path.
   */
  kmsKeyId?: string;
}

export interface StoredObject {
  key: string;
  bytes: Buffer;
  contentType?: string;
}

export interface ObjectHead {
  key: string;
  exists: boolean;
  size: number;
}

/**
 * The port. A `ref` returned by `put` is the DURABLE pointer the caller
 * persists (e.g. WorkspaceMemoryEntry.archivedRef): a blob URL, an
 * `s3://bucket/key` URI, or a `mem://key` token. `get`/`head`/`delete`
 * operate by the same `key` used at put time.
 */
export interface IObjectStore {
  readonly name: string;
  put(
    key: string,
    body: string | Buffer,
    opts?: PutOptions,
  ): Promise<ObjectStoreResult<{ key: string; ref: string }>>;
  get(key: string): Promise<ObjectStoreResult<StoredObject>>;
  delete(key: string): Promise<ObjectStoreResult<{ deleted: boolean }>>;
  head(key: string): Promise<ObjectStoreResult<ObjectHead>>;
}

const toBuffer = (body: string | Buffer): Buffer =>
  typeof body === 'string' ? Buffer.from(body, 'utf8') : body;

/**
 * `import()` through a variable specifier so the bundler/`tsc` doesn't try
 * to resolve the (optional) SDK at build time. Returns null if the module
 * isn't installed — callers map that to a NOT_CONFIGURED error.
 */
async function optionalImport<T = unknown>(specifier: string): Promise<T | null> {
  try {
    const dynamicSpecifier = specifier;
    return (await import(/* @vite-ignore */ dynamicSpecifier)) as T;
  } catch {
    return null;
  }
}

// =====================================================================
// InMemoryObjectStore — test + local fallback
// =====================================================================
export class InMemoryObjectStore implements IObjectStore {
  readonly name = 'in-memory' as const;
  private readonly store = new Map<string, { bytes: Buffer; contentType?: string }>();

  async put(
    key: string,
    body: string | Buffer,
    opts?: PutOptions,
  ): Promise<ObjectStoreResult<{ key: string; ref: string }>> {
    if (!key) return storageError('INVALID_ARGUMENT', 'object key is required');
    this.store.set(key, { bytes: toBuffer(body), contentType: opts?.contentType });
    return storageOk({ key, ref: `mem://${key}` });
  }

  async get(key: string): Promise<ObjectStoreResult<StoredObject>> {
    const hit = this.store.get(key);
    if (!hit) return storageError('NOT_FOUND', `no object at ${key}`);
    return storageOk({ key, bytes: hit.bytes, contentType: hit.contentType });
  }

  async delete(key: string): Promise<ObjectStoreResult<{ deleted: boolean }>> {
    const had = this.store.delete(key);
    return storageOk({ deleted: had });
  }

  async head(key: string): Promise<ObjectStoreResult<ObjectHead>> {
    const hit = this.store.get(key);
    return storageOk({ key, exists: !!hit, size: hit ? hit.bytes.byteLength : 0 });
  }
}

// =====================================================================
// VercelBlobObjectStore — managed AGENTPLAIN default
// =====================================================================
export interface VercelBlobConfig {
  /** BLOB_READ_WRITE_TOKEN; falls back to the env var when omitted. */
  token?: string;
  /** Key prefix so different concerns don't collide in the one blob store. */
  prefix?: string;
}

export class VercelBlobObjectStore implements IObjectStore {
  readonly name = 'vercel-blob' as const;
  private readonly token?: string;
  private readonly prefix: string;

  constructor(config: VercelBlobConfig = {}) {
    this.token = config.token ?? process.env.BLOB_READ_WRITE_TOKEN;
    this.prefix = config.prefix ? config.prefix.replace(/\/+$/, '') + '/' : '';
  }

  private path(key: string): string {
    return `${this.prefix}${key}`;
  }

  async put(
    key: string,
    body: string | Buffer,
    opts?: PutOptions,
  ): Promise<ObjectStoreResult<{ key: string; ref: string }>> {
    if (!this.token) return storageError('NOT_CONFIGURED', 'BLOB_READ_WRITE_TOKEN is not set');
    const mod = await optionalImport<{ put: Function }>('@vercel/blob');
    if (!mod?.put) {
      return storageError('NOT_CONFIGURED', '@vercel/blob is not installed (see TODOS-FOR-CONNER cold-tier decision)');
    }
    try {
      const res = await mod.put(this.path(key), toBuffer(body), {
        access: 'public',
        token: this.token,
        contentType: opts?.contentType,
        addRandomSuffix: false,
      });
      return storageOk({ key, ref: (res as { url: string }).url });
    } catch (err) {
      return storageError('UPSTREAM_ERROR', `vercel blob put failed: ${asMessage(err)}`);
    }
  }

  async get(key: string): Promise<ObjectStoreResult<StoredObject>> {
    if (!this.token) return storageError('NOT_CONFIGURED', 'BLOB_READ_WRITE_TOKEN is not set');
    const mod = await optionalImport<{ head: Function }>('@vercel/blob');
    if (!mod?.head) return storageError('NOT_CONFIGURED', '@vercel/blob is not installed');
    try {
      const meta = (await mod.head(this.path(key), { token: this.token })) as { url: string };
      const resp = await fetch(meta.url);
      if (!resp.ok) return storageError('NOT_FOUND', `blob fetch ${resp.status} for ${key}`);
      const bytes = Buffer.from(await resp.arrayBuffer());
      return storageOk({ key, bytes });
    } catch (err) {
      return storageError('NOT_FOUND', `vercel blob get failed: ${asMessage(err)}`);
    }
  }

  async delete(key: string): Promise<ObjectStoreResult<{ deleted: boolean }>> {
    if (!this.token) return storageError('NOT_CONFIGURED', 'BLOB_READ_WRITE_TOKEN is not set');
    const mod = await optionalImport<{ del: Function; head: Function }>('@vercel/blob');
    if (!mod?.del) return storageError('NOT_CONFIGURED', '@vercel/blob is not installed');
    try {
      const meta = (await mod.head(this.path(key), { token: this.token })) as { url: string };
      await mod.del(meta.url, { token: this.token });
      return storageOk({ deleted: true });
    } catch (err) {
      return storageError('UPSTREAM_ERROR', `vercel blob delete failed: ${asMessage(err)}`);
    }
  }

  async head(key: string): Promise<ObjectStoreResult<ObjectHead>> {
    if (!this.token) return storageError('NOT_CONFIGURED', 'BLOB_READ_WRITE_TOKEN is not set');
    const mod = await optionalImport<{ head: Function }>('@vercel/blob');
    if (!mod?.head) return storageError('NOT_CONFIGURED', '@vercel/blob is not installed');
    try {
      const meta = (await mod.head(this.path(key), { token: this.token })) as { size: number };
      return storageOk({ key, exists: true, size: meta.size ?? 0 });
    } catch {
      return storageOk({ key, exists: false, size: 0 });
    }
  }
}

// =====================================================================
// S3CompatibleObjectStore — customer-hosted (BYO) backend
// =====================================================================
export interface S3CompatibleConfig {
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  /** Path-style addressing — required by most non-AWS S3 endpoints. */
  forcePathStyle?: boolean;
  /** Key prefix inside the bucket. */
  prefix?: string;
}

export class S3CompatibleObjectStore implements IObjectStore {
  readonly name = 's3-compatible' as const;
  private readonly prefix: string;

  constructor(private readonly config: S3CompatibleConfig) {
    this.prefix = config.prefix ? config.prefix.replace(/\/+$/, '') + '/' : '';
  }

  private path(key: string): string {
    return `${this.prefix}${key}`;
  }

  private async client(): Promise<
    | { ok: true; mod: any; client: any }
    | { ok: false; error: ObjectStoreError }
  > {
    const mod = await optionalImport<any>('@aws-sdk/client-s3');
    if (!mod?.S3Client) {
      return {
        ok: false,
        error: {
          code: 'NOT_CONFIGURED',
          message: '@aws-sdk/client-s3 is not installed (see TODOS-FOR-CONNER cold-tier decision)',
        },
      };
    }
    const client = new mod.S3Client({
      endpoint: this.config.endpoint,
      region: this.config.region,
      forcePathStyle: this.config.forcePathStyle ?? true,
      credentials: {
        accessKeyId: this.config.accessKeyId,
        secretAccessKey: this.config.secretAccessKey,
      },
    });
    return { ok: true, mod, client };
  }

  async put(
    key: string,
    body: string | Buffer,
    opts?: PutOptions,
  ): Promise<ObjectStoreResult<{ key: string; ref: string }>> {
    const c = await this.client();
    if (!c.ok) return c;
    try {
      const input: Record<string, unknown> = {
        Bucket: this.config.bucket,
        Key: this.path(key),
        Body: toBuffer(body),
        ContentType: opts?.contentType,
      };
      if (opts?.kmsKeyId) {
        input.ServerSideEncryption = 'aws:kms';
        input.SSEKMSKeyId = opts.kmsKeyId;
      }
      await c.client.send(new c.mod.PutObjectCommand(input));
      return storageOk({ key, ref: `s3://${this.config.bucket}/${this.path(key)}` });
    } catch (err) {
      return storageError('UPSTREAM_ERROR', `s3 put failed: ${asMessage(err)}`);
    }
  }

  async get(key: string): Promise<ObjectStoreResult<StoredObject>> {
    const c = await this.client();
    if (!c.ok) return c;
    try {
      const res = await c.client.send(
        new c.mod.GetObjectCommand({ Bucket: this.config.bucket, Key: this.path(key) }),
      );
      const bytes = await streamToBuffer(res.Body);
      return storageOk({ key, bytes, contentType: res.ContentType });
    } catch (err) {
      const msg = asMessage(err);
      if (/NoSuchKey|NotFound|404/.test(msg)) return storageError('NOT_FOUND', `no object at ${key}`);
      return storageError('UPSTREAM_ERROR', `s3 get failed: ${msg}`);
    }
  }

  async delete(key: string): Promise<ObjectStoreResult<{ deleted: boolean }>> {
    const c = await this.client();
    if (!c.ok) return c;
    try {
      await c.client.send(
        new c.mod.DeleteObjectCommand({ Bucket: this.config.bucket, Key: this.path(key) }),
      );
      return storageOk({ deleted: true });
    } catch (err) {
      return storageError('UPSTREAM_ERROR', `s3 delete failed: ${asMessage(err)}`);
    }
  }

  async head(key: string): Promise<ObjectStoreResult<ObjectHead>> {
    const c = await this.client();
    if (!c.ok) return c;
    try {
      const res = await c.client.send(
        new c.mod.HeadObjectCommand({ Bucket: this.config.bucket, Key: this.path(key) }),
      );
      return storageOk({ key, exists: true, size: res.ContentLength ?? 0 });
    } catch (err) {
      const msg = asMessage(err);
      if (/NoSuchKey|NotFound|404/.test(msg)) return storageOk({ key, exists: false, size: 0 });
      return storageError('UPSTREAM_ERROR', `s3 head failed: ${msg}`);
    }
  }
}

function asMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

async function streamToBuffer(stream: unknown): Promise<Buffer> {
  // AWS SDK v3 Body is a web/Node stream or has transformToByteArray().
  const anyStream = stream as {
    transformToByteArray?: () => Promise<Uint8Array>;
    [Symbol.asyncIterator]?: () => AsyncIterator<Uint8Array>;
  };
  if (typeof anyStream?.transformToByteArray === 'function') {
    return Buffer.from(await anyStream.transformToByteArray());
  }
  const chunks: Buffer[] = [];
  for await (const chunk of anyStream as AsyncIterable<Uint8Array>) {
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}
