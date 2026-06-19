/**
 * lib/memory/byo-storage.ts
 *
 * Resolves WHICH object store a workspace's cold-tier memory reads/writes go
 * to, and owns the encryption of customer-supplied bucket credentials.
 *
 *   memoryStorage = AGENTPLAIN  → our managed Vercel Blob store
 *   memoryStorage = CUSTOMER    → the customer's own S3-compatible bucket,
 *                                 credentials decrypted from WorkspaceStorageConfig
 *
 * Credentials NEVER live in plaintext: the access key, secret key, and any
 * KMS key ref are stored with the v1 AES-256-GCM envelope
 * (lib/security/encryption.ts) — the same primitive that protects
 * IntegrationCredential OAuth tokens and WorkspaceMemoryEntry bodies. This
 * module is the only place that decrypts them, and only to hand them to an
 * S3CompatibleObjectStore that lives for the duration of one operation.
 *
 * DATA RESIDENCY: the managed store pins a region-scoped key prefix so a
 * workspace's objects are grouped by `dataRegion`. True at-rest residency
 * (the bytes physically never leaving a region) is strongest on the CUSTOMER
 * path — the customer picks their own bucket's region — and on the managed
 * path requires a per-region blob store, which is the operational follow-up
 * tracked in TODOS-FOR-CONNER (data-residency sign-off). We do NOT claim
 * hard residency we can't honor; see docs note in the data settings page.
 */

import type {
  DataRegion,
  MemoryStorageProvider,
  StorageKmsProvider,
  WorkspaceStorageConfig,
} from '@prisma/client';
import { decrypt, encrypt, isEncryptionConfigured } from '../security/encryption';
import {
  IObjectStore,
  ObjectStoreResult,
  S3CompatibleObjectStore,
  VercelBlobObjectStore,
  storageError,
  storageOk,
} from '../storage/object-store';

/** Plaintext credentials as supplied by the customer on the data page. */
export interface StorageCredentialsPlain {
  endpoint: string;
  bucket: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  kmsProvider: StorageKmsProvider;
  /** KMS key id/ARN (AWS_KMS/GCP_KMS) or raw symmetric key (BYO); null for NONE. */
  kmsKeyRef?: string | null;
}

/** The encrypted column values to persist on WorkspaceStorageConfig. */
export interface EncryptedStorageCredentials {
  accessKeyEncrypted: string;
  secretKeyEncrypted: string;
  kmsKeyRefEncrypted: string | null;
}

/** Decrypted, ready-to-use config for constructing a store. */
export interface DecryptedStorageConfig {
  endpoint: string;
  bucket: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  kmsProvider: StorageKmsProvider;
  kmsKeyRef: string | null;
}

/**
 * Encrypt customer credentials for storage. Throws (via the encryption lib)
 * if ENCRYPTION_KEY is not configured — we refuse to persist BYO credentials
 * we can't protect at rest.
 */
export function encryptStorageCredentials(
  plain: StorageCredentialsPlain,
): EncryptedStorageCredentials {
  if (!isEncryptionConfigured()) {
    throw new Error(
      'ENCRYPTION_KEY is not configured — refusing to store customer bucket credentials in plaintext.',
    );
  }
  return {
    accessKeyEncrypted: encrypt(plain.accessKeyId),
    secretKeyEncrypted: encrypt(plain.secretAccessKey),
    kmsKeyRefEncrypted:
      plain.kmsProvider !== 'NONE' && plain.kmsKeyRef ? encrypt(plain.kmsKeyRef) : null,
  };
}

/** Decrypt a persisted WorkspaceStorageConfig row into usable credentials. */
export function decryptStorageConfig(
  row: Pick<
    WorkspaceStorageConfig,
    | 'endpoint'
    | 'bucket'
    | 'region'
    | 'accessKeyEncrypted'
    | 'secretKeyEncrypted'
    | 'kmsProvider'
    | 'kmsKeyRefEncrypted'
  >,
): DecryptedStorageConfig {
  return {
    endpoint: row.endpoint,
    bucket: row.bucket,
    region: row.region,
    accessKeyId: decrypt(row.accessKeyEncrypted),
    secretAccessKey: decrypt(row.secretKeyEncrypted),
    kmsProvider: row.kmsProvider,
    kmsKeyRef: row.kmsKeyRefEncrypted ? decrypt(row.kmsKeyRefEncrypted) : null,
  };
}

/**
 * The S3 region string we expect a managed-store object's residency to map
 * to per the workspace's dataRegion. Used for the region-scoped key prefix
 * and surfaced on the data page so the commitment is legible.
 */
const REGION_TO_S3: Record<DataRegion, string> = {
  US_EAST: 'us-east-1',
  US_WEST: 'us-west-2',
  EU_WEST: 'eu-west-1',
  AP_SOUTHEAST: 'ap-southeast-1',
};

export function regionForWorkspace(dataRegion: DataRegion): string {
  return REGION_TO_S3[dataRegion];
}

/** Managed (AGENTPLAIN) store — Vercel Blob, keys prefixed by region. */
export function buildManagedObjectStore(dataRegion: DataRegion): IObjectStore {
  return new VercelBlobObjectStore({ prefix: `memory/${regionForWorkspace(dataRegion)}` });
}

/** Customer-hosted (CUSTOMER) store from decrypted config. */
export function buildCustomerObjectStore(config: DecryptedStorageConfig): IObjectStore {
  return new S3CompatibleObjectStore({
    endpoint: config.endpoint,
    region: config.region,
    bucket: config.bucket,
    accessKeyId: config.accessKeyId,
    secretAccessKey: config.secretAccessKey,
    forcePathStyle: true,
    prefix: 'memory',
  });
}

export interface ResolveStoreArgs {
  memoryStorage: MemoryStorageProvider;
  dataRegion: DataRegion;
  /** The workspace's WorkspaceStorageConfig row, or null if none. */
  storageConfig: WorkspaceStorageConfig | null;
}

/**
 * Resolve the object store for a workspace. CUSTOMER requires a *verified*
 * storage config — we refuse to route cold reads/writes to an unverified
 * bucket (a misconfigured bucket would silently swallow a customer's memory).
 */
export function resolveObjectStoreForWorkspace(
  args: ResolveStoreArgs,
): ObjectStoreResult<IObjectStore> {
  if (args.memoryStorage === 'CUSTOMER') {
    if (!args.storageConfig) {
      return storageError(
        'NOT_CONFIGURED',
        'workspace memoryStorage=CUSTOMER but no WorkspaceStorageConfig row exists',
      );
    }
    if (!args.storageConfig.verifiedAt) {
      return storageError(
        'NOT_CONFIGURED',
        'customer storage config has not passed the connectivity probe (verifiedAt is null)',
      );
    }
    try {
      return storageOk(buildCustomerObjectStore(decryptStorageConfig(args.storageConfig)));
    } catch (err) {
      return storageError(
        'AUTHENTICATION',
        `failed to decrypt customer storage credentials: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
  return storageOk(buildManagedObjectStore(args.dataRegion));
}

/**
 * The KMS key id to pass through on a server-side-encrypted put for this
 * config, or undefined when the posture doesn't use pass-through SSE (NONE,
 * or BYO where the caller envelope-encrypts the bytes itself).
 */
export function kmsKeyIdForPut(config: DecryptedStorageConfig): string | undefined {
  if (config.kmsProvider === 'AWS_KMS' || config.kmsProvider === 'GCP_KMS') {
    return config.kmsKeyRef ?? undefined;
  }
  return undefined;
}

/**
 * Deterministic object key for a memory entry's cold archive. Workspace-
 * scoped so a bucket listing groups by tenant and a workspace teardown can
 * prefix-delete. Stable across archive→restore→re-archive cycles.
 */
export function coldObjectKey(workspaceId: string, entryId: string): string {
  return `ws/${workspaceId}/entries/${entryId}.enc`;
}
