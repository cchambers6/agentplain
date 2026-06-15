/**
 * lib/integrations/docusign-mcp/approval-gate-memory.ts
 *
 * In-memory `DocuSignApprovalGate` — the deterministic, no-DB implementation
 * that satisfies the two-implementation rule alongside the Prisma gate
 * (`feedback_runner_portability.md`). It backs the smoke test and the
 * `INTEGRATIONS_PROVIDER=test` preview server.
 *
 * It does NOT mint approvals on its own — grants must be seeded explicitly
 * (`seedApproved` / `seedPending`). An empty gate therefore blocks every
 * send/void, which is the correct default: a preview or test must opt in to a
 * grant exactly as a real operator must approve on /approvals.
 */

import { mcpOk, type McpResult } from '@/lib/integrations/mcp-core';
import {
  approvalRequired,
  fingerprintAction,
  type DocuSignApprovalGate,
  type DocuSignApprovalGrant,
  type DocuSignGatedAction,
} from './with-approval';

type Status = 'PENDING' | 'APPROVED' | 'REJECTED';

interface StoredGrant {
  pendingApprovalId: string;
  workspaceId: string;
  type: 'send' | 'void';
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
  action: DocuSignGatedAction;
  approvedByUserId?: string;
  /** ISO timestamp; omit for no expiry. */
  expiresAt?: string;
}

export class InMemoryDocuSignApprovalGate implements DocuSignApprovalGate {
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
      type: args.action.type,
      fingerprint: fingerprintAction(args.action),
      status,
      approvedByUserId: status === 'APPROVED' ? (args.approvedByUserId ?? null) : null,
      approvedAt: status === 'APPROVED' ? new Date(this.now()).toISOString() : null,
      expiresAt: args.expiresAt ?? null,
    });
  }

  async check(args: {
    workspaceId: string;
    action: DocuSignGatedAction;
  }): Promise<McpResult<DocuSignApprovalGrant>> {
    const { workspaceId, action } = args;
    const id = action.pendingApprovalId;
    const verb = action.type === 'send' ? 'send' : 'void';

    if (!id) {
      return approvalRequired(
        `DocuSign ${verb} requires operator approval before it can run. No approval token was provided.`,
      );
    }
    const record = this.grants.get(id);
    if (!record) {
      return approvalRequired(`DocuSign ${verb} approval ${id} was not found.`, id);
    }
    if (record.workspaceId !== workspaceId || record.type !== action.type) {
      return approvalRequired(
        `DocuSign ${verb} approval ${id} does not match this workspace or action.`,
        id,
      );
    }
    if (record.fingerprint !== fingerprintAction(action)) {
      return approvalRequired(
        `DocuSign ${verb} approval ${id} was granted for a different envelope — re-request approval.`,
        id,
      );
    }
    if (record.status !== 'APPROVED') {
      return approvalRequired(
        `DocuSign ${verb} approval ${id} is ${record.status.toLowerCase()}, not approved.`,
        id,
      );
    }
    if (record.expiresAt && this.now() > Date.parse(record.expiresAt)) {
      return approvalRequired(
        `DocuSign ${verb} approval ${id} expired at ${record.expiresAt} — re-request approval.`,
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
