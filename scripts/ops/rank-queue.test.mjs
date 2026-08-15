// M9 deliberate-failure tests. The fixture is a frozen, sanitized snapshot of
// the LIVE queue as measured 2026-08-11 — real data, not synthetic. These
// assertions are the ship-day falsification rule in executable form: derived
// order MUST beat declared priority on the exact items that proved the need.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { rank, classify, loadValueMap } from "./rank-queue.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const fixture = JSON.parse(
  fs.readFileSync(path.join(here, "fixtures", "queue-snapshot-2026-08-11.json"), "utf8")
);
const NOW = "2026-08-11T12:00:00Z";
const map = await loadValueMap();
const ranked = rank(fixture.items, map, NOW);
const business = ranked.business_lane;
const fleet = ranked.fleet_lane;

test("revoke-flatsbo-pat classifies B0 and heads the business lane DESPITE declared priority 6", () => {
  assert.equal(business[0].id, "revoke-flatsbo-pat");
  assert.equal(business[0].band, "B0");
  assert.equal(business[0].declared_priority, 6); // derived beats declared, on the item that proves the need
});

test("the production outage heads B1 — business rank 2, behind only the exposure item", () => {
  const outage = business.find((e) => e.id === "prod-deploy-dead-since-06-17");
  assert.equal(outage.band, "B1");
  assert.equal(outage.rank, 2);
});

test("the scratch sweep and retention policy land in the fleet lane and hold NO business position", () => {
  for (const id of ["memory-dir-scratch-bloat", "working-state-retention-policy", "memory-dangling-links-class-a"]) {
    assert.ok(fleet.some((e) => e.id === id), `${id} in fleet lane`);
    assert.ok(!business.some((e) => e.id === id), `${id} not in business lane`);
  }
});

test("all 14 pending items appear exactly once across the two lanes", () => {
  const pendingIds = fixture.items.filter((i) => i.status === "pending").map((i) => i.id).sort();
  const rankedIds = [...business, ...fleet].map((e) => e.id).sort();
  assert.equal(pendingIds.length, 14); // the measured 2026-08-11 count
  assert.deepEqual(rankedIds, pendingIds);
  assert.equal(ranked.pending_total, 14);
});

test("an item with no priority key at all ranks normally (the dual-schema victim)", () => {
  const l3 = fleet.find((e) => e.id === "l3-loop-progress-unverified");
  assert.ok(l3, "present in fleet lane");
  assert.equal(l3.declared_priority, null);
  assert.ok(l3.age_days > 20); // raised 2026-07-19, dated ordering applies
});

test("resolved items never appear in either lane", () => {
  for (const lane of [business, fleet]) {
    assert.ok(!lane.some((e) => e.id === "git-config-repair"));
    assert.ok(!lane.some((e) => e.id === "truth-wave-tiers-fix"));
  }
});

test("within a band, dated items order oldest-first and undated items sort after every dated item", () => {
  const b1 = business.filter((e) => e.band === "B1");
  assert.equal(b1[0].id, "prod-deploy-dead-since-06-17"); // only dated B1 item
  const dated = b1.filter((e) => e.raised);
  const undated = b1.filter((e) => !e.raised);
  assert.ok(dated.every((d) => b1.indexOf(d) < Math.min(...undated.map((u) => b1.indexOf(u)))));
  const fleetDated = fleet.filter((e) => e.raised).map((e) => e.raised);
  assert.deepEqual(fleetDated, [...fleetDated].sort());
});

test("declared priority is display metadata: a string 'medium' and a string '6' break nothing", () => {
  const cadence = fleet.find((e) => e.id === "librarian-cadence-vs-cost-cap");
  assert.equal(cadence.declared_priority, "medium");
  const budget = fleet.find((e) => e.id === "budget-week-to-date-unmeasured");
  assert.ok(budget);
});

test("producer ratio is measured and populated (root cause 9's self-reporting tell)", () => {
  const r = ranked.producer_ratio;
  assert.equal(r.self_generated + r.external, 14);
  // Pre-backfill, exactly 5 items carry machine-readable self-producer
  // evidence (WORKING_STATE source ×2, librarian raised_by, opened_by_pass ×2).
  // The ratio reports what is measurable, never a guess — after the producer
  // backfill it rises as the stamps land.
  assert.ok(r.self_generated >= 5, `measured self-produced floor (got ${r.self_generated})`);
});

test("an unclassifiable item lands at the HEAD of the fleet lane flagged, never silently bottom", () => {
  const items = [
    ...fixture.items,
    { id: "totally-novel-thing", status: "pending", title: "a subject the map has never seen" },
  ];
  const r = rank(items, map, NOW);
  assert.equal(r.fleet_lane[0].id, "totally-novel-thing");
  assert.equal(r.fleet_lane[0].band, "B-UNKNOWN");
  assert.match(r.fleet_lane[0].flag, /classify me/);
});

test("subject beats keywords: a stamped subject overrides misleading text", () => {
  const band = classify(
    { id: "x", title: "production deploy of the librarian memory", subject: "fleet-memory-store" },
    map
  );
  assert.equal(band, "B3");
});
