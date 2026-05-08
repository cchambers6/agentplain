import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { __test_only } from "@/lib/auth/flows";

describe("auth flows helpers", () => {
  it("slugifies brokerage names", () => {
    assert.equal(__test_only.slugify("Acme Realty"), "acme-realty");
    assert.equal(__test_only.slugify("  Foo & Bar, LLC "), "foo-bar-llc");
    assert.equal(__test_only.slugify("Café"), "cafe");
    assert.equal(__test_only.slugify(""), "workspace");
    assert.match(__test_only.slugify("a".repeat(60)), /^a{48}$/);
  });

  it("buildVerifyUrl includes token in query string", () => {
    const oldOrigin = process.env.APP_PUBLIC_ORIGIN;
    process.env.APP_PUBLIC_ORIGIN = "https://app.agentplain.test";
    try {
      const url = __test_only.buildVerifyUrl("abc-token-123");
      assert.match(url, /^https:\/\/app\.agentplain\.test\/app\/verify\?token=abc-token-123$/);
    } finally {
      if (oldOrigin) process.env.APP_PUBLIC_ORIGIN = oldOrigin;
      else delete process.env.APP_PUBLIC_ORIGIN;
    }
  });

  it("buildVerifyUrl strips trailing slash from origin", () => {
    const oldOrigin = process.env.APP_PUBLIC_ORIGIN;
    process.env.APP_PUBLIC_ORIGIN = "https://app.agentplain.test/";
    try {
      const url = __test_only.buildVerifyUrl("t");
      assert.match(url, /^https:\/\/app\.agentplain\.test\/app\/verify\?token=t$/);
    } finally {
      if (oldOrigin) process.env.APP_PUBLIC_ORIGIN = oldOrigin;
      else delete process.env.APP_PUBLIC_ORIGIN;
    }
  });
});
