/**
 * lib/integrations/approval/approval-gate-memory.ts
 *
 * In-memory `ConnectorApprovalGate` + `ConnectorActionAuditSink` — the
 * deterministic, no-DB implementations that satisfy the two-implementation
 * rule (`feedback_runner_portability.md`) alongside the Prisma versions. They
 * back the connector smoke tests and the `INTEGRATIONS_PROVIDER=test` server.
 *
 * The gate does NOT mint approvals on its own — grants must be seeded
 * explicitly. An empty gate therefore blocks every write, which is the correct
 * default: a test (or preview) must opt into a grant exactly as a real
 * operator must approve on /approvals.
 */

import { mcpOk, type McpResult } from '@/lib/integrations/mcp-core';
import {
  approvalRequired,
  fingerprintAction,
  type ConnectorActionAuditEntry,
  type ConnectorActionAuditSink,
  type ConnectorApprovalGate,
  type ConnectorApprovalGrant,
  type GatedAction,
} from './with-approval';

type Status = 'PENDING' | 'APPROVED' | 'REJECTED';

interface StoredGrant {
  pendingApprovalId: string;
  workspaceId: string;
  connector: string;
  action: string;
  fingerprint: string;
  status: Status;
  approvedByUserId: string | null;
  approvedAt: string | null;
  expiresAt: string | null;
}

export interface SeedGrantArgs {
  pendingApprovalId: string;
  workspaceId: string;
  /** The exact action the operator approved — its fingerprint is bound in. */
  action: GatedAction;
  approvedByUserId?: string;
  /** ISO timestamp; omit for no expiry. */
  expiresAt?: string;
}

export class InMemoryConnectorApprovalGate implements ConnectorApprovalGate {
  private readonly grants = new Map<string, StoredGrant>();
  private readonly now: () => number;

  constructor(opts?: { now?: () => number }) {
    this.now = opts?.now ?? Date.now;
  }

  /** Seed an operator-approved grant. */
  seedApproved(args: SeedGrantArgs): void {
    this.put(args, 'APPROVED');
  }

  /** Seed a still-pending request (operator has not yet decided). */
  seedPending(args: SeedGrantArgs): void {
    this.put(args, 'PENDING');
  }

  /** Seed a rejected request. */
  seedRejected(args: SeedGrantArgs): void {
    this.put(args, 'REJECTED');
  }

  private put(args: SeedGrantArgs, status: Status): void {
    this.grants.set(args.pendingApprovalId, {
      pendingApprovalId: args.pendingApprovalId,
      workspaceId: args.workspaceId,
      connector: args.action.connector,
      action: args.action.action,
      fingerprint: fingerprintAction(args.action),
      status,
      approvedByUserId: status === 'APPROVED' ? (args.approvedByUserId ?? null) : null,
      approvedAt: status === 'APPROVED' ? new Date(this.now()).toISOString() : null,
      expiresAt: args.expiresAt ?? null,
    });
  }

  async check(args: {
    workspaceId: string;
    action: GatedAction;
  }): Promise<McpResult<ConnectorApprovalGrant>> {
    const { workspaceId, action } = args;
    const id = action.pendingApprovalId;
    const label = `${action.connector}.${action.action}`;

    if (!id) {
      return approvalRequired(
        `${label} requires operator approval before it can run. No approval token was provided.`,
      );
    }
    const record = this.grants.get(id);
    if (!record) {
      return approvalRequired(`${label} approval ${id} was not found.`, id);
    }
    if (
      record.workspaceId !== workspaceId ||
      record.connector !== action.connector ||
      record.action !== action.action
    ) {
      return approvalRequired(
        `${label} approval ${id} does not match this workspace or action.`,
        id,
      );
    }
    if (record.fingerprint !== fingerprintAction(action)) {
      return approvalRequired(
        `${label} approval ${id} was granted for a different payload — re-request approval.`,
        id,
      );
    }
    if (record.status !== 'APPROVED') {
      return approvalRequired(
        `${label} approval ${id} is ${record.status.toLowerCase()}, not approved.`,
        id,
      );
    }
    if (record.expiresAt && this.now() > Date.parse(record.expiresAt)) {
      return approvalRequired(
        `${label} approval ${id} expired at ${record.expiresAt} — re-request approval.`,
        id,
      );
    }
    return mcpOk({
      pendingApprovalId: record.pendingApprovalId,
      approvedByUserId: record.approvedByUserId,
      approvedAt: record.approvedAt,
      expiresAt: record.expiresAt,
    });
  }
}

/** In-memory audit sink — records every executed write for test assertions. */
export class InMemoryConnectorActionAuditSink implements ConnectorActionAuditSink {
  readonly entries: ConnectorActionAuditEntry[] = [];

  async record(entry: ConnectorActionAuditEntry): Promise<void> {
    this.entries.push(entry);
  }
}
