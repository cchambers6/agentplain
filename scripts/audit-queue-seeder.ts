/**
 * scripts/audit-queue-seeder.ts
 *
 * Feeds the autonomous audit-queue. It converts four classes of regression
 * signal into INBOX entries tagged `audit-queue, regression` so the existing
 * scheduled task `agentplain-audit-queue-autofire` (which scans the INBOX by
 * those keywords at 9am/1pm/5pm/9pm ET) starts firing fixes — no human has to
 * notice the breakage first.
 *
 * Signals gathered (each is independently best-effort — a missing token or an
 * API hiccup degrades to fewer signals, never a crash):
 *   1. CI failures        — GitHub Actions runs in the last 8h on main / branches
 *   2. Vercel preview     — failed deployment commit-statuses in the last 8h
 *   3. Brand-gate drift   — `tools/brand/brand-gate.mjs --json` newViolations > 0
 *   4. Stale PRs          — open > 2h, no new commits, CI green → "ready to merge?"
 *   5. E2E failures       — failed tests in the latest Playwright report
 *
 * ── WHERE IT WRITES (the cloud-vs-local reality) ───────────────────────────────
 * The autofire task's INBOX is a LOCAL file on Conner's machine. A cloud GitHub
 * Actions runner CANNOT write to it. So the write target is environment-aware:
 *   - LOCAL run  (the INBOX dir exists / is writable, or AUDIT_QUEUE_INBOX_PATH
 *     points somewhere reachable) → append entries to the real INBOX.
 *   - CI run     (INBOX dir absent) → write to ./audit-queue/seeded-inbox.md in
 *     the repo, echo to stdout, and append a summary to $GITHUB_STEP_SUMMARY.
 * To close the loop, run this LOCALLY on a 30-min cadence (see PR C docs / the
 * recommended scheduled task) where it has BOTH a GitHub token AND the INBOX.
 *
 * Entries use the Librarian frontmatter format the INBOX documents, with the
 * brief's required fields (tags / signal / suggested-fix / source / reproducer)
 * embedded in the observation so BOTH consumers work: the Librarian parses the
 * frontmatter; the autofire task keyword-scans for `audit-queue` / `regression`.
 *
 * Idempotent: an entry whose slug already appears in the INBOX (or its
 * processed sibling) is skipped, so re-running every 30 min doesn't duplicate.
 *
 * Run:
 *   GITHUB_TOKEN=… npx tsx scripts/audit-queue-seeder.ts            # all signals
 *   npx tsx scripts/audit-queue-seeder.ts --dry-run                 # print only
 *   AUDIT_QUEUE_INBOX_PATH=/path/to/INBOX.md npx tsx scripts/audit-queue-seeder.ts
 */

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

// ── Config ─────────────────────────────────────────────────────────────────────

const REPO = process.env.GITHUB_REPOSITORY || "cchambers6/agentplain";
const TOKEN = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || "";
const DRY_RUN = process.argv.includes("--dry-run");
const WINDOW_MS = 8 * 60 * 60 * 1000; // CI/Vercel lookback
const STALE_PR_MS = 2 * 60 * 60 * 1000; // PR open-without-commits threshold
const NOW = Date.now();
const REPO_ROOT = resolve(__dirname, "..");

/** Default local INBOX the autofire task reads (override via env). */
const DEFAULT_INBOX =
  "C:/Users/conne/AppData/Local/Packages/Claude_pzs8sxrjxfjjc/LocalCache/Roaming/Claude/" +
  "local-agent-mode-sessions/e96926c9-f6b4-447c-b651-556629bc1f98/" +
  "3e6a77a8-104b-4774-8239-85aac4c3463b/agent/memory/INBOX.md";
const INBOX_PATH = process.env.AUDIT_QUEUE_INBOX_PATH || DEFAULT_INBOX;
const CI_FALLBACK = join(REPO_ROOT, "audit-queue", "seeded-inbox.md");

type Severity = "high" | "medium" | "low";
type Source = "ci" | "vercel" | "brand-gate" | "stale-pr" | "e2e";

interface Signal {
  slug: string; // stable, dedup key: {source}-{detail}
  severity: Severity;
  source: Source;
  signal: string; // one-line: what broke
  fix: string; // one-line: recommendation
  reproducer: string; // URL / test name / build log
}

// ── GitHub API (best-effort) ─────────────────────────────────────────────────

async function gh<T>(path: string): Promise<T | null> {
  if (!TOKEN) return null;
  try {
    const res = await fetch(`https://api.github.com${path}`, {
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        Accept: "application/vnd.github+json",
        "User-Agent": "audit-queue-seeder",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });
    if (!res.ok) {
      log(`  gh ${path} → ${res.status}`);
      return null;
    }
    return (await res.json()) as T;
  } catch (err) {
    log(`  gh ${path} failed: ${errMsg(err)}`);
    return null;
  }
}

// ── Signal gatherers ───────────────────────────────────────────────────────────

async function gatherCiFailures(): Promise<Signal[]> {
  const data = await gh<{ workflow_runs?: WorkflowRun[] }>(
    `/repos/${REPO}/actions/runs?per_page=50`,
  );
  if (!data?.workflow_runs) return [];
  const out: Signal[] = [];
  for (const run of data.workflow_runs) {
    if (run.conclusion !== "failure") continue;
    if (NOW - Date.parse(run.updated_at) > WINDOW_MS) continue;
    const onMain = run.head_branch === "main";
    out.push({
      slug: `ci-${run.id}`,
      severity: onMain ? "high" : "medium",
      source: "ci",
      signal: `CI workflow "${run.name}" failed on ${run.head_branch} (${shortSha(run.head_sha)})`,
      fix: onMain
        ? "main is red — bisect the failing job and ship a fix or revert ASAP"
        : "open the failing job log; fix the branch before its PR merges",
      reproducer: run.html_url,
    });
  }
  return out;
}

async function gatherVercelFailures(): Promise<Signal[]> {
  // Vercel posts deployment outcomes as commit statuses. Walk the last few main
  // commits + open-PR head commits and surface failure/error within the window.
  const commits = await gh<Array<{ sha: string }>>(
    `/repos/${REPO}/commits?sha=main&per_page=5`,
  );
  if (!commits) return [];
  const out: Signal[] = [];
  for (const c of commits) {
    const statuses = await gh<CommitStatus[]>(
      `/repos/${REPO}/commits/${c.sha}/statuses?per_page=20`,
    );
    if (!statuses) continue;
    for (const s of statuses) {
      const isVercel = /vercel/i.test(s.context) || /vercel/i.test(s.target_url || "");
      if (!isVercel) continue;
      if (s.state !== "failure" && s.state !== "error") continue;
      if (NOW - Date.parse(s.updated_at) > WINDOW_MS) continue;
      out.push({
        slug: `vercel-${c.sha.slice(0, 10)}-${s.context}`,
        severity: "high",
        source: "vercel",
        signal: `Vercel deployment ${s.state} on main (${shortSha(c.sha)}): ${s.description || s.context}`,
        fix: "open the Vercel build log; the live deploy is broken or degraded",
        reproducer: s.target_url || `https://github.com/${REPO}/commit/${c.sha}`,
      });
      break; // one entry per commit is enough
    }
  }
  return out;
}

function gatherBrandGateDrift(): Signal[] {
  const gatePath = join(REPO_ROOT, "tools", "brand", "brand-gate.mjs");
  if (!existsSync(gatePath)) {
    log("  brand-gate.mjs not found — skipping brand-gate drift check");
    return [];
  }
  let json: BrandGateOut | null = null;
  try {
    // --json exits 1 when there are new violations, so capture output even on
    // a non-zero exit.
    const raw = execFileSync("node", [gatePath, "--json"], {
      cwd: REPO_ROOT,
      encoding: "utf8",
    });
    json = JSON.parse(raw) as BrandGateOut;
  } catch (err) {
    const e = err as { stdout?: string };
    if (e.stdout) {
      try {
        json = JSON.parse(e.stdout) as BrandGateOut;
      } catch {
        /* fall through */
      }
    }
    if (!json) {
      log(`  brand-gate run failed: ${errMsg(err)}`);
      return [];
    }
  }
  if (!json || json.newViolations <= 0) return [];
  const top = json.violations
    .slice(0, 3)
    .map((v) => `${v.file}:${v.line} (${v.rule} ${v.match})`)
    .join("; ");
  return [
    {
      slug: `brand-gate-drift-${json.newViolations}`,
      severity: "medium",
      source: "brand-gate",
      signal: `Brand-gate drift: ${json.newViolations} NEW violation(s) above baseline (${json.baselineCount})`,
      fix: "fix the new violations (or, if intentional, re-baseline with `node tools/brand/brand-gate.mjs --baseline`)",
      reproducer: `node tools/brand/brand-gate.mjs --json — ${top}`,
    },
  ];
}

async function gatherStalePrs(): Promise<Signal[]> {
  const prs = await gh<PullRequest[]>(
    `/repos/${REPO}/pulls?state=open&per_page=30&sort=updated&direction=asc`,
  );
  if (!prs) return [];
  const out: Signal[] = [];
  for (const pr of prs) {
    if (pr.draft) continue; // drafts are intentionally parked
    const updatedAgo = NOW - Date.parse(pr.updated_at);
    if (updatedAgo < STALE_PR_MS) continue; // still active
    // CI green on the head?
    const combined = await gh<{ state?: string }>(
      `/repos/${REPO}/commits/${pr.head.sha}/status`,
    );
    const green = combined?.state === "success";
    if (!green) continue; // not ready — that's a CI signal, not a stale-merge one
    out.push({
      slug: `stale-pr-${pr.number}`,
      severity: "low",
      source: "stale-pr",
      signal: `PR #${pr.number} "${pr.title}" open ${Math.round(updatedAgo / 3.6e6)}h with no new commits, CI green`,
      fix: "review + merge, or close if superseded — it's been sitting ready",
      reproducer: pr.html_url,
    });
  }
  return out;
}

/** Parse a Playwright JSON report into failed-test signals. Exported for reuse. */
export function parsePlaywrightReport(reportPath: string): Signal[] {
  if (!existsSync(reportPath)) return [];
  let report: PlaywrightReport;
  try {
    report = JSON.parse(readFileSync(reportPath, "utf8")) as PlaywrightReport;
  } catch {
    return [];
  }
  const out: Signal[] = [];
  const walk = (suites: PwSuite[] | undefined, trail: string) => {
    for (const suite of suites || []) {
      const path = trail ? `${trail} › ${suite.title}` : suite.title;
      for (const spec of suite.specs || []) {
        const failed = (spec.tests || []).some((t) =>
          (t.results || []).some((r) => r.status === "failed" || r.status === "timedOut"),
        );
        if (spec.ok === false || failed) {
          const name = `${path} › ${spec.title}`;
          out.push({
            slug: `e2e-${slugify(name)}`,
            severity: "high",
            source: "e2e",
            signal: `E2E failing: ${name}`,
            fix: "open the Playwright trace; a customer-facing path regressed",
            reproducer: `${spec.file || "tests/e2e"} — "${spec.title}"`,
          });
        }
      }
      walk(suite.suites, path);
    }
  };
  walk(report.suites, "");
  return out;
}

function gatherE2eFailures(): Signal[] {
  const reportPath =
    process.env.PLAYWRIGHT_JSON_REPORT || join(REPO_ROOT, "playwright-report", "results.json");
  return parsePlaywrightReport(reportPath);
}

// ── INBOX writing ─────────────────────────────────────────────────────────────

function isoNow(): string {
  return new Date(NOW).toISOString().replace(/\.\d{3}Z$/, "Z");
}

function dateStamp(): string {
  return isoNow().slice(0, 10);
}

/** A Librarian-format entry that also carries the brief's required fields. */
export function renderEntry(s: Signal): string {
  const name = `audit-queue-${s.slug}-${dateStamp()}`;
  return [
    "",
    "---",
    `ts: ${isoNow()}`,
    `source: audit-queue-seeder`,
    `type-hint: ephemeral`,
    `suggested-name: ${name}`,
    `observation: |`,
    `  audit-queue regression [${s.severity}] — source: ${s.source}`,
    `  tags: audit-queue, regression, ${s.severity}, ${s.source}`,
    `  signal: ${s.signal}`,
    `  suggested-fix: ${s.fix}`,
    `  reproducer: ${s.reproducer}`,
    `  source: seeded by audit-queue-seeder, ${isoNow()}`,
    `links: []`,
    "---",
  ].join("\n");
}

/** Slugs already present in the INBOX (or its processed sibling) → skip. */
function existingSlugs(inboxPath: string): Set<string> {
  const seen = new Set<string>();
  for (const p of [inboxPath, inboxPath.replace(/INBOX\.md$/, "INBOX_PROCESSED.md")]) {
    if (!existsSync(p)) continue;
    const txt = readFileSync(p, "utf8");
    const re = /suggested-name:\s*audit-queue-(.+?)-\d{4}-\d{2}-\d{2}/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(txt))) seen.add(m[1]);
  }
  return seen;
}

interface WriteResult {
  target: string;
  written: number;
  skipped: number;
  mode: "local-inbox" | "ci-fallback" | "dry-run";
}

export function writeEntries(signals: Signal[]): WriteResult {
  // Resolve the target: real INBOX if its dir is reachable, else CI fallback.
  const inboxDirOk = existsSync(dirname(INBOX_PATH));
  const target = inboxDirOk ? INBOX_PATH : CI_FALLBACK;
  const mode: WriteResult["mode"] = DRY_RUN
    ? "dry-run"
    : inboxDirOk
      ? "local-inbox"
      : "ci-fallback";

  const seen = inboxDirOk ? existingSlugs(INBOX_PATH) : new Set<string>();
  const fresh = signals.filter((s) => !seen.has(s.slug));
  const skipped = signals.length - fresh.length;
  const body = fresh.map(renderEntry).join("\n");

  if (DRY_RUN) {
    log("\n── DRY RUN — would write the following entries ──");
    if (body) console.log(body);
    log(`\n(${fresh.length} new, ${skipped} already present)`);
    return { target, written: fresh.length, skipped, mode };
  }

  if (fresh.length > 0) {
    if (mode === "ci-fallback") {
      mkdirSync(dirname(target), { recursive: true });
      if (!existsSync(target)) {
        writeFileSync(
          target,
          "# Seeded audit-queue entries (CI fallback)\n" +
            "# The real INBOX is local-only; drain these into it from a local runner.\n",
        );
      }
    }
    appendFileSync(target, body + "\n");
  }

  // Mirror to the GH Actions job summary so a CI run surfaces what it found.
  const summary = process.env.GITHUB_STEP_SUMMARY;
  if (summary) {
    const lines = [
      `### audit-queue-seeder — ${fresh.length} new signal(s)`,
      "",
      ...fresh.map((s) => `- **[${s.severity}/${s.source}]** ${s.signal}`),
      skipped ? `\n_${skipped} already in INBOX (deduped)._` : "",
    ];
    appendFileSync(summary, lines.join("\n") + "\n");
  }

  return { target, written: fresh.length, skipped, mode };
}

// ── Helpers + types ─────────────────────────────────────────────────────────────

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}
function shortSha(sha: string): string {
  return (sha || "").slice(0, 7);
}
function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
function log(msg: string): void {
  // eslint-disable-next-line no-console
  console.log(msg);
}

interface WorkflowRun {
  id: number;
  name: string;
  conclusion: string | null;
  head_branch: string;
  head_sha: string;
  updated_at: string;
  html_url: string;
}
interface CommitStatus {
  state: string;
  context: string;
  description: string | null;
  target_url: string | null;
  updated_at: string;
}
interface PullRequest {
  number: number;
  title: string;
  draft: boolean;
  updated_at: string;
  html_url: string;
  head: { sha: string };
}
interface BrandGateOut {
  newViolations: number;
  baselineCount: number;
  violations: Array<{ rule: string; file: string; line: number; match: string }>;
}
interface PlaywrightReport {
  suites?: PwSuite[];
}
interface PwSuite {
  title: string;
  file?: string;
  specs?: PwSpec[];
  suites?: PwSuite[];
}
interface PwSpec {
  title: string;
  ok?: boolean;
  file?: string;
  tests?: Array<{ results?: Array<{ status: string }> }>;
}

// ── Main ─────────────────────────────────────────────────────────────────────

export async function gatherAll(): Promise<Signal[]> {
  if (!TOKEN) {
    log("No GITHUB_TOKEN — skipping CI / Vercel / stale-PR signals (brand-gate + E2E still run).");
  }
  const groups = await Promise.all([
    gatherCiFailures(),
    gatherVercelFailures(),
    gatherStalePrs(),
  ]);
  return [...groups.flat(), ...gatherBrandGateDrift(), ...gatherE2eFailures()];
}

async function main(): Promise<void> {
  log(`[audit-queue-seeder] ${isoNow()} — repo ${REPO}`);
  const signals = await gatherAll();
  log(`[audit-queue-seeder] gathered ${signals.length} signal(s).`);
  const result = writeEntries(signals);
  log(
    `[audit-queue-seeder] mode=${result.mode} target=${result.target} ` +
      `written=${result.written} deduped=${result.skipped}`,
  );
  if (result.mode === "ci-fallback") {
    log(
      "[audit-queue-seeder] NOTE: wrote to the CI fallback file — the local autofire " +
        "INBOX is unreachable from here. Run this on a local 30-min cadence to feed it.",
    );
  }
}

// Run only when invoked directly (not when imported by the companion script).
const invokedDirectly =
  process.argv[1] && resolve(process.argv[1]).endsWith("audit-queue-seeder.ts");
if (invokedDirectly) {
  main().catch((err) => {
    log(`[audit-queue-seeder] FATAL: ${errMsg(err)}`);
    process.exit(1);
  });
}
