/**
 * lib/integrations/qualia-mcp/server.ts
 *
 * Production Qualia MCP server. Wraps Qualia's REST surface behind the
 * `QualiaMcpServer` interface so the closing-doc-chase skill never sees a
 * `fetch` call. Plain `fetch` — Qualia's API is HTTP/JSON.
 *
 * Cold-start safe: re-resolves the credential on every method via
 * `resolveQualiaCredential`; no secret is cached on the instance.
 *
 * Per `project_no_outbound_architecture.md`: READ-ONLY. We read an order's
 * parties + document checklist + received documents; we never place an
 * order, send a message, or write a document back to Qualia.
 *
 * Qualia REST (org-scoped host, HTTP Basic):
 *   base   https://{org}.qualia.io/api/v1
 *   auth   Basic base64(orgId:apiKey)
 *   order  GET /orders/{id}
 *   docs   GET /orders/{id}/documents
 */

import { mcpError, mcpOk, type McpResult } from '@/lib/integrations/mcp-core';
import { resolveQualiaCredential, type ResolvedQualia } from './auth';
import {
  type GetClosingOrderInput,
  type GetClosingOrderOutput,
  type QualiaChecklistItem,
  type QualiaMcpServer,
  type QualiaOrderSummary,
  type QualiaParty,
  type QualiaPartyRole,
  type QualiaReceivedDoc,
} from './types';

export function qualiaApiBase(orgId: string): string {
  return `https://${encodeURIComponent(orgId)}.qualia.io/api/v1`;
}

export class ProdQualiaMcpServer implements QualiaMcpServer {
  readonly name = 'qualia-rest' as const;
  readonly workspaceId: string;

  constructor(args: { workspaceId: string }) {
    if (!args.workspaceId) throw new Error('ProdQualiaMcpServer: workspaceId is required');
    this.workspaceId = args.workspaceId;
  }

  async getClosingOrder(
    input: GetClosingOrderInput,
  ): Promise<McpResult<GetClosingOrderOutput>> {
    if (!input.orderId) return mcpError('INVALID_ARGUMENT', 'orderId is required');
    return this.withApi(async (api) => {
      const orderRes = await api<RawOrder>('GET', `/orders/${encodeURIComponent(input.orderId)}`);
      if (!orderRes.ok) return orderRes;
      const docsRes = await api<RawDocumentsResponse>(
        'GET',
        `/orders/${encodeURIComponent(input.orderId)}/documents`,
      );
      if (!docsRes.ok) return docsRes;

      return mcpOk({
        order: toOrderSummary(orderRes.value),
        checklist: (docsRes.value.checklist ?? []).map(toChecklistItem),
        receivedDocs: (docsRes.value.received ?? []).map(toReceivedDoc),
      });
    });
  }

  // ── internals ───────────────────────────────────────────────────────────

  private async withApi<T>(fn: (api: ApiFn) => Promise<McpResult<T>>): Promise<McpResult<T>> {
    const resolved = await resolveQualiaCredential({ workspaceId: this.workspaceId });
    if (!resolved.ok) return resolved;
    return fn(makeApiContext(resolved.value));
  }
}

type ApiFn = <T>(method: string, path: string, body?: unknown) => Promise<McpResult<T>>;

function makeApiContext(resolved: ResolvedQualia): ApiFn {
  const base = qualiaApiBase(resolved.orgId);
  const basic = Buffer.from(`${resolved.orgId}:${resolved.apiKey}`).toString('base64');
  return async <T>(method: string, path: string, body?: unknown) => {
    let res: Response;
    try {
      res = await fetch(`${base}${path}`, {
        method,
        headers: {
          Authorization: `Basic ${basic}`,
          Accept: 'application/json',
          ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
    } catch (err) {
      return mcpError('NETWORK', `Qualia network error: ${err instanceof Error ? err.message : String(err)}`);
    }
    const text = await res.text();
    if (!res.ok) return mapRestError(res, text);
    if (text.length === 0) return mcpOk({} as T);
    try {
      return mcpOk(JSON.parse(text) as T);
    } catch (err) {
      return mcpError('MALFORMED_RESPONSE', `Qualia JSON parse failed: ${err instanceof Error ? err.message : String(err)}`, { status: res.status });
    }
  };
}

function mapRestError(res: Response, text: string): { ok: false; error: import('@/lib/integrations/mcp-core').McpError } {
  let detail = res.statusText || `HTTP ${res.status}`;
  try {
    const body = JSON.parse(text) as { message?: string; error?: string };
    detail = body.message ?? body.error ?? detail;
  } catch {
    if (text) detail = text.slice(0, 240);
  }
  if (res.status === 401) return mcpError('UNAUTHORIZED', detail, { status: 401 });
  if (res.status === 403) return mcpError('FORBIDDEN', detail, { status: 403 });
  if (res.status === 404) return mcpError('NOT_FOUND', detail, { status: 404 });
  if (res.status === 429) return mcpError('RATE_LIMITED', detail, { status: 429 });
  return mcpError('UPSTREAM_ERROR', detail, { status: res.status });
}

// ── Raw Qualia JSON → DTO mappers ────────────────────────────────────────

interface RawContact {
  name?: string;
  full_name?: string;
  email?: string;
  role?: string;
}
interface RawOrder {
  id?: string | number;
  property_address?: string;
  closing_date?: string;
  closing_coordinator?: RawContact | null;
  parties?: RawContact[];
}
interface RawChecklistItem {
  id?: string | number;
  label?: string;
  name?: string;
  responsible_party?: string;
  due_date?: string;
  required?: boolean;
}
interface RawReceivedDoc {
  id?: string | number;
  checklist_item_id?: string | number | null;
  received_at?: string;
  filename?: string;
}
interface RawDocumentsResponse {
  checklist?: RawChecklistItem[];
  received?: RawReceivedDoc[];
}

/** Map Qualia's contact-role string to our normalized role. Unknown roles
 *  collapse to 'realtor' (the most generic outside-party bucket) — never
 *  fabricated and never dropped silently from the party list. */
function toRole(raw: string | undefined): QualiaPartyRole {
  switch ((raw ?? '').trim().toLowerCase()) {
    case 'buyer':
    case 'borrower':
      return 'buyer';
    case 'seller':
      return 'seller';
    case 'lender':
    case 'mortgage':
      return 'lender';
    case 'buyer attorney':
    case 'buyer-attorney':
      return 'buyer-attorney';
    case 'seller attorney':
    case 'seller-attorney':
      return 'seller-attorney';
    case 'underwriter':
      return 'underwriter';
    case 'realtor':
    case 'agent':
    case 'real estate agent':
      return 'realtor';
    default:
      return 'realtor';
  }
}

function toParty(c: RawContact): QualiaParty {
  const name = (c.full_name ?? c.name ?? '').trim();
  return {
    name: name.length > 0 ? name : (c.email ?? 'Contact'),
    email: c.email && c.email.trim().length > 0 ? c.email.trim() : null,
    role: toRole(c.role),
  };
}

function toOrderSummary(order: RawOrder): QualiaOrderSummary {
  return {
    id: String(order.id ?? ''),
    propertyAddress: order.property_address ?? '',
    scheduledClosingDate: order.closing_date ?? null,
    closingCoordinator: order.closing_coordinator ? toParty(order.closing_coordinator) : null,
    parties: (order.parties ?? []).map(toParty),
  };
}

function toChecklistItem(item: RawChecklistItem): QualiaChecklistItem {
  return {
    id: String(item.id ?? ''),
    label: item.label ?? item.name ?? 'Document',
    responsibleParty: toRole(item.responsible_party),
    dueDate: item.due_date ?? null,
    required: item.required !== false,
  };
}

function toReceivedDoc(doc: RawReceivedDoc): QualiaReceivedDoc {
  return {
    id: String(doc.id ?? ''),
    satisfiesChecklistItemId:
      doc.checklist_item_id !== undefined && doc.checklist_item_id !== null
        ? String(doc.checklist_item_id)
        : null,
    receivedAt: doc.received_at ?? new Date(0).toISOString(),
    filename: doc.filename ?? 'document',
  };
}
