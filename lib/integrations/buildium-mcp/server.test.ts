/**
 * lib/integrations/buildium-mcp/server.test.ts
 *
 * Unit tests for the Buildium prod-server HTTP + error-mapping layer with a
 * MOCKED global.fetch (no network, no DB). Exercises the adapter contract the
 * keystone recipe requires: happy path + 401 + 429 + 500 + malformed body +
 * network error → the right McpError codes. Uses the exported `makeApiContext`
 * so credential resolution (Prisma) is bypassed.
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import { makeApiContext } from './server';
import type { ResolvedBuildium } from './auth';
import type { DecryptedCredential } from '@/lib/integrations/types';

const RESOLVED: ResolvedBuildium = {
  credential: {} as DecryptedCredential,
  clientId: 'cid-123',
  clientSecret: 'secret-abc',
};

const realFetch = globalThis.fetch;

function mockFetch(impl: (url: string, init?: RequestInit) => Promise<Response>) {
  globalThis.fetch = impl as unknown as typeof fetch;
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(typeof body === 'string' ? body : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('buildium prod-server — request + error mapping', () => {
  beforeEach(() => {
    // default mock; individual tests override
    mockFetch(async () => jsonResponse(200, []));
  });
  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  it('happy path returns parsed JSON + sends the auth headers', async () => {
    let seenHeaders: Record<string, string> = {};
    mockFetch(async (_url, init) => {
      seenHeaders = (init?.headers ?? {}) as Record<string, string>;
      return jsonResponse(200, [{ Id: 1 }]);
    });
    const api = makeApiContext(RESOLVED);
    const res = await api<Array<{ Id: number }>>('GET', '/leases?limit=1');
    assert.equal(res.ok, true);
    if (!res.ok) return;
    assert.equal(res.value[0].Id, 1);
    assert.equal(seenHeaders['x-buildium-client-id'], 'cid-123');
    assert.equal(seenHeaders['x-buildium-client-secret'], 'secret-abc');
  });

  it('401 → UNAUTHORIZED', async () => {
    mockFetch(async () => jsonResponse(401, { UserMessage: 'bad key' }));
    const res = await makeApiContext(RESOLVED)('GET', '/leases');
    assert.equal(res.ok, false);
    if (res.ok) return;
    assert.equal(res.error.code, 'UNAUTHORIZED');
    assert.equal(res.error.status, 401);
    assert.match(res.error.message, /bad key/);
  });

  it('429 → RATE_LIMITED', async () => {
    mockFetch(async () => jsonResponse(429, { Message: 'slow down' }));
    const res = await makeApiContext(RESOLVED)('GET', '/leases');
    assert.equal(res.ok, false);
    if (res.ok) return;
    assert.equal(res.error.code, 'RATE_LIMITED');
    assert.equal(res.error.status, 429);
  });

  it('500 → UPSTREAM_ERROR', async () => {
    mockFetch(async () => jsonResponse(500, { Message: 'boom' }));
    const res = await makeApiContext(RESOLVED)('GET', '/leases');
    assert.equal(res.ok, false);
    if (res.ok) return;
    assert.equal(res.error.code, 'UPSTREAM_ERROR');
    assert.equal(res.error.status, 500);
  });

  it('malformed body on 200 → MALFORMED_RESPONSE', async () => {
    mockFetch(async () =>
      new Response('{not json', { status: 200, headers: { 'Content-Type': 'application/json' } }),
    );
    const res = await makeApiContext(RESOLVED)('GET', '/leases');
    assert.equal(res.ok, false);
    if (res.ok) return;
    assert.equal(res.error.code, 'MALFORMED_RESPONSE');
  });

  it('network throw → NETWORK', async () => {
    mockFetch(async () => {
      throw new Error('ECONNRESET');
    });
    const res = await makeApiContext(RESOLVED)('GET', '/leases');
    assert.equal(res.ok, false);
    if (res.ok) return;
    assert.equal(res.error.code, 'NETWORK');
    assert.match(res.error.message, /ECONNRESET/);
  });
});
