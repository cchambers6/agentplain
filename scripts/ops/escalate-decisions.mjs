// escalate-decisions.mjs — M2's reader, rev-4 banded form (EU-6 + EU-15 core).
//
// The 2026-08-09 conclusion that outranks every individual defect: the
// escalation machinery works; nothing reads it. This is the reader, and its
// absence of reading is itself loud (it runs on GHA, its last-run age is a
// public fact, and a dead mirror keeps escalating last-known state).
//
// Rev 4: the reader consumes M9's RANKED mirror — it never sees ledger order.
// SLAs and bump cadence key on band, not a flat 7 days:
//   B0 exposure          issue on first sight, daily bump
//   B1 customer/revenue  48 h, bump every 3 days
//   B2 delivery          7 d  (matches M5), weekly bump
//   B3 fleet hygiene     14 d, weekly bump
//   B-UNKNOWN            7 d  (never silently bottom)
// An item that cannot prove its age (no parseable raised) is treated as past
// SLA — unproven age never buys silence.
//
// Total accounting is enforced, not hoped for: count(ranked items) must equal
// pending_total or the run goes red with a `ranking-incomplete` finding.
// 14-pending/8-surfaced can no longer happen silently.
//
// Consumption receipt is structural: an item leaves `pending` (or gains a
// future snooze_until) -> the next mirror shows it gone -> its issue closes.
// Snooze is a legitimate answer; the goal is NO SILENT PENDING, not forced
// action.

import fs from "node:fs";
import { pathToFileURL } from "node:url";
import { ghApi, REPO, readToken, nowIso, hoursBetween, daysBetween, parseIso, hasFlag, argValue } from "./lib.mjs";
import { fetchOpenIssues, findBySlug, slugMarker, executeActions } from "./upsert-issue.mjs";

export const SLA_DAYS = { B0: 0, B1: 2, B2: 7, B3: 14, "B-UNKNOWN": 7 };
export const BUMP_DAYS = { B0: 1, B1: 3, B2: 7, B3: 7, "B-UNKNOWN": 7 };
const MIRROR_STALE_HOURS = 26;
const DECISION_LABEL = "decision-overdue";

const slugFor = (id) => `decision:${id}`;

export function evaluateReader({ payload, openIssues, now }) {
  const actions = [];
  const findings = [];

  if (!payload || !payload.queue) {
    findings.push("mirror-unreadable");
    if (!findBySlug(openIssues, "mirror-unreadable")) {
      actions.push({
        type: "create",
        slug: "mirror-unreadable",
        title: "fleet-ops: heartbeat queue mirror missing or unparseable",
        body: `The decision-escalation reader could not read the queue mirror from ops/heartbeat at ${now}. The reader does not go quiet when the writer dies — this issue is the noise. Escalation of individual items resumes on the next readable mirror.`,
        labels: ["fleet-ops"],
      });
    }
    return { actions, findings, red: true };
  }

  const q = payload.queue;
  const staleMirror = payload.ts && hoursBetween(payload.ts, now) > MIRROR_STALE_HOURS;
  const staleNote = staleMirror
    ? `\n\n> ⚠ The heartbeat mirror is stale (payload ts ${payload.ts}) — the host may be down (see any open fleet-down issue). Escalating LAST-KNOWN state: overdue is overdue regardless of whether the host is currently up.`
    : "";

  let items;
  if (q.mirror_mode === "ranked") {
    items = [...(q.business_lane || []), ...(q.fleet_lane || [])];
    // Total accounting: enumerate, don't sample — as a machine check.
    if (items.length !== q.pending_total) {
      findings.push("ranking-incomplete");
      if (!findBySlug(openIssues, "ranking-incomplete")) {
        actions.push({
          type: "create",
          slug: "ranking-incomplete",
          title: `fleet-ops: ranking-incomplete — ${items.length} ranked vs ${q.pending_total} pending`,
          body: `The ranked mirror accounts for ${items.length} items but declares pending_total ${q.pending_total} (payload ts ${payload.ts}). Every pending item must be ranked; a shortfall is how 14-pending/8-surfaced happened. Fix the ranker or the mirror, not this issue.`,
          labels: ["fleet-ops"],
        });
      }
    }
  } else {
    // Pre-M9 mirror: never go quiet, but say loudly that order is missing.
    items = (q.items || [])
      .filter((i) => i.status === "pending")
      .map((i) => ({ ...i, band: "B-UNKNOWN" }));
    findings.push("mirror-not-ranked");
    if (!findBySlug(openIssues, "mirror-not-ranked")) {
      actions.push({
        type: "create",
        slug: "mirror-not-ranked",
        title: "fleet-ops: queue mirror is not ranked (rank-queue.mjs missing from the publisher)",
        body: `The mirror arrived in ${q.mirror_mode || "unknown"} mode at ${now}. The reader is escalating everything on the conservative 7-day SLA, but a reader that faithfully automates the wrong order has not solved anything — install M9's ranker.`,
        labels: ["fleet-ops"],
      });
    }
  }

  const pendingSlugs = new Set(items.map((i) => slugFor(i.id)));

  for (const item of items) {
    const slug = slugFor(item.id);
    const existing = findBySlug(openIssues, slug);
    const snoozed = item.snooze_until && new Date(parseIso(item.snooze_until)) > new Date(now);

    if (snoozed) {
      if (existing) {
        actions.push({
          type: "close",
          number: existing.number,
          body: `Snoozed until ${item.snooze_until} — snooze is a first-class answer. Reopens via a fresh issue if still pending after that date.`,
        });
      }
      continue;
    }

    const raised = parseIso(item.raised);
    const ageDays = raised ? daysBetween(raised, now) : Infinity;
    const band = item.band || "B-UNKNOWN";
    const sla = SLA_DAYS[band] ?? 7;
    if (ageDays < sla) continue;

    const ageLabel = raised ? `${Math.floor(ageDays)}d` : "age unproven — treated as overdue";
    if (existing) {
      const lastTouch = existing.updated_at || existing.created_at;
      if (daysBetween(lastTouch, now) >= (BUMP_DAYS[band] ?? 7)) {
        actions.push({
          type: "comment",
          number: existing.number,
          body: `Still pending at ${now} (${ageLabel}, band ${band}). Consuming it = changing its status in the queue (answer / reject / resolve-*) or setting snooze_until.${staleNote}`,
        });
      }
    } else {
      actions.push({
        type: "create",
        slug,
        title: `[${band}] ${item.id} — pending ${ageLabel}`,
        body: [
          `**${String(item.title || "").slice(0, 200)}**`,
          ``,
          `- Band: ${band} (${band === "B0" ? "exposure — no grace period" : `SLA ${sla}d`}), age: ${ageLabel}`,
          `- Declared priority (display only, never orders): ${item.declared_priority ?? "none"}`,
          item.recommended_default ? `- Recommended default: ${item.recommended_default}` : null,
          ``,
          `Consumed when its status leaves \`pending\` in the live queue (or it gains \`snooze_until\`) — this issue then closes automatically on the next mirror. Snooze is a legitimate answer; the invariant is NO SILENT PENDING.${staleNote}`,
        ]
          .filter((l) => l !== null)
          .join("\n"),
        labels: [DECISION_LABEL, "fleet-ops", `band-${band.toLowerCase()}`],
      });
    }
  }

  // Structural consumption: close issues for items no longer pending.
  for (const issue of openIssues || []) {
    const m = (issue.body || "").match(/<!-- ops-slug: (decision:[^ ]+) -->/);
    if (m && !pendingSlugs.has(m[1])) {
      actions.push({
        type: "close",
        number: issue.number,
        body: `Consumed: '${m[1].slice("decision:".length)}' is no longer pending in the queue mirror (observed ${now}).`,
      });
    }
  }

  return { actions, findings, red: findings.length > 0 };
}

async function fetchPayload({ token }) {
  const file = await ghApi(
    `/repos/${REPO}/contents/heartbeat.json?ref=${encodeURIComponent("ops/heartbeat")}`,
    { token, ok404: true }
  );
  if (!file) return null;
  try {
    return JSON.parse(Buffer.from(file.content, "base64").toString("utf8"));
  } catch {
    return null;
  }
}

async function main() {
  const dryRun = hasFlag("--dry-run");
  const fixtureFile = argValue("--fixture");
  let payload;
  let openIssues;
  let token = null;
  let now = argValue("--now") || nowIso();

  if (fixtureFile) {
    const fx = JSON.parse(fs.readFileSync(fixtureFile, "utf8"));
    payload = fx.payload ?? null;
    openIssues = fx.open_issues ?? [];
    if (fx.now) now = fx.now;
  } else {
    token = readToken();
    payload = await fetchPayload({ token });
    openIssues = await fetchOpenIssues({ token, labels: "decision-overdue" });
    const opsIssues = await fetchOpenIssues({ token, labels: "fleet-ops" });
    const seen = new Set(openIssues.map((i) => i.number));
    for (const i of opsIssues) if (!seen.has(i.number)) openIssues.push(i);
  }

  const result = evaluateReader({ payload, openIssues, now });
  await executeActions(result.actions, { token, dryRun: dryRun || Boolean(fixtureFile) });
  process.stdout.write(
    `decision-escalation: ${result.actions.length} action(s), findings: ${result.findings.join(", ") || "none"}\n`
  );
  process.exit(result.red ? 1 : 0);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => {
    process.stderr.write(`escalate-decisions failed: ${e.message}\n`);
    process.exit(1);
  });
}
