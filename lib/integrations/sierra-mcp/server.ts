/**
 * lib/integrations/sierra-mcp/server.ts
 *
 * Production Sierra Interactive MCP server. Wraps Sierra's REST API
 * behind the `SierraMcpServer` interface so skills + sweeps never see a
 * `fetch` call directly. Plain `fetch` — no SDK (Sierra does not
 * publish one).
 *
 * Cold-start safe: every method re-resolves the credential via
 * `resolveSierraCredential`; no key is cached on the instance.
 *
 * Per `project_no_outbound_architecture.md`: `createNote` and `addTag`
 * are INTERNAL annotations on the broker's own CRM. No tool here sends
 * mail, SMS, or anything customer-facing.
 *
 * Auth: `Authorization: Bearer <key>` (Sierra's documented header).
 * Base URL: https://api.sierrainteractive.com/v1/
 *
 * NOTE on vendor docs: Sierra's REST API is documented behind a partner
 * portal that publishes per-customer; the base URL + bearer-token auth
 * are the documented public surface. Tool URIs below are conservative —
 * each map to the verbs the lead-triage skill needs. Production
 * acceptance verifies the actual responses against a live sandbox key
 * before this flips to default-installed.
 */

import { mcpError, mcpOk, type McpResult } from '@/lib/integrations/mcp-core';
import { resolveSierraCredential, type ResolvedSierra } from './auth';
import type {
  AddTagInput,
  AddTagOutput,
  CreateNoteInput,
  CreateNoteOutput,
  GetLeadInput,
  GetLeadOutput,
  GetPipelineStageInput,
  GetPipelineStageOutput,
  ListLeadsInput,
  ListLeadsOutput,
  ListPipelinesInput,
  ListPipelinesOutput,
  SierraLeadSummary,
  SierraMcpServer,
  SierraPipelineSummary,
} from './types';
import type {
  CreateContactInput,
  CreateContactOutput,
  SendDripInput,
  SendDripOutput,
  UpdateStatusInput,
  UpdateStatusOutput,
} from './actions';

export const SIERRA_API_BASE = 'https://api.sierrainteractive.com/v1';
const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;

export class ProdSierraMcpServer implements SierraMcpServer {
  readonly name = 'sierra-rest' as const;
  readonly workspaceId: string;

  constructor(args: { workspaceId: string }) {
    if (!args.workspaceId) {
      throw new Error('ProdSierraMcpServer: workspaceId is required');
    }
    this.workspaceId = args.workspaceId;
  }

  async listLeads(input: ListLeadsInput): Promise<McpResult<ListLeadsOutput>> {
    const limit = clampLimit(input.limit);
    return this.withApi(async (api) => {
      const params = new URLSearchParams();
      params.set('limit', String(limit));
      if (input.modifiedSince) {
        params.set('modifiedSince', input.modifiedSince);
      }
      const res = await api<RawListLeadsResponse>(
        'GET',
        `/contacts?${params.toString()}`,
      );
      if (!res.ok) return res;
      const leads = (res.value.contacts ?? []).map(toLeadSummary);
      return mcpOk({ leads });
    });
  }

  async getLead(input: GetLeadInput): Promise<McpResult<GetLeadOutput>> {
    if (!input.leadId) {
      return mcpError('INVALID_ARGUMENT', 'getLead requires leadId');
    }
    return this.withApi(async (api) => {
      const res = await api<RawContact>(
        'GET',
        `/contacts/${encodeURIComponent(input.leadId)}`,
      );
      if (!res.ok) return res;
      return mcpOk({ lead: toLeadSummary(res.value) });
    });
  }

  async createNote(
    input: CreateNoteInput,
  ): Promise<McpResult<CreateNoteOutput>> {
    if (!input.leadId) {
      return mcpError('INVALID_ARGUMENT', 'createNote requires leadId');
    }
    if (!input.body || input.body.trim().length === 0) {
      return mcpError(
        'INVALID_ARGUMENT',
        'createNote requires a non-empty body',
      );
    }
    return this.withApi(async (api) => {
      const res = await api<RawNote>(
        'POST',
        `/contacts/${encodeURIComponent(input.leadId)}/notes`,
        {
          body: input.body,
          isPrivate: input.isPrivate ?? true,
        },
      );
      if (!res.ok) return res;
      if (!res.value.id) {
        return mcpError(
          'MALFORMED_RESPONSE',
          'Sierra note.create returned no id',
        );
      }
      return mcpOk({ noteId: String(res.value.id) });
    });
  }

  async addTag(input: AddTagInput): Promise<McpResult<AddTagOutput>> {
    if (!input.leadId) {
      return mcpError('INVALID_ARGUMENT', 'addTag requires leadId');
    }
    if (!input.tags || input.tags.length === 0) {
      return mcpError(
        'INVALID_ARGUMENT',
        'addTag requires at least one tag',
      );
    }
    // Read-merge-write to avoid clobbering existing tags. Sierra's tags
    // endpoint replaces the full set on PUT.
    return this.withApi(async (api) => {
      const contactRes = await api<RawContact>(
        'GET',
        `/contacts/${encodeURIComponent(input.leadId)}`,
      );
      if (!contactRes.ok) return contactRes;
      const existing = readStringArray(contactRes.value.tags);
      const merged = Array.from(new Set([...existing, ...input.tags]));
      const putRes = await api<RawContact>(
        'PUT',
        `/contacts/${encodeURIComponent(input.leadId)}/tags`,
        { tags: merged },
      );
      if (!putRes.ok) return putRes;
      return mcpOk({ applied: input.tags });
    });
  }

  async listPipelines(
    input: ListPipelinesInput,
  ): Promise<McpResult<ListPipelinesOutput>> {
    const limit = clampLimit(input.limit);
    return this.withApi(async (api) => {
      const params = new URLSearchParams({ limit: String(limit) });
      const res = await api<RawListPipelinesResponse>(
        'GET',
        `/pipelines?${params.toString()}`,
      );
      if (!res.ok) return res;
      const pipelines = (res.value.pipelines ?? []).map(toPipelineSummary);
      return mcpOk({ pipelines });
    });
  }

  async getPipelineStage(
    input: GetPipelineStageInput,
  ): Promise<McpResult<GetPipelineStageOutput>> {
    if (!input.pipelineId || !input.stageId) {
      return mcpError(
        'INVALID_ARGUMENT',
        'getPipelineStage requires pipelineId and stageId',
      );
    }
    return this.withApi(async (api) => {
      const res = await api<RawPipeline>(
        'GET',
        `/pipelines/${encodeURIComponent(input.pipelineId)}`,
      );
      if (!res.ok) return res;
      const summary = toPipelineSummary(res.value);
      const stage = summary.stages.find((s) => s.id === input.stageId);
      if (!stage) {
        return mcpError(
          'NOT_FOUND',
          `Pipeline ${input.pipelineId} has no stage ${input.stageId}`,
        );
      }
      return mcpOk({ stage });
    });
  }

  // ── Write-action-depth mutations (approval-gated at the factory seam) ──

  async createContact(
    input: CreateContactInput,
  ): Promise<McpResult<CreateContactOutput>> {
    if (!input.firstName || !input.lastName) {
      return mcpError(
        'INVALID_ARGUMENT',
        'createContact requires firstName and lastName',
      );
    }
    return this.withApi(async (api) => {
      const res = await api<RawContact>('POST', '/contacts', {
        firstName: input.firstName,
        lastName: input.lastName,
        emails: input.email ? [{ address: input.email }] : undefined,
        phones: input.phone ? [{ number: input.phone }] : undefined,
        source: input.source,
      });
      if (!res.ok) return res;
      if (res.value.id === undefined || res.value.id === null) {
        return mcpError(
          'MALFORMED_RESPONSE',
          'Sierra contact.create returned no id',
        );
      }
      return mcpOk({ contactId: String(res.value.id) });
    });
  }

  async sendDrip(input: SendDripInput): Promise<McpResult<SendDripOutput>> {
    if (!input.contactId || !input.campaignId) {
      return mcpError(
        'INVALID_ARGUMENT',
        'sendDrip requires contactId and campaignId',
      );
    }
    return this.withApi(async (api) => {
      const res = await api<RawEnrollment>(
        'POST',
        `/campaigns/${encodeURIComponent(input.campaignId)}/enrollments`,
        { contactId: input.contactId },
      );
      if (!res.ok) return res;
      if (res.value.id === undefined || res.value.id === null) {
        return mcpError(
          'MALFORMED_RESPONSE',
          'Sierra campaign.enroll returned no id',
        );
      }
      return mcpOk({ enrollmentId: String(res.value.id) });
    });
  }

  async updateStatus(
    input: UpdateStatusInput,
  ): Promise<McpResult<UpdateStatusOutput>> {
    if (!input.leadId) {
      return mcpError('INVALID_ARGUMENT', 'updateStatus requires leadId');
    }
    if (!input.status || input.status.trim().length === 0) {
      return mcpError(
        'INVALID_ARGUMENT',
        'updateStatus requires a non-empty status',
      );
    }
    return this.withApi(async (api) => {
      const res = await api<RawContact>(
        'PUT',
        `/contacts/${encodeURIComponent(input.leadId)}/status`,
        { status: input.status },
      );
      if (!res.ok) return res;
      return mcpOk({ leadId: input.leadId, status: input.status });
    });
  }

  // ── internals ───────────────────────────────────────────────────────

  private async withApi<T>(
    fn: (api: ApiFn) => Promise<McpResult<T>>,
  ): Promise<McpResult<T>> {
    const resolved = await resolveSierraCredential({
      workspaceId: this.workspaceId,
    });
    if (!resolved.ok) return resolved;
    return fn(makeApiContext(resolved.value));
  }
}

type ApiFn = <T>(
  method: string,
  path: string,
  body?: unknown,
) => Promise<McpResult<T>>;

function makeApiContext(resolved: ResolvedSierra): ApiFn {
  const bearer = `Bearer ${resolved.apiKey}`;
  return async <T>(method: string, path: string, body?: unknown) => {
    let res: Response;
    try {
      res = await fetch(`${SIERRA_API_BASE}${path}`, {
        method,
        headers: {
          Authorization: bearer,
          Accept: 'application/json',
          ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
    } catch (err) {
      return mcpError(
        'NETWORK',
        `Sierra Interactive network error: ${
          err instanceof Error ? err.message : String(err)
        }`,
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
        `Sierra Interactive JSON parse failed: ${
          err instanceof Error ? err.message : String(err)
        }`,
        { status: res.status },
      );
    }
  };
}

function mapRestError(
  res: Response,
  text: string,
): { ok: false; error: import('@/lib/integrations/mcp-core').McpError } {
  let detail = res.statusText || `HTTP ${res.status}`;
  try {
    const body = JSON.parse(text) as {
      errorMessage?: string;
      message?: string;
      error?: string;
    };
    detail = body.errorMessage ?? body.message ?? body.error ?? detail;
  } catch {
    if (text) detail = text.slice(0, 240);
  }
  if (res.status === 401) {
    return mcpError('TOKEN_EXPIRED', detail, { status: 401 });
  }
  if (res.status === 403) return mcpError('FORBIDDEN', detail, { status: 403 });
  if (res.status === 404) return mcpError('NOT_FOUND', detail, { status: 404 });
  if (res.status === 429) {
    return mcpError('RATE_LIMITED', detail, { status: 429 });
  }
  return mcpError('UPSTREAM_ERROR', detail, { status: res.status });
}

// ── Raw → DTO mappers ─────────────────────────────────────────────────

interface RawContact {
  id?: number | string;
  firstName?: string | null;
  lastName?: string | null;
  emails?: Array<{ address?: string }>;
  phones?: Array<{ number?: string }>;
  source?: string | null;
  stage?: string | null;
  tags?: string[];
  lastActivityAt?: string | null;
  createdAt?: string | null;
}

interface RawListLeadsResponse {
  contacts?: RawContact[];
}

interface RawNote {
  id?: number | string;
}

interface RawEnrollment {
  id?: number | string;
}

interface RawPipeline {
  id?: number | string;
  name?: string;
  stages?: Array<{
    id?: number | string;
    name?: string;
    order?: number;
  }>;
}

interface RawListPipelinesResponse {
  pipelines?: RawPipeline[];
}

function toLeadSummary(c: RawContact): SierraLeadSummary {
  return {
    id: c.id !== undefined ? String(c.id) : '',
    firstName: c.firstName ?? null,
    lastName: c.lastName ?? null,
    emails: (c.emails ?? [])
      .map((e) => e.address ?? '')
      .filter((v) => v.length > 0),
    phones: (c.phones ?? [])
      .map((p) => p.number ?? '')
      .filter((v) => v.length > 0),
    source: c.source ?? null,
    stage: c.stage ?? null,
    tags: readStringArray(c.tags),
    lastActivityAt: c.lastActivityAt ?? null,
    createdAt: c.createdAt ?? null,
  };
}

function toPipelineSummary(p: RawPipeline): SierraPipelineSummary {
  return {
    id: p.id !== undefined ? String(p.id) : '',
    name: p.name ?? 'Pipeline',
    stages: (p.stages ?? []).map((s) => ({
      id: s.id !== undefined ? String(s.id) : '',
      name: s.name ?? 'Stage',
      sortOrder:
        typeof s.order === 'number' && Number.isFinite(s.order) ? s.order : 0,
    })),
  };
}

function readStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === 'string' && x.length > 0);
}

function clampLimit(value: number | undefined): number {
  if (value === undefined) return DEFAULT_LIMIT;
  if (!Number.isFinite(value)) return DEFAULT_LIMIT;
  if (value < 1) return 1;
  if (value > MAX_LIMIT) return MAX_LIMIT;
  return Math.floor(value);
}
