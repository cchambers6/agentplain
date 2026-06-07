import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  canTransition,
  isAcceptanceDecision,
  isTerminal,
  nextStatuses,
} from "./lifecycle";

describe("canTransition", () => {
  it("allows the happy path DRAFT → BRIEFED → DELIVERED → ACCEPTED", () => {
    assert.ok(canTransition("DRAFT", "BRIEFED"));
    assert.ok(canTransition("BRIEFED", "DELIVERED"));
    assert.ok(canTransition("DELIVERED", "ACCEPTED"));
  });

  it("rejects skipping straight from DRAFT to DELIVERED", () => {
    assert.equal(canTransition("DRAFT", "DELIVERED"), false);
  });

  it("rejects re-opening an ACCEPTED brief", () => {
    assert.equal(canTransition("ACCEPTED", "BRIEFED"), false);
  });

  it("allows a REJECTED brief to be re-briefed", () => {
    assert.ok(canTransition("REJECTED", "BRIEFED"));
  });

  it("allows cancelling from DRAFT and BRIEFED but not after delivery accept", () => {
    assert.ok(canTransition("DRAFT", "CANCELLED"));
    assert.ok(canTransition("BRIEFED", "CANCELLED"));
    assert.equal(canTransition("ACCEPTED", "CANCELLED"), false);
  });
});

describe("isTerminal", () => {
  it("treats ACCEPTED and CANCELLED as terminal", () => {
    assert.ok(isTerminal("ACCEPTED"));
    assert.ok(isTerminal("CANCELLED"));
  });

  it("treats DRAFT as non-terminal", () => {
    assert.equal(isTerminal("DRAFT"), false);
  });
});

describe("nextStatuses", () => {
  it("returns the two acceptance outcomes from DELIVERED", () => {
    assert.deepEqual(nextStatuses("DELIVERED").sort(), ["ACCEPTED", "REJECTED"]);
  });

  it("returns nothing from a terminal state", () => {
    assert.deepEqual(nextStatuses("ACCEPTED"), []);
  });
});

describe("isAcceptanceDecision", () => {
  it("is true only for DELIVERED → ACCEPTED/REJECTED", () => {
    assert.ok(isAcceptanceDecision("DELIVERED", "ACCEPTED"));
    assert.ok(isAcceptanceDecision("DELIVERED", "REJECTED"));
    assert.equal(isAcceptanceDecision("DRAFT", "BRIEFED"), false);
    assert.equal(isAcceptanceDecision("BRIEFED", "DELIVERED"), false);
  });
});
