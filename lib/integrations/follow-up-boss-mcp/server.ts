/**
 * lib/integrations/follow-up-boss-mcp/server.ts
 *
 * Production Follow Up Boss MCP server. Wraps FUB's REST API behind the
 * `FollowUpBossMcpServer` interface so skills + sweeps never see a `fetch`
 * call directly. Plain `fetch` — no SDK (FUB does not publish one).
 *
 * Cold-start safe: every method re-resolves the credential via
 * `resolveFollowUpBossCredential`; no key is cached on the instance.
 *
 * Per `project_no_outbound_architecture.md`: `create_note` and `add_tag`
 * are INTERNAL annotations on the broker's own CRM. No tool here sends
 * mail, SMS, or anything customer-facing.
 *
 * FUB REST docs: https://docs.followupboss.com/reference/
 * Auth: HTTP Basic — username = API key, password = empty string.
 * Base URL: https://api.followupboss.com/v1/
 */

import { mcpError, mcpOk, type McpResult } from '@/lib/integrations/mcp-core';
import {
  resolveFollowUpBossCredential,
  type ResolvedFollowUpBoss,
} from './auth';
import type {
  AddTagInput,
  AddTagOutput,
  CreateNoteInput,
  CreateNoteOutput,
  FollowUpBossMcpServer,
  FubLeadSummary,
  FubPipelineSummary,
  GetLeadInput,
  GetLeadOutput,
  GetPipelineStageInput,
  GetPipelineStageOutput,
  ListLeadsInput,
  ListLeadsOutput,
  ListPipelinesInput,
  ListPipelinesOutput,
} from './types';

export const FUB_API_BASE = 'https://api.followupboss.com/v1';
const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;

export class ProdFollowUpBossMcpServer implements FollowUpBossMcpServer {
  readonly name = 'follow-up-boss-rest' as const;
  readonly workspaceId: string;

  constructor(args: { workspaceId: string }) {
    if (!args.workspaceId) {
      throw new Error('ProdFollowUpBossMcpServer: workspaceId is required');
    }
    this.workspaceId = args.workspaceId;
  }

  async listLeads(input: ListLeadsInput): Promise<McpResult<ListLeadsOutput>> {
    const limit = clampLimit(input.limit);
    return this.withApi(async (api) => {
      const params = new URLSearchParams();
      params.set('limit', String(limit));
      if (input.modifiedSince) {
        params.set('updatedAfter', input.modifiedSince);
      }
      const res = await api<RawListPeopleResponse>(
        'GET',
        `/people?${params.toString()}`,
      );
      if (!res.ok) return res;
      const leads = (res.value.people ?? []).map(toLeadSummary);
      return mcpOk({ leads });
    });
  }

  async getLead(input: GetLeadInput): Promise<McpResult<GetLeadOutput>> {
    if (!input.leadId) {
      return mcpError('INVALID_ARGUMENT', 'getLead requires leadId');
    }
    return this.withApi(async (api) => {
      const res = await api<RawPerson>(
        'GET',
        `/people/${encodeURIComponent(input.leadId)}`,
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
      return mcpError('INVALID_ARGUMENT', 'createNote requires a non-empty body');
    }
    return this.withApi(async (api) => {
      const res = await api<RawNote>('POST', '/notes', {
        personId: Number(input.leadId),
        body: input.body,
        isHtml: false,
        ...(input.isPrivate ? { type: 'private' } : {}),
      });
      if (!res.ok) return res;
      if (!res.value.id) {
        return mcpError('MALFORMED_RESPONSE', 'FUB note.create returned no id');
      }
      return mcpOk({ noteId: String(res.value.id) });
    });
  }

  async addTag(input: AddTagInput): Promise<McpResult<AddTagOutput>> {
    if (!input.leadId) {
      return mcpError('INVALID_ARGUMENT', 'addTag requires leadId');
    }
    if (!input.tags || input.tags.length === 0) {
      return mcpError('INVALID_ARGUMENT', 'addTag requires at least one tag');
    }
    // FUB's tag-write surface: PUT /people/<id> with `tags: [...]`
    // merges (the API replaces the tag set; we re-read first to avoid
    // clobbering existing tags).
    return this.withApi(async (api) => {
      const personRes = await api<RawPerson>(
        'GET',
        `/people/${encodeURIComponent(input.leadId)}`,
      );
      if (!personRes.ok) return personRes;
      const existing = readStringArray(personRes.value.tags);
      const merged = Array.from(new Set([...existing, ...input.tags]));
      const putRes = await api<RawPerson>(
        'PUT',
        `/people/${encodeURIComponent(input.leadId)}`,
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
    // FUB does not expose a per-stage endpoint; we re-read the pipeline
    // and pick out the requested stage from the embedded `stages` list.
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

  // ── internals ───────────────────────────────────────────────────────

  private async withApi<T>(
    fn: (api: ApiFn) => Promise<McpResult<T>>,
  ): Promise<McpResult<T>> {
    const resolved = await resolveFollowUpBossCredential({
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

function makeApiContext(resolved: ResolvedFollowUpBoss): ApiFn {
  // FUB uses HTTP Basic: username = apiKey, password = empty. The base64
  // encoding is "<key>:" — we do not include the password segment.
  const basicAuth = `Basic ${Buffer.from(`${resolved.apiKey}:`).toString('base64')}`;
  return async <T>(method: string, path: string, body?: unknown) => {
    let res: Response;
    try {
      res = await fetch(`${FUB_API_BASE}${path}`, {
        method,
        headers: {
          Authorization: basicAuth,
          Accept: 'application/json',
          ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
    } catch (err) {
      return mcpError(
        'NETWORK',
        `Follow Up Boss network error: ${
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
        `Follow Up Boss JSON parse failed: ${
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
    };
    detail = body.errorMessage ?? body.message ?? detail;
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

interface RawPerson {
  id?: number;
  firstName?: string | null;
  lastName?: string | null;
  emails?: Array<{ value?: string }>;
  phones?: Array<{ value?: string }>;
  source?: string | null;
  stage?: string | null;
  tags?: string[];
  lastActivity?: string | null;
  created?: string | null;
}

interface RawListPeopleResponse {
  people?: RawPerson[];
}

interface RawNote {
  id?: number;
}

interface RawPipeline {
  id?: number;
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

function toLeadSummary(p: RawPerson): FubLeadSummary {
  return {
    id: p.id !== undefined ? String(p.id) : '',
    firstName: p.firstName ?? null,
    lastName: p.lastName ?? null,
    emails: (p.emails ?? [])
      .map((e) => e.value ?? '')
      .filter((v) => v.length > 0),
    phones: (p.phones ?? [])
      .map((e) => e.value ?? '')
      .filter((v) => v.length > 0),
    source: p.source ?? null,
    stage: p.stage ?? null,
    tags: readStringArray(p.tags),
    lastActivityAt: p.lastActivity ?? null,
    createdAt: p.created ?? null,
  };
}

function toPipelineSummary(p: RawPipeline): FubPipelineSummary {
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
