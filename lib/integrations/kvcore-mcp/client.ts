/**
 * lib/integrations/kvcore-mcp/client.ts
 *
 * Typed kvCORE REST client — the single seam that calls the kvCORE API.
 * Plain `fetch`, no SDK (`feedback_no_silent_vendor_lock.md`). The server
 * wires a resolved credential into this client; route handlers + skills speak
 * the `KvcoreMcpServer` interface and never see a kvCORE URL.
 *
 * Auth is `Authorization: Bearer <apiKey>` (per-account API key). Key
 * resolution lives in `auth.ts`; this client only consumes the resolved key.
 */

import { mcpError, mcpOk, type McpError, type McpResult } from '@/lib/integrations/mcp-core';

// verify base/version at partner enrollment — see TODOS-FOR-CONNER
const API_BASE = 'https://api.kvcore.com/v2';

export interface KvcoreClientConfig {
  apiKey: string;
}

export interface KvcoreClient {
  get<T>(path: string): Promise<McpResult<T>>;
  post<T>(path: string, body: unknown): Promise<McpResult<T>>;
}

export function kvcoreApiBase(): string {
  // verify base/version at partner enrollment — see TODOS-FOR-CONNER
  return API_BASE;
}

export function makeKvcoreClient(config: KvcoreClientConfig): KvcoreClient {
  const base = kvcoreApiBase();
  const authHeader = `Bearer ${config.apiKey}`;

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
        `kvCORE network error: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
    const text = await res.text();
    if (!res.ok) return mapKvcoreError(res, text);
    if (text.length === 0) return mcpOk({} as T);
    try {
      return mcpOk(JSON.parse(text) as T);
    } catch (err) {
      return mcpError(
        'MALFORMED_RESPONSE',
        `kvCORE JSON parse failed: ${err instanceof Error ? err.message : String(err)}`,
        { status: res.status },
      );
    }
  }

  return {
    get: <T>(path: string) => request<T>('GET', path),
    post: <T>(path: string, body: unknown) => request<T>('POST', path, body),
  };
}

export function mapKvcoreError(res: Response, text: string): McpResult<never> {
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
