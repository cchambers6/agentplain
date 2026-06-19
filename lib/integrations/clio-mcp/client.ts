/**
 * lib/integrations/clio-mcp/client.ts
 *
 * Typed Clio REST client — the single seam that calls the Clio API v4.
 * Plain `fetch`, no SDK (`feedback_no_silent_vendor_lock.md`). The server
 * wires a resolved credential into this client; route handlers + skills speak
 * the `ClioMcpServer` interface and never see a Clio URL.
 *
 * Base URL is env-driven via the credential's region host (Clio is sharded by
 * region — US `app.clio.com`, EU `eu.app.clio.com`, AU `au.app.clio.com`).
 * The default `app.clio.com` covers the US shard; the region host is carried
 * on `providerMetadata.regionHost` and passed in here.
 *
 * Auth is `Authorization: Bearer <accessToken>` (OAuth2). Token resolution +
 * refresh live in `auth.ts`; this client only consumes the resolved bearer.
 */

import { mcpError, mcpOk, type McpError, type McpResult } from '@/lib/integrations/mcp-core';

const DEFAULT_REGION_HOST = 'app.clio.com';
const API_PREFIX = '/api/v4';

export interface ClioClientConfig {
  accessToken: string;
  /** Region host without scheme, e.g. `app.clio.com` or `eu.app.clio.com`. */
  regionHost?: string;
}

export interface ClioClient {
  get<T>(path: string): Promise<McpResult<T>>;
  post<T>(path: string, body: unknown): Promise<McpResult<T>>;
}

export function clioApiBase(regionHost?: string): string {
  const host = regionHost && regionHost.length > 0 ? regionHost : DEFAULT_REGION_HOST;
  return `https://${host}${API_PREFIX}`;
}

export function makeClioClient(config: ClioClientConfig): ClioClient {
  const base = clioApiBase(config.regionHost);
  const authHeader = `Bearer ${config.accessToken}`;

  async function request<T>(method: string, path: string, body?: unknown): Promise<McpResult<T>> {
    let res: Response;
    try {
      res = await fetch(`${base}${path}`, {
        method,
        headers: {
          Authorization: authHeader,
          Accept: 'application/json',
          ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
    } catch (err) {
      return mcpError(
        'NETWORK',
        `Clio network error: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
    const text = await res.text();
    if (!res.ok) return mapClioError(res, text);
    if (text.length === 0) return mcpOk({} as T);
    try {
      return mcpOk(JSON.parse(text) as T);
    } catch (err) {
      return mcpError(
        'MALFORMED_RESPONSE',
        `Clio JSON parse failed: ${err instanceof Error ? err.message : String(err)}`,
        { status: res.status },
      );
    }
  }

  return {
    get: <T>(path: string) => request<T>('GET', path),
    post: <T>(path: string, body: unknown) => request<T>('POST', path, body),
  };
}

export function mapClioError(res: Response, text: string): McpResult<never> {
  let detail = res.statusText || `HTTP ${res.status}`;
  try {
    const body = JSON.parse(text) as {
      error?: { message?: string } | string;
      message?: string;
    };
    if (typeof body.error === 'string') detail = body.error;
    else if (body.error?.message) detail = body.error.message;
    else if (body.message) detail = body.message;
  } catch {
    if (text) detail = text.slice(0, 240);
  }
  const err: McpError['code'] =
    res.status === 401
      ? 'TOKEN_EXPIRED'
      : res.status === 403
        ? 'FORBIDDEN'
        : res.status === 404
          ? 'NOT_FOUND'
          : res.status === 429
            ? 'RATE_LIMITED'
            : 'UPSTREAM_ERROR';
  return mcpError(err, detail, { status: res.status });
}
