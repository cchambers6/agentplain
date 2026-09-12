// GET /api/health/ready — READINESS. Makes a database call. GUARDED.
//
// Split out of `/api/health` so that dependency checking is no longer on
// the path an external uptime monitor hits every 60 seconds. See the
// header of `../route.ts` for the full cost argument; the short version:
//
//   Neon Free autosuspends after 5 minutes (fixed, not configurable) and
//   bills a 0.25 CU floor while awake. A frequent probe that touches the
//   DB never lets compute idle out — 0.25 x 730 h = 182.5 CU-hr against a
//   100 CU-hr/month allowance. Production exhausted at 110.08/100 and the
//   project was paused.
//
// ── Why this route requires a token ───────────────────────────────────────
//
// Moving the DB check to a new unauthenticated path would have solved
// nothing: anything on the internet — including a monitor someone
// configures later, pointing at the "better" health URL — could put the
// database straight back under a permanent wake load. The cost problem is
// caused by FREQUENCY, not by which path is frequent.
//
// So this route FAILS CLOSED. With `HEALTH_READY_TOKEN` unset it returns
// 503 "unconfigured" WITHOUT touching the database. That is deliberate:
// an unconfigured readiness probe costs nothing, and a fail-open default
// is exactly how the original route became a standing charge.
//
// Set `HEALTH_READY_TOKEN` in the Vercel project and call with:
//
//   curl -H "x-health-token: <token>" https://agentplain.com/api/health/ready
//
// Intended callers: post-deploy verification (a human or a deploy step
// following docs/runbooks/go-live-prod-credentials.md), and on-demand
// operator triage. NOT an uptime monitor — point that at `/api/health`.
//
// Response shape is the one `/api/health` used to return, so existing
// runbooks and any saved parsing still apply:
//
//   200 { "status": "ok",       "checks": { "db": {...}, "inngest": {...} }, ... }
//   503 { "status": "degraded", ... }                 — a dependency failed
//   503 { "status": "unconfigured" }                  — no token set
//   401 { "status": "unauthorized" }                  — bad/missing token

import { type NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/db/prisma";
import { env } from "@/lib/env";
import { getLogger } from "@/lib/observability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface CheckOk {
  ok: true;
  [key: string]: unknown;
}
interface CheckFail {
  ok: false;
  error: string;
}
type Check = CheckOk | CheckFail;

const NO_STORE = { "Cache-Control": "no-store, max-age=0" } as const;

async function checkDatabase(): Promise<Check> {
  const start = Date.now();
  try {
    // SELECT 1 — cheapest round-trip. Goes through the pool, so pool
    // exhaustion shows up here too.
    await prisma.$queryRawUnsafe("SELECT 1");
    return { ok: true, latency_ms: Date.now() - start };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const short = message.split("\n")[0]?.slice(0, 200) ?? "db error";
    return { ok: false, error: short };
  }
}

async function checkInngestMount(): Promise<Check> {
  // Import the serve route module and confirm it exposes handlers, rather
  // than making a self HTTP request (which would hairpin on Vercel).
  try {
    const mod = (await import("../../inngest/route")) as Record<string, unknown>;
    const hasHandlers =
      typeof mod.GET === "function" &&
      typeof mod.POST === "function" &&
      typeof mod.PUT === "function";
    if (!hasHandlers) return { ok: false, error: "inngest handlers missing" };
    return { ok: true, mounted: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message.slice(0, 200) };
  }
}

/** Length-checked, constant-time-ish compare. */
function tokenMatches(provided: string, expected: string): boolean {
  if (provided.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < provided.length; i++) {
    diff |= provided.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return diff === 0;
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const expected = process.env.HEALTH_READY_TOKEN ?? "";

  // FAIL CLOSED, and before any DB work. An unconfigured probe must cost
  // nothing — that is the entire point of this route.
  if (expected.length === 0) {
    return NextResponse.json(
      {
        status: "unconfigured",
        hint: "Set HEALTH_READY_TOKEN to enable the readiness probe. Liveness is at /api/health.",
      },
      { status: 503, headers: NO_STORE },
    );
  }

  // `headers.get()` returns "" for a present-but-empty header. Compare
  // against the expected value explicitly rather than testing truthiness —
  // a blank header has previously escalated privilege elsewhere in this
  // codebase, so never let an empty string pass a check.
  const provided = req.headers.get("x-health-token") ?? "";
  if (!tokenMatches(provided, expected)) {
    return NextResponse.json(
      { status: "unauthorized" },
      { status: 401, headers: NO_STORE },
    );
  }

  const [db, inngest] = await Promise.all([
    checkDatabase(),
    checkInngestMount(),
  ]);

  const ok = db.ok && inngest.ok;
  const body = {
    status: ok ? ("ok" as const) : ("degraded" as const),
    uptime_s: Math.round(process.uptime()),
    checks: { app: { ok: true as const }, db, inngest },
    env: env.sentryEnvironment(),
    version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) ?? "dev",
  };

  // Logged (unlike liveness) because this route is low-volume by
  // construction — every call is a deploy check or a human triaging.
  const logger = getLogger().child({ boundary: "health.ready" });
  if (ok) {
    logger.info("readiness ok");
  } else {
    logger.warn("readiness degraded", {
      db_ok: db.ok,
      inngest_ok: inngest.ok,
      db_error: db.ok ? undefined : db.error,
      inngest_error: inngest.ok ? undefined : inngest.error,
    });
  }

  return NextResponse.json(body, {
    status: ok ? 200 : 503,
    headers: NO_STORE,
  });
}
