/**
 * lib/integrations/buildium-mcp/server.ts
 *
 * Production Buildium MCP server. Wraps Buildium's REST API behind the
 * `BuildiumMcpServer` interface so the rent-collection skill never sees a
 * `fetch` call. Plain `fetch` — Buildium publishes no JS SDK.
 *
 * Cold-start safe: re-resolves the credential on every method via
 * `resolveBuildiumCredential`; no secret is cached on the instance.
 *
 * Per `project_no_outbound_architecture.md`: READ-ONLY. We list active
 * leases + outstanding balances + tenant contacts; we never write back to
 * Buildium and never trigger a charge.
 *
 * Buildium REST:
 *   auth   x-buildium-client-id + x-buildium-client-secret headers
 *   base   https://api.buildium.com/v1
 *   leases GET /leases?leasestatuses=Active&limit=N
 *   ledger GET /leases/{id}/ledger/balances
 */

import { mcpError, mcpOk, type McpResult } from '@/lib/integrations/mcp-core';
import { resolveBuildiumCredential, type ResolvedBuildium } from './auth';
import {
  BUILDIUM_API_BASE,
  type BuildiumHealth,
  type BuildiumLeaseSummary,
  type BuildiumMcpServer,
  type BuildiumTenant,
  type ListDelinquentLeasesInput,
  type ListDelinquentLeasesOutput,
} from './types';

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

export class ProdBuildiumMcpServer implements BuildiumMcpServer {
  readonly name = 'buildium-rest' as const;
  readonly workspaceId: string;

  constructor(args: { workspaceId: string }) {
    if (!args.workspaceId) throw new Error('ProdBuildiumMcpServer: workspaceId is required');
    this.workspaceId = args.workspaceId;
  }

  async listDelinquentLeases(
    input: ListDelinquentLeasesInput = {},
  ): Promise<McpResult<ListDelinquentLeasesOutput>> {
    const limit = clampLimit(input.limit);
    const asOf = input.asOf ? new Date(input.asOf) : new Date();
    return this.withApi(async (api) => {
      const params = new URLSearchParams({
        leasestatuses: 'Active',
        limit: String(limit),
      });
      const leasesRes = await api<RawLease[]>('GET', `/leases?${params.toString()}`);
      if (!leasesRes.ok) return leasesRes;

      const out: BuildiumLeaseSummary[] = [];
      for (const lease of leasesRes.value) {
        if (lease.Id === undefined) continue;
        // Pull the outstanding balance from the lease ledger. Buildium
        // returns a TotalBalance dollar figure; a positive value is past
        // due. We only surface delinquent leases (balance > 0) — the skill
        // assumes everything passed in is past-due.
        const balRes = await api<RawLedgerBalance>(
          'GET',
          `/leases/${encodeURIComponent(String(lease.Id))}/ledger/balances`,
        );
        if (!balRes.ok) {
          // A per-lease ledger failure shouldn't sink the whole roll —
          // skip this lease, the next fire retries.
          continue;
        }
        const balance = numOr0(balRes.value.TotalBalance);
        if (balance <= 0) continue;
        out.push(toLeaseSummary(lease, balance, asOf));
      }
      return mcpOk({ leases: out });
    });
  }

  async healthCheck(): Promise<BuildiumHealth> {
    const startedAt = Date.now();
    const res = await this.withApi(async (api) => {
      // Cheapest read Buildium offers: a single lease. We only care that the
      // call authenticates + returns 2xx — the body is discarded.
      return api<unknown>('GET', '/leases?limit=1');
    });
    const latencyMs = Date.now() - startedAt;
    const lastChecked = new Date().toISOString();
    if (res.ok) return { ok: true, latencyMs, lastChecked };
    return {
      ok: false,
      latencyMs,
      lastChecked,
      errorCode: res.error.code,
      message: res.error.message,
    };
  }

  // ── internals ───────────────────────────────────────────────────────────

  private async withApi<T>(fn: (api: ApiFn) => Promise<McpResult<T>>): Promise<McpResult<T>> {
    const resolved = await resolveBuildiumCredential({ workspaceId: this.workspaceId });
    if (!resolved.ok) return resolved;
    return fn(makeApiContext(resolved.value));
  }
}

type ApiFn = <T>(method: string, path: string, body?: unknown) => Promise<McpResult<T>>;

/** Exported for unit tests: builds the raw Buildium request fn from an
 *  already-resolved credential (no Prisma round-trip), so the HTTP +
 *  error-mapping paths (401/429/500/malformed/happy) can be exercised with a
 *  mocked global.fetch. Not used outside server.ts + tests. */
export function makeApiContext(resolved: ResolvedBuildium): ApiFn {
  return async <T>(method: string, path: string, body?: unknown) => {
    let res: Response;
    try {
      res = await fetch(`${BUILDIUM_API_BASE}${path}`, {
        method,
        headers: {
          'x-buildium-client-id': resolved.clientId,
          'x-buildium-client-secret': resolved.clientSecret,
          Accept: 'application/json',
          ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
    } catch (err) {
      return mcpError('NETWORK', `Buildium network error: ${err instanceof Error ? err.message : String(err)}`);
    }
    const text = await res.text();
    if (!res.ok) return mapRestError(res, text);
    if (text.length === 0) return mcpOk({} as T);
    try {
      return mcpOk(JSON.parse(text) as T);
    } catch (err) {
      return mcpError('MALFORMED_RESPONSE', `Buildium JSON parse failed: ${err instanceof Error ? err.message : String(err)}`, { status: res.status });
    }
  };
}

function mapRestError(res: Response, text: string): { ok: false; error: import('@/lib/integrations/mcp-core').McpError } {
  let detail = res.statusText || `HTTP ${res.status}`;
  try {
    const body = JSON.parse(text) as { UserMessage?: string; Message?: string };
    detail = body.UserMessage ?? body.Message ?? detail;
  } catch {
    if (text) detail = text.slice(0, 240);
  }
  if (res.status === 401) return mcpError('UNAUTHORIZED', detail, { status: 401 });
  if (res.status === 403) return mcpError('FORBIDDEN', detail, { status: 403 });
  if (res.status === 404) return mcpError('NOT_FOUND', detail, { status: 404 });
  if (res.status === 429) return mcpError('RATE_LIMITED', detail, { status: 429 });
  return mcpError('UPSTREAM_ERROR', detail, { status: res.status });
}

function clampLimit(value: number | undefined): number {
  if (value === undefined || !Number.isInteger(value) || value <= 0) return DEFAULT_LIMIT;
  return Math.min(value, MAX_LIMIT);
}

// ── Raw Buildium JSON → DTO mappers ──────────────────────────────────────

interface RawContact {
  FirstName?: string;
  LastName?: string;
  Email?: string;
  PhoneNumbers?: Array<{ Number?: string }>;
}
interface RawUnit {
  UnitNumber?: string;
}
interface RawProperty {
  Name?: string;
  Address?: { AddressLine1?: string };
}
interface RawLease {
  Id?: number;
  PropertyId?: number;
  UnitNumber?: string;
  CurrentRentDueDate?: string;
  PaymentPlan?: { IsActive?: boolean } | null;
  Tenants?: RawContact[];
  Unit?: RawUnit;
  Property?: RawProperty;
}
interface RawLedgerBalance {
  TotalBalance?: number;
}

function numOr0(v: number | undefined): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : 0;
}

function toTenant(c: RawContact): BuildiumTenant {
  const name = [c.FirstName, c.LastName].filter(Boolean).join(' ').trim();
  const phone = c.PhoneNumbers?.find((p) => p.Number)?.Number ?? null;
  return {
    name: name.length > 0 ? name : (c.Email ?? 'Tenant'),
    email: c.Email ?? null,
    phone,
  };
}

function unitLabel(lease: RawLease): string {
  const propName = lease.Property?.Name ?? lease.Property?.Address?.AddressLine1 ?? null;
  const unit = lease.Unit?.UnitNumber ?? lease.UnitNumber ?? null;
  if (propName && unit) return `${propName} #${unit}`;
  if (propName) return propName;
  if (unit) return `Unit ${unit}`;
  return `Lease ${lease.Id ?? ''}`.trim();
}

function daysSince(dueDate: string | null, asOf: Date): number {
  if (!dueDate) return 0;
  const due = new Date(dueDate);
  if (Number.isNaN(due.getTime())) return 0;
  const ms = asOf.getTime() - due.getTime();
  return ms <= 0 ? 0 : Math.floor(ms / (24 * 60 * 60 * 1000));
}

function toLeaseSummary(lease: RawLease, balance: number, asOf: Date): BuildiumLeaseSummary {
  const rentDueDate = lease.CurrentRentDueDate ?? null;
  return {
    id: String(lease.Id),
    unitLabel: unitLabel(lease),
    outstandingBalance: balance,
    rentDueDate,
    daysPastDue: daysSince(rentDueDate, asOf),
    tenants: (lease.Tenants ?? []).map(toTenant),
    paymentPlanInPlace: lease.PaymentPlan?.IsActive === true,
  };
}
