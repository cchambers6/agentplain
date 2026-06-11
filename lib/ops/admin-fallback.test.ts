/**
 * lib/ops/admin-fallback.test.ts
 *
 * The last-resort human address. Bar (Conner-dead P0 #1): there is no env
 * state in which the fleet has nobody to page.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  resolveAdminFallbackEmail,
  hasConfiguredHuman,
  HARDCODED_ADMIN_FALLBACK_EMAIL,
} from "./admin-fallback";

function env(vars: Record<string, string>): NodeJS.ProcessEnv {
  return vars as unknown as NodeJS.ProcessEnv;
}

describe("resolveAdminFallbackEmail", () => {
  it("returns the baked-in default when nothing is configured", () => {
    assert.equal(resolveAdminFallbackEmail(env({})), HARDCODED_ADMIN_FALLBACK_EMAIL);
  });

  it("prefers ADMIN_FALLBACK_EMAIL when set", () => {
    assert.equal(
      resolveAdminFallbackEmail(env({ ADMIN_FALLBACK_EMAIL: "ops@agentplain.com" })),
      "ops@agentplain.com",
    );
  });

  it("trims and falls back to the default on a blank value", () => {
    assert.equal(
      resolveAdminFallbackEmail(env({ ADMIN_FALLBACK_EMAIL: "   " })),
      HARDCODED_ADMIN_FALLBACK_EMAIL,
    );
  });

  it("NEVER returns empty (the load-bearing invariant)", () => {
    for (const e of [
      env({}),
      env({ ADMIN_FALLBACK_EMAIL: "" }),
      env({ ADMIN_FALLBACK_EMAIL: "  " }),
      env({ FLEET_TRUSTED_HUMAN_EMAIL: "", OPERATOR_EMAIL_ALLOWLIST: "" }),
    ]) {
      const r = resolveAdminFallbackEmail(e);
      assert.ok(r.length > 0, "last-resort email must never be empty");
    }
  });
});

describe("hasConfiguredHuman", () => {
  it("false when no operator routing is set", () => {
    assert.equal(hasConfiguredHuman(env({})), false);
  });

  it("false when only ADMIN_FALLBACK_EMAIL is set (last resort is not real routing)", () => {
    assert.equal(
      hasConfiguredHuman(env({ ADMIN_FALLBACK_EMAIL: "ops@agentplain.com" })),
      false,
    );
  });

  it("true when FLEET_TRUSTED_HUMAN_EMAIL is set", () => {
    assert.equal(
      hasConfiguredHuman(env({ FLEET_TRUSTED_HUMAN_EMAIL: "ops@agentplain.com" })),
      true,
    );
  });

  it("true when OPERATOR_EMAIL_ALLOWLIST is set", () => {
    assert.equal(
      hasConfiguredHuman(env({ OPERATOR_EMAIL_ALLOWLIST: "conner@example.com" })),
      true,
    );
  });
});
