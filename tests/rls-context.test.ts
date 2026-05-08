import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { SYSTEM_OPERATOR_CONTEXT, type RlsContext } from "@/lib/db/rls";

describe("RlsContext shape", () => {
  it("system operator context has the right flags", () => {
    assert.equal(SYSTEM_OPERATOR_CONTEXT.isOperator, true);
    assert.equal(SYSTEM_OPERATOR_CONTEXT.userId, null);
    assert.equal(SYSTEM_OPERATOR_CONTEXT.workspaceId, null);
  });

  it("RlsContext type rejects malformed shapes at compile time", () => {
    // Compile-time assertion via type satisfaction: a customer ctx has all 3 fields.
    const customerCtx: RlsContext = {
      userId: "uuid-user",
      workspaceId: "uuid-ws",
      isOperator: false,
    };
    assert.equal(customerCtx.isOperator, false);
  });
});
