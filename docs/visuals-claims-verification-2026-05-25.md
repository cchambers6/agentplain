# Visuals Claims Verification — 2026-05-25

Code-grounded audit of the four explainer visuals (continuous loop, five-phase value loop, nothing-leaves-without-approval, works-from-your-files). Every claim is reconciled against `origin/main` at branch point `fb9a2d7`. Verdicts: **TRUE** (live + verified in code), **HALF** (built but gated by Conner-side config), **NOT-YET** (not in code).

> Standing rule: every fact-claim cites a file path + line. No "I believe" claims.

---

## Summary

| Verdict | Count |
| --- | --- |
| TRUE | 7 |
| HALF | 3 |
| NOT-YET | 0 |

**Three HALF verdicts** — all blocked on the same two Conner-side config items, not code:
- Customer-files live ingestion (waits on Google OAuth client ID/secret + `ENCRYPTION_KEY`).
- Live Stripe charging (waits on live Stripe keys + live catalog provisioning script run).
- Sentry runtime activation (DSN env var; code is wired, no-ops cleanly without it).

No surprise gaps. The continuous loop, five-phase orchestration, no-auto-send guarantee, preference-learning loop, MCP-first integration gating, compliance sentinel literal-match scope, and vertical roster are all live in code with cron triggers + tests.

---

## Claim 1 — Continuous loop runs on its own (Inngest crons)

**Verdict: TRUE**

Four scheduled crons exist, are registered with the Inngest serve handler, and are wrapped in `withCronMonitor` for Sentry check-ins.

| Function | Cron | File:line |
| --- | --- | --- |
| `agentplain-process-webhook-event` | `*/5 * * * *` | `lib/inngest/functions/process-webhook-event.ts:53-55,249-285` |
| `agentplain-integration-renewal-sweep` | `0 */2 * * *` | `lib/inngest/functions/integration-renewal-sweep.ts:45-47,303-337` |
| `agentplain-trial-warnings` | `0 10 * * *` | `lib/inngest/functions/trial-expiration-warnings.ts:34-35,173-228` |
| `agentplain-customer-files-ingestion-sweep` | `0 */6 * * *` | `lib/inngest/functions/customer-files-ingestion-sweep.ts:58-69,206-249` |

All four registered in the serve handler: `app/api/inngest/route.ts:17-20`.

---

## Claim 2 — Five-phase value loop is real and orchestrated

**Verdict: TRUE**

Each phase is a substantive `ISkill` implementation; the runner sequences them; Inngest invokes the runner from the webhook-event cron.

- Skills exist with real logic, not stubs:
  - `lib/skills/read.ts:44-59` (`ReadSkill` → `fetcher.fetchMessagesForEvent()`)
  - `lib/skills/categorize.ts:38-60` (`CategorizeSkill` → `llm.complete()` JSON intent classification)
  - `lib/skills/coordinate.ts:40-60` (`CoordinateSkill` → `fetcher.fetchThreadMessages()`)
  - `lib/skills/schedule.ts:42-60` (`ScheduleSkill` → `llm.complete()` slot proposals)
  - `lib/skills/draft.ts:54-120` (`DraftSkill` → `llm.complete()` then `persister.persistDraft()`)
- Runner orchestrates the chain in order: `lib/skills/runner.ts:110-384`
  - read (line 149) → categorize (237-252) → branch on intent (268) → coordinate (280-295) → schedule (298-316, conditional on `intent === 'scheduling-needed'`) → draft (319-338).
- Entry point (cron → runner): `lib/inngest/functions/process-webhook-event.ts:141` calls `runSkillChain`, then `persistSkillRunArtifacts` at line 150.
- End-to-end test asserts the chain: `tests/wave5-value-loop-integration.test.ts:5,77-99,106`.

---

## Claim 3 — Nothing auto-sends; `WorkApprovalQueueItem` is unconditionally created

**Verdict: TRUE**

- Prisma model: `prisma/schema.prisma:408-426`. `status` defaults to `PENDING` (line 416). No `SENT`/`AUTO_APPROVED` default exists.
- Persister always writes the approval when a draft exists: `lib/skills/persist-artifacts.ts:140-154` (call site) → `:245-280` (`buildApprovalFromOutcome`). Returns `null` only when `record.outcome.draft` is itself null (line 254) — i.e., nothing to approve.
- `DraftPersister` interface exposes only `persistDraft()` — there is no `send()` method. Compile-time guarantee asserted by test: `tests/wave5-value-loop-integration.test.ts:130-135` (`assert.equal((persister as unknown as Record<string,unknown>).send, undefined, 'DraftPersister surface MUST NOT expose send()')`).
- Draft skill only persists, never sends: `lib/skills/draft.ts:79-119` (only call is `input.persister.persistDraft(...)` at line 90).
- No outbound-send call in `lib/skills/**`. Grep confirms zero hits for `twilio | sendgrid | @sendgrid | nodemailer | mailgun` in the skills directory. Resend is used only out-of-band (`lib/support/index.ts`, `lib/auth/resend-provider.ts`, `lib/email/resend-provider.ts`) for operator notifications, magic links, and billing/trial transactional mail — none of these are triggered by the value loop.

---

## Claim 4 — Preference-learning loop is real (capture → store RLS-scoped → wrap prompts → runner → prod cron)

**Verdict: TRUE**

- Capture surface: `lib/preferences/` (5 files — capture.ts, index.ts, render.ts, store.ts, types.ts), not a stub directory.
- Storage with RLS: `prisma/schema.prisma:924-950` (`PreferenceSignal` model, workspace-scoped). RLS policies in migration `prisma/migrations/20260523000000_add_workspace_preferences/migration.sql:44-103` — policy check: `current_setting('app.is_operator') OR workspaceId::text = current_setting('app.workspace_id')` on both `WorkspacePreference` and `PreferenceSignal`.
- Onboarding actually persists (the stub comment in `lib/onboarding/steps.ts:14` is stale): `app/(product)/app/workspace/[id]/onboarding/actions.ts:60-67` calls `upsertOnboardingPreference(rls, {...})`; lines 76-84 loop axes and call `recordPreferenceSignal(rls, {...})` per signal.
- Prompt wrapping: `lib/inngest/functions/process-webhook-event.ts:127-130` loads `getWorkspacePreference(...)`; line 142 passes `workspacePreferences` into `runSkillChain`. Compose layer injects preference text into the prompt envelope (see `lib/skills/prompts/compose.ts`).
- Cron: every 5 minutes (`process-webhook-event`, see Claim 1), every fire reads fresh preferences (cold-start safe per memory rule).

---

## Claim 5 — Per-customer file ingestion + retrieval; production trigger calls ingest

**Verdict: HALF** — pipeline + cron are live; **live Drive data does not flow until Google OAuth + `ENCRYPTION_KEY` are configured**. Fixture source works end-to-end today.

- Pipeline files exist and are substantive: `lib/customer-files/ingest.ts:71-196` (`ingestWorkspaceFiles` — list → fetch → chunk → upsert), `chunk.ts`, `retrieve.ts`, `drive-source.ts`, `fixture-source.ts`.
- Tenant isolation (three layers):
  1. App: `lib/customer-files/ingest.ts:137-138` writes with `workspaceId` set; retrieve enforces match at `lib/customer-files/retrieve.ts:81-88` (`assertSameWorkspace()` throws on mismatch).
  2. DB constraint: `prisma/migrations/20260512000000_*/migration.sql:72` — CHECK constraint requires `workspaceId` on CUSTOMER-context rows.
  3. RLS: same migration, lines 128-152 — RLS policies on `KnowledgeDocument` and `Embedding`.
- Drive source is intentionally `NOT_CONFIGURED` until OAuth: `lib/customer-files/sources/drive-source.ts:41-49` (returns error: "Drive file source is not wired yet — connect Google Drive on /integrations to enable.").
- Fixture source works: `lib/customer-files/sources/fixture-source.ts:46-75`.
- **Production trigger DOES call ingest**: cron `agentplain-customer-files-ingestion-sweep` at `0 */6 * * *` (every 6 hours UTC) — `lib/inngest/functions/customer-files-ingestion-sweep.ts:206-249`. The sweep iterates `listActiveWorkspaces()` and calls `ingestWorkspaceFiles({workspaceId, source, ...})` per workspace (lines 117-182). When Drive returns NOT_CONFIGURED, the sweep increments the `notConfigured` counter and continues gracefully (lines 160-161). Once Google OAuth + `ENCRYPTION_KEY` are set, ingestion lights up without code changes.

---

## Claim 6 — MCP-first connectors; integration tiles gated DISABLED until OAuth client IDs/secrets set

**Verdict: TRUE**

- Marketplace registry: `lib/integrations/marketplace.ts:71-271`. Each entry resolves to a workspace-scoped MCP endpoint at `/api/integrations/<slug>-mcp/{workspaceId}` (file header comment, lines 7-8).
- Config gate by env: `lib/integrations/config-status.ts:33-59` — `isIntegrationConfigured()` checks `GOOGLE_OAUTH_CLIENT_ID && GOOGLE_OAUTH_CLIENT_SECRET` (line 40), `MICROSOFT_OAUTH_CLIENT_ID && MICROSOFT_OAUTH_CLIENT_SECRET` (lines 42-43), same pattern for DocuSign, QuickBooks, Slack (lines 46-54).
- UI gates tile interaction: `app/(operator)/operator/integrations/page.tsx:59` reads `googleConfigured = Boolean(env.googleOAuthClientId() && env.googleOAuthClientSecret())`; lines 93-102 render the unconfigured-warning state.
- Gmail MCP reference implementation: `lib/integrations/gmail-mcp/types.ts:1-53` (`GmailMcpServer` interface — listMessages, readResource, draftMessage, etc.); `lib/integrations/gmail-mcp/server.ts:1-24` (`ProdGmailMcpServer` wraps the Gmail REST API behind that interface, returning `GmailMcpResult<T>`).

---

## Claim 7 — Compliance sentinel fires for realty/HUD literal-match only; other verticals are corpus-only

**Verdict: TRUE**

- Sentinel fire gate (only fires when corpus has a verified literal-match rule with triggers): `lib/skills/runner.ts:352-374`. The qualifier (line 356): `r.purpose === 'literal-match' && !r.unverified && (r.triggers?.length ?? 0) > 0`.
- Realty fires: `lib/agents/sentinel/corpus/real-estate/index.ts` loads `fair-housing-advertising-literal.ts` and `fair-housing-hud-literal.ts` (`:25-94`) with `purpose: "literal-match"`, `unverified: false`, ~40 HUD triggers.
- Other 9 verticals registered but DO NOT fire: `lib/agents/sentinel/index.ts:37-48` registers law, mortgage, cpa, insurance, title-escrow, recruiting, home-services, ria, property-management. Each has corpus content, but every candidate literal-match rule across these verticals is marked `unverified: true` (e.g., `lib/agents/sentinel/corpus/law/mrpc-7-1-advertising-candidates-literal.ts:39-40`). The remaining rules in each corpus are `purpose: "counsel-reference"`, which never fires the sentinel — they're advisory text only.

---

## Claim 8 — Vertical crew count: live agents vs rooting/placeholder

**Verdict: TRUE (count exceeds prior snapshot)**

Every locked vertical now has ≥1 live skill registered. Counted from `lib/skills/registry.ts` plus per-vertical `lib/verticals/*/content.ts`:

| Vertical | Live registered skills | All-vertical shared skills also apply |
| --- | --- | --- |
| real-estate | 2 (lead-triage-realestate, invoice-chasing-realestate) | + 6 shared |
| cpa | 1 (month-end-close-cpa) | + 6 shared |
| law | 1 (law-intake-conflict-screen) | + 6 shared |
| ria | 1 (ria-client-update-draft) | + 6 shared |
| insurance | 1 (insurance-coi-request) | + 6 shared |
| mortgage | 1 (mortgage-document-chase) | + 6 shared |
| home-services | 1 (home-services-estimate-followup) | + 6 shared |
| recruiting | 1 (recruiting-candidate-status-update) | + 6 shared |
| property-management | 1 (property-management-rent-collection-chase) | + 6 shared |
| title-escrow | 1 (title-escrow-closing-doc-chase) | + 6 shared |
| general (on-ramp) | 4 (inbox-triage, follow-up-chaser, process-doc-drafter, chief-of-staff-scheduler) | n/a |

**Headline numbers:**
- **10 locked verticals, all with ≥1 live vertical-specific skill** + 6 shared "any-vertical" skills (kind `triage | draft | coordinate`, never `send`).
- **0 verticals are rooting/placeholder-only.**
- This is a material upgrade from the snapshot in the brief ("realty 3 / law-ria-title-escrow 1 / rest rooting"). Today every vertical has at least one live workflow plus the shared general crew.

Source registry: `lib/skills/registry.ts:62-731`. Vertical lock list: `lib/verticals/index.ts:8-26`. Per-vertical rosters in `lib/verticals/*/content.ts`.

---

## Claim 9 — Billing mechanics (add-payment / change-plan / cancel / portal) built; live charging needs live Stripe config

**Verdict: HALF** — code is complete; live charging requires Conner-side Stripe config.

Code-complete:
- Tier ladder: `lib/pricing/tiers.ts:87-123` (15 cells: 3 tiers × 5 seat bands, USD cents); `lookupKeyFor(tier, band)` at lines 193-196.
- Adapter pattern (interface + two impls, satisfies portability rule): `lib/billing/types.ts:174-213` (`BillingProvider` interface, 10 methods). `lib/billing/stripe-provider.ts:62-377` (`StripeBillingProvider`). `lib/billing/test-provider.ts` (in-memory double). Swap point: `lib/billing/index.ts:16-31`.
- Four operations:
  - Add payment method: `lib/billing/stripe-provider.ts:229-238` (Checkout `mode: "setup"`); action `app/(product)/app/workspace/[id]/settings/billing/actions.ts:45-60`.
  - Change plan: `stripe-provider.ts:226-257,164-197` (Checkout `mode: "subscription"` + `updateSubscription` with proration); action `actions.ts:62-117`.
  - Cancel: `stripe-provider.ts:199-213` (immediate or at-period-end); action `actions.ts:139-185`.
  - Portal redirect: `stripe-provider.ts:259-267`; action `actions.ts:127-137`.
- Webhook handler with HMAC verification + idempotency: `app/api/stripe/webhook/route.ts:1-91`; dispatch `lib/billing/webhook-dispatch.ts:48-56` (6 event types).
- Live catalog provisioning script (Conner-gated): `scripts/stripe/setup-products.ts:1-285` — refuses without `--live` for `sk_live_*` keys (lines 39, 72-76).

Config-side (not code):
- `STRIPE_SECRET_KEY=sk_live_*` and `STRIPE_WEBHOOK_SECRET` must be set in Production env.
- `scripts/stripe/setup-products.ts --live` must be run once to provision live Products/Prices in the Stripe dashboard.

---

## Claim 10 — Sentry error capture wired + a cron watchdog exists

**Verdict: HALF** — code wired and called from every cron; runtime activation requires `SENTRY_DSN`.

- Sentry init: `sentry.server.config.ts:14-31`, `sentry.edge.config.ts:11-22`, `instrumentation.ts:14-23` (runtime-aware loader).
- Error reporter adapter: `lib/observability/sentry-provider.ts:36-56` (`SentryErrorReporter`); per-item failure router `lib/inngest/with-error-reporting.ts:68-80`. Called from each cron's failure path (e.g., `process-webhook-event.ts:190-197`).
- **Cron watchdog**: `lib/observability/cron-monitor.ts:1-198` — `withCronMonitor()` sends Sentry check-ins (start → ok/error) with configurable `checkinMargin` (default 5 min) and `maxRuntime` (default 10 min). Wraps all four cron bodies; cron at line 223 of `customer-files-ingestion-sweep.ts` uses 30-min margin for the 6-hour cadence.
- Graceful no-op when `SENTRY_DSN` is unset: `cron-monitor.ts:89-99,108-112` falls through to a no-op runner instead of erroring. Initialization gated on env at `sentry.server.config.ts:12`, `sentry.edge.config.ts:9`.

Activation: set `SENTRY_DSN` in Production env. Once set, both error capture and cron check-ins begin flowing without code changes.

---

## Gating items (Conner-side config, not code)

A small set of env values turns three of the four visuals from HALF to TRUE:

1. **Google OAuth client ID + secret** (`GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`) + `ENCRYPTION_KEY` → unblocks Claim 5 (Drive ingestion + customer-files live data).
2. **Live Stripe** (`STRIPE_SECRET_KEY=sk_live_*`, `STRIPE_WEBHOOK_SECRET`) + run `scripts/stripe/setup-products.ts --live` once → unblocks Claim 9 (live charging).
3. **Sentry DSN** (`SENTRY_DSN`) → unblocks Claim 10 (live error capture + cron check-ins).

None of these require code changes. They are the standing gates surfaced in `docs/brand-and-claims.md` claims-vs-reality discipline.
