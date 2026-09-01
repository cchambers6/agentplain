import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { TestBillingProvider } from "@/lib/billing";
import { createTrialCheckoutForSignup } from "@/lib/billing/checkout";
import type { SystemContextRunner } from "@/lib/billing/provisioning";
import {
  TRIAL_PERIOD_DAYS,
  TRIAL_PERIOD_DAYS_EXTENDED,
  trialPeriodDaysForVertical,
} from "@/lib/billing/facts";
import {
  VERTICAL_SLUGS,
  ON_RAMP_SLUGS,
} from "@/lib/verticals";

// ─────────────────────────────────────────────────────────────────────────
// Trial length must have ONE source: `trialPeriodDaysForVertical()` in
// `lib/billing/facts.ts`, for the SAME vertical the signup path used.
//
// This is a money guard, not a copy guard. Before this test there were four
// broken branches:
//
//   1. `actions.ts` Checkout path passed 14 for CPA/Law to Stripe, while
//      `checkout-success/page.tsx:26` rendered `env.stripeTrialPeriodDays()`
//      = 7 on the page the customer lands on immediately after entering a
//      card. Under-promised by 7 days.
//   2. `actions.ts` trial-first path (the SHIPPED DEFAULT —
//      `STRIPE_BILLING_ENABLED` unset) called `provisionTrialSubscriptionSafe`
//      with NO `trialPeriodDays`, so `provisioning.ts` fell back to the
//      global 7 and CPA/Law got 7 days in Stripe while pricing, the FAQ and
//      their own vertical pages promised 14. That is charging someone
//      earlier than we told them.
//   3. The Checkout-FAILURE degrade path had the same missing argument.
//   4. `settings/billing/page.tsx:118` rendered the global default too
//      (filed as P1-11 on 2026-07-02, still open 60 days later).
//
// The assertions below are behavioural where they can be (part A) and
// structural where the defect IS a missing argument (part B).
// ─────────────────────────────────────────────────────────────────────────

const REPO_ROOT = join(__dirname, "..");
const read = (rel: string) => readFileSync(join(REPO_ROOT, rel), "utf8");

/**
 * Strip JS/TS comments before asserting on source. Without this, a comment
 * that DOCUMENTS the banned call (e.g. "instead of the global
 * env.stripeTrialPeriodDays()") trips the very rule it explains — the same
 * trap `tests/marketing-banned-strings.test.ts` handles at its line 195.
 * Here we want the opposite of that test's blind spot: we assert on CODE
 * only, and the corpus gate (tests/corpus-claim-truth.test.ts) is what
 * covers comment-borne drift.
 */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

const ALL_SLUGS = [...VERTICAL_SLUGS, ...ON_RAMP_SLUGS];

const fakeSystemContext: SystemContextRunner = async (fn) =>
  fn({
    workspace: { update: async () => {} },
    auditLog: { create: async () => {} },
  } as unknown as Parameters<typeof fn>[0]);

const covered = {
  verticalsRoundTripped: 0,
  provisionCallSitesChecked: 0,
  surfacesScanned: 0,
};

// ── A. Round trip: what Stripe is told === what the page will render ──────
//
// `actions.ts` calls `createTrialCheckoutForSignup` with
// `trialPeriodDaysForVertical(verticalSlug)` AND `verticalSlug`. The helper
// echoes the slug onto the Checkout `success_url`, and
// `checkout-success/page.tsx` re-derives the number from that slug. This
// test walks that whole loop for EVERY vertical and asserts the two numbers
// cannot disagree.

test("trial length: Stripe and the confirmation page agree, for every vertical", async () => {
  for (const slug of ALL_SLUGS) {
    const expected = trialPeriodDaysForVertical(slug);
    const provider = new TestBillingProvider();

    await createTrialCheckoutForSignup({
      workspaceId: `ws_${slug}`,
      workspaceName: `Test ${slug}`,
      email: `owner@${slug}.test`,
      tier: "regular",
      appOrigin: "https://app.test",
      // Mirrors app/(product)/app/actions.ts exactly.
      trialPeriodDays: trialPeriodDaysForVertical(slug),
      verticalSlug: slug,
      provider,
      systemContext: fakeSystemContext,
    });

    const session = provider.checkoutSessions[0];
    assert.ok(session, `no Checkout session recorded for ${slug}`);

    // 1. What Stripe actually receives.
    assert.equal(
      session.trialPeriodDays,
      expected,
      `Stripe got ${session.trialPeriodDays} days for "${slug}"; facts.ts says ${expected}.`,
    );

    // 2. The success_url must carry the vertical, or the page has nothing to
    //    derive from and silently falls back to the global default.
    const url = new URL(session.successUrl);
    const echoed = url.searchParams.get("vertical");
    assert.equal(
      echoed,
      slug,
      `success_url for "${slug}" must echo ?vertical= so checkout-success can derive the trial without a DB read (got ${JSON.stringify(echoed)}).`,
    );

    // 3. What checkout-success/page.tsx will render from that query param.
    const rendered = trialPeriodDaysForVertical(echoed ?? "");
    assert.equal(
      rendered,
      session.trialPeriodDays,
      `Confirmation page would render ${rendered} days for "${slug}" while Stripe was told ${session.trialPeriodDays}.`,
    );

    covered.verticalsRoundTripped += 1;
  }

  // Sanity: the fixture must actually exercise BOTH trial lengths, or the
  // test could pass while only ever seeing one value.
  const lengths = new Set(ALL_SLUGS.map((s) => trialPeriodDaysForVertical(s)));
  assert.ok(
    lengths.has(TRIAL_PERIOD_DAYS) && lengths.has(TRIAL_PERIOD_DAYS_EXTENDED),
    `Fixture must cover both ${TRIAL_PERIOD_DAYS} and ${TRIAL_PERIOD_DAYS_EXTENDED}; saw ${[...lengths].join(", ")}.`,
  );
});

// ── B. The unset-flag default path ────────────────────────────────────────
//
// The regression here is a MISSING ARGUMENT, so the guard is structural:
// every `provisionTrialSubscriptionSafe(` call in the signup action must
// pass `trialPeriodDays`. Omitting it silently reinstates the global-7 bug
// on the shipped-default branch, and no behavioural assertion on the call
// site's output would notice, because the fallback is valid-looking.

test("trial length: every provisionTrialSubscriptionSafe call in signup passes a per-vertical trial", () => {
  // Comments stripped so a comment mentioning `trialPeriodDays` can never
  // satisfy this assertion on behalf of code that omits it.
  const src = stripComments(read("app/(product)/app/actions.ts"));
  const marker = "provisionTrialSubscriptionSafe(";
  let idx = src.indexOf(marker);

  assert.ok(idx !== -1, "expected provisionTrialSubscriptionSafe call sites in actions.ts");

  while (idx !== -1) {
    // Take the argument text up to the closing of the first object literal.
    const open = src.indexOf("{", idx);
    const close = src.indexOf("},", open);
    const args = src.slice(open, close);

    assert.match(
      args,
      /trialPeriodDays:/,
      `A provisionTrialSubscriptionSafe call in app/(product)/app/actions.ts omits trialPeriodDays. ` +
        `It will fall back to env.stripeTrialPeriodDays() (${TRIAL_PERIOD_DAYS}) and give CPA/Law ` +
        `${TRIAL_PERIOD_DAYS} days while every marketing surface promises ${TRIAL_PERIOD_DAYS_EXTENDED}.\n` +
        `Offending call:\n${args}`,
    );
    assert.match(
      args,
      /trialPeriodDaysForVertical\(|trialDays/,
      `trialPeriodDays must be derived from trialPeriodDaysForVertical() (lib/billing/facts.ts), not a literal.\n${args}`,
    );

    covered.provisionCallSitesChecked += 1;
    idx = src.indexOf(marker, idx + marker.length);
  }

  assert.ok(
    covered.provisionCallSitesChecked >= 2,
    `Expected at least 2 provisionTrialSubscriptionSafe call sites (degrade path + shipped default); found ${covered.provisionCallSitesChecked}.`,
  );
});

// ── C. No customer-facing trial surface may read the global default ───────

/**
 * Surfaces that render a trial length to a customer who has ALREADY chosen a
 * vertical. These must derive per-vertical.
 *
 * DECLARED EXEMPTION — `app/(product)/app/sign-up/page.tsx` renders BEFORE a
 * vertical is chosen, so the global default is the only correct value there.
 * It is deliberately not in this list; its comment documents why.
 */
const VERTICAL_AWARE_TRIAL_SURFACES = [
  "app/(product)/app/sign-up/checkout-success/page.tsx",
  "app/(product)/app/workspace/[id]/settings/billing/page.tsx",
];

test("trial length: vertical-aware surfaces never render the global env default", () => {
  for (const rel of VERTICAL_AWARE_TRIAL_SURFACES) {
    const src = stripComments(read(rel));
    covered.surfacesScanned += 1;

    assert.doesNotMatch(
      src,
      /env\.stripeTrialPeriodDays\(\)/,
      `${rel} renders a trial length from the GLOBAL env default. This surface knows its vertical — ` +
        `it must call trialPeriodDaysForVertical() (lib/billing/facts.ts) so a CPA/Law customer is not ` +
        `told ${TRIAL_PERIOD_DAYS} days when Stripe was given ${TRIAL_PERIOD_DAYS_EXTENDED}.`,
    );
    assert.match(
      src,
      /trialPeriodDaysForVertical/,
      `${rel} must derive its trial length from trialPeriodDaysForVertical().`,
    );
  }
});

// ── D. Coverage, asserted ─────────────────────────────────────────────────

test("trial length :: coverage floor", () => {
  assert.ok(
    covered.verticalsRoundTripped >= 10,
    `Only ${covered.verticalsRoundTripped} verticals round-tripped; the registry should supply at least 10.`,
  );
  assert.equal(
    covered.verticalsRoundTripped,
    ALL_SLUGS.length,
    "Every vertical + on-ramp slug must be round-tripped.",
  );
  assert.ok(
    covered.surfacesScanned === VERTICAL_AWARE_TRIAL_SURFACES.length,
    "Every declared vertical-aware surface must be scanned.",
  );

  console.log(
    `[trial-length-single-source] COVERAGE: ${covered.verticalsRoundTripped}/${ALL_SLUGS.length} verticals ` +
      `round-tripped through Checkout -> success_url -> confirmation page, ` +
      `${covered.provisionCallSitesChecked} provisionTrialSubscriptionSafe call sites checked, ` +
      `${covered.surfacesScanned}/${VERTICAL_AWARE_TRIAL_SURFACES.length} vertical-aware surfaces scanned.`,
  );
});

// ── Declared blind spots ──────────────────────────────────────────────────
//
//  1. Does NOT assert on the live Stripe API — no network, no billing config
//     is read or changed. It asserts what the code hands the provider.
//  2. Does NOT cover the `sign-up/page.tsx` pre-vertical surface (exempt, see
//     above): a CPA visitor still sees the 7-day default there before
//     choosing a vertical. That under-promises rather than over-charges, so
//     it is filed rather than gated.
//  3. Does NOT render the pages. Part C is a source-level assertion that the
//     right function is called; it does not observe the DOM.
//  4. Does NOT cover the trial-warning cron's own day math.
