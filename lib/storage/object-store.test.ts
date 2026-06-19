/**
 * lib/storage/object-store.test.ts
 *
 * Pins the object-store port:
 *   - InMemoryObjectStore round-trips put → get → head → delete.
 *   - The optional-SDK adapters degrade to a typed NOT_CONFIGURED error
 *     instead of throwing when their dependency / token is absent — the
 *     seam is wired, the dep is not (yet), and the build stays green.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  InMemoryObjectStore,
  S3CompatibleObjectStore,
  VercelBlobObjectStore,
} from './object-store';

describe('InMemoryObjectStore', () => {
  it('round-trips put → get → head → delete', async () => {
    const store = new InMemoryObjectStore();
    const put = await store.put('ws/a/entries/1.enc', 'v1:aa:bb:cc');
    assert.ok(put.ok);
    assert.equal(put.ok && put.value.ref, 'mem://ws/a/entries/1.enc');

    const got = await store.get('ws/a/entries/1.enc');
    assert.ok(got.ok);
    assert.equal(got.ok && got.value.bytes.toString('utf8'), 'v1:aa:bb:cc');

    const head = await store.head('ws/a/entries/1.enc');
    assert.ok(head.ok && head.value.exists);
    assert.equal(head.ok && head.value.size, 'v1:aa:bb:cc'.length);

    const del = await store.delete('ws/a/entries/1.enc');
    assert.ok(del.ok && del.value.deleted);

    const after = await store.get('ws/a/entries/1.enc');
    assert.equal(after.ok, false);
    assert.equal(!after.ok && after.error.code, 'NOT_FOUND');
  });

  it('head on a missing key returns exists:false, not an error', async () => {
    const store = new InMemoryObjectStore();
    const head = await store.head('nope');
    assert.ok(head.ok);
    assert.equal(head.ok && head.value.exists, false);
  });

  it('rejects an empty key', async () => {
    const store = new InMemoryObjectStore();
    const put = await store.put('', 'x');
    assert.equal(put.ok, false);
    assert.equal(!put.ok && put.error.code, 'INVALID_ARGUMENT');
  });
});

describe('VercelBlobObjectStore — graceful degrade', () => {
  it('put without a token returns NOT_CONFIGURED (never throws)', async () => {
    const prev = process.env.BLOB_READ_WRITE_TOKEN;
    delete process.env.BLOB_READ_WRITE_TOKEN;
    try {
      const store = new VercelBlobObjectStore();
      const res = await store.put('k', 'v');
      assert.equal(res.ok, false);
      assert.equal(!res.ok && res.error.code, 'NOT_CONFIGURED');
    } finally {
      if (prev !== undefined) process.env.BLOB_READ_WRITE_TOKEN = prev;
    }
  });
});

describe('S3CompatibleObjectStore — graceful degrade', () => {
  it('put without the AWS SDK installed returns NOT_CONFIGURED (never throws)', async () => {
    const store = new S3CompatibleObjectStore({
      endpoint: 'https://s3.example.com',
      region: 'us-east-1',
      bucket: 'b',
      accessKeyId: 'AK',
      secretAccessKey: 'SK',
    });
    const res = await store.put('k', 'v');
    assert.equal(res.ok, false);
    assert.equal(!res.ok && res.error.code, 'NOT_CONFIGURED');
  });
});
