/**
 * lib/integrations/appfolio-mcp/client.ts
 *
 * Typed AppFolio REST client — the single seam that calls the AppFolio API.
 * Plain `fetch`, no SDK (`feedback_no_silent_vendor_lock.md`). The server
 * wires a resolved credential into this client; route handlers + skills speak
 * the `AppfolioMcpServer` interface and never see an AppFolio URL.
 *
 * Base URL is per-tenant: `https://${subdomain}.appfolio.com/api/v1` — the
 * subdomain is the customer's AppFolio account host.
 *
 * Auth is HTTP BASIC: `Authorization: Basic base64(clientId:clientSecret)`.
 * Credential resolution lives in `auth.ts`; this client only consumes the
 * resolved id + secret + subdomain.
 */

import { mcpError, mcpOk, type McpError, type McpResult } from '@/lib/integrations/mcp-core';

const API_PREFIX = '/api/v1';

export interface AppfolioClientConfig {
  clientId: string;
  clientSecret: string;
  /** Customer's AppFolio account host label, e.g. `acme` in `acme.appfolio.com`. */
  subdomain: string;
}

export interface AppfolioClient {
  get<T>(path: string): Promise<McpResult<T>>;
  post<T>(path: string, body: unknown): Promise<McpResult<T>>;
}

export function appfolioApiBase(subdomain: string): string {
  // subdomain is the customer's AppFolio account host; verify base/version at
  // partner enablement.
  return `https://${subdomain}.appfolio.com${API_PREFIX}`;
}

export function makeAppfolioClient(config: AppfolioClientConfig): AppfolioClient {
  const base = appfolioApiBase(config.subdomain);
  const basic = Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64');
  const authHeader = `Basic ${basic}`;

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
        `AppFolio network error: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
    const text = await res.text();
    if (!res.ok) return mapAppfolioError(res, text);
    if (text.length === 0) return mcpOk({} as T);
    try {
      return mcpOk(JSON.parse(text) as T);
    } catch (err) {
      return mcpError(
        'MALFORMED_RESPONSE',
        `AppFolio JSON parse failed: ${err instanceof Error ? err.message : String(err)}`,
        { status: res.status },
      );
    }
  }

  return {
    get: <T>(path: string) => request<T>('GET', path),
    post: <T>(path: string, body: unknown) => request<T>('POST', path, body),
  };
}

export function mapAppfolioError(res: Response, text: string): McpResult<never> {
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
