// rank-queue.mjs — M9 Value Order (EU-14, rev 4).
//
// Rank is DERIVED, never judged at ranking time: band falls out of the item's
// `subject` (stamped at admission) or the value map's narrow keyword
// tripwires; within a band, oldest `raised` first; an item that cannot prove
// its age sorts after every dated item. Declared priority/severity never
// order anything — the live ledger declares the leaked PAT priority 6 of 8,
// carries priority: None on three items and a string 'medium' on another; a
// field that unreliable is evidence for this design, not input to it.
//
// Two lanes, not one order: B0–B2 form the business lane; B3 is a separate,
// always-rendered fleet lane — floored, not starved. A scratch sweep can
// never sit above the outage because they are never in the same list.
//
// The surface is GENERATED, never composed: the Librarian and M2's mirror
// consume this output verbatim. The producer of most queue items no longer
// produces the ranking.
//
// Subcommands:
//   rank [--json] [--queue-file <p>]        emit the ranked lanes
//   admit --id --title --subject --producer [--ask <s>]
//                                            the ONE door for new queue items
//   backfill [--write]                       one-time subject/producer stamp
//                                            of the pre-door pending items

import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { repoRoot, argValue, hasFlag, nowIso, parseIso, daysBetween } from "./lib.mjs";
import { resolveStore } from "./resolve-store.mjs";

const VALUE_MAP = path.join(repoRoot, "ops", "value-map.yaml");
const BUSINESS_BANDS = ["B0", "B1", "B2"];

async function yamlLib() {
  return (await import("js-yaml")).default;
}

export async function loadValueMap(file = VALUE_MAP) {
  const yaml = await yamlLib();
  return yaml.load(fs.readFileSync(file, "utf8"));
}

async function liveQueuePath() {
  const store = resolveStore("agent_store");
  if (store.code !== 0) throw new Error(store.error);
  return path.join(store.path, "data", "conner-queue.yaml");
}

export async function loadQueue(queueFile) {
  const yaml = await yamlLib();
  const p = queueFile ?? (await liveQueuePath());
  return { path: p, doc: yaml.load(fs.readFileSync(p, "utf8")) };
}

// Classification text is bounded (title/ask truncated) so a long amendment
// note can never smuggle an item into the wrong band.
function classificationText(item) {
  return [item.id, item.kind, String(item.title || "").slice(0, 200), String(item.ask || "").slice(0, 200)]
    .filter(Boolean)
    .join(" ");
}

export function classify(item, map) {
  for (const band of map.bands) {
    if (item.subject && (band.subjects || []).includes(item.subject)) return band.id;
  }
  const text = classificationText(item);
  for (const band of map.bands) {
    if (band.keywords && new RegExp(band.keywords, "i").test(text)) return band.id;
  }
  return "B-UNKNOWN";
}

function raisedIso(item) {
  return parseIso(item.raised) ?? parseIso(item.first_surfaced) ?? parseIso(item.opened);
}

function isSelfProduced(item) {
  const producer = String(item.producer ?? item.source ?? item.raised_by ?? item.opened_by_pass ?? "");
  return /librarian|working[_-]?state|calibration|roll-?up|watchdog|hygiene|pass\s*\d+|^\d+$/i.test(producer);
}

export function rank(items, map, now = nowIso()) {
  const pending = items.filter((i) => i.status === "pending");
  const entries = pending.map((item, ledgerIndex) => {
    const band = classify(item, map);
    const raised = raisedIso(item);
    return {
      band,
      id: item.id,
      title: String(item.title || item.ask || "").slice(0, 200),
      raised,
      age_days: raised ? +daysBetween(raised, now).toFixed(1) : null,
      declared_priority: item.priority ?? item.severity ?? null,
      subject: item.subject ?? null,
      producer: item.producer ?? item.source ?? item.raised_by ?? (item.opened_by_pass ? `librarian pass ${item.opened_by_pass}` : null),
      snooze_until: item.snooze_until ?? null,
      recommended_default: item.recommended_default ? String(item.recommended_default).slice(0, 300) : null,
      self_produced: isSelfProduced(item),
      _ledgerIndex: ledgerIndex,
    };
  });

  // Within a band: dated items oldest-first; undated after every dated item
  // (an item that cannot prove its age cannot claim seniority), ledger order
  // preserved among the undated.
  const byAge = (a, b) => {
    if (a.raised && b.raised) return new Date(a.raised) - new Date(b.raised);
    if (a.raised) return -1;
    if (b.raised) return 1;
    return a._ledgerIndex - b._ledgerIndex;
  };

  const lane = (bandIds) =>
    bandIds
      .flatMap((bid) => entries.filter((e) => e.band === bid).sort(byAge))
      .map((e, i) => {
        const { _ledgerIndex, ...rest } = e;
        return { rank: i + 1, ...rest };
      });

  const business = lane(BUSINESS_BANDS);
  // B-UNKNOWN heads the fleet lane, flagged — unknown is never important and
  // never silently bottom.
  const fleet = lane(["B-UNKNOWN", "B3"]).map((e) =>
    e.band === "B-UNKNOWN" ? { ...e, flag: "classify me — no value-map match; one-line PR to ops/value-map.yaml" } : e
  );

  const self = entries.filter((e) => e.self_produced).length;
  return {
    generated: now,
    generator: "rank-queue.mjs",
    pending_total: pending.length,
    producer_ratio: { self_generated: self, external: pending.length - self },
    business_lane: business,
    fleet_lane: fleet,
  };
}

export function renderText(ranked) {
  const lines = [];
  lines.push(
    `generated by ${ranked.generator} @ ${ranked.generated} over ${ranked.pending_total} pending (self ${ranked.producer_ratio.self_generated} / external ${ranked.producer_ratio.external})`
  );
  const fmt = (e) =>
    `  ${String(e.rank).padStart(2)}. [${e.band}] ${e.id} — ${e.age_days != null ? e.age_days + "d" : "age unproven"}${
      e.snooze_until ? ` (snoozed until ${e.snooze_until})` : ""
    }${e.flag ? ` ⚠ ${e.flag}` : ""}`;
  lines.push("BUSINESS LANE (B0 exposure > B1 customer/revenue > B2 delivery):");
  lines.push(...(ranked.business_lane.length ? ranked.business_lane.map(fmt) : ["  (empty)"]));
  lines.push("FLEET LANE (B3 hygiene — floored, not starved):");
  lines.push(...(ranked.fleet_lane.length ? ranked.fleet_lane.map(fmt) : ["  (empty)"]));
  return lines.join("\n");
}

// ---- one-time backfill of the pre-door pending items (EU-14) ----
// subject/producer only; status, priority, and raised are never touched.
export const BACKFILL = {
  "prod-deploy-dead-since-06-17": { subject: "production-deploy-pipeline", producer: "session-16fa0ca6" },
  "design-partners-on-record": { subject: "design-partner-pipeline" },
  "legal-entity-ip": { subject: "legal-entity" },
  "company-postal-address": { subject: "customer-email-compliance" },
  "weekly-email-dedupe": { subject: "customer-email-program" },
  "revoke-flatsbo-pat": { subject: "credential-exposure" },
  "working-state-retention-policy": { subject: "fleet-memory-store" },
  "l3-loop-progress-unverified": { subject: "fleet-loop" },
  "fix-claude-code-scheduler-cwd": { subject: "fleet-scheduler", producer: "librarian pass 624" },
  "librarian-cadence-vs-cost-cap": { subject: "fleet-scheduler", producer: "librarian pass 172" },
  "budget-week-to-date-unmeasured": { subject: "fleet-budget", producer: "librarian pass 177" },
  "charter-cites-nonexistent-escalation-tool": { subject: "fleet-charter", producer: "librarian pass 185" },
  "memory-dir-scratch-bloat": { subject: "fleet-memory-store" },
  "memory-dangling-links-class-a": { subject: "fleet-memory-store" },
};

async function backfill({ write }) {
  const yaml = await yamlLib();
  const { path: qPath, doc } = await loadQueue();
  const changes = [];
  for (const item of doc.items || []) {
    const patch = BACKFILL[item.id];
    if (!patch || item.status !== "pending") continue;
    for (const [k, v] of Object.entries(patch)) {
      if (item[k] == null) {
        changes.push(`${item.id}: ${k} = ${v}`);
        if (write) item[k] = v;
      }
    }
  }
  if (write && changes.length) {
    fs.copyFileSync(qPath, qPath + ".pre-m9-backfill");
    fs.writeFileSync(qPath, yaml.dump(doc, { lineWidth: 110 }));
  }
  process.stdout.write(
    (changes.length ? changes.join("\n") : "(nothing to backfill)") +
      `\n${write ? "WRITTEN" : "dry-run — pass --write to apply"} (${changes.length} field stamps)\n`
  );
}

// ---- the ONE admission door (M9 part 3) ----
async function admit() {
  const yaml = await yamlLib();
  const id = argValue("--id");
  const title = argValue("--title");
  const subject = argValue("--subject");
  const producer = argValue("--producer");
  const ask = argValue("--ask");
  const errors = [];
  if (!id || !/^[a-z0-9][a-z0-9-]+$/.test(id)) errors.push("--id required, kebab-case");
  if (!title) errors.push("--title required");
  if (!subject) errors.push("--subject required (see ops/value-map.yaml)");
  if (!producer) errors.push("--producer required (session/task that files the item)");
  const map = await loadValueMap();
  const known = map.bands.flatMap((b) => b.subjects || []);
  if (subject && !known.includes(subject)) {
    errors.push(
      `--subject '${subject}' is not in ops/value-map.yaml — add it there in a one-line PR first (band membership is a ratified call, not a filing-time judgment)`
    );
  }
  if (errors.length) {
    process.stderr.write(errors.join("\n") + "\n");
    process.exit(2);
  }
  const { path: qPath, doc } = await loadQueue();
  if ((doc.items || []).some((i) => i.id === id)) {
    process.stderr.write(`item '${id}' already exists\n`);
    process.exit(2);
  }
  doc.items.push({
    id,
    title,
    subject,
    producer,
    ...(ask ? { ask } : {}),
    status: "pending",
    raised: nowIso(),
  });
  fs.copyFileSync(qPath, qPath + ".pre-admit");
  fs.writeFileSync(qPath, yaml.dump(doc, { lineWidth: 110 }));
  process.stdout.write(`admitted '${id}' (subject ${subject}, band ${classify({ id, title, subject, ask }, map)})\n`);
}

async function main() {
  const cmd = process.argv[2];
  if (cmd === "rank") {
    const map = await loadValueMap();
    const { doc } = await loadQueue(argValue("--queue-file"));
    const ranked = rank(doc.items || [], map);
    process.stdout.write(hasFlag("--json") ? JSON.stringify(ranked) + "\n" : renderText(ranked) + "\n");
    return;
  }
  if (cmd === "admit") return admit();
  if (cmd === "backfill") return backfill({ write: hasFlag("--write") });
  process.stderr.write("usage: node scripts/ops/rank-queue.mjs <rank|admit|backfill> [options]\n");
  process.exit(2);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => {
    process.stderr.write(`rank-queue failed: ${e.message}\n`);
    process.exit(1);
  });
}
