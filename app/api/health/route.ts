// GET /api/health — LIVENESS ONLY. Makes NO database call.
//
// ── Why this route has no DB check ────────────────────────────────────────
//
// This is the path documented for an external uptime monitor
// (docs/runtime-alerting-2026-05-18.md tells the operator to point Better
// Stack / UptimeRobot at `https://agentplain.com/api/health` on a 1-5
// minute cadence). That makes it, by design, the single most frequently
// hit route in the product.
//
// It previously ran `SELECT 1` on EVERY request, and the header comment
// above it claimed the route was "intentionally cheap so a 1-minute
// external probe doesn't move the DB needle." On the production Neon
// plan that claim is false, and inverted:
//
//   * Neon Free scale-to-zero is 5 minutes, fixed, and cannot be disabled.
//   * The compute floor is 0.25 CU.
//   * 0.25 CU x 730 h = 182.5 CU-hr for continuous uptime.
//   * The Free allowance is 100 CU-hr per project per month.
//
// So a 1-minute probe against a DB-touching liveness route never lets
// compute idle out. It alone costs ~182.5 CU-hr/month — more than the
// entire monthly allowance — while reporting "ok". Production exhausted
// its allowance at 110.08/100 CU-hr and the project was paused.
//
// A liveness probe answers ONE question: "is this process serving HTTP?"
// It does not need the database to answer that. Dependency state is a
// READINESS question and lives at `/api/health/ready`.
//
// ── What still works ──────────────────────────────────────────────────────
//
// The response keeps the same top-level shape (`status`, `uptime_s`,
// `checks`, `env`, `version`) so an already-configured monitor keeps
// parsing it. `checks.db` and `checks.inngest` are no longer reported
// here — see `/api/health/ready`.
//
// Still `force-dynamic` + `no-store`: a cached 200 would mask a real
// outage. Still unauthenticated — it discloses nothing beyond the commit
// sha, which is already in the Sentry release tag.

import { type NextRequest, NextResponse } from "next/server";

import { env } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface LivenessBody {
  status: "ok";
  uptime_s: number;
  checks: {
    app: { ok: true };
  };
  env: string;
  version: string;
  /** Points a human (or a monitor's runbook link) at the dependency probe. */
  readiness_path: string;
}

export async function GET(_req: NextRequest): Promise<NextResponse> {
  const body: LivenessBody = {
    status: "ok",
    uptime_s: Math.round(process.uptime()),
    checks: { app: { ok: true } },
    env: env.sentryEnvironment(),
    version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) ?? "dev",
    readiness_path: "/api/health/ready",
  };

  // Deliberately NOT logged. This route is designed to be hit every 60s;
  // an info log per probe is ~43k log lines/month for zero signal. The
  // monitor's own history is the record of whether we were probed.
  return NextResponse.json(body, {
    status: 200,
    headers: { "Cache-Control": "no-store, max-age=0" },
  });
}
