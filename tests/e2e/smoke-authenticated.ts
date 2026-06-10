/**
 * tests/e2e/smoke-authenticated.ts
 *
 * SEEDED-LOGIN E2E SMOKE HARNESS
 * ==============================
 * The runnable harness that makes every auth-gated product surface
 * verifiable end-to-end. It: (1) seeds a clearly-marked TEST workspace
 * against the target DB, (2) mints a real iron-session for the seeded owner,
 * (3) fetches the key product routes — approvals API + page, briefings,
 * onboarding, workspace home — carrying that session, and (4) asserts each
 * returns 200 AND contains the seeded markers (the approval titles, the
 * briefing line). Prints a PASS/FAIL table and exits non-zero on any fail.
 *
 * This is the layer later Playwright waves build on: it proves the routes
 * RENDER REAL DATA behind auth; Playwright then proves they render CORRECTLY
 * in a browser (pixels, interactions). See "WHAT THIS CANNOT VERIFY" below.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * USAGE
 * ──────────────────────────────────────────────────────────────────────────
 * Required env (all three rails must point at the SAME deployment):
 *   DATABASE_URL       Postgres the surfaces read from (and we seed into).
 *   BASE_URL           Origin the app is served at, e.g. http://localhost:3000
 *                      or https://<preview>.vercel.app  (no trailing slash).
 *   SESSION_PASSWORD   The deployment's iron-session secret. MUST match or the
 *                      server unseals to null → 401/redirect on every route.
 *   ENCRYPTION_KEY     64-hex AES key. Must match the deployment's key so the
 *                      seeded approval payloads + briefing body decrypt for
 *                      render. (Same key the app uses at rest.)
 *
 * Guard env (the seed refuses to run on a prod-looking DB — see
 * tests/fixtures/seed-test-workspace.ts):
 *   ALLOW_E2E_SEED=yes                  REQUIRED opt-in.
 *   E2E_SEED_FORBID=1                   Hard-block (set on any real prod DB).
 *   E2E_SEED_MAX_EXISTING_WORKSPACES    Default 50; refuse if exceeded.
 *
 * Optional:
 *   E2E_SEED_KEY        Isolation key (default "default") → slug e2e-test-<key>.
 *   E2E_KEEP_SEED=1     Skip teardown (leave the workspace for manual poking).
 *   SESSION_COOKIE_NAME Override cookie name (default agentplain_session).
 *
 * Local dev DB:
 *   ALLOW_E2E_SEED=yes DATABASE_URL=postgres://...localdev \
 *     BASE_URL=http://localhost:3000 SESSION_PASSWORD=<dev> ENCRYPTION_KEY=<dev> \
 *     node --import tsx tests/e2e/smoke-authenticated.ts
 *
 * Vercel preview (point at the preview's DB + secrets):
 *   ALLOW_E2E_SEED=yes DATABASE_URL=<preview-db> \
 *     BASE_URL=https://<preview>.vercel.app \
 *     SESSION_PASSWORD=<preview> ENCRYPTION_KEY=<preview> \
 *     node --import tsx tests/e2e/smoke-authenticated.ts
 *
 * ──────────────────────────────────────────────────────────────────────────
 * WHAT THIS CANNOT VERIFY (honest limits)
 * ──────────────────────────────────────────────────────────────────────────
 *   - VISUAL rendering. We assert markers appear in the response body, not
 *     that the page LOOKS right (layout, styling, hydration, client-side
 *     interactivity). That is the Playwright layer that sits ON TOP of this
 *     harness — it can reuse `mintSession()` to authenticate a browser
 *     context, then drive the real DOM.
 *   - Server actions / mutations (approve, reject, edit). We exercise the
 *     READ surfaces; the decision mutations run through RLS-gated server
 *     actions that warrant their own driven test.
 *   - Cross-host cookie behavior, CSP, real OAuth. Out of scope for a smoke.
 *
 * NO new auth primitive; NO schema migration; NO secrets committed.
 */

import {
  buildSeedPlan,
  seedTestWorkspace,
  teardownTestWorkspace,
  type SeedClient,
  type SeedPlan,
} from "@/tests/fixtures/seed-test-workspace";
import { mintSession, type MintedSession } from "@/tests/fixtures/mint-session";

// ── Assertion helpers (pure — unit-tested offline in smoke-assertions.test.ts) ─

export type CheckKind = "html" | "json";

export interface RouteCheck {
  /** Human label for the PASS/FAIL table. */
  name: string;
  /** Path appended to BASE_URL. */
  path: string;
  /** html → send the session as a Cookie; json → as a Bearer. */
  kind: CheckKind;
  /** Substrings that MUST all appear in the response body. */
  expectMarkers: string[];
}

export interface CheckOutcome {
  name: string;
  path: string;
  status: number;
  ok: boolean;
  missingMarkers: string[];
  error?: string;
}

/**
 * Evaluate a single response against a check. Pure: takes the status + body
 * text, returns the outcome. Separated from `fetch` so the logic is testable
 * with no network.
 */
export function evaluateResponse(
  check: RouteCheck,
  status: number,
  body: string,
): CheckOutcome {
  const missingMarkers = check.expectMarkers.filter((m) => !body.includes(m));
  const ok = status === 200 && missingMarkers.length === 0;
  return {
    name: check.name,
    path: check.path,
    status,
    ok,
    missingMarkers,
  };
}

/**
 * Build the route-check matrix from a seed plan + workspace id. Pure — drives
 * both the runnable harness and the offline assertion tests.
 */
export function buildRouteChecks(
  plan: SeedPlan,
  workspaceId: string,
): RouteCheck[] {
  const base = `/app/workspace/${workspaceId}`;
  return [
    {
      name: "approvals API (JSON, Bearer)",
      path: `/api/mobile/workspace/${workspaceId}/approvals`,
      kind: "json",
      // The JSON route returns the decrypted payload as-is; the markers live
      // in the payload body/subject/leadName fields.
      expectMarkers: plan.markers.approvals,
    },
    {
      name: "approvals page (HTML, cookie)",
      path: `${base}/approvals`,
      kind: "html",
      expectMarkers: plan.markers.approvals,
    },
    {
      name: "briefings page (HTML, cookie)",
      path: `${base}/briefings`,
      kind: "html",
      expectMarkers: [plan.markers.briefing],
    },
    {
      name: "onboarding page (HTML, cookie)",
      path: `${base}/onboarding`,
      kind: "html",
      // Onboarding is complete → renders the "rooted" state with the workspace
      // present. We assert the surface loaded for the owner (no redirect).
      expectMarkers: ["onboarding"],
    },
    {
      name: "workspace home (HTML, cookie)",
      path: `${base}`,
      kind: "html",
      expectMarkers: [plan.markers.workspaceName],
    },
  ];
}

// ── Runtime (DB + network) ───────────────────────────────────────────────────

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v || v.length === 0) {
    throw new Error(
      `[smoke] required env ${name} is not set. See the USAGE block at the top of this file.`,
    );
  }
  return v;
}

async function loadPrismaClient(): Promise<{ client: SeedClient; disconnect: () => Promise<void> }> {
  // Imported lazily + by string so merely type-checking / importing this
  // module never instantiates a DB client (the offline tests import the pure
  // helpers above without a DATABASE_URL).
  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();
  return {
    client: prisma as unknown as SeedClient,
    disconnect: () => prisma.$disconnect(),
  };
}

async function fetchCheck(
  baseUrl: string,
  check: RouteCheck,
  session: MintedSession,
): Promise<CheckOutcome> {
  const url = `${baseUrl}${check.path}`;
  const headers =
    check.kind === "json" ? session.headers.bearer : session.headers.cookie;
  try {
    const res = await fetch(url, {
      headers: { ...headers, Accept: check.kind === "json" ? "application/json" : "text/html" },
      // Do NOT follow redirects: an auth miss is a 302 to /app/sign-in, which
      // we want to surface as a FAIL (non-200), not silently follow to a 200
      // sign-in page.
      redirect: "manual",
    });
    const body = await res.text();
    return evaluateResponse(check, res.status, body);
  } catch (err) {
    return {
      name: check.name,
      path: check.path,
      status: 0,
      ok: false,
      missingMarkers: check.expectMarkers,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

function printTable(outcomes: CheckOutcome[]): void {
  const nameW = Math.max(...outcomes.map((o) => o.name.length), 4);
  // eslint-disable-next-line no-console
  console.log("\n  RESULT  STATUS  SURFACE");
  // eslint-disable-next-line no-console
  console.log("  ──────  ──────  " + "─".repeat(nameW));
  for (const o of outcomes) {
    const result = o.ok ? "PASS  " : "FAIL  ";
    const status = String(o.status).padStart(6);
    const detail = o.ok
      ? ""
      : o.error
        ? `  ← ${o.error}`
        : o.missingMarkers.length > 0
          ? `  ← missing: ${o.missingMarkers.join(", ")}`
          : "  ← non-200";
    // eslint-disable-next-line no-console
    console.log(`  ${result}  ${status}  ${o.name.padEnd(nameW)}${detail}`);
  }
}

async function main(): Promise<void> {
  const baseUrl = requireEnv("BASE_URL").replace(/\/$/, "");
  requireEnv("DATABASE_URL");
  requireEnv("SESSION_PASSWORD");
  requireEnv("ENCRYPTION_KEY");

  const seedKey = process.env.E2E_SEED_KEY || undefined;
  const keepSeed = process.env.E2E_KEEP_SEED === "1";

  // eslint-disable-next-line no-console
  console.log(`[smoke] target ${baseUrl} — seeding (key=${seedKey ?? "default"})…`);

  const { client, disconnect } = await loadPrismaClient();
  let exitCode = 0;
  try {
    const seeded = await seedTestWorkspace({ client, key: seedKey });
    // eslint-disable-next-line no-console
    console.log(
      `[smoke] seeded workspace ${seeded.workspaceId} (${seeded.slug}); minting session…`,
    );

    const session = await mintSession({
      userId: seeded.userId,
      email: seeded.plan.markers.ownerEmail,
      activeWorkspaceId: seeded.workspaceId,
    });

    const checks = buildRouteChecks(seeded.plan, seeded.workspaceId);
    const outcomes: CheckOutcome[] = [];
    for (const check of checks) {
      outcomes.push(await fetchCheck(baseUrl, check, session));
    }

    printTable(outcomes);
    const failed = outcomes.filter((o) => !o.ok);
    // eslint-disable-next-line no-console
    console.log(
      `\n[smoke] ${outcomes.length - failed.length}/${outcomes.length} surfaces verified.`,
    );
    exitCode = failed.length === 0 ? 0 : 1;

    if (!keepSeed) {
      await teardownTestWorkspace(client, { key: seedKey });
      // eslint-disable-next-line no-console
      console.log("[smoke] torn down seed.");
    } else {
      // eslint-disable-next-line no-console
      console.log("[smoke] E2E_KEEP_SEED=1 — leaving seed in place.");
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(`[smoke] FAILED: ${err instanceof Error ? err.message : String(err)}`);
    exitCode = 1;
  } finally {
    await disconnect();
  }
  process.exit(exitCode);
}

// Only run when invoked directly, not when imported by the offline tests.
// Compare the resolved entrypoint path (argv[1], which may be relative) against
// this module's file URL via pathToFileURL so it's robust on Windows (relative
// argv + absolute import.meta.url + backslash separators).
async function isInvokedDirectly(): Promise<boolean> {
  if (typeof process === "undefined" || process.argv[1] === undefined) {
    return false;
  }
  const { pathToFileURL } = await import("node:url");
  const { resolve } = await import("node:path");
  const entry = pathToFileURL(resolve(process.argv[1])).href;
  return import.meta.url === entry;
}

void isInvokedDirectly().then((direct) => {
  if (direct) {
    // Reference the unused export so linters don't flag it; the builder is part
    // of the public surface for the offline tests.
    void buildSeedPlan;
    main().catch((err) => {
      // `main` exits 0/1 itself on the happy/checked paths; this catches the
      // pre-flight env validation (which throws before main's try block) so a
      // missing-env invocation exits NON-zero rather than 0.
      // eslint-disable-next-line no-console
      console.error(
        `[smoke] ${err instanceof Error ? err.message : String(err)}`,
      );
      process.exit(1);
    });
  }
});
