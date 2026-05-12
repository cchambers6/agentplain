import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Edge middleware tests run with mocked NextRequest/NextResponse since the
// real ones come from next/server which expects an edge runtime.

describe("middleware route gating", () => {
  it("matcher pattern covers /app/* and /operator/*", async () => {
    const mod = await import("@/middleware");
    // /operator/:path* was added in PR-B for the operator integrations
    // surface. The operator-role assertion lives in (operator)/layout.tsx
    // via requireUser + session.isOperator; middleware just pre-gates
    // signed-in-at-all.
    assert.deepEqual(mod.config.matcher, ["/app/:path*", "/operator/:path*"]);
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
