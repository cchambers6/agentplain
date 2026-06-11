/**
 * lib/integrations/buildium-mcp/types.ts
 *
 * Provider-neutral types for the Buildium MCP server. Buildium is a
 * property-management platform; this server is the FIRST real adapter
 * behind the `RentRollLookup` port consumed by
 * `lib/skills/property-management-rent-collection-chase` (until now that
 * port shipped ONLY its `JsonRentRollLookup` fixture — the keystone
 * "port exists, adapter does not" finding).
 *
 * Per `feedback_no_silent_vendor_lock.md`: the rest of the codebase speaks
 * THESE shapes; raw Buildium REST JSON never leaks past `server.ts`.
 *
 * Buildium REST API v1 reference (stable, sandbox-available):
 *   base   https://api.buildium.com/v1
 *   auth   headers `x-buildium-client-id` + `x-buildium-client-secret`
 *   leases GET /leases?leasestatuses=Active        → BuildiumLease[]
 *   ledger GET /leases/{id}/ledger/balances        → outstanding balance
 *   For the rent-collection use case we read active leases + their
 *   outstanding balance + the tenant contacts on each lease.
 */

import type { McpResult } from '@/lib/integrations/mcp-core';

/** A normalized Buildium lease with the fields rent-collection needs. */
export interface BuildiumLeaseSummary {
  /** Buildium lease id, stringified. */
  id: string;
  /** Display unit label assembled from property + unit number. */
  unitLabel: string;
  /** Outstanding balance in dollars (positive = past due). */
  outstandingBalance: number;
  /** ISO date the current cycle's rent was due, when Buildium reports it. */
  rentDueDate: string | null;
  /** Days the balance has been outstanding (derived from rentDueDate). */
  daysPastDue: number;
  /** Lease tenants — the first is treated as the primary leaseholder. */
  tenants: BuildiumTenant[];
  /** Whether Buildium has a payment plan / arrangement flag on the lease. */
  paymentPlanInPlace: boolean;
}

export interface BuildiumTenant {
  name: string;
  email: string | null;
  phone: string | null;
}

export interface ListDelinquentLeasesInput {
  /** Cap on leases pulled per fire. The server clamps to Buildium's page max. */
  limit?: number;
  /** As-of date used to compute daysPastDue. Defaults to now. */
  asOf?: string;
}

export interface ListDelinquentLeasesOutput {
  leases: BuildiumLeaseSummary[];
}

/**
 * Result of a Buildium connection health probe. Never throws — a failed
 * probe returns `ok:false` with the upstream error code so the fleet-health
 * cron + the customer "Test connection" surface can render a plain-language
 * status. `latencyMs` is the round-trip time of the cheap read; `lastChecked`
 * is an ISO timestamp.
 */
export interface BuildiumHealth {
  ok: boolean;
  latencyMs: number;
  lastChecked: string;
  /** Upstream McpError code when `ok` is false (e.g. UNAUTHORIZED,
   *  CREDENTIAL_NOT_FOUND, RATE_LIMITED, NETWORK). Absent when ok. */
  errorCode?: string;
  /** Human-readable detail when `ok` is false. */
  message?: string;
}

/**
 * The ONLY surface the rest of the app uses to read Buildium. Both the live
 * REST server and the fixture server implement this — the two-implementation
 * rule (`feedback_runner_portability.md`).
 */
export interface BuildiumMcpServer {
  readonly name: string;
  readonly workspaceId: string;
  listDelinquentLeases(
    input?: ListDelinquentLeasesInput,
  ): Promise<McpResult<ListDelinquentLeasesOutput>>;
  /** Cheap connection probe — hits a single tiny read (`/leases?limit=1`)
   *  and reports reachability + latency. Used by the fleet-health cron
   *  (Pillar 6) and the customer "Test connection" button. */
  healthCheck(): Promise<BuildiumHealth>;
}

export const BUILDIUM_API_BASE = 'https://api.buildium.com/v1';
