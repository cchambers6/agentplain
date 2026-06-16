# Customer-path E2E suite + audit-queue longevity loop

This is the **longevity layer**: a Playwright suite that exercises the most-clicked customer paths against a running app, wired to a nightly run, plus an **audit-queue-seeder** that turns regressions into autonomous fixes via the existing `agentplain-audit-queue-autofire` scheduled task.

Two stacked PRs deliver it:

- **PR A** — `playwright.config.ts`, `tests/e2e/*.spec.ts`, `tests/e2e/fixtures/test-mode.ts`, `package.json` scripts.
- **PR B** — `scripts/audit-queue-seeder.ts`, `scripts/playwright-failures-to-inbox.ts`, the two GitHub Actions workflows.

---

## 1. Running the E2E suite

The specs drive a **real browser against a RUNNING app** — they are not part of the DB-free `npm test` node suite. They live in `tests/e2e/` and run via Playwright.

```bash
# Against a deployed preview (what nightly CI does)
E2E_BASE_URL=https://<preview>.vercel.app npm run test:e2e

# Against local dev
E2E_BASE_URL=http://localhost:3000 npm run test:e2e

# Visual regression (requires committed baselines — see §3)
E2E_BASE_URL=… npm run test:e2e:visual

# The nightly profile (chromium + mobile projects)
E2E_BASE_URL=… npm run test:e2e:nightly
```

### Test tiers (env-gated — a bare run is a clean partial pass, never a false red)

| Tier | Needs | Covers |
|---|---|---|
| **Public** | `E2E_BASE_URL` | `marketing.spec.ts`, the auth **page-render** tests in `auth.spec.ts` |
| **Authed** | `E2E_BASE_URL` + `E2E_SESSION_COOKIE` + `E2E_WORKSPACE_ID` | `workspace.spec.ts`, `workspace.mobile.spec.ts` |
| **Auth-flow** | the above + `E2E_AUTH_FLOW=1`, app in `AUTH_PROVIDER=test` / `BILLING_PROVIDER=test` | signup submit, the 30-day cookie, logout, Plaino turn submission |

Each tier **self-skips** when its env isn't set, so you only get red on a real regression in a path that *is* configured to run.

### Env vars

| Var | Purpose |
|---|---|
| `E2E_BASE_URL` | Origin to test (preview/prod/localhost). Unset → all specs skip. |
| `E2E_SESSION_COOKIE` | A sealed `agentplain_session` value (signed-in). Injected into the browser context — **no DB or session minting at test time**. |
| `E2E_SESSION_COOKIE_NAME` | Override the cookie name (default `agentplain_session`). |
| `E2E_WORKSPACE_ID` | The workspace the session belongs to (path target for authed specs). |
| `E2E_AUTH_FLOW=1` | Enable the flows that mutate (signup, login, logout) — needs test-mode providers. |
| `E2E_MAGIC_LINK_COMPLETE_PATH` | Test-mode login completion URL, for the 30-day cookie assertion. |
| `E2E_VISUAL=1` | Turn `maybeSnapshot` into real `toHaveScreenshot` assertions. |
| `E2E_WEBSERVER=1` | Let Playwright boot `npm run dev` locally (off in CI). |

### Where the authed session comes from

`tests/e2e/smoke-authenticated.ts` (already on main) seeds a clearly-marked TEST workspace and mints a real iron-session. Run it to get a `(workspace id, sealed cookie)` pair, then feed them in as `E2E_WORKSPACE_ID` + `E2E_SESSION_COOKIE`. The authed Playwright specs are the **visual/interaction** layer on top of that route-level smoke.

### Scope notes (cited reality, not the brief's assumptions)

- The brief listed `/sell`, `/services`, `/financing`, `/instant-offer` — those are **FlatSBO** routes and do **not** exist in agentplain. The suite covers the real `app/(marketing)` surface (`/`, `/[vertical]`, `/verticals`, `/pricing`, `/custom`, legal pages).
- There is **no `TEST_MODE_ENABLED`** env in this codebase; the real flags are `AUTH_PROVIDER=test` / `BILLING_PROVIDER=test` (`lib/env.ts:37–38`).
- Workspace nav currently ships **12 tabs** (the 5-tab IA simplification is planning-only/unmerged) — specs test the shipped reality.
- No real Stripe or LLM calls. The prod model key is paused by policy; the Plaino submit test accepts **either** a rendered turn **or** the honest degraded notice.

---

## 2. The nightly run

`.github/workflows/e2e-nightly.yml` runs at **08:00 UTC** (≈ 03:00/04:00 ET, before the morning autofire) and on `workflow_dispatch`. It:

1. installs deps + the chromium browser,
2. runs `npm run test:e2e:nightly` with `E2E_BASE_URL` from the `E2E_PREVIEW_URL` secret/var (and optional authed secrets),
3. on failure, runs `scripts/playwright-failures-to-inbox.ts` and uploads the report + seeded entries as artifacts.

To enable it end-to-end, set repo secrets/vars: `E2E_PREVIEW_URL` (required to run anything), and optionally `E2E_WORKSPACE_ID` / `E2E_SESSION_COOKIE` / `E2E_AUTH_FLOW` for the authed + auth-flow tiers.

---

## 3. Visual regression

`maybeSnapshot(page, name)` captures a screenshot **artifact** by default. With `E2E_VISUAL=1` it becomes a `toHaveScreenshot` assertion. Baselines are **not** committed yet — generate them once against a known-good deployment:

```bash
E2E_VISUAL=1 E2E_BASE_URL=… npx playwright test --update-snapshots
```

…then commit the `*-snapshots/` dirs. Until then, visual regression is opt-in so a missing baseline can't turn a green render red.

---

## 4. The audit-queue longevity loop

`scripts/audit-queue-seeder.ts` turns regressions into INBOX entries the **`agentplain-audit-queue-autofire`** scheduled task picks up (it scans the INBOX by the `audit-queue` / `regression` keywords at 9am/1pm/5pm/9pm ET and auto-fires fixes scoring 4+/5 with <$150 effort).

### Signals gathered

| Source | Trigger | Severity |
|---|---|---|
| `ci` | GitHub Actions run failed in the last 8h | high (main) / medium (branch) |
| `vercel` | Vercel deployment commit-status failed/errored in the last 8h | high |
| `brand-gate` | `tools/brand/brand-gate.mjs --json` `newViolations > 0` | medium |
| `stale-pr` | PR open >2h, no new commits, CI green | low |
| `e2e` | A failed test in the Playwright report | high |

```bash
GITHUB_TOKEN=… npx tsx scripts/audit-queue-seeder.ts          # all signals
npx tsx scripts/audit-queue-seeder.ts --dry-run               # print, write nothing
AUDIT_QUEUE_INBOX_PATH=/path/to/INBOX.md npx tsx scripts/audit-queue-seeder.ts
```

It is **idempotent** — an entry whose slug already appears in `INBOX.md` or `INBOX_PROCESSED.md` is skipped, so a 30-min cadence never duplicates.

### Entry format (why it satisfies both consumers)

The INBOX uses the **Librarian** YAML-frontmatter format; the autofire task **keyword-scans** for `audit-queue` / `regression`. The seeder emits frontmatter that *also* carries the brief's fields, so both work:

```
---
ts: 2026-06-15T20:19:55Z
source: audit-queue-seeder
type-hint: ephemeral
suggested-name: audit-queue-ci-1234567-2026-06-15
observation: |
  audit-queue regression [high] — source: ci
  tags: audit-queue, regression, high, ci
  signal: CI workflow "schema-drift" failed on main (a1b2c3d)
  suggested-fix: main is red — bisect the failing job and ship a fix or revert ASAP
  reproducer: https://github.com/cchambers6/agentplain/actions/runs/1234567
  source: seeded by audit-queue-seeder, 2026-06-15T20:19:55Z
links: []
---
```

### ⚠️ Cloud vs local — read this before deploying

The autofire INBOX is a **local file** on Conner's machine:

```
…/local-agent-mode-sessions/<sid>/<aid>/agent/memory/INBOX.md
```

A **cloud GitHub Actions runner cannot write to it.** So the write target is environment-aware:

- **Local run** (INBOX dir reachable, or `AUDIT_QUEUE_INBOX_PATH` set) → appends to the real INBOX.
- **CI run** (INBOX dir absent) → writes `./audit-queue/seeded-inbox.md`, echoes to stdout, and appends to `$GITHUB_STEP_SUMMARY`.

The `.github/workflows/audit-queue-seeder.yml` 30-min cron therefore runs the seeder for **visibility** only.

**To actually feed the autofire task, run the seeder LOCALLY on a 30-min cadence** — where it has both a GitHub token *and* the INBOX. The bridge that makes this complete: the local run's **CI-failure gatherer** also catches the nightly-E2E and seeder workflow failures, so E2E breakage reaches the autofire task even though CI can't touch the local file.

### Recommended local deployment

A Claude scheduled task (sibling to the autofire task) that runs every 30 min:

```
~/Claude/Scheduled/agentplain-audit-queue-seeder/SKILL.md
```

whose body runs `GITHUB_TOKEN=… npx tsx scripts/audit-queue-seeder.ts` from `C:\agentplain`. Or a `/loop 30m` invocation. Either gives the seeder local FS + a token, closing the loop into the autofire task.

---

## 5. File map

```
playwright.config.ts                       chromium + mobile projects, opt-in visual
tests/e2e/
  fixtures/test-mode.ts                     env-gated tiers + cited route/selector constants
  marketing.spec.ts                         home, nav/footer non-404, pricing, verticals, legal
  auth.spec.ts                              sign-up/in render, 30-day checkbox, guarded flows
  workspace.spec.ts                         12 nav tabs, composer, integrations, settings
  workspace.mobile.spec.ts                  375px approvals operability
  smoke-authenticated.ts                    (existing) seed + mint → route-level smoke
  passkey-full-ceremony.spec.ts             (existing) WebAuthn ceremony
scripts/
  audit-queue-seeder.ts                     5-signal gatherer → INBOX entries
  playwright-failures-to-inbox.ts           E2E-failure fast path (reuses the seeder)
.github/workflows/
  e2e-nightly.yml                           nightly suite + auto-seed on failure
  audit-queue-seeder.yml                    30-min visibility cron
```
