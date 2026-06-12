import { test } from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";

// Site-audit P1-4 ("customer-visible failure surface"): a failed skill step
// used to render IDENTICALLY to a success in the activity feed, so "a failed
// skill was indistinguishable from a quiet day." These tests pin the fix:
//   1. classifyOutcome maps the persisted step status → ok / skipped / failed
//      with a plain-language reason.
//   2. ActivityFeed renders a failed row as alert + reason + a "didn't
//      complete" badge, a skipped row as a neutral "skipped", and an ok row
//      with neither.

import {
  ActivityFeed,
  classifyOutcome,
  type ActivityRow,
} from "@/app/(product)/app/workspace/[id]/activity/ActivityFeed";

function row(overrides: Partial<ActivityRow>): ActivityRow {
  const base: ActivityRow = {
    id: "h1",
    fromAgent: "drafter",
    toAgent: "completer",
    handoffType: "draft",
    occurredAtIso: "2026-06-12T15:00:00.000Z",
    relatedSubjectTable: null,
    relatedSubjectId: null,
    payload: {},
    summary: "Reply drafted for 142 Peachtree",
    outcome: "ok",
    issue: null,
    errorCode: null,
  };
  return { ...base, ...overrides };
}

function render(node: React.ReactElement): string {
  return renderToStaticMarkup(node);
}

// ── classifyOutcome (pure) ───────────────────────────────────────────────────

test("classifyOutcome: a clean step is ok with no issue", () => {
  const r = classifyOutcome({ handoffType: "draft", ok: true });
  assert.equal(r.outcome, "ok");
  assert.equal(r.issue, null);
});

test("classifyOutcome: legacy row with no ok flag reads as ok (no false alarm)", () => {
  const r = classifyOutcome({ handoffType: "categorize" });
  assert.equal(r.outcome, "ok");
});

test("classifyOutcome: a `.error` handoff type is a failure even without an ok flag", () => {
  const r = classifyOutcome({ handoffType: "draft.error" });
  assert.equal(r.outcome, "failed");
  assert.ok(r.issue && r.issue.length > 0);
});

test("classifyOutcome: ok:false is a failure", () => {
  const r = classifyOutcome({ handoffType: "draft", ok: false, errorCode: "UNKNOWN" });
  assert.equal(r.outcome, "failed");
});

test("classifyOutcome: NOT_APPLICABLE is a benign skip, not a failure", () => {
  const r = classifyOutcome({
    handoffType: "draft.error",
    ok: false,
    errorCode: "NOT_APPLICABLE",
  });
  assert.equal(r.outcome, "skipped");
});

test("classifyOutcome: known error codes get a human reason, not a code dump", () => {
  const gmail = classifyOutcome({
    handoffType: "draft.error",
    ok: false,
    errorCode: "UPSTREAM_GMAIL_ERROR",
  });
  assert.equal(gmail.outcome, "failed");
  assert.match(gmail.issue!, /gmail/i);
  assert.match(gmail.issue!, /reconnect/i);

  const token = classifyOutcome({
    handoffType: "read.error",
    ok: false,
    errorCode: "TOKEN_EXPIRED",
  });
  assert.match(token.issue!, /reconnect/i);
});

test("classifyOutcome: an unknown code still gets a non-empty fallback reason", () => {
  const r = classifyOutcome({
    handoffType: "draft.error",
    ok: false,
    errorCode: "SOMETHING_WEIRD",
  });
  assert.equal(r.outcome, "failed");
  assert.match(r.issue!, /didn.t complete|retries/i);
});

// ── ActivityFeed rendering ───────────────────────────────────────────────────

test("ActivityFeed: a failed row shows the badge + the plain-language reason", () => {
  const html = render(
    <ActivityFeed
      partner="Plaino"
      rows={[
        row({
          outcome: "failed",
          issue: "Couldn’t reach Gmail to finish this. Your connection may need a reconnect.",
          errorCode: "UPSTREAM_GMAIL_ERROR",
          handoffType: "draft.error",
        }),
      ]}
    />,
  );
  assert.match(html, /didn.t complete/i);
  assert.match(html, /reach Gmail/i);
  // The internal `.error` suffix is stripped from the visible type label.
  assert.doesNotMatch(html, /draft\.error/);
});

test("ActivityFeed: a skipped row reads as skipped, not as a failure", () => {
  const html = render(
    <ActivityFeed
      partner="Plaino"
      rows={[row({ outcome: "skipped", issue: "didn’t apply", handoffType: "draft.error" })]}
    />,
  );
  assert.match(html, /skipped/i);
  assert.doesNotMatch(html, /didn.t complete/i);
});

test("ActivityFeed: a clean row carries no failure or skip badge", () => {
  const html = render(<ActivityFeed partner="Plaino" rows={[row({})]} />);
  assert.doesNotMatch(html, /didn.t complete/i);
  assert.doesNotMatch(html, /\bskipped\b/i);
  assert.match(html, /142 Peachtree/);
});
