/**
 * tests/operator-impersonation.test.ts
 *
 * The read-only impersonation + export contract
 * (`lib/operator/impersonation.ts`). Two load-bearing guarantees:
 *
 *   1. Only an operator session reaches the impersonation/export surfaces —
 *      `assertOperatorAccess` throws for everyone else. This is the guard the
 *      operator routes lean on (the routes additionally redirect non-operator
 *      page loads; the actions/route handlers throw via this).
 *   2. Every entry/export builds a well-formed AuditLog row scoped to the
 *      workspace, so impersonation is never silent.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  assertOperatorAccess,
  buildExportAuditEntry,
  buildImpersonationAuditEntry,
  EXPORT_AUDIT_ACTION,
  IMPERSONATION_AUDIT_ACTION,
  OperatorAccessError,
} from "@/lib/operator/impersonation";

describe("assertOperatorAccess", () => {
  it("passes for an operator session", () => {
    assert.doesNotThrow(() => assertOperatorAccess({ isOperator: true }));
  });

  it("throws OperatorAccessError for a non-operator session", () => {
    assert.throws(() => assertOperatorAccess({ isOperator: false }), OperatorAccessError);
  });

  it("throws for a missing/empty session (no implicit allow)", () => {
    assert.throws(() => assertOperatorAccess(null), OperatorAccessError);
    assert.throws(() => assertOperatorAccess(undefined), OperatorAccessError);
    assert.throws(() => assertOperatorAccess({}), OperatorAccessError);
  });
});

const INPUT = {
  operatorUserId: "op-1",
  workspaceId: "ws-9",
  workspaceName: "Peachtree Realty",
  workspaceSlug: "peachtree-realty",
};

describe("buildImpersonationAuditEntry", () => {
  it("builds a workspace-scoped read-only audit row", () => {
    const entry = buildImpersonationAuditEntry(INPUT);
    assert.equal(entry.actorUserId, "op-1");
    assert.equal(entry.workspaceId, "ws-9");
    assert.equal(entry.action, IMPERSONATION_AUDIT_ACTION);
    assert.equal(entry.targetTable, "Workspace");
    assert.equal(entry.targetId, "ws-9");
    const payload = entry.payload as Record<string, unknown>;
    assert.equal(payload.mode, "read-only");
    assert.equal(payload.workspaceSlug, "peachtree-realty");
  });
});

describe("buildExportAuditEntry", () => {
  it("builds a workspace-scoped export audit row", () => {
    const entry = buildExportAuditEntry(INPUT);
    assert.equal(entry.actorUserId, "op-1");
    assert.equal(entry.action, EXPORT_AUDIT_ACTION);
    assert.equal(entry.targetId, "ws-9");
    const payload = entry.payload as Record<string, unknown>;
    assert.equal(payload.workspaceName, "Peachtree Realty");
  });
});
