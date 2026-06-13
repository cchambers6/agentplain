/**
 * lib/support/tickets/classify.test.ts
 *
 * Locks the priority classifier. The failure we refuse is a sensitive ticket
 * (security report, legal threat, distress) being born at the routine P2
 * floor — these tests pin it to P0. They also pin the category floors so a
 * billing ticket can't silently become low-priority.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { classifyTicketPriority } from "./classify";

describe("classifyTicketPriority", () => {
  it("category floors apply when no escalation signal fires", () => {
    assert.equal(
      classifyTicketPriority({ category: "BILLING", subject: "q", description: "general billing question" }).priority,
      "P1",
    );
    assert.equal(
      classifyTicketPriority({ category: "INTEGRATION", subject: "q", description: "how do I connect gmail" }).priority,
      "P1",
    );
    assert.equal(
      classifyTicketPriority({ category: "BUG", subject: "q", description: "a button is misaligned" }).priority,
      "P2",
    );
    assert.equal(
      classifyTicketPriority({ category: "WORKFLOW", subject: "q", description: "how do briefings work" }).priority,
      "P2",
    );
    assert.equal(
      classifyTicketPriority({ category: "OTHER", subject: "q", description: "just saying hi" }).priority,
      "P2",
    );
  });

  it("a security vulnerability report is P0 even under category OTHER", () => {
    const r = classifyTicketPriority({
      category: "OTHER",
      subject: "found something",
      description: "I think there is a security vulnerability — I can see another workspace's data",
    });
    assert.equal(r.priority, "P0");
    assert.equal(r.escalation?.trigger, "vulnerability-report");
  });

  it("a legal threat is P0", () => {
    const r = classifyTicketPriority({
      category: "WORKFLOW",
      subject: "unhappy",
      description: "I'm going to take legal action and my attorney will be in touch",
    });
    assert.equal(r.priority, "P0");
  });

  it("an explicit human request raises a routine ticket to P1", () => {
    const r = classifyTicketPriority({
      category: "OTHER",
      subject: "help",
      description: "I want to talk to a human please",
    });
    assert.equal(r.priority, "P1");
    assert.equal(r.escalation?.trigger, "explicit-human-request");
  });

  it("a large billing dispute escalates to P1 (already a billing floor)", () => {
    const r = classifyTicketPriority({
      category: "BILLING",
      subject: "charge",
      description: "I was double charged $400 and want a refund — this is a dispute",
    });
    assert.equal(r.priority, "P1");
    assert.equal(r.escalation?.trigger, "billing-dispute-over-threshold");
  });

  it("takes the more urgent of escalation tier and category floor", () => {
    // BILLING floor is P1; a distress signal is P0 — P0 wins.
    const r = classifyTicketPriority({
      category: "BILLING",
      subject: "help",
      description: "I can't go on, none of this matters",
    });
    assert.equal(r.priority, "P0");
  });
});
