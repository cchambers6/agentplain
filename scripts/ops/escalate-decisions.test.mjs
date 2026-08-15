// Deliberate-failure tests for M2's banded reader (EU-6 + EU-15 acceptance).
import test from "node:test";
import assert from "node:assert/strict";
import { evaluateReader } from "./escalate-decisions.mjs";
import { slugMarker } from "./upsert-issue.mjs";

const NOW = "2026-08-11T12:00:00Z";

function mirror(business, fleet) {
  return {
    ts: NOW,
    queue: {
      mirror_mode: "ranked",
      pending_total: business.length + fleet.length,
      business_lane: business,
      fleet_lane: fleet,
    },
  };
}
const run = (payload, openIssues = []) => evaluateReader({ payload, openIssues, now: NOW });

test("B0 item pending 0 days yields [create] — no grace period", () => {
  const r = run(mirror([{ rank: 1, band: "B0", id: "revoke-flatsbo-pat", title: "Revoke leaked PAT", raised: NOW, declared_priority: 6 }], []));
  assert.equal(r.actions.length, 1);
  assert.equal(r.actions[0].type, "create");
  assert.match(r.actions[0].title, /^\[B0\] revoke-flatsbo-pat/);
  assert.ok(r.actions[0].labels.includes("band-b0"));
  assert.equal(r.red, false);
});

test("B3 item pending 10 days yields [] — 14-day SLA not reached (floored, not spammed)", () => {
  const r = run(mirror([], [{ rank: 1, band: "B3", id: "scratch", title: "sweep", raised: "2026-08-01T12:00:00Z" }]));
  assert.deepEqual(r.actions, []);
});

test("B1 item backdated 45 days yields exactly one create", () => {
  const r = run(mirror([{ rank: 1, band: "B1", id: "old-thing", title: "old", raised: "2026-06-27T12:00:00Z" }], []));
  assert.equal(r.actions.length, 1);
  assert.equal(r.actions[0].type, "create");
});

test("an item that cannot prove its age is treated as past SLA, never silent", () => {
  const r = run(mirror([{ rank: 1, band: "B1", id: "undated", title: "no raised field", raised: null }], []));
  assert.equal(r.actions.length, 1);
  assert.match(r.actions[0].title, /age unproven — treated as overdue/);
});

test("snoozed item yields no create; its open issue closes (snooze is a first-class answer)", () => {
  const item = { rank: 1, band: "B1", id: "snoozy", title: "t", raised: "2026-06-01T00:00:00Z", snooze_until: "2026-09-01" };
  assert.deepEqual(run(mirror([item], [])).actions, []);
  const withIssue = run(mirror([item], []), [{ number: 9, body: slugMarker("decision:snoozy"), updated_at: NOW }]);
  assert.deepEqual(withIssue.actions.map((a) => [a.type, a.number]), [["close", 9]]);
});

test("consumed item (absent from mirror) with an open issue yields [close]", () => {
  const r = run(mirror([], []), [{ number: 5, body: `answered\n${slugMarker("decision:done-thing")}`, updated_at: NOW }]);
  assert.deepEqual(r.actions.map((a) => [a.type, a.number]), [["close", 5]]);
});

test("existing issue bumps on band cadence, never duplicates", () => {
  const item = { rank: 1, band: "B0", id: "pat", title: "t", raised: "2026-06-09T00:00:00Z" };
  const fresh = run(mirror([item], []), [{ number: 3, body: slugMarker("decision:pat"), updated_at: NOW }]);
  assert.deepEqual(fresh.actions, []); // bumped within the last day — quiet
  const staleTouch = run(mirror([item], []), [{ number: 3, body: slugMarker("decision:pat"), updated_at: "2026-08-09T00:00:00Z" }]);
  assert.deepEqual(staleTouch.actions.map((a) => a.type), ["comment"]); // daily bump for B0
});

test("ranked mirror carrying 13 of 14 pending items yields a ranking-incomplete red run", () => {
  const p = mirror(
    [{ rank: 1, band: "B1", id: "only-one", title: "t", raised: "2026-06-01T00:00:00Z" }],
    Array.from({ length: 12 }, (_, i) => ({ rank: i + 1, band: "B3", id: `f${i}`, title: "t", raised: NOW }))
  );
  p.queue.pending_total = 14; // 13 ranked vs 14 pending
  const r = run(p);
  assert.ok(r.findings.includes("ranking-incomplete"));
  assert.ok(r.actions.some((a) => a.slug === "ranking-incomplete"));
  assert.equal(r.red, true);
});

test("missing/unparseable mirror never goes quiet: fleet-ops issue + red run", () => {
  const r = run(null);
  assert.ok(r.findings.includes("mirror-unreadable"));
  assert.equal(r.actions[0].slug, "mirror-unreadable");
  assert.equal(r.red, true);
});

test("a stale mirror escalates LAST-KNOWN state with the staleness stated", () => {
  const p = mirror([{ rank: 1, band: "B1", id: "old-thing", title: "t", raised: "2026-06-01T00:00:00Z" }], []);
  p.ts = "2026-08-08T00:00:00Z"; // 3.5 days stale
  const r = evaluateReader({ payload: p, openIssues: [], now: NOW });
  assert.equal(r.actions.length, 1);
  assert.match(r.actions[0].body, /Escalating LAST-KNOWN state/);
});

test("un-ranked (pre-M9) mirror escalates conservatively and flags mirror-not-ranked", () => {
  const p = {
    ts: NOW,
    queue: {
      mirror_mode: "raw-ledger-order",
      pending_total: 1,
      items: [{ id: "x", status: "pending", title: "t", raised: "2026-06-01T00:00:00Z" }],
    },
  };
  const r = run(p);
  assert.ok(r.findings.includes("mirror-not-ranked"));
  assert.ok(r.actions.some((a) => a.slug === "mirror-not-ranked"));
  assert.ok(r.actions.some((a) => a.slug === "decision:x"));
});
