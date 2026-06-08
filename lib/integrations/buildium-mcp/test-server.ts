/**
 * lib/integrations/buildium-mcp/test-server.ts
 *
 * Fixture-backed Buildium MCP server — the second implementation that
 * satisfies the two-implementation rule (`feedback_runner_portability.md`)
 * and lets the rent-collection skill run end-to-end in dev with NO live
 * credentials. Deterministic, no network, no credential resolution.
 *
 * Default server when `BUILDIUM_ADAPTER_LIVE` is not `on` (see index.ts).
 * The fixtures span every delinquency bucket so the skill's bucketing +
 * draft + escalation paths are all exercised against real-shaped data.
 */

import { mcpOk, type McpResult } from '@/lib/integrations/mcp-core';
import {
  type BuildiumLeaseSummary,
  type BuildiumMcpServer,
  type ListDelinquentLeasesInput,
  type ListDelinquentLeasesOutput,
} from './types';

/** As-of date the fixtures are authored against (keeps daysPastDue stable). */
const FIXTURE_AS_OF = new Date('2026-06-07T12:00:00Z');

function daysAgo(n: number): string {
  return new Date(FIXTURE_AS_OF.getTime() - n * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
}

const FIXTURE_LEASES: BuildiumLeaseSummary[] = [
  {
    // 5 days past due → soft-chase bucket.
    id: '7001',
    unitLabel: '1234 Oak St #4B',
    outstandingBalance: 1850,
    rentDueDate: daysAgo(5),
    daysPastDue: 5,
    tenants: [
      { name: 'Maria Delgado', email: 'maria.delgado@example.com', phone: '(404) 555-0111' },
      { name: 'Tomas Delgado', email: 'tomas.delgado@example.com', phone: null },
    ],
    paymentPlanInPlace: false,
  },
  {
    // 9 days past due → formal-notice bucket.
    id: '7002',
    unitLabel: '88 Peachtree Pl #12',
    outstandingBalance: 2200,
    rentDueDate: daysAgo(9),
    daysPastDue: 9,
    tenants: [{ name: 'Derek Hsu', email: 'derek.hsu@example.com', phone: '(678) 555-0145' }],
    paymentPlanInPlace: false,
  },
  {
    // 21 days past due → escalation bucket (owner review).
    id: '7003',
    unitLabel: '50 Marietta Ave #2',
    outstandingBalance: 3100,
    rentDueDate: daysAgo(21),
    daysPastDue: 21,
    tenants: [{ name: 'Priya Anand', email: 'priya.anand@example.com', phone: null }],
    paymentPlanInPlace: false,
  },
  {
    // 6 days past due BUT on a payment plan → soft-chase, plan-aware tone.
    id: '7004',
    unitLabel: '12 Howell Mill Rd #7',
    outstandingBalance: 900,
    rentDueDate: daysAgo(6),
    daysPastDue: 6,
    tenants: [{ name: 'Sam Whitfield', email: 'sam.whitfield@example.com', phone: '(770) 555-0190' }],
    paymentPlanInPlace: true,
  },
];

export class TestBuildiumMcpServer implements BuildiumMcpServer {
  readonly name = 'buildium-test' as const;
  readonly workspaceId: string;

  constructor(args: { workspaceId: string }) {
    this.workspaceId = args.workspaceId;
  }

  async listDelinquentLeases(
    input: ListDelinquentLeasesInput = {},
  ): Promise<McpResult<ListDelinquentLeasesOutput>> {
    let leases = FIXTURE_LEASES;
    if (input.limit && input.limit > 0) leases = leases.slice(0, input.limit);
    return mcpOk({ leases });
  }
}
