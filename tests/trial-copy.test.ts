import { test } from "node:test";
import assert from "node:assert/strict";
import { trialCardPolicy, trialHeadline } from "@/lib/billing/trial-copy";

// Trial-honesty regression guard. The funnel previously hardcoded "30-day
// free trial, card captured at signup" — wrong on BOTH counts for the #241
// scaffold default (14-day, trial-first / no card). These tests lock the copy
// to the actual env-configured truth so it can't silently drift back.

test("default flow (no card at signup): copy says no card needed + the real trial length", () => {
  const policy = trialCardPolicy(14, false);
  assert.match(policy, /no card needed to start/i);
  assert.match(policy, /before day 14/);
  // Must NOT claim a card is taken at signup in the default flow.
  assert.doesNotMatch(policy, /captured at signup/i);

  const headline = trialHeadline(14, false);
  assert.match(headline, /14-day free trial/i);
  assert.match(headline, /no card needed to start/i);
  assert.match(headline, /Cancel any time/i);
  assert.doesNotMatch(headline, /30-day/);
});

test("checkout-at-signup flow: copy names the card capture honestly", () => {
  const policy = trialCardPolicy(14, true);
  assert.match(policy, /Card captured at signup/i);

  const headline = trialHeadline(14, true);
  assert.match(headline, /14-day free trial/i);
  assert.match(headline, /card captured at signup/i);
});

test("trial length is parameterized, never hardcoded to 30", () => {
  // A future env override (e.g. 7 or 21 days) must flow straight into the copy.
  assert.match(trialHeadline(7, false), /7-day free trial/i);
  assert.match(trialCardPolicy(21, false), /before day 21/);
  // The dead "30-day" string never appears regardless of flag.
  assert.doesNotMatch(trialHeadline(14, false), /30/);
  assert.doesNotMatch(trialHeadline(14, true), /30/);
});
