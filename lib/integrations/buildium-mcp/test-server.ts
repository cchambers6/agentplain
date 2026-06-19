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

import { mcpError, mcpOk, type McpResult } from '@/lib/integrations/mcp-core';
import {
  type BuildiumHealth,
  type BuildiumLeaseSummary,
  type BuildiumMcpServer,
  type ListDelinquentLeasesInput,
  type ListDelinquentLeasesOutput,
} from './types';
import type {
  CreateWorkOrderInput,
  CreateWorkOrderOutput,
  ChargeLateFeeInput,
  ChargeLateFeeOutput,
  PostNoticeInput,
  PostNoticeOutput,
  SendTenantMsgInput,
  SendTenantMsgOutput,
} from './actions';

/** One recorded write-side call captured by the fixture server for assertions. */
export interface RecordedBuildiumCall {
  tool: 'createWorkOrder' | 'chargeLateFee' | 'postNotice' | 'sendTenantMsg';
  input: unknown;
}

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
  /** Write-side calls captured for test assertions (canned success). */
  readonly calls: RecordedBuildiumCall[] = [];
  private nextId = 8000;

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

  async healthCheck(): Promise<BuildiumHealth> {
    // Fixtures are always reachable — the probe reports healthy with a small
    // deterministic latency so dev/tests exercise the green path.
    return { ok: true, latencyMs: 1, lastChecked: new Date().toISOString() };
  }

  // ── Write actions (recorded; canned success) ─────────────────────────────

  async createWorkOrder(
    input: CreateWorkOrderInput,
  ): Promise<McpResult<CreateWorkOrderOutput>> {
    this.calls.push({ tool: 'createWorkOrder', input });
    if (!input.title) return mcpError('INVALID_ARGUMENT', 'createWorkOrder requires a title');
    return mcpOk({ workOrderId: `wo-${this.nextId++}` });
  }

  async chargeLateFee(
    input: ChargeLateFeeInput,
  ): Promise<McpResult<ChargeLateFeeOutput>> {
    this.calls.push({ tool: 'chargeLateFee', input });
    if (!(input.amount > 0)) return mcpError('INVALID_ARGUMENT', 'chargeLateFee requires a positive amount');
    return mcpOk({ transactionId: `txn-${this.nextId++}` });
  }

  async postNotice(input: PostNoticeInput): Promise<McpResult<PostNoticeOutput>> {
    this.calls.push({ tool: 'postNotice', input });
    if (!input.subject) return mcpError('INVALID_ARGUMENT', 'postNotice requires a subject');
    return mcpOk({ noticeId: `notice-${this.nextId++}` });
  }

  async sendTenantMsg(
    input: SendTenantMsgInput,
  ): Promise<McpResult<SendTenantMsgOutput>> {
    this.calls.push({ tool: 'sendTenantMsg', input });
    if (!input.tenantId) return mcpError('INVALID_ARGUMENT', 'sendTenantMsg requires a tenantId');
    return mcpOk({ messageId: `msg-${this.nextId++}` });
  }
}
