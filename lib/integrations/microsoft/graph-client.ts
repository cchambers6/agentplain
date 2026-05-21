/**
 * lib/integrations/microsoft/graph-client.ts
 *
 * Single low-level HTTP seam for the three post-Outlook M365 MCP servers
 * (Teams, OneDrive, Excel). All three of them route every `graph.microsoft.com`
 * call through `graphFetch` / `graphGet` here so:
 *
 *   * The list of files in the repo that touch `https://graph.microsoft.com/`
 *     stays short and grep-able (outlook-mcp/server.ts + microsoft/ + this).
 *   * Auth-header construction, ConsistencyLevel handling, JSON-vs-binary
 *     parsing, and Graph HTTP→`McpErrorCode` mapping live in ONE place.
 *   * Adding a 4th post-Outlook integration tomorrow doesn't reproduce
 *     these ~120 lines a 4th time.
 *
 * Per `feedback_no_silent_vendor_lock.md`: this is the SOLE outbound
 * `fetch` to `graph.microsoft.com` for Teams, OneDrive, Excel. The
 * subscription client (`./subscriptions.ts`) and the Outlook MCP server
 * have their own seams — separately reviewable. The OAuth refresh seam
 * is `./credential-resolver.ts`, which only hits `login.microsoftonline.com`.
 *
 * Per `feedback_runner_portability.md`: callers inject `fetchImpl` for
 * test-time stubs. The default is the global `fetch`.
 *
 * Why not use `@microsoft/microsoft-graph-client`: the SDK adds ~250 KB
 * to the bundle and locks our request shape to its retry/middleware
 * conventions. Raw fetch keeps the wire format observable and the
 * dependency surface zero. The SDK can land later behind this same
 * function signature without touching the four MCP servers.
 */

import type { DecryptedCredential } from '@/lib/integrations/types';
import { mapGraphError, mcpError, mcpOk, type McpResult } from './mcp-common';

const GRAPH_BASE_URL = 'https://graph.microsoft.com/v1.0';

export interface GraphClientConfig {
  /** Optional `fetch` override. Tests inject a stub here. */
  fetchImpl?: typeof fetch;
}

export class MicrosoftGraphClient {
  readonly baseUrl = GRAPH_BASE_URL;
  private readonly fetchImpl: typeof fetch;

  constructor(config: GraphClientConfig = {}) {
    this.fetchImpl = config.fetchImpl ?? fetch;
  }

  /** Build an absolute Graph URL from a relative path (must start with `/`). */
  url(path: string): string {
    if (!path.startsWith('/')) {
      throw new Error(`MicrosoftGraphClient.url: path must start with '/', got ${path}`);
    }
    return `${GRAPH_BASE_URL}${path}`;
  }

  get<T>(
    cred: DecryptedCredential,
    url: string,
    extraHeaders: Record<string, string> = {},
  ): Promise<McpResult<T>> {
    return this.request<T>(cred, url, { method: 'GET', headers: extraHeaders });
  }

  delete(
    cred: DecryptedCredential,
    url: string,
  ): Promise<McpResult<void>> {
    return this.request<void>(cred, url, { method: 'DELETE' });
  }

  /**
   * Issue a request and parse as JSON. Returns `mcpError` on every non-2xx
   * response with the typed error code Graph maps to. 204 No Content
   * returns `mcpOk(undefined as T)`.
   */
  async request<T>(
    cred: DecryptedCredential,
    url: string,
    init: RequestInit,
  ): Promise<McpResult<T>> {
    const res = await this.send(cred, url, init);
    if (!res.ok) return res;
    if (res.value.status === 204) return mcpOk(undefined as T);
    let parsed: unknown = null;
    const text = await res.value.text();
    if (text.length > 0) {
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = null;
      }
    }
    return mcpOk(parsed as T);
  }

  /**
   * Issue a request and return the raw `Response` for callers that need
   * binary bodies (e.g. file downloads). The HTTP-status → McpErrorCode
   * mapping still happens here on non-2xx; only the success path is opaque.
   */
  async fetchRaw(
    cred: DecryptedCredential,
    url: string,
    init: RequestInit = { method: 'GET' },
  ): Promise<McpResult<Response>> {
    return this.send(cred, url, init);
  }

  /**
   * Issue the underlying fetch with Authorization + ConsistencyLevel headers.
   * Translates non-2xx responses to typed `McpError`s.
   */
  private async send(
    cred: DecryptedCredential,
    url: string,
    init: RequestInit,
  ): Promise<McpResult<Response>> {
    const headers = new Headers(init.headers ?? {});
    headers.set('Authorization', `Bearer ${cred.accessToken}`);
    if (!headers.has('Accept')) {
      headers.set('Accept', 'application/json');
    }
    // `ConsistencyLevel: eventual` is required for $search and advanced
    // queries; safe to send on non-$search endpoints per
    // https://learn.microsoft.com/en-us/graph/aad-advanced-queries
    if (!headers.has('ConsistencyLevel')) {
      headers.set('ConsistencyLevel', 'eventual');
    }
    let res: Response;
    try {
      res = await this.fetchImpl(url, { ...init, headers });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return mcpError('NETWORK', `Microsoft Graph network error: ${message}`);
    }
    if (!res.ok) {
      let parsed: unknown = null;
      const text = await safeReadText(res);
      if (text.length > 0) {
        try {
          parsed = JSON.parse(text);
        } catch {
          parsed = null;
        }
      }
      return mapGraphError(res.status, parsed);
    }
    return mcpOk(res);
  }
}

async function safeReadText(res: Response): Promise<string> {
  try {
    return await res.text();
  } catch {
    return '';
  }
}
