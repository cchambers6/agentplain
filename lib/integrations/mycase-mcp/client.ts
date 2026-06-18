/**
 * lib/integrations/mycase-mcp/client.ts
 *
 * Typed MyCase REST client — the single seam that calls the MyCase API.
 * Plain `fetch`, no SDK (`feedback_no_silent_vendor_lock.md`). The server
 * wires a resolved credential into this client; route handlers + skills speak
 * the `MyCaseMcpServer` interface and never see a MyCase URL.
 *
 * Base URL is a fixed external-integrations host. Auth is
 * `Authorization: Bearer <token>` (a per-workspace API token, NOT OAuth).
 * Token resolution lives in `auth.ts`; this client only consumes the resolved
 * bearer token.
 */

import { mcpError, mcpOk, type McpError, type McpResult } from '@/lib/integrations/mcp-core';

const API_BASE = 'https://external-integrations.mycase.com/v1';

export interface MyCaseClientConfig {
  accessToken: string;
}

export interface MyCaseClient {
  get<T>(path: string): Promise<McpResult<T>>;
  post<T>(path: string, body: unknown): Promise<McpResult<T>>;
}

export function myCaseApiBase(): string {
  // verify base/version at API enablement — see TODOS-FOR-CONNER
  return API_BASE;
}

export function makeMyCaseClient(config: MyCaseClientConfig): MyCaseClient {
  const base = myCaseApiBase();
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
        `MyCase network error: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
    const text = await res.text();
    if (!res.ok) return mapMyCaseError(res, text);
    if (text.length === 0) return mcpOk({} as T);
    try {
      return mcpOk(JSON.parse(text) as T);
    } catch (err) {
      return mcpError(
        'MALFORMED_RESPONSE',
        `MyCase JSON parse failed: ${err instanceof Error ? err.message : String(err)}`,
        { status: res.status },
      );
    }
  }

  return {
    get: <T>(path: string) => request<T>('GET', path),
    post: <T>(path: string, body: unknown) => request<T>('POST', path, body),
  };
}

export function mapMyCaseError(res: Response, text: string): McpResult<never> {
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
