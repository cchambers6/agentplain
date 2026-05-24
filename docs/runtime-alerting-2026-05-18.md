# Runtime error alerting — 2026-05-18

Wires Sentry as the runtime error reporter for agentplain. Closes the
monitoring gap surfaced by the 2026-05-17 `/app/verify` login crash (see
`docs/incident-log.md`), where the only signal was Conner landing on the
broken flow and telling us.

## What's wired

- **`@sentry/nextjs@10.x`** added as a dependency (`package.json`).
- **`lib/observability/`** — the swap-point adapter. Every caller goes
  through this; nobody imports `@sentry/nextjs` outside the SDK boot files.
  - `types.ts` — `ErrorReporter` interface + `ErrorReporterContext`.
  - `sentry-provider.ts` — the only file (outside the root-level
    `sentry.*.config.ts` boot files) that imports `@sentry/nextjs`
    directly. Per `feedback_no_silent_vendor_lock`.
  - `noop-provider.ts` — runs in dev / preview / any environment without a
    `SENTRY_DSN`. Per `feedback_no_prod_secrets_in_dev`: missing prod-tier
    secret resolves to a quiet fallback, not a crash.
  - `test-provider.ts` — in-memory recorder for assertions. Mirrors the
    shape of `TestEmailProvider` / `TestAuthProvider`.
  - `index.ts` — factory + `reportError()` / `reportMessage()` helpers +
    test shim.
- **Root-level Sentry boot files** (required by `withSentryConfig`):
  - `instrumentation.ts` — Next.js `register()` hook. Conditionally loads
    `sentry.server.config.ts` or `sentry.edge.config.ts` based on
    `NEXT_RUNTIME`. Re-exports `Sentry.captureRequestError` as
    `onRequestError` (Next.js 15 hook; forwards-compatible on 14).
  - `sentry.server.config.ts` — Node runtime `Sentry.init`. Gated on
    `SENTRY_DSN`.
  - `sentry.edge.config.ts` — Edge runtime `Sentry.init`. Same gate.
  - `sentry.client.config.ts` — Browser bundle `Sentry.init`. Reads
    `NEXT_PUBLIC_SENTRY_DSN`.
- **`next.config.mjs`** — wrapped with `withSentryConfig(...)`. Source-map
  upload is gated on `SENTRY_AUTH_TOKEN`; when absent, the wrapper is a
  no-op pass-through so dev / preview / pre-token Production builds don't
  fail.
- **Error boundaries** report via the adapter:
  - `app/(product)/error.tsx` — product surface.
  - `app/(product)/app/workspace/[id]/error.tsx` — workspace surface.
  - `app/(marketing)/error.tsx` + `app/(operator)/error.tsx` — segment
    boundaries (each tags its own `boundary=…` value).
  - `app/global-error.tsx` — Catches root-layout failures (above the
    other boundaries). Renders its own `<html>`/`<body>` per Next.js
    convention.
- **Inngest cron / skill-runner capture** — `lib/inngest/with-error-reporting.ts`:
  - `withInngestErrorReporting(...)` wraps every Inngest function body so a
    thrown error reports through the adapter with `boundary=inngest` +
    `function_id` tags, flushes (serverless workers exit fast and Sentry
    buffers events), then rethrows so Inngest still records the failure
    and applies its retry policy. Composed INSIDE `runWithDisableGate` —
    a paused function never reports.
  - `reportInngestItemFailure(...)` is the per-item helper. Cron sweeps
    catch per-row errors so one bad row doesn't stall the batch; this
    helper preserves keep-going behavior and still surfaces the error
    with structured tags (`workspace_id`, `webhook_event_id`, etc.).
  - Wired into `process-webhook-event` (per-event throws inside the skill
    chain), `integration-renewal-sweep` (token refresh + watch renewal
    failures, per-credential), and `trial-expiration-warnings`
    (per-candidate email send failures). These were the load-bearing
    silent paths — same shape as the flatsbo `task_budget` 400 incident
    where a cron threw and the only signal was Conner noticing.

## What Conner needs to do

These steps are manual because the secrets and project-side configuration
live outside the repo. Per `feedback_no_prod_secrets_in_dev`, the DSN goes
in Production-tier Vercel only initially.

### 1. Grab the DSN from the existing Sentry project

The project already exists — `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`,
`SENTRY_PROJECT` are already set on Vercel Production (env audit
2026-05-23) and the `withSentryConfig` wrapper has been uploading
source maps on every build since they landed. The only missing piece
is the DSN that the runtime SDK ingests to.

1. Open <https://sentry.io>, sign in, switch to the org matching the
   `SENTRY_ORG` slug.
2. Navigate to **Projects → agentplain** (slug matches `SENTRY_PROJECT`).
3. Open **Settings → Client Keys (DSN)**. Copy the **Default** key —
   looks like `https://<hash>@<region>.ingest.sentry.io/<project-id>`.
   (Settings cog → in the left rail → "Client Keys (DSN)" under "SDK
   Setup". The same DSN is reused for server + client; it is the *Public
   DSN* shown at the top of the key card.)

### 2. Paste the DSN into Vercel

In the Vercel project (agentplain), under **Settings → Environment
Variables**, add to **Production only** (not Preview, not Development):

| Variable                  | Value                          |
| ------------------------- | ------------------------------ |
| `SENTRY_DSN`              | (paste DSN from step 1)        |
| `NEXT_PUBLIC_SENTRY_DSN`  | (same DSN — exposed to client) |

The Sentry DSN is public-by-design (ingest-only, can't read events) so
having it in the browser bundle is safe. We still keep it gated on
Production so dev/preview don't ship a client init pointing at a project
that doesn't exist.

**Source maps are already wired.** `SENTRY_ORG`, `SENTRY_PROJECT`, and
`SENTRY_AUTH_TOKEN` are already on Vercel Production, so the next build
after the DSN paste will upload sourcemaps + tag the release with
`VERCEL_GIT_COMMIT_SHA` automatically. No additional env vars needed.

After saving env vars, **redeploy** so they take effect (Vercel doesn't
re-bake them on a hot reload).

### 3. Configure alert rules in Sentry

In Sentry → **Alerts → Create Alert** for the agentplain project:

1. **New Issue alert** — fires the first time Sentry sees a unique error.
   - Trigger: When a new issue is created.
   - Filter: `level >= error`.
   - Action: Send a notification to (Conner's email by default; switch to
     Slack if/when a workspace is wired).

2. **High-frequency alert** — fires when a known issue spikes.
   - Trigger: An event matching `level:error` is seen.
   - Frequency: more than **5 events in 5 minutes**.
   - Action: Same destination as above.

These two rules cover the "we should know within minutes" goal. The first
catches the long-tail (login crash class — new failure mode, low volume,
high impact). The second catches volume regressions (a downstream API
flips and starts throwing on every request).

### 4. Verify the wiring works

After the DSN is in Production and a fresh deploy is up:

```sh
# Trigger a controlled exception. Add this route temporarily to confirm
# the round-trip, then revert before merging anything else:
#
#   app/(product)/app/__sentry-check/route.ts
#   export const dynamic = "force-dynamic";
#   export function GET() { throw new Error("sentry-check: ignore me"); }
#
# Then in prod:
curl https://app.agentplain.com/app/__sentry-check
```

Within ~60 seconds, the event should land in the Sentry **Issues** view
with `tags: boundary=…` and a stack trace. Once confirmed, **remove the
test route** — leaving a permanent error generator in prod will eat the
alert quota.

## Sampling + cost guard

- `tracesSampleRate: 0.1` — 10% of transactions sampled for performance
  data. Error events are always captured (sample rate is for spans).
- `replaysSessionSampleRate: 0` + `replaysOnErrorSampleRate: 0` — Session
  Replay disabled at launch. Adds bundle weight and we don't yet have a
  privacy-review story for replays of workspace screens that contain
  customer data. Revisit if/when error context warrants it.

At current traffic the free tier (5K errors/month + 10K transactions/month
+ 50 replays/month) should not be touched. The cost-guard knob if it ever
becomes an issue is `tracesSampleRate` — drop to 0.01 (1%) before paying.

## Future swap

The adapter sits behind one entry point (`lib/observability/index.ts`) so
swapping to OpenTelemetry, BetterStack, or a self-hosted target is a one-
file change. Two-implementation rule (`feedback_runner_portability`):
`SentryErrorReporter` + `NoopErrorReporter` + `TestErrorReporter` already
satisfy the interface — adding a third later is mechanical.

## Files changed

- `package.json` — `@sentry/nextjs` dep.
- `next.config.mjs` — wrapped with `withSentryConfig`.
- `lib/env.ts` — `observabilityProvider()`, `sentryDsn()`, `sentryClientDsn()`,
  `sentryEnvironment()`, `sentryRelease()`.
- `lib/observability/{types,index,noop-provider,sentry-provider,test-provider}.ts`
  — adapter.
- `instrumentation.ts` — Next.js register hook + `onRequestError`.
- `sentry.{server,edge,client}.config.ts` — SDK boot files.
- `app/global-error.tsx` — root-layout error boundary.
- `app/(marketing)/error.tsx`, `app/(operator)/error.tsx`,
  `app/(product)/error.tsx`, `app/(product)/app/workspace/[id]/error.tsx`
  — segment boundaries calling `reportError`.
- `lib/inngest/with-error-reporting.ts` — `withInngestErrorReporting` +
  `reportInngestItemFailure` (cron / skill-runner capture seam).
- `lib/inngest/functions/process-webhook-event.ts` — per-event capture +
  cron-level wrapper.
- `lib/inngest/functions/integration-renewal-sweep.ts` — per-credential
  capture + cron-level wrapper.
- `lib/inngest/functions/trial-expiration-warnings.ts` — per-candidate
  capture + cron-level wrapper.
- `tests/observability-providers.test.ts` — adapter unit tests.
- `lib/inngest/__tests__/with-error-reporting.test.ts` — wrapper unit
  tests + the production-shape gate+wrapper composition test.
- `.env.example` — `SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN` documented.
- `docs/incident-log.md` — closed the monitoring-gap follow-up.
