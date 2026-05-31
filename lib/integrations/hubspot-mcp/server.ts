/**
 * lib/integrations/hubspot-mcp/server.ts
 *
 * Production HubSpot MCP server. Wraps HubSpot's CRM v3 REST API behind
 * the `HubspotMcpServer` interface. One instance per `{workspaceId}` per
 * request. This file is the ONLY place that calls the HubSpot REST API;
 * route handlers + skills speak the MCP interface (per
 * `feedback_no_silent_vendor_lock.md`). Plain `fetch`, no SDK.
 *
 * Cold-start safe: every method re-resolves the credential via
 * `resolveHubspotCredential`; no token is cached on the instance.
 *
 * API docs: https://developers.hubspot.com/docs/api/crm/contacts (read 2026-05-31)
 * Auth: Bearer access token. Base URL: https://api.hubapi.com
 */

import { mcpError, mcpOk, type McpResult } from '@/lib/integrations/mcp-core';
import { HUBSPOT_API_BASE } from '@/lib/integrations/hubspot/oauth';
import { resolveHubspotCredential, type ResolvedHubspot } from './auth';
import type {
  CreateNoteInput,
  CreateNoteOutput,
  GetCompanyInput,
  GetCompanyOutput,
  GetContactInput,
  GetContactOutput,
  GetDealInput,
  GetDealOutput,
  HubspotCompanySummary,
  HubspotContactSummary,
  HubspotDealSummary,
  HubspotMcpServer,
  ListCompaniesInput,
  ListCompaniesOutput,
  ListContactsInput,
  ListContactsOutput,
  ListDealsInput,
  ListDealsOutput,
  UpdateContactInput,
  UpdateContactOutput,
  UpdateDealInput,
  UpdateDealOutput,
} from './types';

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;

const CONTACT_PROPERTIES = [
  'firstname',
  'lastname',
  'email',
  'phone',
  'company',
  'lifecyclestage',
  'hs_lead_status',
  'hs_analytics_source',
  'createdate',
  'lastmodifieddate',
];

const DEAL_PROPERTIES = [
  'dealname',
  'amount',
  'pipeline',
  'dealstage',
  'closedate',
  'createdate',
  'hs_lastmodifieddate',
];

const COMPANY_PROPERTIES = [
  'name',
  'domain',
  'industry',
  'city',
  'country',
  'createdate',
  'hs_lastmodifieddate',
];

export class ProdHubspotMcpServer implements HubspotMcpServer {
  readonly name = 'hubspot-rest' as const;
  readonly workspaceId: string;

  constructor(args: { workspaceId: string }) {
    if (!args.workspaceId) throw new Error('ProdHubspotMcpServer: workspaceId is required');
    this.workspaceId = args.workspaceId;
  }

  async listContacts(input: ListContactsInput): Promise<McpResult<ListContactsOutput>> {
    const limit = clampLimit(input.limit);
    return this.withApi(async (api) => {
      const params = new URLSearchParams({ limit: String(limit) });
      for (const prop of CONTACT_PROPERTIES) params.append('properties', prop);
      if (input.modifiedSince) {
        // HubSpot search endpoint is needed for modifiedSince filtering.
        const sinceMs = Date.parse(input.modifiedSince);
        if (!Number.isFinite(sinceMs)) {
          return mcpError('INVALID_ARGUMENT', `listContacts.modifiedSince invalid ISO: ${input.modifiedSince}`);
        }
        const body = {
          filterGroups: [
            {
              filters: [
                {
                  propertyName: 'lastmodifieddate',
                  operator: 'GTE',
                  value: String(sinceMs),
                },
              ],
            },
          ],
          properties: CONTACT_PROPERTIES,
          limit,
        };
        const res = await api<RawCrmSearchResponse<RawContact>>('POST', '/crm/v3/objects/contacts/search', body);
        if (!res.ok) return res;
        return mcpOk({ contacts: (res.value.results ?? []).map(toContactSummary) });
      }
      const res = await api<RawCrmListResponse<RawContact>>(
        'GET',
        `/crm/v3/objects/contacts?${params.toString()}`,
      );
      if (!res.ok) return res;
      return mcpOk({ contacts: (res.value.results ?? []).map(toContactSummary) });
    });
  }

  async getContact(input: GetContactInput): Promise<McpResult<GetContactOutput>> {
    if (!input.contactId) return mcpError('INVALID_ARGUMENT', 'getContact requires contactId');
    return this.withApi(async (api) => {
      const params = new URLSearchParams();
      for (const prop of CONTACT_PROPERTIES) params.append('properties', prop);
      const res = await api<RawContact>(
        'GET',
        `/crm/v3/objects/contacts/${encodeURIComponent(input.contactId)}?${params.toString()}`,
      );
      if (!res.ok) return res;
      return mcpOk({ contact: toContactSummary(res.value) });
    });
  }

  async updateContact(input: UpdateContactInput): Promise<McpResult<UpdateContactOutput>> {
    if (!input.contactId) return mcpError('INVALID_ARGUMENT', 'updateContact requires contactId');
    if (!input.properties || Object.keys(input.properties).length === 0) {
      return mcpError('INVALID_ARGUMENT', 'updateContact requires at least one property');
    }
    return this.withApi(async (api) => {
      const res = await api<{ id?: string }>(
        'PATCH',
        `/crm/v3/objects/contacts/${encodeURIComponent(input.contactId)}`,
        { properties: input.properties },
      );
      if (!res.ok) return res;
      return mcpOk({ contactId: res.value.id ?? input.contactId });
    });
  }

  async listDeals(input: ListDealsInput): Promise<McpResult<ListDealsOutput>> {
    const limit = clampLimit(input.limit);
    return this.withApi(async (api) => {
      if (input.pipeline) {
        const body = {
          filterGroups: [
            {
              filters: [{ propertyName: 'pipeline', operator: 'EQ', value: input.pipeline }],
            },
          ],
          properties: DEAL_PROPERTIES,
          limit,
        };
        const res = await api<RawCrmSearchResponse<RawDeal>>('POST', '/crm/v3/objects/deals/search', body);
        if (!res.ok) return res;
        return mcpOk({ deals: (res.value.results ?? []).map(toDealSummary) });
      }
      const params = new URLSearchParams({ limit: String(limit) });
      for (const prop of DEAL_PROPERTIES) params.append('properties', prop);
      const res = await api<RawCrmListResponse<RawDeal>>(
        'GET',
        `/crm/v3/objects/deals?${params.toString()}`,
      );
      if (!res.ok) return res;
      return mcpOk({ deals: (res.value.results ?? []).map(toDealSummary) });
    });
  }

  async getDeal(input: GetDealInput): Promise<McpResult<GetDealOutput>> {
    if (!input.dealId) return mcpError('INVALID_ARGUMENT', 'getDeal requires dealId');
    return this.withApi(async (api) => {
      const params = new URLSearchParams();
      for (const prop of DEAL_PROPERTIES) params.append('properties', prop);
      const res = await api<RawDeal>(
        'GET',
        `/crm/v3/objects/deals/${encodeURIComponent(input.dealId)}?${params.toString()}`,
      );
      if (!res.ok) return res;
      return mcpOk({ deal: toDealSummary(res.value) });
    });
  }

  async updateDeal(input: UpdateDealInput): Promise<McpResult<UpdateDealOutput>> {
    if (!input.dealId) return mcpError('INVALID_ARGUMENT', 'updateDeal requires dealId');
    if (!input.properties || Object.keys(input.properties).length === 0) {
      return mcpError('INVALID_ARGUMENT', 'updateDeal requires at least one property');
    }
    return this.withApi(async (api) => {
      const res = await api<{ id?: string }>(
        'PATCH',
        `/crm/v3/objects/deals/${encodeURIComponent(input.dealId)}`,
        { properties: input.properties },
      );
      if (!res.ok) return res;
      return mcpOk({ dealId: res.value.id ?? input.dealId });
    });
  }

  async listCompanies(input: ListCompaniesInput): Promise<McpResult<ListCompaniesOutput>> {
    const limit = clampLimit(input.limit);
    return this.withApi(async (api) => {
      const params = new URLSearchParams({ limit: String(limit) });
      for (const prop of COMPANY_PROPERTIES) params.append('properties', prop);
      const res = await api<RawCrmListResponse<RawCompany>>(
        'GET',
        `/crm/v3/objects/companies?${params.toString()}`,
      );
      if (!res.ok) return res;
      return mcpOk({ companies: (res.value.results ?? []).map(toCompanySummary) });
    });
  }

  async getCompany(input: GetCompanyInput): Promise<McpResult<GetCompanyOutput>> {
    if (!input.companyId) return mcpError('INVALID_ARGUMENT', 'getCompany requires companyId');
    return this.withApi(async (api) => {
      const params = new URLSearchParams();
      for (const prop of COMPANY_PROPERTIES) params.append('properties', prop);
      const res = await api<RawCompany>(
        'GET',
        `/crm/v3/objects/companies/${encodeURIComponent(input.companyId)}?${params.toString()}`,
      );
      if (!res.ok) return res;
      return mcpOk({ company: toCompanySummary(res.value) });
    });
  }

  async createNote(input: CreateNoteInput): Promise<McpResult<CreateNoteOutput>> {
    if (!input.objectId) return mcpError('INVALID_ARGUMENT', 'createNote requires objectId');
    if (!input.body || input.body.trim().length === 0) {
      return mcpError('INVALID_ARGUMENT', 'createNote requires a non-empty body');
    }
    // HubSpot engagements v3: POST /crm/v3/objects/notes, then associate
    // to the target. The simpler path is to create the note with an
    // `associations` payload referencing the target object.
    const associationTypeId = noteAssociationTypeId(input.objectType);
    return this.withApi(async (api) => {
      const body = {
        properties: {
          hs_note_body: input.body,
          hs_timestamp: new Date().toISOString(),
        },
        associations: [
          {
            to: { id: input.objectId },
            types: [
              {
                associationCategory: 'HUBSPOT_DEFINED',
                associationTypeId,
              },
            ],
          },
        ],
      };
      const res = await api<{ id?: string }>('POST', '/crm/v3/objects/notes', body);
      if (!res.ok) return res;
      if (!res.value.id) return mcpError('MALFORMED_RESPONSE', 'HubSpot note.create returned no id');
      return mcpOk({ noteId: res.value.id });
    });
  }

  // ── internals ───────────────────────────────────────────────────────

  private async withApi<T>(
    fn: (api: ApiFn) => Promise<McpResult<T>>,
  ): Promise<McpResult<T>> {
    const resolved = await resolveHubspotCredential({ workspaceId: this.workspaceId });
    if (!resolved.ok) return resolved;
    return fn(makeApiContext(resolved.value));
  }
}

type ApiFn = <T>(method: string, path: string, body?: unknown) => Promise<McpResult<T>>;

function makeApiContext(resolved: ResolvedHubspot): ApiFn {
  const authHeader = `Bearer ${resolved.credential.accessToken}`;
  return async <T>(method: string, path: string, body?: unknown) => {
    let res: Response;
    try {
      res = await fetch(`${HUBSPOT_API_BASE}${path}`, {
        method,
        headers: {
          Authorization: authHeader,
          Accept: 'application/json',
          ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
    } catch (err) {
      return mcpError('NETWORK', `HubSpot network error: ${err instanceof Error ? err.message : String(err)}`);
    }
    const text = await res.text();
    if (!res.ok) return mapRestError(res, text);
    if (text.length === 0) return mcpOk({} as T);
    try {
      return mcpOk(JSON.parse(text) as T);
    } catch (err) {
      return mcpError('MALFORMED_RESPONSE', `HubSpot JSON parse failed: ${err instanceof Error ? err.message : String(err)}`, { status: res.status });
    }
  };
}

function mapRestError(res: Response, text: string): { ok: false; error: import('@/lib/integrations/mcp-core').McpError } {
  let detail = res.statusText || `HTTP ${res.status}`;
  let reference: string | undefined;
  try {
    const body = JSON.parse(text) as { message?: string; category?: string; correlationId?: string };
    detail = body.message ?? detail;
    reference = body.category ?? body.correlationId;
  } catch {
    if (text) detail = text.slice(0, 240);
  }
  if (res.status === 401) return mcpError('TOKEN_EXPIRED', detail, { status: 401, reference });
  if (res.status === 403) return mcpError('FORBIDDEN', detail, { status: 403, reference });
  if (res.status === 404) return mcpError('NOT_FOUND', detail, { status: 404, reference });
  if (res.status === 429) return mcpError('RATE_LIMITED', detail, { status: 429, reference });
  return mcpError('UPSTREAM_ERROR', detail, { status: res.status, reference });
}

// ── Raw → DTO mappers ───────────────────────────────────────────────────

interface RawCrmListResponse<T> {
  results?: T[];
  paging?: { next?: { after?: string } };
}
interface RawCrmSearchResponse<T> {
  results?: T[];
  total?: number;
}

interface RawCrmObject {
  id?: string;
  properties?: Record<string, string | null>;
}

type RawContact = RawCrmObject;
type RawDeal = RawCrmObject;
type RawCompany = RawCrmObject;

function readProp(props: Record<string, string | null> | undefined, key: string): string | null {
  if (!props) return null;
  const v = props[key];
  return typeof v === 'string' && v.length > 0 ? v : null;
}

function readNumberProp(props: Record<string, string | null> | undefined, key: string): number | null {
  const raw = readProp(props, key);
  if (raw === null) return null;
  const num = Number(raw);
  return Number.isFinite(num) ? num : null;
}

function toContactSummary(c: RawContact): HubspotContactSummary {
  const p = c.properties ?? {};
  return {
    id: c.id ?? '',
    firstName: readProp(p, 'firstname'),
    lastName: readProp(p, 'lastname'),
    email: readProp(p, 'email'),
    phone: readProp(p, 'phone'),
    company: readProp(p, 'company'),
    lifecycleStage: readProp(p, 'lifecyclestage'),
    leadSource: readProp(p, 'hs_analytics_source'),
    createdAt: readProp(p, 'createdate'),
    updatedAt: readProp(p, 'lastmodifieddate'),
  };
}

function toDealSummary(d: RawDeal): HubspotDealSummary {
  const p = d.properties ?? {};
  return {
    id: d.id ?? '',
    name: readProp(p, 'dealname'),
    amount: readNumberProp(p, 'amount'),
    pipeline: readProp(p, 'pipeline'),
    dealStage: readProp(p, 'dealstage'),
    closeDate: readProp(p, 'closedate'),
    createdAt: readProp(p, 'createdate'),
    updatedAt: readProp(p, 'hs_lastmodifieddate'),
  };
}

function toCompanySummary(c: RawCompany): HubspotCompanySummary {
  const p = c.properties ?? {};
  return {
    id: c.id ?? '',
    name: readProp(p, 'name'),
    domain: readProp(p, 'domain'),
    industry: readProp(p, 'industry'),
    city: readProp(p, 'city'),
    country: readProp(p, 'country'),
    createdAt: readProp(p, 'createdate'),
    updatedAt: readProp(p, 'hs_lastmodifieddate'),
  };
}

/** HubSpot's HUBSPOT_DEFINED association type ids for notes →
 *  per https://developers.hubspot.com/docs/api/crm/associations (read 2026-05-31).
 *    note → contact = 202
 *    note → deal    = 214
 *    note → company = 190
 */
function noteAssociationTypeId(objectType: 'contacts' | 'deals' | 'companies'): number {
  switch (objectType) {
    case 'contacts':
      return 202;
    case 'deals':
      return 214;
    case 'companies':
      return 190;
  }
}

function clampLimit(value: number | undefined): number {
  if (value === undefined) return DEFAULT_LIMIT;
  if (!Number.isFinite(value)) return DEFAULT_LIMIT;
  if (value < 1) return 1;
  if (value > MAX_LIMIT) return MAX_LIMIT;
  return Math.floor(value);
}
