/**
 * tests/ttfv-real-estate-smoke.test.ts
 *
 * Time-to-first-value smoke — the signup → first-approved-draft funnel for
 * the real-estate vertical must fit inside 5 minutes.
 *
 * What "measured" means here (DB-free, network-free, honest about it):
 *   1. MACHINE PATH — the deterministic core that produces the first draft
 *      (demo dataset → urgent record → activation-draft builder) is executed
 *      for real and timed. It is LLM-free by design (lib/onboarding/demo-data)
 *      so this measurement is the true production cost, not a stand-in.
 *   2. HUMAN PATH — every screen between the signup click and the approved
 *      draft is enumerated with an explicit per-screen budget. The screen list
 *      is pinned against the actual route sources below, so a new screen or a
 *      removed skip path FAILS this test until the budget is re-derived.
 *   3. STRUCTURAL GUARANTEES — the funnel's no-dead-end wiring is asserted
 *      against the route sources: verify lands on /onboarding, the wizard's
 *      final step lands on /welcome (where a draft is guaranteed), the connect
 *      step keeps its skip path, and the approvals empty state routes a
 *      mid-onboarding customer back into setup.
 *
 * What this cannot cover: real network latency and email-provider delivery
 * time. Those live in the email-hop budget line (60s), which is deliberately
 * the largest human line item.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  INPUT_STEPS,
  STEP_ORDER,
  nextStepAfter,
  type StepId,
} from "@/lib/onboarding/steps";
import {
  demoDatasetFor,
  pickUrgentRecord,
  buildActivationDraft,
} from "@/lib/onboarding/demo-data";

const ROOT = process.cwd();
const src = (rel: string): string => readFileSync(join(ROOT, rel), "utf8");

const ONBOARDING_ACTIONS = "app/(product)/app/workspace/[id]/onboarding/actions.ts";
const ONBOARDING_PAGE = "app/(product)/app/workspace/[id]/onboarding/page.tsx";
const WELCOME_PAGE = "app/(product)/app/workspace/[id]/welcome/page.tsx";
const WELCOME_EXPERIENCE =
  "app/(product)/app/workspace/[id]/welcome/WelcomeExperience.tsx";
const VERIFY_ROUTE = "app/(product)/app/verify/route.ts";
const APPROVALS_PAGE = "app/(product)/app/workspace/[id]/approvals/page.tsx";

// ── The budget model ────────────────────────────────────────────────────────
// Seconds a first-time broker-owner spends on each screen, deliberately
// padded (reading every word, no muscle memory). One entry per screen the
// funnel actually shows — the structural tests below keep this list honest.
const HUMAN_BUDGET_SECONDS: Array<[screen: string, seconds: number]> = [
  ["sign-up form (tier preselected via ?vertical=&tier= deep link)", 60],
  ["email hop — open inbox, find mail, click sign-in link", 60],
  ["wizard 1/5 confirm_details (read-only confirm)", 15],
  ["wizard 2/5 connect_integration (skip-for-now path)", 10],
  ["wizard 3/5 pick_skills (defaults pre-checked)", 20],
  ["wizard 4/5 set_preferences (tone + window, notes optional)", 40],
  ["wizard 5/5 first_fire_watch → 'see your first draft'", 10],
  ["welcome narration (3 staged beats, skippable)", 5],
  ["welcome — read the draft + approve it", 45],
];
// Page-load allowance per navigation (server-rendered, no client bundles of
// note on this path).
const SCREEN_LOADS = HUMAN_BUDGET_SECONDS.length;
const LOAD_ALLOWANCE_SECONDS_PER_SCREEN = 3;
const TTFV_LIMIT_SECONDS = 5 * 60;

describe("TTFV smoke — real-estate signup to first approved draft", () => {
  it("machine path: the RE activation draft builds deterministically, fast, and send-ready", () => {
    const started = process.hrtime.bigint();
    const dataset = demoDatasetFor("REAL_ESTATE");
    const record = pickUrgentRecord(dataset);
    assert.ok(record, "RE demo dataset must contain an urgent record");
    const draft = buildActivationDraft({
      vertical: "REAL_ESTATE",
      record,
      businessName: "Peachtree Realty Group",
      savedMinutes: dataset.savedMinutes,
    });
    const machineMs = Number(process.hrtime.bigint() - started) / 1e6;

    // Send-ready, not lorem: a subject, a multi-paragraph body addressed to
    // the demo party, a positive saved-minutes claim, the locked promise line.
    assert.ok(draft.subject.length > 10, "draft subject present");
    assert.ok(
      draft.body.split(/\n{2,}/).length >= 3,
      "draft body has multiple paragraphs",
    );
    assert.ok(draft.savedMinutes > 0, "savedMinutes is a positive claim");
    assert.ok(draft.promiseHeadline.length > 0, "killer-workflow promise present");
    assert.match(
      draft.party.email ?? "",
      /@example\.com$/,
      "demo party email stays a placeholder — honesty bar",
    );
    // The whole deterministic core must be effectively instant — it is the
    // reason the magic moment cannot be broken by a paused model key.
    assert.ok(
      machineMs < 1_000,
      `activation core took ${machineMs.toFixed(1)}ms — expected < 1s`,
    );
  });

  it("human + machine budget: the full walk fits inside 5 minutes with headroom for the machine path", () => {
    // Time the machine core again, amortized over several runs, and fold it in.
    const runs = 20;
    const started = process.hrtime.bigint();
    for (let i = 0; i < runs; i += 1) {
      const dataset = demoDatasetFor("REAL_ESTATE");
      const record = pickUrgentRecord(dataset)!;
      buildActivationDraft({
        vertical: "REAL_ESTATE",
        record,
        businessName: "Peachtree Realty Group",
        savedMinutes: dataset.savedMinutes,
      });
    }
    const machineSeconds =
      Number(process.hrtime.bigint() - started) / 1e9 / runs;

    const humanSeconds = HUMAN_BUDGET_SECONDS.reduce((sum, [, s]) => sum + s, 0);
    const loadSeconds = SCREEN_LOADS * LOAD_ALLOWANCE_SECONDS_PER_SCREEN;
    const total = humanSeconds + loadSeconds + machineSeconds;

    assert.ok(
      total < TTFV_LIMIT_SECONDS,
      `TTFV budget ${total.toFixed(1)}s exceeds the ${TTFV_LIMIT_SECONDS}s limit — ` +
        `human ${humanSeconds}s + loads ${loadSeconds}s + machine ${machineSeconds.toFixed(3)}s. ` +
        "A screen was added or a budget grew; re-derive the funnel before shipping.",
    );
  });

  it("wizard shape: exactly the five budgeted input steps, terminating at done", () => {
    assert.equal(
      INPUT_STEPS.length,
      5,
      "budget model assumes a 5-step wizard — update HUMAN_BUDGET_SECONDS if this changes",
    );
    // The state machine walks every step to `done` with no cycles.
    let step: StepId = STEP_ORDER[0]!;
    const visited: StepId[] = [step];
    while (step !== "done") {
      step = nextStepAfter(step);
      assert.ok(!visited.includes(step), `cycle at ${step}`);
      visited.push(step);
    }
    assert.equal(visited.length, STEP_ORDER.length);
  });

  it("no dead ends: verify → onboarding, final step → /welcome, connect keeps its skip path", () => {
    // Magic link lands a non-onboarded customer on the wizard.
    assert.match(src(VERIFY_ROUTE), /\/onboarding`/);

    // The wizard's final advance lands on /welcome — the surface that
    // guarantees a draft exists (idempotent activation run) even when every
    // picked skill skipped.
    const actions = src(ONBOARDING_ACTIONS);
    assert.match(
      actions,
      /if \(isFinalStep\) \{[\s\S]{0,800}?\/welcome`\)/,
      "final onboarding step must redirect to /welcome, never a bare dashboard",
    );

    // Connect step keeps its skip-for-now escape.
    const page = src(ONBOARDING_PAGE);
    assert.match(page, /name="skipped"/, "connect step skip path removed");
    assert.match(page, /skip for now/, "skip copy removed");

    // The welcome surface actually runs the activation (idempotent) — the
    // guarantee behind "see your first draft".
    const welcome = src(WELCOME_PAGE);
    assert.match(welcome, /runActivationForWorkspace/);

    // One-click approve + the staged narration remain skippable and present.
    const experience = src(WELCOME_EXPERIENCE);
    assert.match(experience, /approve this draft/);
    assert.match(experience, /show it now/, "narration skip removed");
    assert.match(experience, /savedMinutes/, "saved-minutes payoff removed");
  });

  it("empty queue mid-onboarding routes back into setup, not a void", () => {
    const approvals = src(APPROVALS_PAGE);
    assert.match(
      approvals,
      /onboardingComplete/,
      "approvals empty state must know onboarding state",
    );
    assert.match(
      approvals,
      /finish setup — see your first draft/,
      "mid-onboarding empty state must carry a CTA back into setup",
    );
  });
});
