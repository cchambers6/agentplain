// Does the deploy-age alarm survive PR #641?
//
// THE HANDOVER
// ------------
// deploy-state.mjs answers "is origin/main actually in production" by reading
// GitHub's Deployments API. Those records were written by the Vercel GitHub
// app. PR #641 disables Vercel's git auto-deploy for `main` (so Vercel and the
// deploy workflow cannot race) and has the workflow create the Deployment and
// post its own status instead.
//
// That changes WHO WRITES the only data this alarm reads. If the handover is
// wrong in any detail — a different environment name, a state string the alarm
// does not recognise, a status never posted on the failure path — the alarm
// goes quiet while looking healthy, which is precisely the failure mode that
// let 140 production deploys fail unseen. Re-creating that while fixing it
// would be the worst possible outcome.
//
// These are CONTRACT tests. They do not test #641's workflow file directly
// (it is not on main yet); they pin the four properties the handover must
// preserve, and the last one activates automatically the moment #641 lands.
//
// WHAT IS PROVEN HERE vs WHAT IS REASONED
// ---------------------------------------
// Proven by execution: the alarm's behaviour for every state the new writer
// can post, including the stuck-in_progress gap.
// Proven by static assertion: that the reader never filters on who wrote the
// record, and that #641's workflow posts a matching environment and states.
// NOT proven here: that GitHub actually accepts the workflow's createDeployment
// call at runtime. That needs a real run, and is called out in the PR.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { buildReport, evaluate, MAX_DAYS_WITHOUT_SUCCESS } from "./deploy-state.mjs";

const NOW = "2026-09-21T12:00:00Z";
const SHA_MAIN = "2fe80b56a5cc7e768f75193498888f76bae12963";
const SHA_OLD = "d5fcfad9ccd52d1a15659a8c90686c33e2bf9adc";

/**
 * A deploy-state as it would look once the WORKFLOW is the writer.
 * Shape is identical to the Vercel-written case on purpose — that identity is
 * the thing being asserted.
 */
async function reportFrom(walked, lastSuccess, { originMainSha = SHA_MAIN } = {}) {
  return buildReport({
    now: NOW,
    state: { walked, lastSuccess, originMainSha, walkExhausted: false },
  });
}

test("a workflow-written FAILURE still fires both alarms", async () => {
  // The exact shape of tonight's production reality, but with the records
  // written by production-deploy.yml rather than by vercel[bot].
  const r = evaluate(
    await reportFrom(
      [{ sha: SHA_MAIN, created_at: "2026-09-21T11:00:00Z", state: "failure" }],
      { sha: SHA_OLD, created_at: "2026-06-17T14:28:49Z" },
    ),
  );
  assert.equal(r.red, true);
  assert.deepEqual(r.actions.map((a) => a.slug).sort(), ["deploy:error", "deploy:stale"]);
});

test("a workflow-written SUCCESS clears both alarms", async () => {
  const r = evaluate(
    await reportFrom(
      [{ sha: SHA_MAIN, created_at: "2026-09-21T11:00:00Z", state: "success" }],
      { sha: SHA_MAIN, created_at: "2026-09-21T11:00:00Z" },
    ),
    {
      openErrorIssue: { number: 1 },
      openStaleIssue: { number: 2 },
    },
  );
  assert.equal(r.red, false);
  assert.deepEqual(r.actions.map((a) => a.type), ["close", "close"]);
});

test("the alarm never depends on WHO wrote the record", () => {
  // The reader must select on environment alone. A creator filter — even one
  // added later in good faith, e.g. to ignore bots — would silently blind this
  // alarm the moment the writer changed. Guard it statically.
  const src = fs.readFileSync(new URL("./deploy-state.mjs", import.meta.url), "utf8");
  assert.ok(
    /deployments\?environment=\$\{?ENVIRONMENT\}?|deployments\?environment=/.test(src),
    "deploy-state must select deployments by environment",
  );
  assert.ok(
    !/creator|\bactor\b|vercel\[bot\]|performed_via/i.test(src),
    "deploy-state must NOT filter on who created the deployment — that couples the alarm to its writer",
  );
});

// The gap, asserted rather than hoped away.
test("a deployment stuck in_progress does not fire the error alarm — but staleness still does", async () => {
  // production-deploy.yml posts `in_progress` before migrating. If the runner
  // dies between that and the always() status step, the newest status stays
  // `in_progress` forever. That is NOT in FAILED_STATES, so condition 1 stays
  // quiet — correct in the short run, a blind spot in the long run.
  const stuck = [{ sha: SHA_MAIN, created_at: "2026-09-21T11:00:00Z", state: "in_progress" }];

  const fresh = evaluate(await reportFrom(stuck, { sha: SHA_OLD, created_at: "2026-09-20T12:00:00Z" }));
  assert.equal(
    fresh.actions.some((a) => a.slug === "deploy:error"),
    false,
    "in_progress is not a failure, so the error alarm correctly stays quiet",
  );

  // The safety net: staleness does not care about the latest state at all, so
  // a permanently-stuck deploy is still caught, just via the other condition.
  const stale = evaluate(await reportFrom(stuck, { sha: SHA_OLD, created_at: "2026-06-17T14:28:49Z" }));
  assert.equal(
    stale.actions.some((a) => a.slug === "deploy:stale"),
    true,
    "a stuck in_progress must still be caught by the staleness condition",
  );
  assert.equal(stale.red, true);
});

test("staleness threshold is unchanged by the handover", () => {
  assert.equal(MAX_DAYS_WITHOUT_SUCCESS, 7);
});

// Activates automatically when #641 lands. Until then it self-skips, and says
// so, rather than passing silently and pretending it checked something.
test("production-deploy.yml posts an environment and states the alarm recognises", (t) => {
  const path = new URL("../../.github/workflows/production-deploy.yml", import.meta.url);
  if (!fs.existsSync(path)) {
    t.skip("production-deploy.yml not on this ref yet (PR #641 unmerged) — contract unenforced");
    return;
  }
  const wf = fs.readFileSync(path, "utf8");
  assert.match(wf, /environment:\s*'Production'/, "must create the Deployment under environment 'Production'");
  assert.match(wf, /state:\s*ok\s*\?\s*'success'\s*:\s*'failure'|'success'/, "must post a 'success' state");
  assert.match(wf, /'failure'/, "must post a 'failure' state on the failure path");
  assert.match(wf, /if:\s*always\(\)/, "the status step must run on both paths");
});
