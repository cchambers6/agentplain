import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { withWorkspace } from "@/lib/auth";
import type { WorkspaceContext } from "@/lib/auth";

// withWorkspace bundles requireWorkspaceMember + workspace load + RLS ctx.
// Integration tests against a real DB live in the deploy-time smoke pass;
// here we pin the public surface so a refactor doesn't quietly drop the
// RLS context or membership assertion.

describe("withWorkspace surface", () => {
  it("is exported from @/lib/auth", () => {
    assert.equal(typeof withWorkspace, "function");
  });

  it("WorkspaceContext type carries member + workspace + rls", () => {
    // Compile-time pin via type satisfaction.
    const ctx: WorkspaceContext = {
      member: {
        userId: "u",
        email: "e@x.test",
        workspaceId: "w",
        role: "BROKER_OWNER",
        isOperator: false,
      },
      workspace: {
        id: "w",
        name: "Acme",
        slug: "acme",
        tier: "HIGH_TOUCH",
        verticalTier: "REGULAR",
        vertical: "REAL_ESTATE",
        stateCode: "GA",
        billingMode: "MANUAL_INVOICE",
        stripeCustomerId: null,
        stripeSubscriptionId: null,
        tierPriceUsdMonthly: null,
        settings: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      rls: { userId: "u", workspaceId: "w", isOperator: false },
    };
    assert.equal(ctx.member.role, "BROKER_OWNER");
    assert.equal(ctx.workspace.vertical, "REAL_ESTATE");
    assert.equal(ctx.workspace.verticalTier, "REGULAR");
    assert.equal(ctx.rls.isOperator, false);
  });
});
