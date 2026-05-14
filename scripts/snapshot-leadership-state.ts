/**
 * scripts/snapshot-leadership-state.ts
 *
 * Build- or operator-run script that produces
 * `public/leadership-snapshot.json` — the v1 data file the leadership
 * board reads.
 *
 * Run: `npx tsx scripts/snapshot-leadership-state.ts`
 *
 * Discovery rules:
 *
 *   1. If `LEADERSHIP_STATE_DIR` env var is set, treat it as the
 *      directory containing per-agent daily-log + recommendation
 *      markdown files. This is the supported integration point: the
 *      operator points the env var at `C:/flatsbo/agent-state` (or
 *      whatever vendor-neutral mount path eventually replaces it).
 *
 *   2. If `LEADERSHIP_STATE_DIR` is unset but `../flatsbo/agent-state`
 *      exists relative to repo root (common local dev layout), use it.
 *
 *   3. If neither resolves, write an empty snapshot. The page renders
 *      its `NotYetFired` empty-state — which is the expected v1 view
 *      before any leadership cron has fired.
 *
 * Per `feedback_no_silent_vendor_lock.md`: this script is a one-time
 * transform, not a vendor adapter. The page never calls into here at
 * runtime; it reads the JSON file the script wrote.
 *
 * Per `feedback_no_guesses_no_estimates.md`: every observation in the
 * output cites either a real file (mtime + first-line summary) or is
 * omitted. Missing data is never extrapolated.
 */

import {
  readdir,
  readFile,
  stat,
  writeFile,
  mkdir,
} from "node:fs/promises";
import path from "node:path";
import {
  LEADERSHIP_ROSTER,
  type AgentObservation,
  type AgentRecommendationRef,
  type AgentEscalationRef,
  type LeadershipSnapshot,
} from "../lib/operator/leadership-data";

// Assume `npx tsx scripts/snapshot-leadership-state.ts` is run from the
// repo root — same convention as every other script in this directory
// (cf. scripts/seed-knowledge.ts, scripts/demo-skill-chain.ts).
const REPO_ROOT = process.cwd();
const SNAPSHOT_PATH = path.join(REPO_ROOT, "public", "leadership-snapshot.json");

interface ResolvedStateDir {
  dir: string;
  source: LeadershipSnapshot["source"];
}

async function resolveStateDir(): Promise<ResolvedStateDir | null> {
  const explicit = process.env.LEADERSHIP_STATE_DIR;
  if (explicit) {
    if (await directoryExists(explicit)) {
      return { dir: explicit, source: "flatsbo-repo" };
    }
    console.warn(
      `[snapshot] LEADERSHIP_STATE_DIR=${explicit} does not exist; falling back`,
    );
  }
  const sibling = path.resolve(REPO_ROOT, "..", "flatsbo", "agent-state");
  if (await directoryExists(sibling)) {
    return { dir: sibling, source: "flatsbo-repo" };
  }
  return null;
}

async function directoryExists(p: string): Promise<boolean> {
  try {
    const s = await stat(p);
    return s.isDirectory();
  } catch {
    return false;
  }
}

async function readFirstNonEmptyLine(filePath: string): Promise<string | null> {
  try {
    const raw = await readFile(filePath, "utf8");
    const line = raw
      .split(/\r?\n/)
      .map((l) => l.trim())
      .find((l) => l.length > 0 && !l.startsWith("#"));
    return line ?? null;
  } catch {
    return null;
  }
}

async function readDailyLog(
  stateDir: string,
  agentId: string,
): Promise<{ lastFiredAt: string | null; summary: string | null }> {
  const filePath = path.join(stateDir, `${agentId}-daily-log.md`);
  try {
    const s = await stat(filePath);
    const summary = await readFirstNonEmptyLine(filePath);
    return {
      lastFiredAt: s.mtime.toISOString(),
      summary,
    };
  } catch {
    return { lastFiredAt: null, summary: null };
  }
}

interface ParsedRecommendation {
  rec: AgentRecommendationRef | null;
  escalation: AgentEscalationRef | null;
}

async function readRecommendations(
  stateDir: string,
  agentId: string,
): Promise<ParsedRecommendation> {
  const filePath = path.join(stateDir, `${agentId}-recommendations.md`);
  let raw: string;
  try {
    raw = await readFile(filePath, "utf8");
  } catch {
    return { rec: null, escalation: null };
  }
  const lines = raw.split(/\r?\n/);
  let rec: AgentRecommendationRef | null = null;
  let escalation: AgentEscalationRef | null = null;
  // Format we tolerate (per existing flatsbo `*-recommendations.md`
  // conventions): each entry is a `## YYYY-MM-DD — STATUS — Title`
  // heading. We grab the first one we see (file is reverse-chrono).
  for (const line of lines) {
    const m = line.match(/^##\s+(\d{4}-\d{2}-\d{2})\s+[—-]\s+(\w+)\s+[—-]\s+(.+)$/);
    if (m && !rec) {
      rec = {
        id: `${agentId}#${m[1]}`,
        status: m[2].toUpperCase(),
        title: m[3].trim(),
        recordedAt: `${m[1]}T00:00:00Z`,
      };
    }
    const escMatch = line.match(/^!!\s*ESCALATION:\s+(.+)$/i);
    if (escMatch && !escalation) {
      escalation = {
        title: escMatch[1].trim(),
        recordedAt: new Date().toISOString(),
      };
    }
    if (rec && escalation) break;
  }
  return { rec, escalation };
}

async function buildObservationsFromDir(
  stateDir: string,
): Promise<AgentObservation[]> {
  const observations: AgentObservation[] = [];
  // Pre-scan the directory once to avoid stat-ing for every roster
  // entry. We still join paths per-agent below — this is just a fast
  // existence cache.
  const entries = new Set<string>();
  try {
    for (const e of await readdir(stateDir)) entries.add(e);
  } catch {
    // Empty / unreadable directory: every agent will resolve to NotYetFired.
  }

  for (const agent of LEADERSHIP_ROSTER) {
    const hasLog = entries.has(`${agent.id}-daily-log.md`);
    const hasRecs = entries.has(`${agent.id}-recommendations.md`);
    if (!hasLog && !hasRecs) continue;

    const { lastFiredAt, summary } = hasLog
      ? await readDailyLog(stateDir, agent.id)
      : { lastFiredAt: null, summary: null };
    const { rec, escalation } = hasRecs
      ? await readRecommendations(stateDir, agent.id)
      : { rec: null, escalation: null };

    observations.push({
      agentId: agent.id,
      lastFiredAt,
      lastFireSummary: summary,
      lastError: null,
      latestRecommendation: rec,
      latestEscalation: escalation,
    });
  }

  return observations;
}

async function main(): Promise<void> {
  const resolved = await resolveStateDir();
  const observations = resolved
    ? await buildObservationsFromDir(resolved.dir)
    : [];

  const snapshot: LeadershipSnapshot = {
    generatedAt: new Date().toISOString(),
    source: resolved ? resolved.source : "empty",
    observations,
  };

  await mkdir(path.dirname(SNAPSHOT_PATH), { recursive: true });
  await writeFile(SNAPSHOT_PATH, JSON.stringify(snapshot, null, 2) + "\n", "utf8");

  console.log(
    `[snapshot] wrote ${SNAPSHOT_PATH} — source=${snapshot.source} agents=${observations.length}/${LEADERSHIP_ROSTER.length}`,
  );
}

main().catch((err: unknown) => {
  console.error("[snapshot] failed:", err);
  process.exit(1);
});
