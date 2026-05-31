/**
 * lib/integrations/karbon-mcp/server.ts
 *
 * Production Karbon MCP server. Wraps the Karbon API v3 REST surface
 * behind the `KarbonMcpServer` interface. One instance per
 * `{workspaceId}` per request. This file is the ONLY place that calls
 * the Karbon REST API; route handlers + skills speak the MCP interface
 * (per `feedback_no_silent_vendor_lock.md`). Plain `fetch`, no SDK.
 *
 * Cold-start safe: every method re-resolves the credential; no key is
 * cached on the instance.
 *
 * Read-only by contract — no `create_*` paths today.
 *
 * NOTE on the REST shapes: Karbon API v3 (per the OpenAPI spec at
 * karbonhq.github.io/karbon-api-reference) returns paginated lists as
 * `{ items: [...], page: {...} }`. The mappers below tolerate either
 * flat-array or paginated envelopes so a partner-program upgrade does
 * not break our reads. A malformed body returns MALFORMED_RESPONSE —
 * the honest signal to upgrade.
 */

import { mcpError, mcpOk, type McpResult } from '@/lib/integrations/mcp-core';
import { resolveKarbonCredential, karbonApiBase, type ResolvedKarbon } from './auth';
import {
  type GetClientInput,
  type GetClientOutput,
  type GetWorkflowInput,
  type GetWorkflowOutput,
  type KarbonClientSummary,
  type KarbonJobSummary,
  type KarbonMcpServer,
  type KarbonRecurringTaskSummary,
  type KarbonWorkflowSummary,
  type ListClientsInput,
  type ListClientsOutput,
  type ListJobsInput,
  type ListJobsOutput,
  type ListRecurringTasksInput,
  type ListRecurringTasksOutput,
  type ListWorkflowsInput,
  type ListWorkflowsOutput,
} from './types';

const DEFAULT_COUNT = 25;
const MAX_COUNT = 100;

export class ProdKarbonMcpServer implements KarbonMcpServer {
  readonly name = 'karbon-rest' as const;
  readonly workspaceId: string;

  constructor(args: { workspaceId: string }) {
    if (!args.workspaceId) throw new Error('ProdKarbonMcpServer: workspaceId is required');
    this.workspaceId = args.workspaceId;
  }

  async listClients(input: ListClientsInput): Promise<McpResult<ListClientsOutput>> {
    const count = clampCount(input.count);
    if (!count.ok) return count;
    return this.withApi(async (ctx) => {
      const res = await ctx.api<RawListEnvelope<RawClient>>(
        'GET',
        `/Contacts?$top=${count.value}`,
      );
      if (!res.ok) return res;
      return mcpOk({ clients: unwrapList(res.value).map(toClientSummary) });
    });
  }

  async getClient(input: GetClientInput): Promise<McpResult<GetClientOutput>> {
    if (!input.clientId) return mcpError('INVALID_ARGUMENT', 'getClient requires clientId');
    return this.withApi(async (ctx) => {
      const res = await ctx.api<RawClient | { data: RawClient }>(
        'GET',
        `/Contacts/${encodeURIComponent(input.clientId)}`,
      );
      if (!res.ok) return res;
      const raw =
        'data' in res.value && res.value.data ? res.value.data : (res.value as RawClient);
      if (!raw || !raw.Id) return mcpError('NOT_FOUND', `No client ${input.clientId}`);
      return mcpOk({ client: toClientSummary(raw) });
    });
  }

  async listWorkflows(input: ListWorkflowsInput): Promise<McpResult<ListWorkflowsOutput>> {
    const count = clampCount(input.count);
    if (!count.ok) return count;
    const params = new URLSearchParams();
    params.set('$top', String(count.value));
    if (input.clientId) params.set('clientId', input.clientId);
    if (input.status) params.set('status', input.status);
    return this.withApi(async (ctx) => {
      const res = await ctx.api<RawListEnvelope<RawWorkflow>>(
        'GET',
        `/WorkItems?${params.toString()}`,
      );
      if (!res.ok) return res;
      return mcpOk({ workflows: unwrapList(res.value).map(toWorkflowSummary) });
    });
  }

  async getWorkflow(input: GetWorkflowInput): Promise<McpResult<GetWorkflowOutput>> {
    if (!input.workflowId) return mcpError('INVALID_ARGUMENT', 'getWorkflow requires workflowId');
    return this.withApi(async (ctx) => {
      const res = await ctx.api<RawWorkflow | { data: RawWorkflow }>(
        'GET',
        `/WorkItems/${encodeURIComponent(input.workflowId)}`,
      );
      if (!res.ok) return res;
      const raw =
        'data' in res.value && res.value.data ? res.value.data : (res.value as RawWorkflow);
      if (!raw || !raw.Id) return mcpError('NOT_FOUND', `No workflow ${input.workflowId}`);
      return mcpOk({ workflow: toWorkflowSummary(raw) });
    });
  }

  async listJobs(input: ListJobsInput): Promise<McpResult<ListJobsOutput>> {
    const count = clampCount(input.count);
    if (!count.ok) return count;
    const params = new URLSearchParams();
    params.set('$top', String(count.value));
    if (input.workflowId) params.set('workItemId', input.workflowId);
    if (input.status) params.set('status', input.status);
    return this.withApi(async (ctx) => {
      const res = await ctx.api<RawListEnvelope<RawJob>>(
        'GET',
        `/Tasks?${params.toString()}`,
      );
      if (!res.ok) return res;
      return mcpOk({ jobs: unwrapList(res.value).map(toJobSummary) });
    });
  }

  async listRecurringTasks(
    input: ListRecurringTasksInput,
  ): Promise<McpResult<ListRecurringTasksOutput>> {
    const count = clampCount(input.count);
    if (!count.ok) return count;
    const params = new URLSearchParams();
    params.set('$top', String(count.value));
    if (input.clientId) params.set('clientId', input.clientId);
    return this.withApi(async (ctx) => {
      const res = await ctx.api<RawListEnvelope<RawRecurring>>(
        'GET',
        `/WorkTemplates?${params.toString()}`,
      );
      if (!res.ok) return res;
      return mcpOk({ recurringTasks: unwrapList(res.value).map(toRecurringSummary) });
    });
  }

  // ── internals ─────────────────────────────────────────────────────────

  private async withApi<T>(
    fn: (ctx: { api: ApiFn }) => Promise<McpResult<T>>,
  ): Promise<McpResult<T>> {
    const resolved = await resolveKarbonCredential({ workspaceId: this.workspaceId });
    if (!resolved.ok) return resolved;
    return fn(makeApiContext(resolved.value));
  }
}

// ── REST helpers ───────────────────────────────────────────────────────────

type ApiFn = <T>(method: string, path: string, body?: unknown) => Promise<McpResult<T>>;

function makeApiContext(resolved: ResolvedKarbon): { api: ApiFn } {
  const base = karbonApiBase();
  const authHeader = `Bearer ${resolved.credential.accessToken}`;
  const accessKey = resolved.accessKey;

  const api: ApiFn = async <T>(method: string, path: string, body?: unknown) => {
    let res: Response;
    try {
      res = await fetch(`${base}${path}`, {
        method,
        headers: {
          Authorization: authHeader,
          AccessKey: accessKey,
          Accept: 'application/json',
          ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
    } catch (err) {
      return mcpError(
        'NETWORK',
        `Karbon network error: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
    const text = await res.text();
    if (!res.ok) return mapRestError(res, text);
    if (text.length === 0) return mcpOk({} as T);
    try {
      return mcpOk(JSON.parse(text) as T);
    } catch (err) {
      return mcpError(
        'MALFORMED_RESPONSE',
        `Karbon JSON parse failed: ${err instanceof Error ? err.message : String(err)}`,
        { status: res.status },
      );
    }
  };

  return { api };
}

function mapRestError(
  res: Response,
  text: string,
): { ok: false; error: import('@/lib/integrations/mcp-core').McpError } {
  let detail = res.statusText || `HTTP ${res.status}`;
  try {
    const body = JSON.parse(text) as { message?: string; error?: string; Message?: string };
    detail = body.message ?? body.Message ?? body.error ?? detail;
  } catch {
    if (text) detail = text.slice(0, 240);
  }
  if (res.status === 401) return mcpError('TOKEN_EXPIRED', detail, { status: 401 });
  if (res.status === 403) return mcpError('FORBIDDEN', detail, { status: 403 });
  if (res.status === 404) return mcpError('NOT_FOUND', detail, { status: 404 });
  if (res.status === 429) return mcpError('RATE_LIMITED', detail, { status: 429 });
  return mcpError('UPSTREAM_ERROR', detail, { status: res.status });
}

// ── Raw → DTO mappers ────────────────────────────────────────────────────

interface RawListEnvelope<T> {
  items?: T[];
  data?: T[];
  value?: T[];
}
interface RawClient {
  Id?: string;
  Name?: string;
  DisplayName?: string;
  PrimaryEmail?: string;
  Email?: string;
  Type?: string;
  ClientType?: string;
}
interface RawWorkflow {
  Id?: string;
  Title?: string;
  Name?: string;
  ClientId?: string;
  Status?: string;
  LastActivityAt?: string;
  UpdatedAt?: string;
}
interface RawJob {
  Id?: string;
  WorkItemId?: string;
  Title?: string;
  Name?: string;
  Status?: string;
  ColumnName?: string;
  AssigneeEmail?: string;
  Assignee?: string;
  DueDate?: string;
}
interface RawRecurring {
  Id?: string;
  Title?: string;
  Name?: string;
  ClientId?: string;
  Frequency?: string;
  Cadence?: string;
  NextDueDate?: string;
}

function unwrapList<T>(envelope: RawListEnvelope<T> | T[]): T[] {
  if (Array.isArray(envelope)) return envelope;
  if (envelope && Array.isArray(envelope.items)) return envelope.items;
  if (envelope && Array.isArray(envelope.value)) return envelope.value;
  if (envelope && Array.isArray(envelope.data)) return envelope.data;
  return [];
}

function toClientSummary(c: RawClient): KarbonClientSummary {
  const id = c.Id ?? '';
  const name = c.DisplayName ?? c.Name ?? '';
  const email = c.PrimaryEmail ?? c.Email ?? null;
  const rawType = (c.ClientType ?? c.Type ?? '').toLowerCase();
  const kind: KarbonClientSummary['kind'] = rawType === 'contact' ? 'contact' : 'organization';
  return { id, name, email, kind };
}

function toWorkflowSummary(w: RawWorkflow): KarbonWorkflowSummary {
  const id = w.Id ?? '';
  const title = w.Title ?? w.Name ?? '';
  const clientId = w.ClientId ?? null;
  const status = normalizeWorkflowStatus(w.Status);
  const last = w.LastActivityAt ?? w.UpdatedAt;
  let daysSinceLastActivity: number | null = null;
  if (last) {
    const lastMs = Date.parse(last);
    if (Number.isFinite(lastMs)) {
      daysSinceLastActivity = Math.max(
        0,
        Math.floor((Date.now() - lastMs) / (24 * 60 * 60 * 1000)),
      );
    }
  }
  return { id, title, clientId, status, daysSinceLastActivity };
}

function normalizeWorkflowStatus(raw: string | undefined): KarbonWorkflowSummary['status'] {
  const v = (raw ?? '').toLowerCase();
  if (v === 'completed' || v === 'archived') return v;
  return 'active';
}

function toJobSummary(j: RawJob): KarbonJobSummary {
  const id = j.Id ?? '';
  const workflowId = j.WorkItemId ?? '';
  const title = j.Title ?? j.Name ?? '';
  const status = normalizeJobStatus(j.Status ?? j.ColumnName);
  const assigneeEmail = j.AssigneeEmail ?? j.Assignee ?? null;
  const dueAt = j.DueDate ?? null;
  return { id, workflowId, title, status, assigneeEmail, dueAt };
}

function normalizeJobStatus(raw: string | undefined): KarbonJobSummary['status'] {
  const v = (raw ?? '').toLowerCase();
  if (v === 'in-progress' || v === 'in progress' || v === 'doing') return 'in-progress';
  if (v === 'review' || v === 'in review') return 'review';
  if (v === 'done' || v === 'completed') return 'done';
  if (v === 'blocked' || v === 'waiting' || v === 'on hold') return 'blocked';
  return 'todo';
}

function toRecurringSummary(r: RawRecurring): KarbonRecurringTaskSummary {
  const id = r.Id ?? '';
  const title = r.Title ?? r.Name ?? '';
  const clientId = r.ClientId ?? null;
  const cadence = normalizeCadence(r.Cadence ?? r.Frequency);
  const nextDueAt = r.NextDueDate ?? null;
  return { id, title, clientId, cadence, nextDueAt };
}

function normalizeCadence(raw: string | undefined): KarbonRecurringTaskSummary['cadence'] {
  const v = (raw ?? '').toLowerCase();
  if (v === 'weekly' || v === 'monthly' || v === 'quarterly' || v === 'yearly') return v;
  return 'other';
}

function clampCount(value: number | undefined): McpResult<number> {
  if (value === undefined) return mcpOk(DEFAULT_COUNT);
  if (!Number.isInteger(value) || value <= 0)
    return mcpError('INVALID_ARGUMENT', `count must be a positive integer, got ${value}`);
  if (value > MAX_COUNT)
    return mcpError('INVALID_ARGUMENT', `count must be <= ${MAX_COUNT}, got ${value}`);
  return mcpOk(value);
}
