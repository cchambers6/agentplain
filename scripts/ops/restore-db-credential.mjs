#!/usr/bin/env node
/**
 * restore-db-credential - one command to put a new Neon password everywhere.
 *
 * WHY THIS EXISTS
 * ---------------
 * On 2026-09-24 production had been undeployed for 98.9 days across 149
 * consecutive failed production deployments, and the live 2026-06-17 build was
 * serving /api/health 503 with db.ok=false. The chain was:
 *
 *   1. P3009 - a failed migration                              (fixed earlier)
 *   2. P1001 - Vercel builders have no IPv6 route while Neon publishes AAAA
 *              records, so Prisma took the AAAA path and got an instant
 *              ENETUNREACH, reported as "can't reach database server"
 *                                             (fixed by scripts/with-ipv4-db.mjs)
 *   3. P1000 - the stored password for neondb_owner no longer authenticates
 *
 * Step 3 is the only one a human must do: Vercel's production database
 * variables are "sensitive" type and unreadable by any API, and no Neon
 * credential exists on any build host. This script exists so the human part is
 * exactly one paste and everything downstream is already automated.
 *
 * ORDER OF OPERATIONS
 * -------------------
 *   1. Validate the connection string and derive the direct URL from the
 *      pooled one (Neon's direct host is the pooled host minus "-pooler").
 *   2. VERIFY the credential against Neon BEFORE touching any configuration.
 *      This is the anti-half-apply design: the overwhelmingly likely failure is
 *      a wrong or mistyped password, so it is made to happen before any system
 *      has been changed.
 *   3. Update DATABASE_URL and DATABASE_URL_DIRECT in Vercel, Production scope.
 *   4. Set the five GitHub Actions secrets production-deploy.yml needs.
 *   5. Trigger a production deploy and watch it to a terminal state.
 *
 * A ledger is printed at the end naming every step as APPLIED, SKIPPED or
 * FAILED. Writes to Vercel and to GitHub cannot be made atomic with each other,
 * so the next best thing is to put the likely failure before both of them and
 * to never be vague about what landed.
 *
 * SECRET HANDLING
 * ---------------
 * Credentials arrive in environment variables, never argv, so they stay out of
 * shell history and out of another user's `ps`. Every line printed goes through
 * a redactor seeded with the real values. This prints hostnames, never secrets.
 *
 * USAGE
 *   NEW_DATABASE_URL='postgresql://USER:PASS@ep-xxx-pooler.REGION.aws.neon.tech/neondb?sslmode=require' \
 *     node scripts/ops/restore-db-credential.mjs
 *
 * OPTIONAL ENVIRONMENT
 *   NEW_DATABASE_URL_DIRECT  explicit direct URL (default: derived)
 *   VERCEL_TOKEN             default: the local Vercel CLI session
 *   GH_SECRETS_TOKEN         PAT with secrets:write. Without it step 4 is
 *                            SKIPPED loudly - the agentplain-fleet App token
 *                            cannot write secrets (403 on the public key).
 *   SKIP_DEPLOY=1            do everything except step 5.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

export const VERCEL_PROJECT_ID = "prj_1XqKvh3hzT9AZHVXsgavH4lXf94b";
export const VERCEL_ORG_ID = "team_MC4ZLHOKHrDsVT8oBZrnfi0M";
export const REPO = "cchambers6/agentplain";

export const GITHUB_SECRETS = [
  "DATABASE_URL",
  "DATABASE_URL_DIRECT",
  "VERCEL_TOKEN",
  "VERCEL_ORG_ID",
  "VERCEL_PROJECT_ID",
];

/** A printer that can never emit one of the known secret values. */
export function makeRedactor(secrets = []) {
  const real = secrets.filter((s) => typeof s === "string" && s.length >= 8);
  return (msg) => {
    let out = String(msg);
    for (const s of real) out = out.split(s).join("<REDACTED>");
    return out.replace(/postgres(ql)?:[^\s"']*/gi, "postgresql://<REDACTED>");
  };
}

/**
 * Neon's direct (non-pooled) host is the pooled host with "-pooler" removed.
 * Migrations need the direct endpoint: the pooler runs in transaction mode,
 * which breaks the session-level locks prisma migrate deploy relies on.
 */
export function deriveDirectUrl(pooled) {
  const u = new URL(pooled);
  const parts = u.hostname.split(".");
  const suffix = "-pooler";
  if (!parts[0].endsWith(suffix)) return u.toString();
  parts[0] = parts[0].slice(0, -suffix.length);
  u.hostname = parts.join(".");
  return u.toString();
}

export function validateUrl(raw, label) {
  let u;
  try {
    u = new URL(raw);
  } catch {
    throw new Error(label + " is not a valid URL.");
  }
  if (!u.protocol.startsWith("postgres")) {
    throw new Error(label + " is not a postgres:// URL (got " + u.protocol + ").");
  }
  if (!u.username) throw new Error(label + " has no username.");
  if (!u.password) throw new Error(label + " has no password.");
  if (!u.hostname.includes("neon.tech")) {
    throw new Error(label + " host " + u.hostname + " is not a neon.tech host.");
  }
  return u;
}

/** Prefer an explicit token; fall back to the local Vercel CLI session. */
export function resolveVercelToken(env = process.env, readFile = fs.readFileSync) {
  if (env.VERCEL_TOKEN) return env.VERCEL_TOKEN;
  const home = os.homedir();
  const candidates = [
    path.join(home, "AppData", "Roaming", "com.vercel.cli", "Data", "auth.json"),
    path.join(home, ".local", "share", "com.vercel.cli", "auth.json"),
    path.join(home, "Library", "Application Support", "com.vercel.cli", "auth.json"),
  ];
  for (const p of candidates) {
    try {
      const j = JSON.parse(readFile(p, "utf8"));
      if (j.token) return j.token;
    } catch {
      /* try the next location */
    }
  }
  return null;
}

// ------------------------------------------------------------------ Vercel

async function vercelApi(pathname, token, init = {}) {
  const sep = pathname.includes("?") ? "&" : "?";
  const res = await fetch("https://api.vercel.com" + pathname + sep + "teamId=" + VERCEL_ORG_ID, {
    ...init,
    headers: {
      Authorization: "Bearer " + token,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
  let body = null;
  try {
    body = await res.json();
  } catch {
    /* DELETE returns an empty body */
  }
  return { ok: res.ok, status: res.status, body };
}

/**
 * Replace a Production-scope variable. Vercel has no upsert, so existing
 * Production entries for the key are removed first. Preview and development
 * entries are deliberately left alone: they point at other Neon branches.
 */
export async function setVercelProductionEnv(key, value, token, log, api = vercelApi) {
  const list = await api("/v10/projects/" + VERCEL_PROJECT_ID + "/env", token);
  if (!list.ok) throw new Error("Could not list Vercel env vars (HTTP " + list.status + ").");

  const existing = (list.body.envs || []).filter(
    (e) => e.key === key && (e.target || []).includes("production"),
  );
  for (const e of existing) {
    const del = await api("/v9/projects/" + VERCEL_PROJECT_ID + "/env/" + e.id, token, { method: "DELETE" });
    if (!del.ok) throw new Error("Could not remove the previous " + key + " (HTTP " + del.status + ").");
    log("  removed previous " + key + " (Production)");
  }

  const created = await api("/v10/projects/" + VERCEL_PROJECT_ID + "/env", token, {
    method: "POST",
    body: JSON.stringify({ key, value, type: "sensitive", target: ["production"] }),
  });
  if (!created.ok) {
    const why = created.body && created.body.error ? created.body.error.message : "";
    throw new Error("Could not create " + key + " (HTTP " + created.status + ") " + why);
  }
  log("  set " + key + " (Production, sensitive)");
}

// ------------------------------------------------------------------ verify

/**
 * Prove the credential works BEFORE any configuration is touched.
 *
 * Routed through with-ipv4-db.mjs so this exercises the exact path a
 * production build uses, rather than one that merely resembles it.
 *
 * POSITIVE EVIDENCE ONLY. An earlier revision of this function returned
 * success whenever it did not recognise an error code, and a run where
 * `npx prisma` failed to resolve at all (exit 2, no Prisma output) was read as
 * "credential accepted" — which then overwrote production configuration with a
 * password that had never been checked. Absence of a known error is not
 * evidence of success. This now requires prisma to have actually run and said
 * something recognisable, and treats everything else as unverified.
 */
export function verifyCredential(pooledUrl, directUrl, opts = {}) {
  const { runner = spawnSync, prismaVersion = readPrismaVersion() } = opts;
  const env = { ...process.env, DATABASE_URL: pooledUrl, DATABASE_URL_DIRECT: directUrl };
  delete env.MIGRATE_ON_BUILD;

  const r = runner(
    process.execPath,
    [
      "scripts/with-ipv4-db.mjs",
      "--",
      "npx",
      "--yes",
      "prisma@" + prismaVersion,
      "migrate",
      "status",
      "--schema",
      "prisma/schema.prisma",
    ],
    { env, encoding: "utf8", timeout: 300000 },
  );

  const out = String(r.stdout || "") + String.fromCharCode(10) + String(r.stderr || "");

  // Named failures first: each means something specific and actionable.
  for (const code of ["P1000", "P1001", "P1012"]) {
    if (out.includes(code)) return { ok: false, code, out };
  }

  // Then positive evidence that prisma reached the database and reported.
  if (out.includes("not yet been applied")) return { ok: true, code: "PENDING", pending: true, out };
  if (r.status === 0 && out.includes("Database schema is up to date")) {
    return { ok: true, code: "CLEAN", pending: false, out };
  }

  // Anything else is unverified. Refuse to guess.
  return { ok: false, code: "UNVERIFIED", status: r.status, out };
}

/** Pin the same major Prisma the repo depends on, so the check matches the build. */
export function readPrismaVersion(readFile = fs.readFileSync) {
  try {
    const pkg = JSON.parse(readFile("package.json", "utf8"));
    const spec = (pkg.dependencies && pkg.dependencies.prisma) || (pkg.devDependencies && pkg.devDependencies.prisma);
    if (spec) return String(spec).replace(/[^0-9.]/g, "") || "latest";
  } catch {
    /* fall through */
  }
  return "latest";
}

export const VERIFY_HELP = {
  P1000:
    "The password was rejected. Copy the connection string again from the Neon " +
    "console (Connection Details, role neondb_owner) - nothing has been changed.",
  P1001:
    "Could not reach the database at all. Check the Neon project is not suspended - " +
    "nothing has been changed.",
  P1012:
    "The schema could not read both URLs. DATABASE_URL and DATABASE_URL_DIRECT must " +
    "both be non-empty - nothing has been changed.",
  UNVERIFIED:
    "Could not get a usable answer out of `prisma migrate status`, so the credential " +
    "is UNVERIFIED. Run this from the repository root. Nothing has been changed.",
};

// ------------------------------------------------------------------ GitHub

/**
 * Set the Actions secrets via the gh CLI.
 *
 * The secrets API needs a libsodium sealed box, which Node cannot build from
 * its own primitives, so gh does the sealing. gh is driven with GH_TOKEN so
 * nothing depends on an interactive `gh auth login`.
 *
 * The agentplain-fleet App token CANNOT do this: it has no secrets scope and
 * returns 403 on actions/secrets/public-key. A PAT with secrets:write is
 * required, which is why this step is optional and loud when skipped.
 */
export function setGithubSecrets(values, token, log, runner = spawnSync) {
  const results = [];
  for (const name of GITHUB_SECRETS) {
    const value = values[name];
    if (value == null) {
      results.push({ name, ok: false, why: "no value supplied" });
      continue;
    }
    const r = runner("gh", ["secret", "set", name, "--repo", REPO, "--body", value], {
      env: { ...process.env, GH_TOKEN: token },
      encoding: "utf8",
      timeout: 60000,
      shell: false,
    });
    const ok = r.status === 0;
    results.push({
      name,
      ok,
      why: ok ? "" : String(r.stderr || r.stdout || "exit " + r.status).trim().slice(0, 160),
    });
    log("  " + (ok ? "set" : "FAILED") + " GitHub secret " + name);
  }
  return results;
}

// ------------------------------------------------------------------ deploy

export function deployProduction(log, runner = spawnSync) {
  log("  starting production deploy (this takes a few minutes)...");
  const r = runner("npx", ["--yes", "vercel@latest", "deploy", "--prod", "--yes"], {
    encoding: "utf8",
    timeout: 900000,
    shell: true,
  });
  const out = String(r.stdout || "") + "\n" + String(r.stderr || "");
  const url = (out.match(/https:\/\/[a-z0-9-]+\.vercel\.app/g) || []).pop() || null;
  return { ok: r.status === 0, url, out };
}

export async function waitForTerminalState(url, token, log, sleep = (ms) => new Promise((r) => setTimeout(r, ms))) {
  if (!url) return "UNKNOWN";
  for (let i = 0; i < 80; i += 1) {
    const res = await vercelApi("/v13/deployments/" + encodeURIComponent(url.replace("https://", "")), token);
    const state = (res.body && (res.body.readyState || res.body.status)) || "UNKNOWN";
    if (state === "READY" || state === "ERROR" || state === "CANCELED") {
      log("  deployment state: " + state);
      return state;
    }
    await sleep(15000);
  }
  return "TIMEOUT";
}

// -------------------------------------------------------------------- main

export async function main(env = process.env) {
  const ledger = [];
  const record = (step, status, detail) => ledger.push({ step, status, detail: detail || "" });

  const pooledRaw = env.NEW_DATABASE_URL;
  if (!pooledRaw) {
    console.error(
      "restore-db-credential: NEW_DATABASE_URL is not set.\n\n" +
        "  NEW_DATABASE_URL='postgresql://...' node scripts/ops/restore-db-credential.mjs\n\n" +
        "Copy it from the Neon console: Connection Details, role neondb_owner, pooled connection.",
    );
    return 2;
  }

  const directRaw = env.NEW_DATABASE_URL_DIRECT || deriveDirectUrl(pooledRaw);
  const redact = makeRedactor([pooledRaw, directRaw, env.VERCEL_TOKEN, env.GH_SECRETS_TOKEN]);
  const log = (m) => console.log(redact(m));
  const err = (m) => console.error(redact(m));

  // 1. validate ------------------------------------------------------------
  let pooled;
  let direct;
  try {
    pooled = validateUrl(pooledRaw, "NEW_DATABASE_URL");
    direct = validateUrl(directRaw, "NEW_DATABASE_URL_DIRECT");
  } catch (e) {
    err("restore-db-credential: " + e.message);
    return 2;
  }
  log("[1/5] Connection strings parsed.");
  log("      pooled host: " + pooled.hostname);
  log("      direct host: " + direct.hostname);
  if (pooled.hostname === direct.hostname) {
    log("      NOTE: pooled and direct hosts are identical. If the pooled host ends");
    log("      in -pooler this is wrong; pass NEW_DATABASE_URL_DIRECT explicitly.");
  }

  // 2. verify BEFORE writing anything --------------------------------------
  log("[2/5] Verifying the credential against Neon before changing anything...");
  const v = verifyCredential(pooledRaw, directRaw);
  if (!v.ok) {
    err("      REJECTED (" + v.code + "). " + (VERIFY_HELP[v.code] || ""));
    err("      Nothing has been changed. Fix the connection string and run again.");
    return 1;
  }
  log("      Credential accepted by Neon (" + v.code + ").");
  if (v.pending) log("      Migrations are pending; the deploy pipeline will apply them.");
  record("verify credential", "APPLIED", v.code);

  // 3. Vercel --------------------------------------------------------------
  const vercelToken = resolveVercelToken(env);
  if (!vercelToken) {
    err("[3/5] No Vercel token. Set VERCEL_TOKEN or run `vercel login`.");
    record("vercel env vars", "FAILED", "no token");
    printLedger(ledger, log);
    return 1;
  }
  log("[3/5] Updating Vercel Production environment variables...");
  try {
    await setVercelProductionEnv("DATABASE_URL", pooledRaw, vercelToken, log);
    record("vercel DATABASE_URL", "APPLIED");
    await setVercelProductionEnv("DATABASE_URL_DIRECT", directRaw, vercelToken, log);
    record("vercel DATABASE_URL_DIRECT", "APPLIED");
  } catch (e) {
    err("      " + e.message);
    record("vercel env vars", "FAILED", e.message);
    printLedger(ledger, log);
    return 1;
  }

  // 4. GitHub secrets ------------------------------------------------------
  const ghToken = env.GH_SECRETS_TOKEN;
  if (!ghToken) {
    log("[4/5] SKIPPED - no GH_SECRETS_TOKEN.");
    log("      The agentplain-fleet App token cannot write secrets (403 on the");
    log("      public key), so this needs a PAT with secrets:write, or set these");
    log("      five by hand at:");
    log("      https://github.com/" + REPO + "/settings/secrets/actions");
    for (const n of GITHUB_SECRETS) log("        - " + n);
    record("github secrets", "SKIPPED", "no GH_SECRETS_TOKEN");
  } else {
    log("[4/5] Setting GitHub Actions secrets...");
    const results = setGithubSecrets(
      {
        DATABASE_URL: pooledRaw,
        DATABASE_URL_DIRECT: directRaw,
        VERCEL_TOKEN: vercelToken,
        VERCEL_ORG_ID: VERCEL_ORG_ID,
        VERCEL_PROJECT_ID: VERCEL_PROJECT_ID,
      },
      ghToken,
      log,
    );
    const bad = results.filter((r) => !r.ok);
    record("github secrets", bad.length ? "FAILED" : "APPLIED", bad.map((b) => b.name + ": " + b.why).join("; "));
    if (bad.length) {
      err("      " + bad.length + " secret(s) failed. production-deploy.yml will still fail its preflight.");
    }
  }

  // 5. deploy --------------------------------------------------------------
  if (env.SKIP_DEPLOY === "1") {
    log("[5/5] SKIPPED - SKIP_DEPLOY=1.");
    record("production deploy", "SKIPPED", "SKIP_DEPLOY=1");
    printLedger(ledger, log);
    return 0;
  }
  log("[5/5] Deploying to production...");
  const d = deployProduction(log);
  const state = d.url ? await waitForTerminalState(d.url, vercelToken, log) : "UNKNOWN";
  record("production deploy", state === "READY" ? "APPLIED" : "FAILED", state + (d.url ? " " + d.url : ""));

  printLedger(ledger, log);
  if (state !== "READY") {
    err("Production did NOT reach READY. Read the build log:");
    err("  npx vercel inspect --logs " + (d.url || "<deployment url>"));
    return 1;
  }
  log("Production is READY. Verify the database is actually serving:");
  log("  curl -s https://agentplain.com/api/health");
  return 0;
}

export function printLedger(ledger, log) {
  log("");
  log("---- what changed ----");
  for (const r of ledger) log("  " + r.status.padEnd(8) + r.step + (r.detail ? "  (" + r.detail + ")" : ""));
  log("----------------------");
}

const invokedAs = (process.argv[1] || "").split("/").pop().split("\\").pop();
if (invokedAs === "restore-db-credential.mjs") {
  process.exit(await main());
}
