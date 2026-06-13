/**
 * lib/support/tickets/sla.test.ts
 *
 * Pins the SLA promise — the load-bearing commitment the support channel
 * makes to the customer (24h default) and that Conner staffs L1 against. If
 * these numbers or the verbatim promise drift, the test fails loud.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  DEFAULT_FIRST_RESPONSE_HOURS,
  FIRST_RESPONSE_HOURS_BY_PRIORITY,
  computeFirstResponseDueAt,
  slaWindowLabel,
  firstResponsePromise,
  formatTicketNumber,
  isSlaBreached,
} from "./sla";

describe("ticket SLA", () => {
  it("default first response is 24 hours", () => {
    assert.equal(DEFAULT_FIRST_RESPONSE_HOURS, 24);
    assert.equal(FIRST_RESPONSE_HOURS_BY_PRIORITY.P2, 24);
  });

  it("priority tightens the window", () => {
    assert.equal(FIRST_RESPONSE_HOURS_BY_PRIORITY.P0, 1);
    assert.equal(FIRST_RESPONSE_HOURS_BY_PRIORITY.P1, 4);
    assert.equal(FIRST_RESPONSE_HOURS_BY_PRIORITY.P3, 48);
  });

  it("computes the deadline from createdAt + window", () => {
    const created = new Date("2026-06-12T00:00:00.000Z");
    const due = computeFirstResponseDueAt("P2", created);
    assert.equal(due.toISOString(), "2026-06-13T00:00:00.000Z");
    const dueP0 = computeFirstResponseDueAt("P0", created);
    assert.equal(dueP0.toISOString(), "2026-06-12T01:00:00.000Z");
  });

  it("formats the window label, singular for 1 hour", () => {
    assert.equal(slaWindowLabel("P2"), "within 24 hours");
    assert.equal(slaWindowLabel("P0"), "within 1 hour");
  });

  it("renders the verbatim customer promise", () => {
    assert.equal(
      firstResponsePromise("P2"),
      "Got it. Expected first response: within 24 hours.",
    );
  });

  it("formats the public ticket number", () => {
    assert.equal(formatTicketNumber(1042), "#1042");
  });

  it("SLA breach: past due with no staff reply yet", () => {
    const due = new Date("2026-06-13T00:00:00.000Z");
    const after = new Date("2026-06-13T00:00:01.000Z");
    const before = new Date("2026-06-12T23:59:59.000Z");
    assert.equal(isSlaBreached(due, null, after), true);
    assert.equal(isSlaBreached(due, null, before), false);
  });

  it("SLA clock stops once a staff reply lands", () => {
    const due = new Date("2026-06-13T00:00:00.000Z");
    const responded = new Date("2026-06-12T12:00:00.000Z");
    const wayLater = new Date("2026-06-20T00:00:00.000Z");
    assert.equal(isSlaBreached(due, responded, wayLater), false);
  });
});
