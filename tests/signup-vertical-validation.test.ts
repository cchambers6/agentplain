import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { signUpBrokerOwner } from "@/lib/auth/flows";

// These tests exercise the pure input-validation path of signUpBrokerOwner
// — the branches that throw BEFORE any DB call. Integration tests that
// actually create User/Workspace/Membership/OnboardingState rows live in
// the deploy-time smoke pass against the Vercel preview.

describe("signUpBrokerOwner input validation", () => {
  it("rejects invalid email", async () => {
    await assert.rejects(
      signUpBrokerOwner({
        email: "not-an-email",
        brokerageName: "Acme",
        vertical: "REAL_ESTATE",
      }),
      /Invalid email/,
    );
  });

  it("rejects empty brokerage name", async () => {
    await assert.rejects(
      signUpBrokerOwner({
        email: "test@example.com",
        brokerageName: " ",
        vertical: "REAL_ESTATE",
      }),
      /at least 2 characters/,
    );
  });

  it("rejects unknown vertical", async () => {
    await assert.rejects(
      signUpBrokerOwner({
        email: "test@example.com",
        brokerageName: "Acme",
        // @ts-expect-error — testing the runtime guard with an invalid value
        vertical: "MEDICAL",
      }),
      /Pick a vertical/,
    );
  });
});
