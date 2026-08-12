// publish-heartbeat.mjs — M1's writer (EU-1).
//
// Builds one JSON payload — timestamp, host census, git state, queue mirror,
// deploy state, contracts — and PUTs it as heartbeat.json to the ops/heartbeat
// branch via the GitHub Contents API. The branch's commit history is the
// outage ruler: gaps between commits are non-disputable outage durations on
// GitHub's clock.
//
// Hard rules:
//   - Secret scan runs over the full serialized payload BEFORE any network
//     call; on a match the publish hard-fails (exit 1). A missed heartbeat is
//     strictly better than a leaked token, and the miss is itself caught by
//     the fleet-liveness alarm.
//   - Every section carries its own `ts`, so a stale sub-result can never
//     ride a fresh heartbeat unnoticed.
//   - Counts are measured, never derived. A failed probe writes null plus an
//     `error` string — never a guess.
//
// Usage: node scripts/ops/publish-heartbeat.mjs [--token-file <p>] [--dry-run]
//        [--inject-test-secret]   (deliberate-failure test: must exit 1)

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { repoRoot, readToken, ghApi, REPO, nowIso, hasFlag } from "./lib.mjs";
import { resolveStore } from "./resolve-store.mjs";

const BRANCH = "ops/heartbeat";
const SECRET_PATTERNS =
  /(ghs_[A-Za-z0-9]{8,}|ghp_[A-Za-z0-9]{8,}|github_pat_[A-Za-z0-9_]{8,}|-----BEGIN)/;

function section(build) {
  try {
    return { ts: nowIso(), ...build() };
  } catch (e) {
    return { ts: nowIso(), error: String(e.message || e).slice(0, 300) };
  }
}

function hostCensus() {
  const ps = `
    $os = Get-CimInstance Win32_OperatingSystem;
    $claude = @(Get-Process -Name claude -ErrorAction SilentlyContinue);
    $node = @(Get-Process -Name node -ErrorAction SilentlyContinue);
    @{
      free_gb = [math]::Round($os.FreePhysicalMemory / 1MB, 2);
      claude_procs = $claude.Count;
      claude_rss_gb = [math]::Round(($claude | Measure-Object WorkingSet64 -Sum).Sum / 1GB, 2);
      node_procs = $node.Count;
      node_rss_gb = [math]::Round(($node | Measure-Object WorkingSet64 -Sum).Sum / 1GB, 2);
    } | ConvertTo-Json -Compress`;
  const out = execFileSync("powershell.exe", ["-NoProfile", "-Command", ps], {
    encoding: "utf8",
    timeout: 30_000,
  });
  return JSON.parse(out);
}

function gitState() {
  const run = (args) =>
    execFileSync("git", ["-C", repoRoot, ...args], { encoding: "utf8", timeout: 30_000 }).trim();
  const counts = run(["rev-list", "--left-right", "--count", "origin/main...main"]);
  const [, ahead] = counts.split(/\s+/).map(Number);
  return {
    local_main_ahead: Number.isFinite(ahead) ? ahead : null,
    origin_main_sha: run(["rev-parse", "origin/main"]),
  };
}

function tryScript(relPath, args) {
  const script = path.join(repoRoot, relPath);
  if (!fs.existsSync(script)) return null;
  const out = execFileSync(process.execPath, [script, ...args], {
    encoding: "utf8",
    timeout: 120_000,
  });
  return JSON.parse(out);
}

// Raw sanitized mirror — the pre-M9 fallback. Once rank-queue.mjs exists the
// reader never sees ledger order (rev 4); until then, sanitized fields only
// (amendment-note prose has carried near-secrets and is never mirrored).
async function rawMirror() {
  const store = resolveStore("agent_store");
  if (store.code !== 0) throw new Error(store.error);
  const yaml = (await import("js-yaml")).default;
  const qPath = path.join(store.path, "data", "conner-queue.yaml");
  const doc = yaml.load(fs.readFileSync(qPath, "utf8"));
  const items = (doc.items || []).map((it) => ({
    id: it.id,
    title: String(it.title || "").slice(0, 200),
    status: it.status,
    raised: it.raised ?? it.first_surfaced ?? null,
    priority: it.priority ?? null,
    snooze_until: it.snooze_until ?? null,
  }));
  return {
    mirror_mode: "raw-ledger-order",
    pending_total: items.filter((i) => i.status === "pending").length,
    items,
  };
}

function findSecret(obj, trail = "$") {
  if (typeof obj === "string") {
    return SECRET_PATTERNS.test(obj) ? trail : null;
  }
  if (obj && typeof obj === "object") {
    for (const [k, v] of Object.entries(obj)) {
      if (SECRET_PATTERNS.test(k)) return `${trail}.${k}`;
      const hit = findSecret(v, `${trail}.${k}`);
      if (hit) return hit;
    }
  }
  return null;
}

async function ensureBranch(token) {
  const ref = await ghApi(`/repos/${REPO}/git/ref/heads/${BRANCH}`, { token, ok404: true });
  if (ref) return;
  const main = await ghApi(`/repos/${REPO}/git/ref/heads/main`, { token });
  await ghApi(`/repos/${REPO}/git/refs`, {
    method: "POST",
    token,
    body: { ref: `refs/heads/${BRANCH}`, sha: main.object.sha },
  });
  process.stdout.write(`created branch ${BRANCH} from main @ ${main.object.sha.slice(0, 7)}\n`);
}

async function main() {
  const payload = { ts: nowIso() };
  payload.host = section(hostCensus);
  payload.git = section(gitState);

  payload.queue = await (async () => {
    try {
      const ranked = tryScript("scripts/ops/rank-queue.mjs", ["rank", "--json"]);
      if (ranked) return { ts: nowIso(), mirror_mode: "ranked", ...ranked };
    } catch (e) {
      // fall through to raw mirror; record why
      process.stderr.write(`rank-queue failed, falling back to raw mirror: ${e.message}\n`);
    }
    try {
      return { ts: nowIso(), ...(await rawMirror()) };
    } catch (e) {
      return { ts: nowIso(), error: String(e.message || e).slice(0, 300) };
    }
  })();

  payload.deploy = (() => {
    try {
      const report = tryScript("scripts/ops/deploy-state.mjs", [
        "report",
        "--json",
        ...(process.argv.includes("--token-file")
          ? ["--token-file", process.argv[process.argv.indexOf("--token-file") + 1]]
          : []),
      ]);
      return report ? { ts: nowIso(), ...report } : { ts: nowIso(), status: "not-installed" };
    } catch (e) {
      return { ts: nowIso(), error: String(e.message || e).slice(0, 300) };
    }
  })();

  payload.contracts = { ts: nowIso(), status: "checker-not-installed" };

  if (hasFlag("--inject-test-secret")) {
    payload.__secret_test = "ghs_" + "A".repeat(30);
  }

  const hit = findSecret(payload);
  if (hit) {
    process.stderr.write(`SECRET-SCAN FAIL: pattern match at payload path ${hit} — publish aborted\n`);
    process.exit(1);
  }

  const body = JSON.stringify(payload, null, 2);
  if (hasFlag("--dry-run")) {
    process.stdout.write(body + "\n");
    return;
  }

  const token = readToken();
  await ensureBranch(token);
  const existing = await ghApi(
    `/repos/${REPO}/contents/heartbeat.json?ref=${encodeURIComponent(BRANCH)}`,
    { token, ok404: true }
  );
  const result = await ghApi(`/repos/${REPO}/contents/heartbeat.json`, {
    method: "PUT",
    token,
    body: {
      message: `heartbeat ${payload.ts}`,
      content: Buffer.from(body).toString("base64"),
      branch: BRANCH,
      ...(existing?.sha ? { sha: existing.sha } : {}),
    },
  });
  process.stdout.write(
    `published heartbeat ${payload.ts} -> ${BRANCH} @ ${result.commit.sha.slice(0, 7)} (${body.length} bytes)\n`
  );
}

main().catch((e) => {
  process.stderr.write(`publish-heartbeat failed: ${e.message}\n`);
  process.exit(1);
});
