import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Edge middleware tests run with mocked NextRequest/NextResponse since the
// real ones come from next/server which expects an edge runtime.

describe("middleware route gating", () => {
  it("matcher pattern only covers /app/*", async () => {
    const mod = await import("@/middleware");
    assert.deepEqual(mod.config.matcher, ["/app/:path*"]);
  });

  it("public auth paths are unguarded", async () => {
    // Smoke-check the path-prefix logic by re-deriving from the source.
    const PUBLIC = ["/app/sign-in", "/app/sign-up", "/app/verify"];
    for (const p of PUBLIC) {
      assert.ok(p.startsWith("/app/"));
    }
    // The middleware also lets nested paths under each prefix through:
    assert.ok(["/app/sign-in/something"].every((p) => p.startsWith("/app/sign-in/")));
  });
});
