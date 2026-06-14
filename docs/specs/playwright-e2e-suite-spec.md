# Playwright E2E Suite Spec — what #247 *should* be vs *is*

**Audit date:** 2026-06-14
**Branch under audit:** `test/e2e-revenue-path-playwright` (PR #247, committed 2026-06-13 by Sonnet 4.6)
**Baseline:** `origin/main` @ `fc900bc` (post-#257 — includes #240–#257)
**Author:** fleet audit (`audit/playwright-e2e-spec-2026-06-14`)

---

## TL;DR — Recommendation

**PARTIAL REWRITE. Do not close-and-replace; do not blind-rebase.**

#247's *infrastructure* (seed harness, session minting, signed-webhook helper, Playwright config, CI workflow) is genuinely good and matches current `main` — **keep all of it**. Its *scenario coverage* is ~50% of what the post-merge revenue path now needs, and three of its six specs encode assumptions that are now wrong:

1. **`signup-to-first-value` assumes card-at-signup is the default flow.** It is not — `STRIPE_CHECKOUT_ENABLED` defaults **FALSE** (`lib/env.ts:154–161`), so the shipped default is *trial-first / no-card* (`provisionTrialSubscriptionSafe`, `app/(product)/app/actions.ts:232–237`). #247's config never sets the flag, so the "redirects to Stripe Checkout" test will **time out against current `main`.**
2. **`support-ticket-lifecycle` asserts a status enum that doesn't exist** (`["NEW","ACKNOWLEDGED"]`) — the real enum is `NEW / OPEN / RESOLVED` (`SupportRequestStatus`). Its skip-guarded admin-reply tests are now unblocked (#244 merged: `/operator/support` exists).
3. **No coverage of the live customer reality:** prod `ANTHROPIC_API_KEY` is the `sk-ant-PAUSED-…` sentinel **by policy** (#257 audit). Degraded mode *is* the customer experience today — and #247 has zero degraded-mode tests.

**Single most-critical missing scenario:** `degraded-mode-llm` — because the LLM is paused by policy, the degraded path is what every real customer hits *right now*. A suite that only tests the happy path is green on a flow no one experiences.

**Estimated effort to bring coverage to this spec:** ~46–62 engineer-hours (keep 4 specs as-is/extended, rewrite 2, add 8). Detail in §D.

> ⚠️ **Ground-truth caveat that the spec depends on (verify before building):** the code has an internal trial-length contradiction. `lib/pricing/tiers.ts:131` exports `TRIAL_PERIOD_DAYS = 30` (used in the SignUpForm tier-summary copy "30 days free"), while the *actual* Stripe/billing trial uses `env.stripeTrialPeriodDays()` which **defaults to 14** (`lib/env.ts:142`, and the checkout-success page renders `{trialDays}` = 14). The per-vertical 7-day/14-day-CPA-Law split declared in `docs/business-plan/per-vertical-pricing.md` **is not implemented** — trial length is one flat env number for all verticals. Tests must assert *what the code does*, and one test should pin this contradiction so it can't silently drift further.

---

## Section A — What the suite SHOULD cover (post-merge reality)

Scenarios are ordered by revenue-criticality. Each is tagged **[no-DB]** (runs in CI without Postgres) or **[DB]** (needs the seed harness). The suite already separates these cleanly via `skipIfNoDb`.

Mock posture (constant across all scenarios):
- **Billing:** `BILLING_PROVIDER=test` (`lib/billing/test-provider.ts`) — no real Stripe. Webhooks delivered via the HMAC-signed helper to `POST /api/stripe/webhook`.
- **Auth:** `AUTH_PROVIDER=test` — sessions minted directly (`tests/fixtures/mint-session.ts`), no magic-link email.
- **LLM:** Anthropic never called. Drafts are **pre-seeded** by the harness; degraded-mode tests assert the *paused* path (which by design never calls the model — `lib/plaino/degraded-mode.ts` detects the sentinel before any model call or DB write).
- **Integrations:** no live OAuth — credential rows seeded directly; adapter behavior asserted via DB state + UI copy.

### A1. `signup-default-trial-first` **[no-DB + DB]** — *the actual default flow*
- **Proves:** A new visitor in a supported vertical can sign up with **no card** and land in a working, trial-first workspace (the shipped default, `STRIPE_CHECKOUT_ENABLED` unset).
- **Critical assertions:**
  - `/app/sign-up?vertical=real-estate` renders: `getByLabel("brokerage / firm name")`, `getByLabel("your email")`, tier radio defaults to Regular.
  - Submit (`begin with us — … workspace`) does **not** redirect to any `checkout.example` / Stripe URL.
  - A `Subscription` row is created with `status = TRIALING` via `provisionTrialSubscriptionSafe`.
  - Tier-summary copy is internally consistent — **this test pins the 30-vs-14 contradiction** (assert the displayed trial number equals `env.stripeTrialPeriodDays()`; today this *fails* and documents the bug, or is marked `fixme` with the cite).
- **Mocks:** test billing provider; no checkout flag.

### A2. `signup-card-at-signup` **[DB]** — *the opt-in CC-at-signup path*
- **Proves:** With `STRIPE_CHECKOUT_ENABLED=true` + `STRIPE_BILLING_ENABLED=true`, signup captures a card via Checkout before the workspace is usable, and the success landing renders correctly.
- **Critical assertions:**
  - Submit redirects to the (intercepted) Checkout URL.
  - `checkout-success?session_id=…` renders eyebrow "card on file", heading "Your card is secured. Your trial is rooted.", and "{trialDays}-day trial" copy.
  - `checkout.session.completed` webhook (metadata `agentplain_signup_flow: "checkout_at_signup"`) returns 200 and the `Workspace.stripeCustomerId` + `Subscription(status=TRIALING)` are persisted.
- **Mocks:** `page.route` intercept on the test provider's `checkout.example/**`; signed `checkout.session.completed` event.
- **Note:** this is the path the *go-live mandate* wants as default. Until the default flips, this test must explicitly set the env flag in a dedicated Playwright project/worker.

### A3. `vertical-gate` **[no-DB]** — *honest waitlist, no charge*
- **Proves:** Unsupported vertical ("Something else") shows the waitlist screen, never redirects to checkout, creates no workspace; supported vertical (real-estate) passes the gate.
- **Critical assertions:** waitlist copy visible ("Plaino isn't ready for…" / "not yet" / "waitlist"); `page.url()` has no `checkout.example`; supported path proceeds.
- **Mocks:** none (no-DB). Refund-on-paid-unsupported stays guarded (Pillar 4 not merged).

### A4. `degraded-mode-llm` **[DB]** — ⭐ *the live customer experience*
- **Proves:** When the model credential is the paused sentinel / missing, Plaino chat and support degrade gracefully with in-character copy, persist no broken turn, and route to a human — never a raw 5xx.
- **Critical assertions:**
  - `/app/workspace/[id]/talk` renders the degraded notice (per `lib/plaino/degraded-mode.ts` copy, e.g. ANTHROPIC_API_KEY_MISSING → "Plaino is offline for the moment — the model credential I need…").
  - Posting a message returns a `formError` and writes **no** `PersistedChatMessage` row (assert count unchanged).
  - `/api/chat?mode=support` for a paying customer returns support-specific copy and does **not** force the lead-capture box (`expandLeadCapture:false`) — per #257 P1-b and the support-degraded distinction.
- **Mocks:** run this project/worker with `ANTHROPIC_API_KEY` unset (and `LLM_PROVIDER` not `test`) to trigger the real detection branch.

### A5. `support-ticket-lifecycle` **[DB]** — *full, now that #244 is merged*
- **Proves:** Customer files a help request → row created → draft reply enters review (`SUPPORT_HANDLER_REPLY_DRAFT` approval) → operator sees it in `/operator/support` → resolves → customer's `/help` banner reflects state.
- **Critical assertions:**
  - `/app/workspace/[id]/help` form (subject + "your message" textarea, "send to your service partner") submits and creates a `SupportRequest` with `status ∈ {NEW, OPEN}`.
  - The `/help` recent-status banner shows "drafted-under-review" or "submitted" (`lib/support/recent-status.ts`).
  - Operator (seeded operator session) at `/operator/support?status=open` sees the ticket; `markSupportResolvedAction` flips it to `RESOLVED` and writes an `AuditLog` `support_request.status_changed` row.
- **Mocks:** operator session minted with `isOperator:true`; no real email (test provider, `emailMessageId` may be null).

### A6. `trial-to-paid` **[DB]** — *trial converts via webhook*
- **Proves:** A trialing subscription flips to ACTIVE on `customer.subscription.updated(status=active)`; billing page reflects trial → active.
- **Critical assertions:** billing page (`/settings/billing`) shows trial status + an add-card/manage CTA during trial; after the update webhook, `Subscription.status = ACTIVE` in DB and the page reflects it. Assert the trial-end math against `env.stripeTrialPeriodDays()`, not a hardcoded 14/30.
- **Mocks:** seed customerId on workspace; `subscription.created(trialing)` then `subscription.updated(active)`.

### A7. `past-due-grace` **[DB]** — *dunning keeps the fleet running, then gates*
- **Proves:** `invoice.payment_failed` → `PAST_DUE`; workspace stays accessible during grace (fleet keeps running); billing page surfaces past-due; webhook is idempotent.
- **Critical assertions:** DB `status = PAST_DUE`; workspace home loads (not hard-gated, not redirected to sign-in); billing shows "past due"/"payment failed"; duplicate webhook returns 200 twice (idempotent via `BillingEvent.stripeEventId` unique).
- **Mocks:** `subscription.created(active)` → `invoice.payment_failed`.

### A8. `cancel-and-resubscribe` **[DB]** — *data survives the billing lifecycle*
- **Proves:** `cancelAtPeriodEnd=true` keeps access; `subscription.deleted` → `CANCELED`; workspace + approvals rows survive; new `subscription.created` restores ACTIVE.
- **Critical assertions:** as #247 already has — `closureStatus != CLOSED` after cancel; `workApprovalQueueItem.count > 0` survives; resub → ACTIVE.

### A9. `token-budget-enforcement` **[DB]** — *margin guardrail (per #253 spec)*
- **Proves:** Crossing 80% fires a one-time alert; reaching 100% hard-gates new work with an upgrade path; raising the cap clears the gate immediately.
- **Critical assertions** (per `docs/specs/per-customer-token-budget-enforcer.md`): at ≥80% an alert is recorded once (`alertedAt80Pct` set, no double-fire); at ≥100% `BudgetExceededError` path engages — chat/talk shows the budget degraded copy with "See usage & upgrade" → `/settings/billing?reason=budget`; cron skills write `AuditLog billing.budget_gated` and skip; raising `budgetTokens` clears the gate.
- **Status flag:** the enforcer is a **spec** (#253), not confirmed shipped end-to-end. Gate this spec behind `E2E_TOKEN_BUDGET=1` and skip-with-message until the enforcer lands, mirroring #247's Pillar-4 pattern.
- **Mocks:** seed a usage row near the threshold; no real model calls.

### A10. `first-5-min-value` **[DB]** — *demo data → instant draft → clears on real sync (#248)*
- **Proves:** A brand-new workspace shows a Plaino draft on demo data within the first session, and demo drafts clear after the first real integration sync.
- **Critical assertions:** seeded demo workspace shows ≥1 approval card on `/app/workspace/[id]/approvals`; after a simulated real-sync event, demo-marked drafts are cleared (count of demo-flagged items → 0) while the workspace remains intact.
- **Status flag:** verify the demo-clear-after-sync implementation exists before asserting (the explorer found the seeding path `scripts/seed-loop-demo.ts` but the clear-trigger wiring is comment-referenced — confirm in `lib` sync handlers). Gate behind `E2E_DEMO_CLEAR=1` if not yet wired.

### A11. `approval-queue-interaction` **[DB]** — *the core daily loop (rebuilt #243)*
- **Proves:** The rebuilt approvals UI renders seeded drafts, the discipline filter works, and approve/reject actions complete and remove the card.
- **Critical assertions:** seeded markers visible; `role="group"` discipline filter (`aria-label="Filter approvals by discipline"`) filters; clicking "approve" (lowercase, `decideApprovalAction` with `decision=APPROVED`) removes the card; "reject" works; provenance line "herded in by Plaino" present.
- **Mobile sub-case:** set viewport to 375px and assert the queue is operable (the explorer found no swipe/batch-select implementation — assert *operability at mobile width*, not gestures that don't exist; flag swipe/batch as a product gap, do not test phantom features).

### A12. `weekly-report` **[DB]** — *recurring value surfaces (#245)*
- **Proves:** The weekly/scheduled pulses (analytics/finance/content/compliance) produce approval-queue items, not outbound email (per `project_no_outbound_architecture.md`).
- **Critical assertions:** invoking the relevant Inngest sweep against a seeded workspace produces a `WorkApprovalQueueItem` of kind `ANALYTICS_PULSE` / `FINANCE_PULSE` / `CONTENT_CALENDAR` / `COMPLIANCE_DIGEST`; it renders on `/approvals`. **No** real email is sent.
- **Note:** "weekly report email" in the task brief is a misnomer for current architecture — output is the approval queue, not email. Test the real behavior.

### A13. `integration-self-heal` **[DB]** — *Pillar 2 credential expiry → reconnect*
- **Proves:** An expired/revoked `IntegrationCredential` surfaces a reconnect prompt to the customer rather than failing silently.
- **Critical assertions:** seed a credential with `status = EXPIRED` (or `REVOKED`); the integrations settings surface shows a reconnect CTA; status transitions are reflected.
- **Status flag:** the explorer found status enums + refresh logic but no confirmed customer-facing reconnect *banner*. Gate behind `E2E_SELF_HEAL=1` and verify the UI exists before asserting.

### A14. `money-back-refund` **[DB]** — *14-day guarantee (declared, not built)*
- **Proves:** A paid customer within the guarantee window can request a refund and the workspace gates gracefully.
- **Status flag:** the 14-day money-back guarantee is **policy in `per-vertical-pricing.md`, not implemented** (no refund route found). **Do not write live assertions** — add as a guarded placeholder (`E2E_MONEY_BACK=1`) so the gap is visible in the suite manifest, same pattern as Pillar 4.

---

## Section B — What #247 currently has (delta vs Section A)

| #247 spec file | Maps to | Alignment | What's stale / wrong |
|---|---|---|---|
| `signup-to-first-value.spec.ts` | A1 + A2 + A11 | ⚠️ Partial | **Assumes card-at-signup is default.** Test "real-estate signup redirects to Stripe Checkout" expects a `checkout.example` redirect, but the default flow (`STRIPE_CHECKOUT_ENABLED` unset) is trial-first/no-card → **test will time out on current `main`.** Config never sets the flag. Approval-queue + webhook sub-tests are fine. Splits cleanly into A1 (default) + A2 (opt-in). |
| `trial-to-paid.spec.ts` | A6 | ✅ Mostly aligned | Hardcodes "16 days remaining" / implies a long trial — works for either 14 or 30 but doesn't assert against `env.stripeTrialPeriodDays()`, so it can't catch the 30-vs-14 contradiction. Webhook flip logic is correct (`ACTIVE`). |
| `past-due-grace.spec.ts` | A7 | ✅ Aligned | Status enum (`PAST_DUE`), idempotency, grace-access all match current schema. Keep nearly verbatim. |
| `cancel-and-resubscribe.spec.ts` | A8 | ✅ Aligned | `CANCELED`, `cancelAtPeriodEnd`, data-survival, resub→ACTIVE all match. Keep nearly verbatim. |
| `support-ticket-lifecycle.spec.ts` | A5 | ⚠️ Stale enum + over-skipped | **Asserts `["NEW","ACKNOWLEDGED"]`** — real enum is `NEW / OPEN / RESOLVED` (`SupportRequestStatus`). Admin-reply + operator-queue tests are skip-guarded on `E2E_SUPPORT_THREAD` "pending #244" — **#244 is merged**; `/operator/support` exists, so these can be written for real now. |
| `vertical-gate-refund.spec.ts` | A3 + A14 | ✅ / guarded | Waitlist tests align. Pillar-4 refund correctly stays skipped (still not merged). The money-back-refund (A14) is a *different* missing guarantee not represented at all. |
| `fixtures.ts` | infra | ✅ Keep | Seed + session + `authedPage` + `skipIfNoDb` — clean, matches `seed-test-workspace.ts` + `mint-session.ts` on the branch. |
| `helpers/webhook.ts` | infra | ✅ Keep | HMAC signing matches `TestBillingProvider.verifyWebhook`; posts to `/api/stripe/webhook` (correct route); event builders match Stripe shapes. Add `checkout.session.completed` is already present; add budget/usage helpers for A9. |
| `playwright.config.ts` | infra | ⚠️ Keep + extend | Good base (single worker, 60s timeout, test providers). **Missing** a second project that sets `STRIPE_CHECKOUT_ENABLED`/`STRIPE_BILLING_ENABLED` for A2, and a degraded-mode project that unsets `ANTHROPIC_API_KEY` for A4. |
| `.github/workflows/e2e.yml` | infra | ✅ Keep + extend | Solid: pgvector service, `prisma migrate deploy`, chromium-only, report artifact. Add the env permutations for A2/A4; consider sharding if runtime grows. |
| `seed-test-workspace.ts` (Concern B harness) | infra | ✅ Keep | Seeds owner + membership + onboarding + credentials + briefing + approvals of kinds that exist on `main`. Extend with: operator user (A5), near-budget usage row (A9), demo-flagged drafts (A10), expired credential (A13). |

**Coverage math:** #247 has 6 specs covering ~A1/A3/A5/A6/A7/A8 (of which A5 is stubbed and A1 is half-wrong). Section A wants 14 scenarios. **Net: ~4 solid, 2 need rewrite, 8 net-new (4 of them guarded placeholders).**

---

## Section C — Recommendation (per-item)

**KEEP + EXTEND (lightly):**
- All infrastructure: `fixtures.ts`, `helpers/webhook.ts`, `playwright.config.ts`, `e2e.yml`, the `seed-test-workspace.ts` harness. This is the strongest part of #247 and exactly what you don't want to re-derive.
- `past-due-grace.spec.ts` (A7) — keep ~verbatim.
- `cancel-and-resubscribe.spec.ts` (A8) — keep ~verbatim.
- `trial-to-paid.spec.ts` (A6) — keep, add an assertion against `env.stripeTrialPeriodDays()` so it catches the trial-length contradiction.

**REWRITE against new state:**
- `signup-to-first-value.spec.ts` → split into **A1 `signup-default-trial-first`** (the real default — no checkout redirect) and **A2 `signup-card-at-signup`** (opt-in, env-flagged project). This is the single biggest correctness fix.
- `support-ticket-lifecycle.spec.ts` (A5) → fix the status enum to `NEW/OPEN/RESOLVED`; unskip and implement the operator-queue + resolve flow now that #244 is merged.

**ADD (net-new):**
- A4 `degraded-mode-llm` — ⭐ highest priority new test (live reality).
- A11 `approval-queue-interaction` — promote the buried approval sub-test in #247 into a first-class spec for the rebuilt (#243) UI, incl. discipline filter + 375px operability.
- A12 `weekly-report` — pulses → approval items (not email).
- A9 `token-budget-enforcement` — guarded (`E2E_TOKEN_BUDGET=1`) until #253 enforcer ships.
- A10 `first-5-min-value` — guarded (`E2E_DEMO_CLEAR=1`) until clear-on-sync is verified.
- A13 `integration-self-heal` — guarded (`E2E_SELF_HEAL=1`) until reconnect UI verified.
- A14 `money-back-refund` — guarded placeholder (`E2E_MONEY_BACK=1`), policy-only today.

**CLOSE:** nothing. #247 is salvageable and the harness is worth more than a rewrite.

**Mechanically:** rebase #247 onto current `main`, apply the two rewrites + enum fix, then land the net-new specs in a follow-up PR (or the same PR if reviewer bandwidth allows). The branch's own files don't conflict with `main` (they're additive, mostly untracked paths), so the rebase is clean; the *content* fixes are the work.

---

## Section D — Implementation plan

**Effort assumptions:** hours are rough engineering effort for a developer familiar with this codebase, *including* writing the assertion against real selectors (already inventoried in this doc) and getting it green in CI. Guarded placeholders are cheap (write the skip + TODO). These are estimates per the explicit ask in the task brief — treat as planning ranges, not commitments.

| Scenario | Action | Est. hours | Notes |
|---|---|---|---|
| Infra (fixtures/webhook/config/CI/harness) | Keep | 0 | Already correct. |
| Config: add checkout + degraded projects | Extend | 2–3 | Two extra Playwright projects + env wiring in `e2e.yml`. |
| Harness: operator user, budget row, demo drafts, expired cred | Extend | 4–5 | Additive seed functions. |
| A7 past-due-grace | Keep | 0–1 | Re-verify only. |
| A8 cancel-and-resubscribe | Keep | 0–1 | Re-verify only. |
| A6 trial-to-paid | Keep + assert trial-len | 1–2 | Add `env.stripeTrialPeriodDays()` assertion. |
| A1 signup-default-trial-first | Rewrite | 3–4 | New default-path assertions + trial-contradiction pin. |
| A2 signup-card-at-signup | Rewrite | 3–4 | Env-flagged project + checkout intercept + `checkout.session.completed`. |
| A3 vertical-gate | Keep (from #247) | 0–1 | Drop the Pillar-4 stub into A14. |
| A5 support-ticket-lifecycle | Rewrite + unskip | 4–6 | Enum fix + operator session + resolve flow. |
| A4 degraded-mode-llm ⭐ | Add | 4–6 | Highest-value new test; chat + support-mode branches. |
| A11 approval-queue-interaction | Add | 4–5 | Filter + approve/reject + 375px operability. |
| A12 weekly-report | Add | 3–4 | Invoke sweep → assert approval item, no email. |
| A9 token-budget-enforcement | Add (guarded) | 3–5 | Full body when #253 lands; ~1h for the guarded stub now. |
| A10 first-5-min-value | Add (guarded) | 3–5 | Verify clear-on-sync first; ~1h stub now. |
| A13 integration-self-heal | Add (guarded) | 2–4 | Verify reconnect UI first; ~1h stub now. |
| A14 money-back-refund | Add (placeholder) | 1 | Skip + TODO; policy-only today. |
| **Total** | | **~46–62 h** | Live now: ~38–50h. Guarded stubs: ~4h. Remainder unlocks as features land. |

**Mock infrastructure needed (all already present or trivial extension):**
- Stripe test mode: `BILLING_PROVIDER=test` + `STRIPE_WEBHOOK_SECRET=test_whsec` + HMAC helper. ✅ exists.
- Card-at-signup: add `STRIPE_CHECKOUT_ENABLED=true` + `STRIPE_BILLING_ENABLED=true` in a dedicated project; `page.route` intercept on `checkout.example/**`. New.
- Anthropic: never mock the success path (drafts pre-seeded). For A4, run a project with `ANTHROPIC_API_KEY` unset to hit the real degraded branch. New project.
- Integration adapters: seed `IntegrationCredential` rows directly (ACTIVE for happy path, EXPIRED/REVOKED for A13). Harness extension.

**CI integration:**
- Keep `e2e.yml` (pgvector service, `prisma migrate deploy`, chromium, report artifact, 20-min timeout).
- Add the two env-permutation projects so A2/A4 run in CI. Keep them in the same job (cheap) unless runtime exceeds budget.
- Triggers: PR + push-to-main (already set).

**Run-time budget (<5 min target):**
- 6 specs single-worker today fit comfortably. At 14 scenarios, single-worker `next dev` startup (~30–60s) + ~14 specs may push 5–8 min. Mitigations: (1) build once with `next build && next start` instead of `next dev` for CI speed; (2) shard by file across 2 workers *only if* DB isolation per worker is guaranteed (the seedKey already derives per-worker keys, so this is viable); (3) keep no-DB specs (A1 partial, A3) in a fast lane that runs without the Postgres service.

---

## Section E — Decision matrix for #247

Read this top-to-bottom; the verdict column is the action to take per scenario.

| Scenario (Section A) | In #247? | State on `main` | Verdict |
|---|---|---|---|
| A1 signup-default-trial-first | Partial (wrong default) | Default flow, shipped | **REWRITE** — split from #247's signup spec |
| A2 signup-card-at-signup | Partial (assumed default) | Opt-in, shipped | **REWRITE** — env-flagged project |
| A3 vertical-gate | Yes | Shipped | **KEEP** |
| A4 degraded-mode-llm ⭐ | No | **Live reality (paused by policy)** | **ADD — do first** |
| A5 support-ticket-lifecycle | Stubbed + wrong enum | #244 merged | **REWRITE + unskip** |
| A6 trial-to-paid | Yes | Shipped | **KEEP + assert trial-len** |
| A7 past-due-grace | Yes | Shipped | **KEEP** |
| A8 cancel-and-resubscribe | Yes | Shipped | **KEEP** |
| A9 token-budget-enforcement | No | Spec #253, not confirmed shipped | **ADD (guarded)** |
| A10 first-5-min-value | No | #248 shipped; clear-on-sync unverified | **ADD (guarded)** |
| A11 approval-queue-interaction | Buried sub-test | #243 rebuilt, shipped | **ADD (promote)** |
| A12 weekly-report | No | #245 shipped (queue, not email) | **ADD** |
| A13 integration-self-heal | No | Enums exist; UI unverified | **ADD (guarded)** |
| A14 money-back-refund | No | Policy only, not built | **ADD (placeholder)** |

**Plan-B summary (the one-liner to greenlight):** *Rebase #247, keep the harness + 4 billing specs, rewrite signup (split into default/opt-in) and support (enum + unskip), then add degraded-mode-llm first and the remaining 7 (4 guarded). ~46–62h to full spec; ~38–50h to everything that's testable today.*

---

### Appendix — verified ground-truth cites (so this doesn't re-derive)
- Trial length: `lib/pricing/tiers.ts:131` (`TRIAL_PERIOD_DAYS = 30`, display) vs `lib/env.ts:142–161` (`stripeTrialPeriodDays()` default **14**, actual). Contradiction — not yet reconciled.
- Card-at-signup default OFF: `lib/env.ts:154–161` (`STRIPE_CHECKOUT_ENABLED` default false); `app/(product)/app/actions.ts:185,232–237` (trial-first path).
- Billing default OFF: `lib/env.ts:135–141` (`STRIPE_BILLING_ENABLED` default false).
- Webhook route: `app/api/stripe/webhook/route.ts`; idempotency via `BillingEvent.stripeEventId` unique.
- SubscriptionStatus enum: `TRIALING / ACTIVE / PAST_DUE / INCOMPLETE / INCOMPLETE_EXPIRED / CANCELED / UNPAID / PAUSED`.
- SupportRequestStatus enum: `NEW / OPEN / RESOLVED` (#247 wrongly assumes `ACKNOWLEDGED`).
- Support surfaces: `/app/workspace/[id]/help` (`HelpForm.tsx`), `/operator/support` (`actions.ts`: mark-open/resolved/reopen), `lib/support/recent-status.ts`.
- Approvals (#243): `/app/workspace/[id]/approvals` (`ApprovalsList.tsx`, `ApprovalCard.tsx`, `actions.ts:decideApprovalAction`), filter `aria-label="Filter approvals by discipline"`, buttons "approve"/"reject".
- Talk/chat (#251): `/app/workspace/[id]/talk` (`talk-view.tsx`, `TalkComposer.tsx`), degraded via `lib/plaino/degraded-mode.ts` + `checkDegradedMode()`.
- Token budget enforcer spec: `docs/specs/per-customer-token-budget-enforcer.md` (80% alert, 100% hard-gate, `/settings/billing?reason=budget`, `AuditLog billing.budget_gated`).
- Pricing/trial policy (declared, partly unbuilt): `docs/business-plan/per-vertical-pricing.md`, `docs/business-plan/unit-economics.md`.
- #257 P0/P1: `docs/audits/CUSTOMER_JOURNEY_POST_MERGE_2026_06_14.md`.
