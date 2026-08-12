// deploy-state.mjs — deploy-state as a first-class fact.
//
// Answers, durably and from off-host data only: is origin/main actually
// deployed to production, and if not, since when? "Merged" is not "shipped" —
// production served a 2026-06-17 build for eight weeks while every surface a
// human glanced at said green, because previews (which stay READY) skip
// `migrate deploy` and production (which runs it) had been in state ERROR
// since 2026-07-02. No check existed for either signal. This is that check.
//
// Source of truth: GitHub's Deployments API. Vercel posts every deployment
// and its outcome there, so this needs NO Vercel token and no on-host
// component — the default GITHUB_TOKEN in Actions is enough, and the same
// report is embedded in the heartbeat payload for always-available reading.
//
// Subcommands:
//   report [--json]   print the deploy-state fact
//   check  [--dry-run] [--fixture <file>] [--now <iso>]
//                     evaluate alarms and upsert/close issues; exit 1 when red
//
// Alarm conditions (constants below):
//   prod-deploy-error  latest production deployment is failure/error
//   prod-deploy-stale  no successful production deployment in > MAX_DAYS days
//
// Deliberate-failure test: deploy-state.test.mjs fixtures. Ship-day rule: on
// 2026-08-11's real data BOTH alarms MUST fire (last success 2026-06-17,
// every production deployment since in state failure). A first run that
// opens zero issues is a failed acceptance test.

import fs from "node:fs";
import { pathToFileURL } from "node:url";
import {
  ghApi,
  REPO,
  readToken,
  nowIso,
  daysBetween,
  hasFlag,
  argValue,
} from "./lib.mjs";
import { fetchOpenIssues, findBySlug, executeActions } from "./upsert-issue.mjs";

export const MAX_DAYS_WITHOUT_SUCCESS = 7;
const ENVIRONMENT = "Production";
const MAX_DEPLOYMENTS_WALKED = 500; // 5 pages; if no success in 500, that IS the finding
const FAILED_STATES = new Set(["failure", "error"]);

// Walk production deployments newest-first until the first success.
// One statuses call per deployment: expensive only while production is
// broken, which is exactly when the calls are worth it.
export async function fetchDeployState({ token }) {
  const walked = [];
  let lastSuccess = null;
  for (let page = 1; page <= MAX_DEPLOYMENTS_WALKED / 100 && !lastSuccess; page++) {
    const deployments = await ghApi(
      `/repos/${REPO}/deployments?environment=${ENVIRONMENT}&per_page=100&page=${page}`,
      { token }
    );
    if (!deployments.length) break;
    for (const d of deployments) {
      const statuses = await ghApi(`${d.statuses_url}?per_page=1`, { token });
      const state = statuses[0]?.state ?? "unknown";
      walked.push({ sha: d.sha, created_at: d.created_at, state });
      if (state === "success") {
        lastSuccess = { sha: d.sha, created_at: d.created_at };
        break;
      }
    }
  }
  const mainRef = await ghApi(`/repos/${REPO}/git/ref/heads/main`, { token });
  return {
    walked,
    lastSuccess,
    originMainSha: mainRef.object.sha,
    walkExhausted: !lastSuccess && walked.length >= MAX_DEPLOYMENTS_WALKED,
  };
}

export async function buildReport({ token, now = nowIso(), state }) {
  const s = state ?? (await fetchDeployState({ token }));
  const latest = s.walked[0] ?? null;
  const consecutiveFailures = s.lastSuccess
    ? s.walked.findIndex((w) => w.state === "success")
    : s.walked.length;

  let originMainDeployed = null;
  let behindBy = null;
  if (s.lastSuccess) {
    originMainDeployed = s.lastSuccess.sha === s.originMainSha;
    if (!originMainDeployed && token && !state) {
      try {
        const cmp = await ghApi(
          `/repos/${REPO}/compare/${s.lastSuccess.sha}...${s.originMainSha}`,
          { token }
        );
        behindBy = cmp.ahead_by; // commits on origin/main not in production
      } catch {
        behindBy = null;
      }
    }
  }

  return {
    generated: now,
    environment: ENVIRONMENT,
    latest_production_deployment: latest,
    last_successful_production_deployment: s.lastSuccess
      ? { ...s.lastSuccess, days_ago: +daysBetween(s.lastSuccess.created_at, now).toFixed(1) }
      : null,
    consecutive_failed_deployments_since_success: consecutiveFailures,
    origin_main: {
      sha: s.originMainSha,
      deployed_to_production: originMainDeployed,
      undeployed_since: originMainDeployed ? null : (s.lastSuccess?.created_at ?? "unknown"),
      commits_not_in_production: behindBy,
    },
    walk: { deployments_examined: s.walked.length, exhausted_without_success: s.walkExhausted },
  };
}

export function evaluate(report, { openErrorIssue = null, openStaleIssue = null } = {}) {
  const actions = [];
  const now = report.generated;
  const latest = report.latest_production_deployment;
  const success = report.last_successful_production_deployment;

  // Condition 1: latest production deployment is failed/error.
  const errorActive = latest && FAILED_STATES.has(latest.state);
  if (errorActive && !openErrorIssue) {
    actions.push({
      type: "create",
      slug: "deploy:error",
      title: `prod-deploy-error: latest production deployment is ${latest.state} (${latest.sha.slice(0, 7)})`,
      body: [
        `The latest production deployment is in state **${latest.state}**.`,
        ``,
        `- Deployment: \`${latest.sha}\` at ${latest.created_at}`,
        `- Consecutive failed production deployments since the last success: **${report.consecutive_failed_deployments_since_success}**`,
        `- Source: GitHub Deployments API (environment: ${ENVIRONMENT}), judged off-host.`,
        ``,
        `This issue auto-closes when a production deployment reaches state success.`,
      ].join("\n"),
      labels: ["deploy-dead", "fleet-ops"],
    });
  } else if (!errorActive && openErrorIssue) {
    actions.push({
      type: "close",
      number: openErrorIssue.number,
      body: `Cleared at ${now}: latest production deployment is ${latest ? latest.state : "absent"}.`,
    });
  }

  // Condition 2: too long without a successful production deployment.
  const daysWithout = success ? success.days_ago : Infinity;
  const staleActive = daysWithout > MAX_DAYS_WITHOUT_SUCCESS;
  if (staleActive && !openStaleIssue) {
    const om = report.origin_main;
    actions.push({
      type: "create",
      slug: "deploy:stale",
      title: `prod-deploy-stale: no successful production deploy in ${
        success ? Math.floor(daysWithout) + " days" : ">" + report.walk.deployments_examined + " deployments"
      }`,
      body: [
        `Production has not deployed successfully in **${
          success ? daysWithout + " days" : "longer than the " + report.walk.deployments_examined + " deployments examined"
        }** (threshold: ${MAX_DAYS_WITHOUT_SUCCESS} days).`,
        ``,
        `- Last successful production deployment: ${
          success ? `\`${success.sha}\` at ${success.created_at}` : "none found"
        }`,
        `- origin/main (\`${om.sha.slice(0, 7)}\`) deployed to production: **${om.deployed_to_production}**${
          om.deployed_to_production === false
            ? ` — undeployed since ${om.undeployed_since}${
                om.commits_not_in_production != null
                  ? `, ${om.commits_not_in_production} commits not in production`
                  : ""
              }`
            : ""
        }`,
        `- "Merged" is not "shipped": everything landed on main since that date is correct, reviewed, and NOT LIVE.`,
        ``,
        `This issue auto-closes when a production deployment reaches state success.`,
      ].join("\n"),
      labels: ["deploy-dead", "fleet-ops"],
    });
  } else if (!staleActive && openStaleIssue) {
    actions.push({
      type: "close",
      number: openStaleIssue.number,
      body: `Cleared at ${now}: successful production deployment ${success.sha.slice(0, 7)} at ${success.created_at}.`,
    });
  }

  return { red: Boolean(errorActive || staleActive), actions };
}

async function main() {
  const cmd = process.argv[2];
  const dryRun = hasFlag("--dry-run");
  const fixtureFile = argValue("--fixture");
  const now = argValue("--now") || nowIso();

  if (cmd === "report") {
    const token = readToken();
    const report = await buildReport({ token, now });
    process.stdout.write(JSON.stringify(report, null, hasFlag("--json") ? 0 : 2) + "\n");
    return;
  }

  if (cmd === "check") {
    let report;
    let openErrorIssue = null;
    let openStaleIssue = null;
    let token = null;

    if (fixtureFile) {
      const fx = JSON.parse(fs.readFileSync(fixtureFile, "utf8"));
      report = fx.report ?? (await buildReport({ now, state: fx.state }));
      openErrorIssue = fx.open_error_issue ?? null;
      openStaleIssue = fx.open_stale_issue ?? null;
    } else {
      token = readToken();
      report = await buildReport({ token, now });
      const open = await fetchOpenIssues({ token, labels: "deploy-dead" });
      openErrorIssue = findBySlug(open, "deploy:error");
      openStaleIssue = findBySlug(open, "deploy:stale");
    }

    const result = evaluate(report, { openErrorIssue, openStaleIssue });
    await executeActions(result.actions, { token, dryRun: dryRun || Boolean(fixtureFile) });
    process.stdout.write(
      `deploy-state: ${result.red ? "RED" : "green"} — origin/main deployed: ${report.origin_main.deployed_to_production}, last success: ${
        report.last_successful_production_deployment?.created_at ?? "none"
      }\n`
    );
    process.exit(result.red ? 1 : 0);
  }

  process.stderr.write("usage: node scripts/ops/deploy-state.mjs <report|check> [--json] [--dry-run] [--fixture <f>] [--now <iso>] [--token-file <p>]\n");
  process.exit(2);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => {
    process.stderr.write(`deploy-state failed: ${e.message}\n`);
    process.exit(1);
  });
}
