/**
 * lib/memory/byo-storage.test.ts
 *
 * Pins:
 *   - Customer bucket credentials encrypt at rest (v1 envelope) and decrypt
 *     back identically; the KMS key ref is only encrypted when used.
 *   - resolveObjectStoreForWorkspace picks the managed store for AGENTPLAIN,
 *     refuses CUSTOMER without a verified config, and builds the S3 store for
 *     a verified config.
 *   - coldObjectKey is workspace-scoped + stable.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

process.env.ENCRYPTION_KEY =
  process.env.ENCRYPTION_KEY ??
  '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

import { isEncrypted } from '../security/encryption';
import {
  coldObjectKey,
  decryptStorageConfig,
  encryptStorageCredentials,
  kmsKeyIdForPut,
  regionForWorkspace,
  resolveObjectStoreForWorkspace,
} from './byo-storage';

const baseRow = {
  endpoint: 'https://s3.us-east-1.amazonaws.com',
  bucket: 'acme-memory',
  region: 'us-east-1',
  kmsProvider: 'NONE' as const,
  kmsKeyRefEncrypted: null as string | null,
};

describe('byo-storage — credential encryption', () => {
  it('encrypts access/secret keys with the v1 envelope and round-trips', () => {
    const enc = encryptStorageCredentials({
      endpoint: baseRow.endpoint,
      bucket: baseRow.bucket,
      region: baseRow.region,
      accessKeyId: 'AKIAEXAMPLE',
      secretAccessKey: 'super-secret-value',
      kmsProvider: 'NONE',
    });
    assert.ok(isEncrypted(enc.accessKeyEncrypted));
    assert.ok(isEncrypted(enc.secretKeyEncrypted));
    assert.equal(enc.kmsKeyRefEncrypted, null);

    const dec = decryptStorageConfig({ ...baseRow, ...enc });
    assert.equal(dec.accessKeyId, 'AKIAEXAMPLE');
    assert.equal(dec.secretAccessKey, 'super-secret-value');
    assert.equal(dec.kmsKeyRef, null);
  });

  it('encrypts the KMS key ref only when a KMS provider is selected', () => {
    const enc = encryptStorageCredentials({
      endpoint: baseRow.endpoint,
      bucket: baseRow.bucket,
      region: baseRow.region,
      accessKeyId: 'AK',
      secretAccessKey: 'SK',
      kmsProvider: 'AWS_KMS',
      kmsKeyRef: 'arn:aws:kms:us-east-1:111:key/abc',
    });
    assert.ok(enc.kmsKeyRefEncrypted && isEncrypted(enc.kmsKeyRefEncrypted));
    const dec = decryptStorageConfig({
      ...baseRow,
      ...enc,
      kmsProvider: 'AWS_KMS',
    });
    assert.equal(dec.kmsKeyRef, 'arn:aws:kms:us-east-1:111:key/abc');
    assert.equal(kmsKeyIdForPut(dec), 'arn:aws:kms:us-east-1:111:key/abc');
  });

  it('kmsKeyIdForPut is undefined for NONE and BYO (no SSE pass-through)', () => {
    assert.equal(
      kmsKeyIdForPut({ ...baseRow, accessKeyId: 'a', secretAccessKey: 's', kmsProvider: 'NONE', kmsKeyRef: null }),
      undefined,
    );
    assert.equal(
      kmsKeyIdForPut({ ...baseRow, accessKeyId: 'a', secretAccessKey: 's', kmsProvider: 'BYO', kmsKeyRef: 'rawkey' }),
      undefined,
    );
  });
});

describe('byo-storage — store resolution', () => {
  it('AGENTPLAIN resolves to the managed (vercel-blob) store', () => {
    const res = resolveObjectStoreForWorkspace({
      memoryStorage: 'AGENTPLAIN',
      dataRegion: 'US_EAST',
      storageConfig: null,
    });
    assert.ok(res.ok);
    assert.equal(res.ok && res.value.name, 'vercel-blob');
  });

  it('CUSTOMER without a config is NOT_CONFIGURED', () => {
    const res = resolveObjectStoreForWorkspace({
      memoryStorage: 'CUSTOMER',
      dataRegion: 'US_EAST',
      storageConfig: null,
    });
    assert.equal(res.ok, false);
    assert.equal(!res.ok && res.error.code, 'NOT_CONFIGURED');
  });

  it('CUSTOMER with an UNVERIFIED config is refused', () => {
    const enc = encryptStorageCredentials({
      endpoint: baseRow.endpoint,
      bucket: baseRow.bucket,
      region: baseRow.region,
      accessKeyId: 'AK',
      secretAccessKey: 'SK',
      kmsProvider: 'NONE',
    });
    const res = resolveObjectStoreForWorkspace({
      memoryStorage: 'CUSTOMER',
      dataRegion: 'US_EAST',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      storageConfig: {
        id: 'c',
        workspaceId: 'w',
        provider: 'CUSTOMER',
        ...baseRow,
        ...enc,
        verifiedAt: null,
        lastError: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any,
    });
    assert.equal(res.ok, false);
    assert.equal(!res.ok && res.error.code, 'NOT_CONFIGURED');
  });

  it('CUSTOMER with a VERIFIED config builds the s3-compatible store', () => {
    const enc = encryptStorageCredentials({
      endpoint: baseRow.endpoint,
      bucket: baseRow.bucket,
      region: baseRow.region,
      accessKeyId: 'AK',
      secretAccessKey: 'SK',
      kmsProvider: 'NONE',
    });
    const res = resolveObjectStoreForWorkspace({
      memoryStorage: 'CUSTOMER',
      dataRegion: 'US_EAST',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      storageConfig: {
        id: 'c',
        workspaceId: 'w',
        provider: 'CUSTOMER',
        ...baseRow,
        ...enc,
        verifiedAt: new Date(),
        lastError: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any,
    });
    assert.ok(res.ok);
    assert.equal(res.ok && res.value.name, 's3-compatible');
  });
});

describe('byo-storage — keys + regions', () => {
  it('coldObjectKey is workspace-scoped and stable', () => {
    assert.equal(coldObjectKey('ws-1', 'e-1'), 'ws/ws-1/entries/e-1.enc');
    assert.equal(coldObjectKey('ws-1', 'e-1'), coldObjectKey('ws-1', 'e-1'));
    assert.notEqual(coldObjectKey('ws-1', 'e-1'), coldObjectKey('ws-2', 'e-1'));
  });
  it('every DataRegion maps to an s3 region string', () => {
    assert.equal(regionForWorkspace('US_EAST'), 'us-east-1');
    assert.equal(regionForWorkspace('EU_WEST'), 'eu-west-1');
    assert.equal(regionForWorkspace('AP_SOUTHEAST'), 'ap-southeast-1');
    assert.equal(regionForWorkspace('US_WEST'), 'us-west-2');
  });
});
