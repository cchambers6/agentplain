import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isDemoMode } from "./demo-mode";

describe("demo-mode", () => {
  it("is demo mode when there is no real work", () => {
    assert.equal(
      isDemoMode({ pendingApprovals: 0, recentHandoffsCount: 0 }),
      true,
    );
  });

  it("steps aside once a draft is pending", () => {
    assert.equal(
      isDemoMode({ pendingApprovals: 1, recentHandoffsCount: 0 }),
      false,
    );
  });

  it("steps aside once a handoff has landed", () => {
    assert.equal(
      isDemoMode({ pendingApprovals: 0, recentHandoffsCount: 3 }),
      false,
    );
  });
});
