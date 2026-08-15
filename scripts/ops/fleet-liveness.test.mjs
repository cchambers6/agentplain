// Deliberate-failure tests for M1's reader. The spec's rule: an unfired alarm
// and a broken alarm are indistinguishable, so every check proves it fires.
import test from "node:test";
import assert from "node:assert/strict";
import { evaluate } from "./fleet-liveness-check.mjs";

const NOW = "2026-08-11T12:00:00Z";

test("stale heartbeat (3 h old) fires exactly one create action and reads stale", () => {
  const r = evaluate({
    headCommitIso: "2026-08-11T09:00:00Z",
    prevCommitIso: "2026-08-11T08:30:00Z",
    openIssue: null,
    now: NOW,
  });
  assert.equal(r.status, "stale");
  assert.equal(r.actions.length, 1);
  assert.equal(r.actions[0].type, "create");
  assert.match(r.actions[0].title, /fleet-down/);
  assert.ok(r.actions[0].labels.includes("fleet-down"));
});

test("no heartbeat branch at all is treated as a dead fleet (fires)", () => {
  const r = evaluate({ headCommitIso: null, prevCommitIso: null, openIssue: null, now: NOW });
  assert.equal(r.status, "stale");
  assert.equal(r.ageHours, Infinity);
  assert.equal(r.actions[0].type, "create");
  assert.match(r.actions[0].title, /never published/);
});

test("simulate-stale (the drill path) fires against a perfectly fresh heartbeat", () => {
  const r = evaluate({
    headCommitIso: "2026-08-11T11:59:00Z",
    prevCommitIso: null,
    openIssue: null,
    now: NOW,
    simulateStale: true,
  });
  assert.equal(r.status, "stale");
  assert.match(r.actions[0].title, /^\[DRILL\] /);
  assert.ok(r.actions[0].labels.includes("drill"));
});

test("still-stale with an open issue bumps (comments), never duplicates", () => {
  const r = evaluate({
    headCommitIso: "2026-08-11T06:00:00Z",
    prevCommitIso: null,
    openIssue: { number: 42, created_at: "2026-08-11T09:00:00Z" },
    now: NOW,
  });
  assert.equal(r.actions.length, 1);
  assert.equal(r.actions[0].type, "comment");
  assert.equal(r.actions[0].number, 42);
});

test("recovery closes the open issue with the measured commit-gap duration", () => {
  const r = evaluate({
    headCommitIso: "2026-08-11T11:50:00Z",
    prevCommitIso: "2026-08-11T02:00:00Z", // 9.8 h gap = the outage
    openIssue: { number: 42, created_at: "2026-08-11T04:10:00Z" },
    now: NOW,
  });
  assert.equal(r.status, "fresh");
  assert.equal(r.actions.length, 1);
  assert.equal(r.actions[0].type, "close");
  assert.match(r.actions[0].body, /9\.8 h \(measured/);
});

test("fresh heartbeat with no open issue does nothing", () => {
  const r = evaluate({
    headCommitIso: "2026-08-11T11:50:00Z",
    prevCommitIso: "2026-08-11T11:20:00Z",
    openIssue: null,
    now: NOW,
  });
  assert.equal(r.status, "fresh");
  assert.equal(r.actions.length, 0);
});
