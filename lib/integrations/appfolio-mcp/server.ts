/**
 * lib/integrations/appfolio-mcp/server.ts
 *
 * Production AppFolio MCP server. Wraps the AppFolio REST surface behind the
 * `AppfolioMcpServer` interface via `client.ts`. One instance per
 * `{workspaceId}` per request. This file + `client.ts` are the ONLY places that
 * touch AppFolio; route handlers + skills speak the MCP interface
 * (`feedback_no_silent_vendor_lock.md`).
 *
 * Cold-start safe: every method re-resolves the credential; no secret cached
 * on the instance.
 *
 * The single READ method (`listUnits`) issues a real GET once a credential
 * resolves. The three MUTATING methods (`createWorkOrder`, `chargeTenant`,
 * `sendNotice`) funnel through the approval seam — they return
 * APPROVAL_REQUIRED and never call AppFolio from the scaffold. When Conner
 * wires the credential + a real approval gate (DocuSign's gate is the
 * reference), the gated branch is replaced with the documented POST.
 */

import { gateMutation, mcpOk, type McpResult } from '@/lib/integrations/mcp-core';
import { makeAppfolioClient } from './client';
import { resolveAppfolioCredential } from './auth';
import {
  type AppFolioUnitSummary,
  type AppfolioMcpServer,
  type ChargeTenantInput,
  type ChargeTenantOutput,
  type CreateWorkOrderInput,
  type CreateWorkOrderOutput,
  type ListUnitsInput,
  type ListUnitsOutput,
  type SendNoticeInput,
  type SendNoticeOutput,
} from './types';

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;

export class ProdAppfolioMcpServer implements AppfolioMcpServer {
  readonly name = 'appfolio-rest' as const;
  readonly workspaceId: string;

  constructor(args: { workspaceId: string }) {
    if (!args.workspaceId) throw new Error('ProdAppfolioMcpServer: workspaceId is required');
    this.workspaceId = args.workspaceId;
  }

  async listUnits(input: ListUnitsInput): Promise<McpResult<ListUnitsOutput>> {
    const limit = Math.min(Math.max(1, input.limit ?? DEFAULT_LIMIT), MAX_LIMIT);
    const resolved = await resolveAppfolioCredential({ workspaceId: this.workspaceId });
    if (!resolved.ok) return resolved;
    const client = makeAppfolioClient({
      clientId: resolved.value.clientId,
      clientSecret: resolved.value.clientSecret,
      subdomain: resolved.value.subdomain,
    });
    const params = new URLSearchParams();
    params.set('limit', String(limit));
    if (input.propertyId) params.set('property_id', input.propertyId);
    const res = await client.get<RawUnitsEnvelope | RawUnit[]>(
      `/units.json?${params.toString()}`,
    );
    if (!res.ok) return res;
    const data = Array.isArray(res.value)
      ? res.value
      : Array.isArray(res.value.data)
        ? res.value.data
        : [];
    return mcpOk({ units: data.map(toUnitSummary) });
  }

  // ── Mutating: approval-gated. AppFolio is never called from the scaffold. ──

  async createWorkOrder(
    _input: CreateWorkOrderInput,
  ): Promise<McpResult<CreateWorkOrderOutput>> {
    return gateMutation('AppFolio', 'creating a work order');
  }

  async chargeTenant(_input: ChargeTenantInput): Promise<McpResult<ChargeTenantOutput>> {
    return gateMutation('AppFolio', 'charging a tenant');
  }

  async sendNotice(_input: SendNoticeInput): Promise<McpResult<SendNoticeOutput>> {
    return gateMutation('AppFolio', 'sending a notice');
  }
}

// ── Raw → DTO mappers ────────────────────────────────────────────────────

interface RawUnitsEnvelope {
  data?: RawUnit[];
}
interface RawUnit {
  id?: number | string;
  address?: string;
  property_id?: number | string;
  occupancy?: string;
  occupied?: boolean;
  status?: string;
}

function toUnitSummary(u: RawUnit): AppFolioUnitSummary {
  return {
    id: u.id != null ? String(u.id) : '',
    address: u.address ?? '',
    propertyId: u.property_id != null ? String(u.property_id) : null,
    occupancy: normalizeOccupancy(u),
    status: u.status ?? '',
  };
}

function normalizeOccupancy(u: RawUnit): AppFolioUnitSummary['occupancy'] {
  if (typeof u.occupied === 'boolean') return u.occupied ? 'occupied' : 'vacant';
  const v = (u.occupancy ?? '').toLowerCase();
  if (v === 'occupied' || v === 'vacant') return v;
  return 'unknown';
}
