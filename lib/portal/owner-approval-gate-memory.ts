/**
 * lib/portal/owner-approval-gate-memory.ts
 *
 * In-memory OwnerApprovalGate for unit tests + DB-free smoke paths. Models the
 * exact PENDING → APPROVED/REJECTED → (re-check) lifecycle of the Prisma gate
 * without a database, so a test can: draft (gate opens a PENDING request),
 * simulate the owner approving (or rejecting), and re-check the grant — and
 * assert the same fingerprint-bound, TTL-scoped behavior the production gate
 * enforces.
 */

import {
  approvalGranted,
  approvalRequired,
  fingerprintPortalMessage,
  type OwnerApprovalDecision,
  type OwnerApprovalGate,
  type PortalOutgoingMessage,
} from "./with-owner-approval";

export const MEMORY_PORTAL_APPROVAL_TTL_MS = 24 * 60 * 60 * 1000;

interface Row {
  id: string;
  workspaceId: string;
  fingerprint: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | "EXPIRED";
  decidedAtMs: number | null;
  decidedByUserId: string | null;
}

export class MemoryOwnerApprovalGate implements OwnerApprovalGate {
  private readonly rows = new Map<string, Row>();
  private seq = 0;
  private readonly now: () => number;

  constructor(options: { now?: () => number } = {}) {
    this.now = options.now ?? Date.now;
  }

  /** Test helper — approve a pending row as if the owner clicked approve. */
  approve(id: string, userId = "owner-user"): void {
    const row = this.rows.get(id);
    if (!row) throw new Error(`no such approval row: ${id}`);
    row.status = "APPROVED";
    row.decidedAtMs = this.now();
    row.decidedByUserId = userId;
  }

  /** Test helper — reject a pending row. */
  reject(id: string): void {
    const row = this.rows.get(id);
    if (!row) throw new Error(`no such approval row: ${id}`);
    row.status = "REJECTED";
    row.decidedAtMs = this.now();
  }

  /** Test helper — inspect a row. */
  get(id: string): Row | undefined {
    return this.rows.get(id);
  }

  async check(args: {
    workspaceId: string;
    portalConfigId: string;
    action: PortalOutgoingMessage;
  }): Promise<OwnerApprovalDecision> {
    const { workspaceId, action } = args;
    const fingerprint = fingerprintPortalMessage(action);

    if (action.pendingApprovalId) {
      const row = this.rows.get(action.pendingApprovalId);
      if (row && row.workspaceId === workspaceId && row.status === "APPROVED") {
        if (row.fingerprint !== fingerprint) {
          return approvalRequired(
            "Approval was granted for a different message — re-request approval.",
            row.id,
          );
        }
        const expiresMs =
          row.decidedAtMs !== null
            ? row.decidedAtMs + MEMORY_PORTAL_APPROVAL_TTL_MS
            : null;
        if (expiresMs !== null && this.now() > expiresMs) {
          row.status = "EXPIRED";
          return approvalRequired("Approval expired — re-request approval.", row.id);
        }
        return approvalGranted({
          pendingApprovalId: row.id,
          approvedByUserId: row.decidedByUserId,
          approvedAt: row.decidedAtMs !== null ? new Date(row.decidedAtMs).toISOString() : null,
          expiresAt: expiresMs !== null ? new Date(expiresMs).toISOString() : null,
        });
      }
      if (row && row.status === "PENDING") {
        return approvalRequired("Still awaiting your decision.", row.id);
      }
    }

    for (const row of this.rows.values()) {
      if (
        row.workspaceId === workspaceId &&
        row.fingerprint === fingerprint &&
        row.status === "PENDING"
      ) {
        return approvalRequired(
          "This message to your client needs your approval before it's sent.",
          row.id,
        );
      }
    }

    const id = `mem-approval-${++this.seq}`;
    this.rows.set(id, {
      id,
      workspaceId,
      fingerprint,
      status: "PENDING",
      decidedAtMs: null,
      decidedByUserId: null,
    });
    return approvalRequired(
      "This message to your client needs your approval before it's sent.",
      id,
    );
  }
}
