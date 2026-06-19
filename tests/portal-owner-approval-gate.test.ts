// Owner-approval gate contract — the load-bearing invariant of the client
// portal: a message Plaino drafts to an end client is NEVER deliverable until
// the owner approves the EXACT message. Tested against the in-memory gate
// (DB-free), which mirrors the Prisma gate's lifecycle, plus the pure
// fingerprint + visibility helpers that the read path enforces.

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { MemoryOwnerApprovalGate } from "@/lib/portal/owner-approval-gate-memory";
import {
  fingerprintPortalMessage,
  isPortalMessageVisibleToClient,
  type PortalOutgoingMessage,
} from "@/lib/portal/with-owner-approval";

const base = (overrides: Partial<PortalOutgoingMessage> = {}): PortalOutgoingMessage => ({
  threadId: "thread-1",
  toClientEmail: "dana@example.com",
  body: "Thanks for reaching out — here's an update.",
  ...overrides,
});

const ARGS = (action: PortalOutgoingMessage) => ({
  workspaceId: "ws-1",
  portalConfigId: "cfg-1",
  action,
});

describe("portal owner-approval gate", () => {
  it("opens a PENDING request and refuses delivery on the first attempt", async () => {
    const gate = new MemoryOwnerApprovalGate();
    const decision = await gate.check(ARGS(base()));
    assert.equal(decision.ok, false);
    assert.ok(!decision.ok && decision.pendingApprovalId, "names the pending request");
  });

  it("dedupes repeated drafts of the same message to one request", async () => {
    const gate = new MemoryOwnerApprovalGate();
    const first = await gate.check(ARGS(base()));
    const second = await gate.check(ARGS(base()));
    assert.equal(first.ok, false);
    assert.equal(second.ok, false);
    assert.ok(!first.ok && !second.ok);
    assert.equal(
      !first.ok ? first.pendingApprovalId : null,
      !second.ok ? second.pendingApprovalId : null,
      "same fingerprint reuses the same PENDING row",
    );
  });

  it("grants delivery only after the owner approves the exact message", async () => {
    const gate = new MemoryOwnerApprovalGate();
    const opened = await gate.check(ARGS(base()));
    assert.ok(!opened.ok);
    const id = opened.pendingApprovalId!;

    // Still pending → still refused.
    const pending = await gate.check(ARGS(base({ pendingApprovalId: id })));
    assert.equal(pending.ok, false);

    // Owner approves → re-check with the same action grants.
    gate.approve(id);
    const granted = await gate.check(ARGS(base({ pendingApprovalId: id })));
    assert.equal(granted.ok, true);
    assert.ok(granted.ok && granted.grant.pendingApprovalId === id);
  });

  it("refuses to replay an approval onto a DIFFERENT message", async () => {
    const gate = new MemoryOwnerApprovalGate();
    const opened = await gate.check(ARGS(base()));
    const id = (opened as { pendingApprovalId: string }).pendingApprovalId;
    gate.approve(id);

    // Same approval id, but the body changed → fingerprint mismatch → refused.
    const tampered = await gate.check(
      ARGS(base({ pendingApprovalId: id, body: "Wire $5,000 to this account." })),
    );
    assert.equal(tampered.ok, false);
  });

  it("re-opens a request after the owner rejects", async () => {
    const gate = new MemoryOwnerApprovalGate();
    const opened = await gate.check(ARGS(base()));
    const id = (opened as { pendingApprovalId: string }).pendingApprovalId;
    gate.reject(id);

    const reopened = await gate.check(ARGS(base()));
    assert.equal(reopened.ok, false);
    assert.notEqual((reopened as { pendingApprovalId: string }).pendingApprovalId, id);
  });

  it("expires a grant after the 24h TTL", async () => {
    let now = 1_000_000;
    const gate = new MemoryOwnerApprovalGate({ now: () => now });
    const opened = await gate.check(ARGS(base()));
    const id = (opened as { pendingApprovalId: string }).pendingApprovalId;
    gate.approve(id);

    // Within TTL → granted.
    now += 60 * 60 * 1000; // +1h
    const ok = await gate.check(ARGS(base({ pendingApprovalId: id })));
    assert.equal(ok.ok, true);

    // Past TTL → refused.
    now += 24 * 60 * 60 * 1000; // +24h
    const expired = await gate.check(ARGS(base({ pendingApprovalId: id })));
    assert.equal(expired.ok, false);
  });

  it("fingerprint is recipient-case-insensitive but body-sensitive", () => {
    assert.equal(
      fingerprintPortalMessage(base({ toClientEmail: "Dana@Example.com" })),
      fingerprintPortalMessage(base({ toClientEmail: "dana@example.com" })),
    );
    assert.notEqual(
      fingerprintPortalMessage(base({ body: "A" })),
      fingerprintPortalMessage(base({ body: "B" })),
    );
  });
});

describe("portal message visibility invariant", () => {
  it("always shows the client their own messages", () => {
    assert.equal(isPortalMessageVisibleToClient({ sender: "CLIENT", approvalStatus: null }), true);
  });

  it("hides PLAINO/OWNER messages unless the approval is APPROVED", () => {
    for (const sender of ["PLAINO", "OWNER"] as const) {
      assert.equal(isPortalMessageVisibleToClient({ sender, approvalStatus: null }), false);
      assert.equal(isPortalMessageVisibleToClient({ sender, approvalStatus: "PENDING" }), false);
      assert.equal(isPortalMessageVisibleToClient({ sender, approvalStatus: "REJECTED" }), false);
      assert.equal(isPortalMessageVisibleToClient({ sender, approvalStatus: "EXPIRED" }), false);
      assert.equal(isPortalMessageVisibleToClient({ sender, approvalStatus: "APPROVED" }), true);
    }
  });
});
