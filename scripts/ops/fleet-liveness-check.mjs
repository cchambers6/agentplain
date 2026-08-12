// fleet-liveness-check.mjs — M1's reader (EU-5), run by
// .github/workflows/fleet-liveness.yml on GitHub's infrastructure — outside
// the host failure domain by construction.
//
// Health condition: the ops/heartbeat branch's head commit is recent.
// Alarm condition: its negation. Nothing in the alarm path depends on the
// host being able to say anything — this failure mode produces no errors,
// only absence, so we alarm on staleness only, never on error signals.
//
// Exit 1 (red run) when stale; exit 0 when fresh. A red run upserts one
// `fleet-down` issue; recovery auto-closes it with the measured outage
// duration stamped in (the outage ruler made human-readable).
//
// Deliberate-failure test: --simulate-stale evaluates the heartbeat as if its
// timestamp were epoch 0 and MUST produce a red run and a [DRILL] issue.

import fs from "node:fs";
import { pathToFileURL } from "node:url";
import { ghApi, REPO, readToken, nowIso, hoursBetween, hasFlag, argValue } from "./lib.mjs";
import { fetchOpenIssues, findBySlug, executeActions } from "./upsert-issue.mjs";

export const STALE_THRESHOLD_HOURS = 2; // 4 missed 30-min beats

export function evaluate({
  headCommitIso, // ISO ts of ops/heartbeat head commit, or null if branch/commits absent
  prevCommitIso, // ISO ts of the commit before head, or null
  openIssue, // existing open fleet-down issue object ({number, created_at}) or null
  now,
  simulateStale = false,
  thresholdHours = STALE_THRESHOLD_HOURS,
}) {
  const effectiveHead = simulateStale ? "1970-01-01T00:00:00Z" : headCommitIso;
  const drill = simulateStale ? "[DRILL] " : "";
  const slug = "fleet-down";
  const actions = [];

  const ageHours = effectiveHead ? hoursBetween(effectiveHead, now) : Infinity;

  if (ageHours > thresholdHours) {
    const detail = effectiveHead
      ? `last heartbeat ${effectiveHead} (${ageHours.toFixed(1)} h ago; threshold ${thresholdHours} h)`
      : `no ops/heartbeat branch or no commits on it — the fleet has never published a heartbeat, which is indistinguishable from a dead fleet and is treated as one`;
    const title = `${drill}fleet-down: heartbeat stale — ${
      effectiveHead ? `${ageHours.toFixed(1)} h old` : "never published"
    }`;
    const body = [
      `The off-host liveness check found the fleet heartbeat stale as of ${now}.`,
      ``,
      `- ${detail}`,
      `- Judged from GitHub Actions; no on-host component is in this alarm's dependency chain.`,
      `- Recovery: this issue auto-closes with the measured outage duration when the next fresh heartbeat lands on \`ops/heartbeat\`.`,
    ].join("\n");
    if (openIssue) {
      actions.push({
        type: "comment",
        number: openIssue.number,
        body: `${drill}Still stale at ${now} — ${detail}`,
      });
    } else {
      actions.push({
        type: "create",
        slug,
        title,
        body,
        labels: simulateStale ? ["fleet-down", "fleet-ops", "drill"] : ["fleet-down", "fleet-ops"],
      });
    }
    return { status: "stale", ageHours, actions };
  }

  if (openIssue) {
    // Measured duration: the gap between the two consecutive heartbeat commits
    // spanning the outage when that gap exceeds the threshold; otherwise fall
    // back to time-since-issue-creation (labelled as such).
    const gap = prevCommitIso ? hoursBetween(prevCommitIso, headCommitIso) : null;
    const duration =
      gap && gap > thresholdHours
        ? `${gap.toFixed(1)} h (measured: gap between heartbeat commits ${prevCommitIso} -> ${headCommitIso})`
        : `≤${hoursBetween(openIssue.created_at, now).toFixed(1)} h (inferred from issue lifetime; commit gap was ${gap ? gap.toFixed(1) + " h" : "unavailable"})`;
    actions.push({
      type: "close",
      number: openIssue.number,
      body: `Recovered: fresh heartbeat ${headCommitIso} observed at ${now}. Outage duration: ${duration}.`,
    });
  }
  return { status: "fresh", ageHours, actions };
}

async function main() {
  const token = readToken();
  const dryRun = hasFlag("--dry-run");
  const simulateStale = hasFlag("--simulate-stale");
  const fixtureFile = argValue("--fixture");

  let headCommitIso = null;
  let prevCommitIso = null;
  let openIssue = null;
  let now = nowIso();

  if (fixtureFile) {
    const fx = JSON.parse(fs.readFileSync(fixtureFile, "utf8"));
    ({ headCommitIso = null, prevCommitIso = null, openIssue = null } = fx);
    if (fx.now) now = fx.now;
  } else {
    const commits = await ghApi(
      `/repos/${REPO}/commits?sha=${encodeURIComponent("ops/heartbeat")}&per_page=2`,
      { token, ok404: true }
    );
    if (Array.isArray(commits) && commits.length > 0) {
      headCommitIso = commits[0].commit.committer.date;
      prevCommitIso = commits[1]?.commit.committer.date ?? null;
    }
    const open = await fetchOpenIssues({ token, labels: "fleet-down" });
    openIssue = findBySlug(open, "fleet-down");
  }

  const result = evaluate({ headCommitIso, prevCommitIso, openIssue, now, simulateStale });
  await executeActions(result.actions, { token, dryRun });

  process.stdout.write(
    `fleet-liveness: ${result.status} (age ${result.ageHours === Infinity ? "∞" : result.ageHours.toFixed(1) + " h"})\n`
  );
  process.exit(result.status === "stale" ? 1 : 0);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => {
    process.stderr.write(`fleet-liveness-check failed: ${e.message}\n`);
    process.exit(1);
  });
}
