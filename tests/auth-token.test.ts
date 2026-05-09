import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  generateRawToken,
  hashToken,
  tokenExpiresAt,
  MAGIC_LINK_TTL_MINUTES,
} from "@/lib/auth";

describe("auth token discipline", () => {
  it("generates 32-byte base64url tokens", () => {
    const t = generateRawToken();
    // base64url of 32 bytes is 43 chars (no padding).
    assert.equal(t.length, 43);
    assert.match(t, /^[A-Za-z0-9_-]+$/);
  });

  it("generates unique tokens", () => {
    const a = generateRawToken();
    const b = generateRawToken();
    assert.notEqual(a, b);
  });

  it("hashes deterministically", () => {
    const t = generateRawToken();
    const h1 = hashToken(t);
    const h2 = hashToken(t);
    assert.equal(h1, h2);
    assert.equal(h1.length, 64); // sha256 hex
  });

  it("hashes different tokens differently", () => {
    const a = generateRawToken();
    const b = generateRawToken();
    assert.notEqual(hashToken(a), hashToken(b));
  });

  it("computes expiry 15 min in the future", () => {
    const now = new Date(2026, 0, 1, 12, 0, 0);
    const exp = tokenExpiresAt(now);
    const deltaMs = exp.getTime() - now.getTime();
    assert.equal(deltaMs, MAGIC_LINK_TTL_MINUTES * 60 * 1000);
  });
});
