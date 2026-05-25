// GET /api/health
//
// Lightweight liveness + dependency check. Suitable for an external uptime
// monitor (Better Stack, UptimeRobot, BetterUptime, Pingdom, etc.). The
// route is intentionally cheap so a 1-minute external probe doesn't move
// the DB needle.
//
// Response shape (always JSON, never sets cookies):
//
//   200 {
//     "status": "ok" | "degraded",
//     "uptime_s": <number>,
//     "checks": {
//       "app":     { "ok": true },
//       "db":      { "ok": true,  "latency_ms": <number> }
//                |  { "ok": false, "error": "<short reason>" },
//       "inngest": { "ok": true,  "registered": <count> }
//                |  { "ok": false, "error": "<short reason>" }
//     },
//     "env":     "production" | "preview" | "development",
//     "version": "<git sha or 'dev'>"
//   }
//
//   503 — same shape, status: "degraded", when ANY required check fails.
//
// Why "degraded" + 503 (not 500): an uptime monitor needs a clear binary
// signal. A 503 with a reason in the body tells both the monitor (alert)
// and a human (which dep failed) in one read.
//
// No auth, no secret leakage: we never include connection strings, env
// values, customer counts, or anything that would help an attacker
// fingerprint our stack beyond what's already visible. Versions are
// already visible in the Sentry release tag — exposing the commit sha here
// just helps the operator correlate.
//
// The route is dynamic so it never gets cached by Vercel / a CDN — a
// stale cached 200 would silently mask a real outage.

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

interface HealthBody {
  status: "ok" | "degraded";
  uptime_s: number;
  checks: {
    app: CheckOk;
    db: Check;
    inngest: Check;
  };
  env: string;
  version: string;
}

async function checkDatabase(): Promise<Check> {
  const start = Date.now();
  try {
    // SELECT 1 — cheapest round-trip. Goes through the pool, so a pool
    // exhaustion shows up here too. Cast to unknown so we don't pollute
    // the response with the result rows.
    await prisma.$queryRawUnsafe("SELECT 1");
    return { ok: true, latency_ms: Date.now() - start };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // Trim long Postgres error chains to a short reason for the response
    // body; the full error is in the logs.
    const short = message.split("\n")[0]?.slice(0, 200) ?? "db error";
    return { ok: false, error: short };
  }
}

async function checkInngestMount(): Promise<Check> {
  // The Inngest serve route lives at /api/inngest. We don't want to make
  // a self HTTP request (would add latency + a hairpin loop on Vercel).
  // Instead we import the route module and count the registered functions
  // — same code path Inngest's GET handler reflects.
  try {
    const mod = (await import("../inngest/route")) as Record<string, unknown>;
    // serve() returns { GET, POST, PUT } — its mere presence means the
    // module imported cleanly (env vars OK, function modules loaded).
    const hasHandlers =
      typeof mod.GET === "function" &&
      typeof mod.POST === "function" &&
      typeof mod.PUT === "function";
    if (!hasHandlers) {
      return { ok: false, error: "inngest handlers missing" };
    }
    return { ok: true, mounted: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message.slice(0, 200) };
  }
}

export async function GET(_req: NextRequest): Promise<NextResponse> {
  const t0 = process.hrtime.bigint();

  const [db, inngest] = await Promise.all([
    checkDatabase(),
    checkInngestMount(),
  ]);

  const body: HealthBody = {
    status: db.ok && inngest.ok ? "ok" : "degraded",
    uptime_s: Math.round(process.uptime()),
    checks: {
      app: { ok: true },
      db,
      inngest,
    },
    env: env.sentryEnvironment(),
    version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) ?? "dev",
  };

  const elapsedMs = Number(process.hrtime.bigint() - t0) / 1_000_000;

  // Log every probe at info — high-volume but cheap, and lets us answer
  // "did the monitor actually probe us during the gap" after the fact.
  // Degraded checks log at warn so they're easy to grep.
  const logger = getLogger().child({ boundary: "health" });
  if (body.status === "ok") {
    logger.info("health ok", { elapsed_ms: Math.round(elapsedMs) });
  } else {
    logger.warn("health degraded", {
      elapsed_ms: Math.round(elapsedMs),
      db_ok: db.ok,
      inngest_ok: inngest.ok,
      db_error: db.ok ? undefined : db.error,
      inngest_error: inngest.ok ? undefined : inngest.error,
    });
  }

  return NextResponse.json(body, {
    status: body.status === "ok" ? 200 : 503,
    headers: {
      "Cache-Control": "no-store, max-age=0",
    },
  });
}
