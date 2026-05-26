# agentplain — fleet architecture assessment

Audience: Conner, engineering-grade critique.
Scope: rigorous read of the fleet as it exists on `origin/main` @ `658d9e3`
(after the merge of `docs/fleet-architecture.md` in PR #80), measured
against the locked principles in
`~/.claude/projects/C--agentplain/memory/`.

Answers three questions:

1. Can it be improved? → §1 Improvement backlog (prioritized P0/P1/P2).
2. Is it on brand (do we hold to the locked principles)? → §2
   Principles-adherence audit (PASS / PARTIAL / DEVIATION per principle).
3. Is the design sound? → §3 Design-soundness verdict.

Every claim cites a file path or git ref. Where the assessment differs
from the fleet-architecture doc shipped in PR #80, the disagreement is
called out.

The product is built _by_ the fleet, so no human-engineer-day or
$/day cost framing appears. Improvement items are sized by code shape
("one wrapper", "one migration", "one adapter") because that is what the
fleet actually moves.

---

## 1. Improvement backlog

### P0 — Fix before any non-internal pilot expands beyond Conner's inbox

#### P0-1. Three production tables hold per-workspace data with **no RLS policy**

`IntegrationCredential`, `WebhookSubscription`, `WebhookEvent` were
created by the migration that added Gmail
(`prisma/migrations/20260511180000_add_gmail_integration/migration.sql:35-92`)
and were never given `ENABLE ROW LEVEL SECURITY` + `CREATE POLICY`. All
three carry `workspaceId` columns; one (`IntegrationCredential`) holds
encrypted OAuth refresh tokens.

A `grep` across `prisma/migrations/**/migration.sql` for the literal
strings `IntegrationCredential`, `WebhookEvent`, `WebhookSubscription`
returns only three files (`20260511180000_add_gmail_integration`,
`20260520000000_add_docusign_qbo_slack_providers`,
`20260524000000_webhook_event_idempotency_retry`) — and none of them
contain `CREATE POLICY` or `ENABLE ROW LEVEL SECURITY`. The
`wave5-multitenant-isolation.test.ts:241-250` enforcement list also
omits these three models, so the bare-`prisma.X.` regression test does
not protect them either.

Today the practical exposure is low because these tables are read only
by webhook receivers and crons running under
`SYSTEM_OPERATOR_CONTEXT` (`lib/db/rls.ts:25-29`). But the architecture
rule is "Workspace RLS isolation on all multi-tenant data," and these
are multi-tenant data with the highest-sensitivity column in the schema
(encrypted refresh tokens). Any future surface — operator dashboard
that exposes per-customer integration health, a customer-visible
"connected accounts" list — will lack the SQL-layer guarantee that
prevents a Prisma `where` typo from cross-leaking.

**Fix.** New migration that:

1. `ALTER TABLE "IntegrationCredential" ENABLE ROW LEVEL SECURITY;` +
   policy `(current_setting('app.workspace_id', true) = "workspaceId"::text
   OR current_setting('app.is_operator', true) = 'true')`.
2. Same for `WebhookSubscription`.
3. `WebhookEvent` is workspace-scoped transitively (`subscriptionId`
   FK → `WebhookSubscription.workspaceId`). Either denormalize
   `workspaceId` onto `WebhookEvent` (cheapest, matches the indexing
   the cron already needs) and add the same policy, or write a
   SECURITY-DEFINER view + policy referencing the join.
4. Add all three to `wave5-multitenant-isolation.test.ts:241-250`
   `WORKSPACE_SCOPED_MODELS` so the source-grep regression catches
   future direct reads.

The migration runs against the direct Neon URL
(`schema.prisma:9-13`); existing rows are unaffected.

#### P0-2. Customer-file ingestion source is wired to `NOT_CONFIGURED` everywhere

`lib/inngest/functions/customer-files-ingestion-sweep.ts:196-204` calls
`new DriveFileSource()` with no config. `DriveFileSource` in
`lib/customer-files/drive-source.ts:36-72` ships with `unwired: true`
as the default and **even the wired branch returns** `fileSourceError('NOT_CONFIGURED',
'Drive list path is wired but not implemented in this PR.')`
(`drive-source.ts:52-55, 68-71`). The cron is registered
(`app/api/inngest/route.ts` includes `customerFilesIngestionSweepFn`),
fires every 6 hours (`customer-files-ingestion-sweep.ts:69`), and
gracefully NO-OPs per workspace. The cost is real — the customer-files
retrieval path in `process-webhook-event.ts:138-140` returns empty,
which means **drafts are composed without any "works from your files"
context** for the lifetime of the customer's workspace.

The fleet-architecture doc says this is "the missing production trigger"
(`docs/fleet-architecture.md:275`). It is — but only half. The trigger
is wired; the source is not. The doc is honest that this is a
known stub but does not flag that, until the Drive adapter ships,
**the entire "grounded in your files" pitch in the customer-facing copy
is empty.** That is the kind of mismatch between code state and
positioning that erodes trust on day 1.

**Fix.** Implement `lib/integrations/google/drive.ts` (or wherever the
Drive helper lives — the doc references it at
`drive-source.ts:51`). Two methods: `listFiles(workspaceId, folderQuery)`
and `getFileText(workspaceId, fileId)`. Both resolve the
`IntegrationCredential` for `provider='GOOGLE'` with drive scopes via
`lib/integrations/gmail-mcp/auth.ts:resolveCredential` (the same pattern
the Gmail MCP already uses, so no new auth shape). Flip
`DriveFileSource.unwired` to false in `defaultBuildSource` only after a
manual seed test against a real workspace returns ≥ 1 file.

The Drive **MCP server** is already implemented
(`lib/integrations/google-drive-mcp/server.ts:17` imports
`googleapis`), so the SDK call site is in the right folder per the
no-silent-vendor-lock rule. This is wiring, not new architecture.

#### P0-3. Code sessions cannot push without a manual installation-token mint

Observed: this assessment's own push to GitHub required the operator to
mint a fresh installation token from
`C:\private\agentplain-fleet.2026-05-14.private-key (2).pem` (App ID
3714103, installation 132417507), inject it into the remote URL as
`x-access-token:<token>`, push, then restore the plain URL — every
session. There is no on-disk credential helper for git that calls into
`lib/github/app-auth.ts:18-22` (the in-repo equivalent referenced by
`docs/fleet-architecture.md:373-376`), so a code session that finishes
its work and runs `git push` falls back to the plain HTTPS URL and
fails the auth handshake.

Each fleet build that needs to commit therefore has to thread the
installation-token mint into its own bash prelude — the exact mistake
the in-repo `app-auth.ts` was supposed to abstract.

**Fix (best, not a quick fix).** Configure a git credential helper at
`~/.gitconfig` that runs a small wrapper script:

1. Wrapper reads `GITHUB_APP_ID`, `GITHUB_APP_INSTALLATION_ID`, and the
   PEM path from env (no hardcoded paths; `.gitconfig` is committed-
   friendly).
2. Wrapper signs a JWT (`iat=now-60, exp=now+540, iss=app-id`,
   `RS256`), exchanges it via
   `POST https://api.github.com/app/installations/<id>/access_tokens`,
   prints `username=x-access-token\npassword=<token>\n` to stdout, and
   exits.
3. Git config: `credential.https://github.com.helper = !path/to/wrapper`.

This routes the same token-mint logic through every `git push` without
the session needing to touch the PEM. Add a one-line
`feedback_session_auth.md` memory entry so future sessions know the
helper is the right path.

Alternative: bake a long-lived deploy-key SSH key into the box and rewrite
the remote to `git@github.com:cchambers6/agentplain.git`. Lower
auditability than the App route (one secret, not rotating) so the App
helper is preferred.

#### P0-4. Inngest pause/resume can take 5+ minutes to propagate; no per-fire kill switch

`runWithDisableGate` (`lib/inngest/run-with-disable-gate.ts`) reads
`process.env.INNGEST_FN_DISABLE_<ID>` at function entry. The disable
flag is written via `lib/ops/inngest/control.ts:152-162` →
Vercel REST API → new deployment env var. On Vercel, env-var changes
to a serverless function **only take effect on the next cold start**
(the docs at `https://vercel.com/docs/projects/environment-variables`
read 2026-05-26 are explicit about this).

So `pauseInngestFunction()` returns `ok` instantly, but the running
function instances on Vercel keep firing with the old (unset) env until
the next cold start or redeploy. In a runaway-LLM-cost incident the
window is roughly "until Vercel cycles the instance," which can be
**5+ minutes for a low-traffic function**. The
`docs/fleet-architecture.md:300-303` claim that "pausing a function is
one env-var flip, no redeploy" is technically true for the flag write
but understates the propagation.

**Fix.** Add a **DB-backed disable flag** as the source of truth, with
env-var as the fast-path cache:

1. New `OpsFlag` table: `(key text primary key, value text, updatedAt
   timestamptz)`. RLS off (operator-only).
2. `isFunctionDisabled(functionId)` checks env first; if env says
   "false" or unset, fall through to a 60-second-TTL Postgres read of
   `OpsFlag` keyed on `INNGEST_FN_DISABLE_<ID>`. 60s ≪ next-Vercel-
   cold-start.
3. `InngestControlAdapter.pauseInngestFunction` writes BOTH the env
   var (for cold-start parity) and the OpsFlag row (for hot-path
   propagation).
4. `runWithDisableGate` switches to `await isFunctionDisabledAsync(id)`
   — every cron already does async DB work, the extra read is free.

This keeps Inngest swappable (the env-var part stays for any future
runtime), but cuts pause latency from 5 min to ≤ 60 s.

### P1 — Fix in the next two cycles

#### P1-1. Knowledge substrate has no freshness/re-seed automation

`scripts/seed-knowledge.ts:1-23` is manual — the production substrate
is whatever was last seeded by a human running
`npx tsx scripts/seed-knowledge.ts`. There is no Inngest function, no
GHA workflow, and no `agentplain-knowledge-reseed` in
`app/api/inngest/route.ts:25-31` for re-seeding when
`lib/knowledge/seed-data.ts`, `lib/verticals/*/content.ts`, or
`docs/brand-and-claims.md` change.

The `pre-pilot-ship-readiness-2026-05-18.md` audit raised this as **S7**
("Knowledge substrate freshness is unverified") and recommended a smoke
test before pilot. The smoke test isn't a fix; it's a check. After the
2026-05-12 single-tier pricing simplification and the brand lock, any
seed produced before those memories ratified is stale.

**Fix.** Add a fifth Inngest cron, `agentplain-knowledge-reseed-sweep`,
on a daily schedule. Body calls `buildSeedAssembly()` and runs
`upsert` for every row. The natural key (`sourceType:sourceId` per
`lib/customer-files/ingest.ts:148-149`) makes this idempotent. Wrap
in the same three composition layers (`runWithDisableGate` +
`withCronMonitor` + `withInngestErrorReporting`) so the new cron joins
the existing observability + kill-switch story automatically. Cost is
~$0.0006 per re-seed per `scripts/seed-knowledge.ts:22`.

#### P1-2. Vertical depth: 9 of 10 verticals ship one skill each — and the rosters carry 4-7 `rooting` cards each

Skill catalog (`lib/skills/registry.ts:62-731`): real-estate gets two
flagship skills (`invoice-chasing-realestate`, `lead-triage-realestate`)
plus shared `chief-of-staff-scheduler`. Every other vertical (cpa, law,
ria, insurance, mortgage, home-services, recruiting,
property-management, title-escrow) gets **exactly one** vertical-
specific skill. Each vertical's roster
(`lib/verticals/<slug>/content.ts`) declares 8-9 agent cards, of which
5-7 are still `runtime: 'rooting'` (no `boundSkill`, no `owns[]`).

The roster validator (`lib/verticals/types.ts:204-213`) is honest
about this — `rooting` is the explicit "not yet wired" state. But for
a customer who signs up on a non-realty vertical today, the surface
shows up to 7 agent cards that do nothing. That is the inverse of the
realty case where the loop fires, the cards light up, and the customer
sees concrete value.

This is not an architecture defect — the architecture supports growing
each vertical to parity. It is a **depth-of-product gap** that bleeds
into the principle "every element earns its place"
(`feedback_everything_tells_a_story.md`).

**Fix.** Either (a) ship per-vertical skill #2-#3 for the lockedset of
verticals that have a near-term sales narrative, or (b) gate the
non-realty verticals to a "preview" surface until skill depth catches
up. Option (b) is the smaller change and matches
`feedback_no_new_verticals_finish_locked.md`. Sequence the locked-
vertical depth roadmap per `b2b-head-of-realty` (active) before
opening any second vertical.

#### P1-3. Test coverage gaps on the highest-blast-radius surfaces

Counts: 47 root `tests/*.test.ts` plus 38 co-located `lib/**/*.test.ts`
= 85 test files using `node:test`. No Playwright is installed (no
`@playwright/*` in `package.json:21-37`), contra the
`docs/fleet-architecture.md:68` claim of "Playwright + integration
test harnesses." The doc is loosely accurate (Playwright was used
historically per `docs/pre-pilot-ship-readiness-2026-05-18.md:55`) but
should be corrected.

Specific holes:

- **No test for `withCronMonitor` failure paths under Sentry-on mode.**
  `lib/observability/cron-monitor.ts:177-198` is tested only via the
  noop runner; the Sentry-DSN-on branch is exercised in production but
  not in CI. A regression that broke the check-in payload would only
  surface as silent monitor gaps.
- **No end-to-end RLS test against a real Postgres.** The grep-based
  source-pinning in `wave5-multitenant-isolation.test.ts:270-301` is
  load-bearing but cannot catch a policy-level mistake (P0-1).
- **No test verifying integration-credential decryption survives a
  rotated `ENCRYPTION_KEY`.** The rotation path
  (`lib/security/rotate-keys.test.ts`) exists but the cron in
  `integration-renewal-sweep.ts:86-96` only tests the
  `!isEncryptionConfigured()` short-circuit branch, not the
  decrypt-fail-mid-fire path.

**Fix.** A new `tests/wave6-observability-live.test.ts` that injects a
spy `Sentry.captureCheckIn` (the existing
`__setCronMonitorRunnerForTests` hook supports this per
`lib/observability/index.ts:1-10`) and asserts the start/ok/error
payloads. Schedule a CI job that runs a Postgres-backed RLS test under
`DATABASE_URL_DIRECT` pointing at a Neon preview branch — RLS
assertions written as `set_config('app.workspace_id', 'A')` →
`SELECT count(*) FROM "IntegrationCredential" WHERE "workspaceId" = 'B'`
expects zero.

#### P1-4. Three config gates are still required-at-boot and will brick a deploy if missing

`lib/env.ts:144` — `encryptionKey: () => required("ENCRYPTION_KEY")`.
A missing key throws at first call (`lib/env.ts:15-18`). The cron is
graceful (`integration-renewal-sweep.ts:87-96` short-circuits the whole
sweep with structured failures), but `app/api/auth/oauth/google/callback`
calls `encryptTokenSet` synchronously — a fresh deploy missing the key
500s on the first OAuth completion. Same for `STRIPE_SECRET_KEY` /
`STRIPE_WEBHOOK_SECRET` (`env.ts:86-87`), and `NOTION_API_KEY`
(`env.ts:96`) which the `pre-pilot-ship-readiness-2026-05-18.md` audit
called out as S4 (briefings hard-error path) — `notionApiKeyOptional()`
exists at `env.ts:103` but the call sites still use the required
variant.

**Fix.** Convert all three to `optional()` + a `config-status` page
(modelled on `lib/integrations/config-status.ts:33-59`) that flags
"missing for production tier" so the operator surface shows the
omission at deploy time rather than at first user click. A boot-time
preflight that scans the required-prod list and refuses to serve any
route until it passes is the louder version of the same idea.

#### P1-5. Inngest is the live runner; the `OpsControlPlane` interface is the only abstraction layer

`lib/ops/inngest/control.ts` is named the "Inngest control adapter" but
its implementation is hard-coded to Vercel REST API
(`control.ts:50-58`). If the agent runtime moves off Vercel (Cloudflare
Workers, Fly Machines), the disable-flag pattern silently breaks. There
is no `RunWithDisableGate` interface with two impls; the file
`lib/inngest/run-with-disable-gate.ts` is the single implementation.

This is less a violation of the portability principle than a thin one:
the `OpsControlPlane` interface is there, but it has exactly one prod
adapter (`InngestControlAdapter`) per surface. The two-impl rule from
`feedback_runner_portability.md` says an interface isn't trusted until
it has two real implementations. Here it has prod + test — that
counts technically, but the test impl is recorder-only, not a second
runtime.

**Fix.** When the second host (Fly / Cloudflare / Render) ships, drop
in a `FlyMachinesControlAdapter` that writes the same disable-flag
into the same env-var format. Keep the contract test
(`lib/ops/__tests__/contract.test.ts`) parameterized over all three
adapters. Until then, document the constraint in the OpsControlPlane
header so the gap isn't a surprise.

### P2 — Improvements when the system grows

#### P2-1. GHA crons (flatsbo side) have no automatic retry / dead-letter

`docs/fleet-architecture.md:333-393` describes the dual-substrate model
honestly. What's missing on the GHA side: a failed cron run shows up
in the Actions tab and that's it. No exponential backoff (Inngest
WebhookEvent gets 5 retries before deadletter per
`webhook-idempotency.ts:161-176`), no auto-re-trigger. A flaky network
day means a missed daily brief surfaces only when Conner notices the
empty Notion page.

**Fix.** GHA workflow_dispatch trigger + a sibling
`cron-retry-on-failure.yml` that listens for `workflow_run` with
`conclusion: failure` and retries once with 10-minute backoff. Or add
`continue-on-error: false` + a final `if: failure()` step that opens a
GitHub issue tagged `cron-failure`. The latter matches the "fleet-
visible" pattern that already exists for fleet-produced PRs.

#### P2-2. The `MessageFetcher` / `DraftPersister` swap point is exhaustive on a 2-value enum

`process-webhook-event.ts:225-239` switches on `provider: 'GOOGLE' |
'M365'`. The compiler-checked `_exhaustive: never` clause makes adding a
third provider a compile-time fix-it list. Good. But the adapter
class names (`GmailMessageAdapter`, `OutlookMessageAdapter`) are
imported into the cron file directly
(`process-webhook-event.ts:38-39`), so adding a provider requires a
new import line in the cron itself — that's the wrong surface to grow.

**Fix.** Replace `buildAdapterForProvider` with a registry pattern: a
new provider exports `register(providerKey, factory)` from its own
module; the cron imports the registry and asks. Same idea as
`lib/integrations/marketplace.ts:71-269` for tiles. Three-line change;
keeps the cron file shape stable as providers grow.

#### P2-3. The single Anthropic provider has no failover or rate-limit-aware retry

`lib/llm/anthropic-provider.ts:25` is the only prod LLM impl. A Claude
API outage drops the entire categorize/coordinate/draft chain. There is
no second LLM provider, no fall-back-to-heuristic on outage, no
local model. The `LlmProvider` interface (`lib/llm/types.ts`) supports
this — the test heuristic is the second impl — but a production
fallback is not wired.

**Fix.** Two paths, pick one: (a) when Anthropic returns 5xx or
429-with-no-Retry-After-budget, fall back to the test heuristic
provider for categorize-only (draft requires real generation, so it
queues to retry) — this keeps inbox triage working through Claude
outages. (b) Add a second prod provider behind the interface
(any Claude-API-compatible model) and let `getLlmProvider()` pick the
healthy one via a circuit-breaker. (a) is one new file; (b) adds a
real second implementation. Defer until pilot revenue justifies the
hedge.

#### P2-4. Per-vertical compliance sentinel corpora are realty-deep, others-shallow

`lib/agents/sentinel/` carries the corpus. The
`pre-pilot-ship-readiness-2026-05-18.md:157` line "Strongest compliance
corpus — `lib/agents/sentinel/` carries 50+ realty-specific rules"
matches what I see in
`lib/agents/sentinel/compliance-corpus.test.ts`. The non-realty
corpora are mostly placeholders flagged `unverified: true` and
deliberately skipped at seed time
(`lib/knowledge/seed-data.ts:24-29`).

**Fix.** When each second-vertical pilot is greenlit, file a corpus
expansion as a `CapabilityProposal` (the state machine already exists
per `schema.prisma:140-147`) so the path to ratification is the same
as every other expansion. This is sequencing, not a missing
mechanism.

---

## 2. Principles-adherence audit

### Living portable architecture (every layer abstraction + swappable impl)

**Verdict: PASS** (with a thin spot called out at P1-5).

Evidence:

- LLM: `LlmProvider` interface (`lib/llm/types.ts`) +
  `AnthropicProvider` + `TestLlmProvider`.
- Embeddings: `IEmbeddingProvider` (`lib/knowledge/types.ts:84-93`) +
  `OpenAIEmbeddingProvider` + `TestEmbeddingProvider`.
- Knowledge store: `IKnowledgeStore` (`lib/knowledge/types.ts:185-193`)
  + `PgvectorKnowledgeStore` + `TestKnowledgeStore`.
- Email: `EmailProvider` (`lib/email/`) + Resend impl + test impl.
- Billing: `BillingProvider` + Stripe impl + test impl
  (`lib/billing/`).
- File source: `IFileSource` (`lib/customer-files/types.ts`) +
  `DriveFileSource` + `FixtureFileSource`.
- OAuth provider: `IntegrationProvider` (`lib/integrations/types.ts`)
  + `GoogleOAuth` + `TestIntegrationProvider`
  (`lib/integrations/__tests__/contract.test.ts:14-15`).
- Ops control plane: `OpsControlPlane` (`lib/ops/types.ts:91-130`) +
  Inngest+Vercel impl + `TestOpsControlPlane`. **One real impl per
  surface**, see P1-5.

### Adapter pattern mandatory; two-implementation rule

**Verdict: PASS for every interface except `OpsControlPlane`**.

`OpsControlPlane` has prod + test, but the test impl is a recorder, not
a second runtime. The prod surface is "GitHub Actions vars" and "Inngest
disable" — two surfaces, one runtime per surface (GitHub for repo vars,
Vercel for env). Not a deviation by the letter of the rule (test +
prod = two impls); a thin spot by the spirit. See P1-5.

### No silent vendor lock-in (vendor SDK in `lib/<domain>/` behind an abstraction)

**Verdict: PASS**.

Audit: `grep -rn "^import.*from\s+['\"](googleapis|@microsoft|@slack|docusign|intuit|stripe|@anthropic|openai)" lib/` returns

```
lib/billing/stripe-provider.ts:12        — Stripe SDK in lib/billing/
lib/llm/anthropic-provider.ts:25         — Anthropic SDK in lib/llm/
lib/integrations/google-drive-mcp/server.ts:17  — googleapis in MCP server
lib/integrations/google/gmail-provider.ts:24    — googleapis in provider
lib/integrations/gmail-mcp/server.ts:26         — googleapis in MCP server
```

Every one is inside `lib/<domain>/` per the rule. The same grep across
`app/` returns **zero** matches — no route handler reaches a vendor SDK
directly. Microsoft Graph is gated through one client (`lib/integrations/microsoft/graph-client.ts:34`)
shared by every Graph-touching MCP server (Outlook, Teams, OneDrive, Excel).

Sentry imports (`@sentry/nextjs`) appear only in `sentry.*.config.ts`,
`instrumentation.ts`, `next.config.mjs`, and
`lib/observability/{cron-monitor,sentry-provider}.ts` — all inside
the observability domain or the Next-mandated boot files.

Note: `docs/fleet-architecture.md:747` claims `openai-embedding.ts` is
"the only file that imports the OpenAI SDK." Actually the project does
not depend on `openai` at all — `lib/knowledge/openai-embedding.ts:34`
just `fetch`es `https://api.openai.com/v1/embeddings` directly. That is
**stronger** than the SDK route (one less dependency to lock to), but
the doc misstates the mechanism. Minor doc correction; not an
architecture issue.

### MCP-first integrations (per-workspace MCP server; skills call `mcp.call`)

**Verdict: PASS**.

Nine MCP servers exist (`lib/integrations/{gmail,outlook,docusign,excel,
onedrive,google-drive,quickbooks,slack,teams}-mcp/`). Each pairs with a
route at `app/api/integrations/<slug>-mcp/[workspaceId]/route.ts`.
Workspace-bound construction is enforced in each server's `auth.ts`
(e.g. `lib/integrations/gmail-mcp/server.ts:61-70` per the doc) and
the shared `lib/integrations/mcp-core/route.ts` checks operator session
OR `MCP_API_KEY` shared secret.

The architectural claim "skills call `mcp.call(server, tool, args)`,
not vendor SDKs directly" is satisfied **transitively** — skills call
`MessageFetcher` / `DraftPersister` interfaces (`lib/skills/types.ts:115-130,
218-228`), whose prod impl wraps the MCP server. No skill file imports
`googleapis` or `@microsoft/microsoft-graph-client`:

```
grep -rln "googleapis\|microsoft-graph" lib/skills/ → 0 hits
```

### No-outbound (agents draft only; nothing auto-sends)

**Verdict: PASS**.

Triple-belt-and-braces, all verified:

1. **Interface has no send.** `DraftPersister`
   (`lib/skills/types.ts:218-228`) declares one method: `persistDraft`.
   No `sendMessage`, no `submitDraft`, no `users.messages.send`. Skills
   physically cannot send.
2. **MCP servers expose drafts.create, not send.** Verified by
   `grep -rn "users\.messages\.send\|users\.drafts\.send\|sendMail" lib/`
   → only comments / negative assertions
   (`lib/integrations/gmail-mcp/server.ts:18`,
   `lib/integrations/outlook-mcp/server.ts:25`,
   `lib/skills/draft.ts:11`). No call sites.
3. **OAuth scopes exclude send.** `lib/integrations/marketplace.ts` Gmail
   scope set is `gmail.readonly + gmail.modify + gmail.compose` (no
   `gmail.send`); Outlook is `Mail.Read + Mail.ReadWrite + offline_access`
   (no `Mail.Send`).

Edge case the doc names correctly: `trial-expiration-warnings.ts:131-150`
sends through `lib/email/` (Resend). This is **agentplain's own
transactional billing email to the broker-owner**, not customer-system
outbound. Comment at `trial-expiration-warnings.ts:5-9` makes the
carve-out explicit.

`WorkApprovalQueueItem` is created unconditionally on every draft path:
`lib/skills/persist-artifacts.ts:1-25` describes this, and
`process-webhook-event.ts:150-153` calls `persistSkillRunArtifacts` on
every successful chain run — no conditional gates auto-approve.

### Cold-start-safe agents (every fire reads durable state)

**Verdict: PASS**.

Every Inngest function body and skill runner re-reads its inputs from
DB or env on entry:

- `process-webhook-event.ts:81-98` — `findMany` every fire.
- `process-webhook-event.ts:129-132` —
  `getWorkspacePreference(SYSTEM_OPERATOR_CONTEXT, workspace.id)`
  per event, never memoized.
- `process-webhook-event.ts:138-140` — `customerContextResolver`
  closure built per event.
- `integration-renewal-sweep.ts:66-72` — re-queries every
  `WebhookSubscription` per fire.
- `trial-expiration-warnings.ts:57-77` — `findMany` of TRIALING
  subscriptions per fire.
- `customer-files-ingestion-sweep.ts:187-194` — re-lists workspaces per
  fire.
- `lib/skills/runner.ts:110-127` — preferences + customer context
  passed in by caller; no module-level cache.

MCP server design backs this up: `gmail-mcp/server.ts:21-23` per the
doc states "every public method re-resolves the credential via
`./auth.ts:resolveCredential`."

### Workspace RLS isolation on all multi-tenant data

**Verdict: DEVIATION** (see P0-1).

PASS for the following tables (policies enumerated by `grep -rn
"CREATE POLICY" prisma/migrations/`):

- `Workspace`, `Membership`, `WorkThresholdConfig`,
  `WorkApprovalQueueItem`, `HandoffLogEntry`, `ComplianceFlag`,
  `CapabilityProposal`, `WorkspaceInvoice`, `AuditLog`, `User`,
  `MagicLinkToken` (`20260508000000_phase1_init`).
- `OnboardingState` (`20260511000000`).
- `Subscription`, `BillingEvent` (`20260511120000`).
- `KnowledgeDocument`, `Embedding` (`20260512000000`).
- `Inquiry` (`20260515000000`).
- `WebAuthnCredential`, `SupportRequest` (`20260520000000`).
- `WorkspacePreference`, `PreferenceSignal` (`20260523000000`).

DEVIATION for: **`IntegrationCredential`, `WebhookSubscription`,
`WebhookEvent`.** All three carry workspaceId (directly or via FK).
`IntegrationCredential` is the highest-sensitivity table in the schema
(encrypted OAuth refresh tokens). The
`wave5-multitenant-isolation.test.ts:241-250` model list also omits
them — the source-grep regression doesn't catch the gap. Fix path in
P0-1.

### No prod secrets in Preview/Dev env tiers

**Verdict: PASS by convention; no automated enforcement**.

Every `env.ts` access for a production-tier secret carries a comment
referencing `feedback_no_prod_secrets_in_dev`
(`env.ts:75-77, 120-127, 132-135, 152-155, 168-170, 200-202, 207-209`).
The convention is honest and consistent, but it is a comment-only
guard — nothing in CI or `next.config.mjs` enforces that
`VERCEL_ENV=preview` deploys cannot see a prod Stripe secret.

**Improvement (P2-fold):** add a CI check that runs against
`VERCEL_ENV=preview` deployments and fails if `STRIPE_SECRET_KEY`
starts with `sk_live_`, or if `OPENAI_API_KEY` matches the prod
account fingerprint. Cheap; closes the convention into a contract.

### Push-verification (remote mutation curl-verified before "done")

**Verdict: PASS**.

- Token refresh: `integration-renewal-sweep.ts:229-236` —
  `findUniqueOrThrow` immediately after `update`, asserts
  `status === 'ACTIVE'` and `expiresAt > now`.
- Subscription renewal: `integration-renewal-sweep.ts:281-287` — same
  pattern.
- Webhook idempotency: `webhook-idempotency.ts` writes
  `WebhookEvent` before the receiver ACKs; the upsert is the verify
  surface.
- GHA cron output: per `docs/fleet-architecture.md:380-384`, the
  flatsbo-side `commit-cron-output.ts` re-reads the remote ref after
  push.

The discipline is genuinely encoded in code, not just docs.

---

## 3. Design-soundness verdict

### Where the design is sound

**The five-skill loop is the right shape.** A fixed pipeline
(read → categorize → coordinate? → schedule? → draft? → compliance?)
with branch-by-intent is the inverse of "let the agent decide what to
do" — which is the failure mode that makes agentic systems
unpredictable. The runner stays Prisma-free
(`lib/skills/runner.ts`), persistence lives at the edge
(`lib/skills/persist-artifacts.ts:14-16`), and the office-admin
pre-pass (`runner.ts:198-234`) is a load-bearing optimization that
keeps verification codes and password resets out of the LLM-cost path.
Confidence-floor demotion (`runner.ts:255-265`) prevents
low-conviction categorizations from triggering expensive coordinate +
draft work. Each of these is a small decision that compounds into a
loop that fails safe.

**The triple-belt no-outbound architecture is genuinely safe.**
Interface, MCP surface, and OAuth scopes all enforce the same
invariant. Removing one belt does not unsafely the system. This is
defense-in-depth done right and is the load-bearing differentiation
of the product — every customer integration cannot send, by
construction. The carve-out for `trial-expiration-warnings` is correctly
scoped (agentplain's own transactional email, not customer outbound)
and isolated to `lib/email/`.

**The MCP-first per-workspace server pattern scales.** Adding a
provider is: new `lib/integrations/<vendor>/` for the SDK wrapper, new
`lib/integrations/<vendor>-mcp/` for the workspace-bound server, new
route at `app/api/integrations/<vendor>-mcp/[workspaceId]/route.ts`
that delegates to `mcp-core/route.ts`. The boilerplate is shared in
`mcp-core/`. Workspace-bound construction
(`gmail-mcp/server.ts:61-70` per the doc) prevents cross-workspace
calls at the constructor level — strictly stronger than a path-param
check.

**The knowledge-substrate boundary is the cleanest swap surface in
the repo.** `lib/knowledge/index.ts:44-93` reads two env vars
(`KNOWLEDGE_STORE`, `KNOWLEDGE_EMBEDDING_PROVIDER`) and picks the
right impl. The fallback chain (no `OPENAI_API_KEY` → test embedder)
keeps preview builds green. The CUSTOMER vs SKILL/VERTICAL/COMPLIANCE
context-kind partition (`lib/knowledge/types.ts:97-102`) — enforced
at three layers per `docs/fleet-architecture.md:716-724` (app
validation + CHECK constraint + RLS trigger) — is the correct
shape for tenant-isolated retrieval.

**The verify-after-create discipline is real, not aspirational.** Token
refresh and subscription renewal both read the row back immediately
after writing it. This is the kind of thing that's easy to claim and
hard to find in code; here it's in code.

**The two-substrate cron split is the right call.** Inngest for
event-driven loops with retry/dead-letter semantics; GHA for
git-side-effect daily memory deltas. The split matches the work shape
and avoids forcing one runner to do both jobs poorly. The
`USE_GHA_CRON` repo-variable kill-switch + the
`INNGEST_FN_DISABLE_*` env-var flag give symmetric pause control.

### Where structural change is warranted

**1. RLS coverage for integration data is a real gap (P0-1).** Not a
"future problem" — three production tables holding workspaceId data
(one of them OAuth refresh tokens) ship without policies. The
migration to add policies is one file; the test extension is one
list. This should land before any non-Conner customer onboards.

**2. The customer-files ingestion path is half-built (P0-2).** The
cron runs, the source returns `NOT_CONFIGURED`, and the customer
sees "works from your files" copy with empty retrieval. The Drive
adapter is the missing piece. Until it ships, soften the copy or
ship the adapter — current state is a trust hazard at first run.

**3. The Inngest disable-flag pause has a 5+ minute propagation
window (P0-4).** A runaway-cost incident has a bad blast radius until
Vercel cycles the function instances. DB-backed flag with env-var
cold-start parity closes the window to 60 s. Add this before
revenue-scale traffic.

**4. The single LLM provider is a single point of failure (P2-3).**
The `LlmProvider` interface supports failover; the prod wiring
doesn't have it. Today an Anthropic outage drops the entire
categorize/coordinate/draft chain. The fix is one circuit-breaker or
one fallback provider. Defer until revenue justifies — but recognize
the gap exists.

**5. Vertical depth is realty-heavy (P1-2).** This is not a design
defect — the architecture supports growing each vertical. It is the
honest current state: 9 of 10 verticals ship one skill each, and
their rosters carry 4-7 `rooting` cards. A customer who signs up on
recruiting today sees 7 cards that do nothing. Either build more
vertical skills before opening the verticals to sign-up, or gate
non-realty to a preview surface. The current state is "ship the
shape, not the depth," and that's a defensible interim; it is not a
defensible 90-day state.

**6. Inngest is not as portable as the principles claim (P1-5).** The
`runWithDisableGate` wrapper is the only abstraction over Inngest;
there is no `IRunner` interface with two impls. Moving off Inngest
would require finding every `inngest.createFunction` call site
(`lib/inngest/functions/*.ts`, four files today) and replacing the
trigger registration. The body of each function (the
`withCronMonitor(...)` core) is portable; the wrapper isn't. Honest
labeling — "Inngest is the live fleet runner per
`reference_inngest_is_the_live_fleet`" — is in the source, but the
portability principle is stretched here. When the second runner
candidate is real, build the interface; until then, expect a real
migration when Inngest is replaced.

### The honest summary

The architecture is sound. The skill chain, the MCP-first integration
pattern, the no-outbound enforcement, and the knowledge substrate are
all the right shapes for what's being built. Cold-start safety and
verify-after-create are real disciplines in code, not slogans in
docs.

The gaps are operational, not architectural: three tables that need
RLS policies; one cron whose source is a stub; a pause path with a
slow propagation window; a config-gate set that fails closed in
unhelpful ways. None of those require redesign. They require the next
two PRs.

The vertical-depth gap is a different shape — it's a deliberate "ship
the architecture, deepen the realty pilot, hold the line on opening
new verticals" position. That matches
`feedback_no_new_verticals_finish_locked.md`. Hold the line.

---

## Appendix: open doc corrections

Minor disagreements between this assessment and
`docs/fleet-architecture.md`:

- §6.1 table at line 747 says `OpenAIEmbeddingProvider` "imports the
  OpenAI SDK." It does not — `lib/knowledge/openai-embedding.ts:34`
  uses `fetch` against the REST API. Stronger, but mislabeled.
- §3.2 line 297 says `lib/inngest/functions/customer-files-ingestion-sweep.ts:58-69`
  defines the cron. The function id constant is at 58, the cron
  schedule is at 69 — accurate, but the range
  `58-69` includes the trigger-event constant in between, which is
  fine.
- §3.1 footnote at line 305 says pausing is "one env-var flip, no
  redeploy." Technically true for the flag write; the propagation
  story is in P0-4 above.
- §3 intro at line 68 says "Playwright + integration test harnesses."
  Playwright is not in `package.json` today; tests run via
  `node --test` per `package.json:11`. Doc should drop the Playwright
  mention or note it as historical.

None of these change the architecture story. Worth fixing in the next
docs-touch PR.

---

## Fleet review (2026-05-26)

Three lenses — architecture/tech-lead, portability/principles, reliability
— independently re-read the codebase against the §1-§3 verdicts. Each
finding cites code; the original assessment is corrected in place above
where this review found factual errors, and consolidated outcomes are
captured here.

### Architecture / tech-lead lens

**Original P0s — all four confirmed.**

- **P0-1 (RLS gap on `IntegrationCredential` / `WebhookSubscription` /
  `WebhookEvent`).** Independently verified.
  `grep "CREATE POLICY\|ENABLE ROW LEVEL SECURITY"
  prisma/migrations/**/migration.sql` returns 0 hits for the three
  table names. `tests/wave5-multitenant-isolation.test.ts:241-250`
  `WORKSPACE_SCOPED_MODELS` list omits `integrationCredential`,
  `webhookSubscription`, `webhookEvent`. Confirmed DEVIATION.
- **P0-2 (`DriveFileSource` returns `NOT_CONFIGURED` in BOTH branches).**
  Confirmed. `lib/customer-files/drive-source.ts:44-71` — the `unwired`
  branch returns `NOT_CONFIGURED`, and the wired branch (lines 52-55,
  68-71) also returns `NOT_CONFIGURED` with the explicit message
  "Drive list/fetch path is wired but not implemented in this PR."
- **P0-3 (Session git-auth needs a manual installation-token mint).**
  Accepted as an operational fact of this session — the artifact is
  the bash prelude required to push this very PR. The proposed
  `gitconfig` credential helper is the right fix.
- **P0-4 (Inngest disable-flag propagation ≥ 5 min).** Mechanism
  confirmed. `lib/inngest/run-with-disable-gate.ts:34-39` calls
  `isFunctionDisabled(functionId, env)` (`disable-flag.ts:66-72`) which
  reads `process.env` at function entry. `lib/ops/inngest/control.ts:152-162`
  writes the flag via Vercel's `POST /v9/projects/<id>/env?upsert=true`
  — that only takes effect on the next cold start of a running
  function instance.

**NEW finding — N1. Three bare `prisma.auditLog.create` call sites in
the inbound webhook routes will fail RLS in production.**

`AuditLog` policy is `audit_operator_write WITH CHECK (
  current_setting('app.is_operator', true) = 'true' OR "actorUserId" IS
NOT NULL )` (`prisma/migrations/20260508000000_phase1_init/migration.sql:298-300`).
Bare `prisma.<...>.create` calls run in implicit transactions with no
GUC set — `app.is_operator` resolves to NULL, `NULL = 'true'` is NULL
(falsy). The OR arm `"actorUserId" IS NOT NULL` is the only way the
check passes. Three webhook-receive call sites set neither:

- `app/api/webhooks/google/route.ts:97` (unknown_sender path)
- `app/api/webhooks/microsoft/route.ts:85` (signature_invalid path)
- `app/api/webhooks/microsoft/route.ts:160` (unknown_subscription path)

And one cron path:

- `lib/inngest/functions/integration-renewal-sweep.ts:200` (GRANT_REVOKED
  branch) — passes `workspaceId` but no `actorUserId` and no `withRls`.

All other `prisma.auditLog.create` sites (8 OAuth callbacks, one cron
audit) either pass `actorUserId: session.userId` or wrap in
`withSystemContext` and so satisfy the check.

The role on Neon does not have `BYPASSRLS` (no `ALTER ROLE … BYPASSRLS`
in any migration). On production these paths therefore throw a
`23514`-equivalent / RLS-violation error. They are all rare branches
(unknown sender, invalid signature, revoked grant) which is likely why
the gap hasn't surfaced — but a hostile prober hitting `/api/webhooks/
microsoft` with garbage signatures would 500 instead of returning the
intended 401 and would silently lose the audit trail of the probe.

**Fix.** Wrap each in `withSystemContext` (one line each) — the
operator context sets `app.is_operator='true'` and the WITH CHECK
clause passes. Promote to **P0-5** in the revised ordering.

**NEW finding — N2. The Inquiry-table RLS policy is operator-only,
which forces every customer-facing inquiry intake to run through
`withSystemContext`.**

`Inquiry` is the load-bearing intake table for `/custom`. The migration
header at `prisma/migrations/20260515000000_add_inquiry_intake/migration.sql:54-62`
is explicit that the public POST satisfies the WITH CHECK only when
the handler calls `withSystemContext`. This is correct today but is a
**single missed `withRls`** away from blocking customer intake. A
contract test that pins `Inquiry.create()` inside `withSystemContext`
would close the gap. P2 (low immediate risk, but the failure mode is
"new customer inquiries silently 500").

**NEW finding — N3. The Teams MCP server (`lib/integrations/teams-mcp/`)
has NO approval gate on the `sendChatMessage` and `postToChannel`
tools.**

The Slack MCP (`lib/integrations/slack-mcp/server.ts:111-125`,
`127-147`) enforces an `approvalToken` arg — `if (!input.approvalToken
|| input.approvalToken.trim().length === 0) return mcpError('
APPROVAL_REQUIRED', ...)`. The Teams MCP does not. `teams-mcp/server.ts:202-264`
(`sendChatMessage`) and `:265-` (`postToChannel`) check only `chatId`/
`body`/`teamId`/`channelId` and immediately POST to Graph.

**No skill calls these tools today** so the practical exposure is
zero. But the architecture invariant "every send tool gates on an
approval token" is only true for Slack, not Teams. P1 — close before
the Teams MCP is exposed to any skill that could call it.

**NEW finding — N4. `webhook-idempotency.ts` reads `prisma.webhookEvent`
directly without RLS, by design (since the table has no RLS).**

Once P0-1 lands and `WebhookEvent` gets RLS, every call site in
`lib/integrations/webhook-idempotency.ts:67-121` plus the bare
`prisma.webhookEvent.findMany/update` calls in
`lib/inngest/functions/process-webhook-event.ts:81-98, 156-165, 204-212`
will need to be wrapped in `withSystemContext`. Catalogued so the RLS
migration is not a surprise to the receiver code. Not a defect today;
a checklist item against the P0-1 fix.

**Other backlog items reviewed.** P1-1 (knowledge re-seed cron), P1-2
(vertical depth), P1-3 (test coverage), P1-4 (config gates), P1-5
(`OpsControlPlane` thin spot) all confirmed as written. P2-1 through
P2-4 confirmed.

### Portability / principles lens

The principles audit in §2 holds. One correction and one nuance:

- **No-outbound (§2, "Triple-belt-and-braces, all verified").** The
  three belts are accurate **for Gmail and Outlook** — the
  load-bearing email loop. They are NOT accurate for Slack or Teams.
  `lib/integrations/marketplace.ts:114` requests `ChannelMessage.Send`
  for Teams; `:238-239` requests `chat:write` and `im:write` for
  Slack. Those are send-class scopes. The third belt (OAuth scopes
  exclude send) is **email-only**. The Slack MCP enforces
  no-auto-send via an `approvalToken` runtime check; the Teams MCP
  does not enforce it at all today (see N3). The architecture is
  still "no skill currently calls these tools" — but the
  scope-level guarantee is overstated.

  This affects the SVG-02 panel (c) — see visuals review.

- **`OpsControlPlane` two-implementation thin spot (§2, P1-5).** Real
  but acceptable today: the "second implementation" is the test
  recorder (`TestOpsControlPlane`) plus the in-tree
  `GithubActionsVarsAdapter`. The third (a non-Vercel runner control)
  has no realistic candidate today — Vercel is the deploy target —
  so the two-impl rule is held in spirit (one prod impl per
  surface) with a real test impl. Not a deviation. Document the
  constraint at the interface header so the gap isn't a surprise.

### Reliability lens

- **Inngest dead-letter / retry — covered.** `webhook-idempotency.ts:
  decideRetry` schedule (1m → 5m → 30m → 2h → 6h → deadletter) is
  exercised by `process-webhook-event.ts:199-213`. Strong.
- **GHA dead-letter — gap (P2-1).** Confirmed. The fix path is the
  one suggested in the original assessment: a
  `workflow_run`-triggered retry workflow OR a final
  `if: failure()` step that opens a `cron-failure` issue.
- **Disable-flag propagation — gap (P0-4).** As above, confirmed.
- **Observability.** `withCronMonitor` is consistent across all four
  Inngest functions (verified —
  `grep "withCronMonitor" lib/inngest/functions/` returns matches
  in each). The Sentry-DSN-off noop path is tested; the
  Sentry-DSN-on production branch is not (P1-3 covers).
- **Single Anthropic provider — single point of failure (P2-3).**
  Confirmed. Defer per original sequencing.
- **Bare-prisma audit-log writes (N1).** A failed RLS write produces
  a 500 on the inbound webhook receiver. Pub/Sub retries the 500
  indefinitely for that delivery — the route would back the receiver
  off rather than the intended "ACK 200 ignored" pattern. Reliability
  hazard layered on top of the correctness hazard.

### Revised P0 ordering

The original four P0s plus the audit-log RLS bug. Sequenced by fix
cost × blast radius:

1. **P0-5** (NEW) — wrap the four bare `prisma.auditLog.create`
   call sites in `withSystemContext`. Four-line fix; closes a real
   500-on-edge-paths bug today. One PR.
2. **P0-1** — add RLS policies + denormalize `WebhookEvent.workspaceId`
   + extend `WORKSPACE_SCOPED_MODELS`. Lands before any non-Conner
   pilot. Same PR as N4 (audit + update the call sites that go bare
   today).
3. **P0-2** — implement `lib/integrations/google/drive.ts` `listFiles`
   + `getFileText` + flip `DriveFileSource.unwired` to false. Until
   then, the customer-facing "works from your files" copy is empty.
4. **P0-4** — DB-backed disable flag (`OpsFlag` table) with env-var
   cold-start parity. Cuts pause latency from 5 min to ≤ 60 s.
5. **P0-3** — `gitconfig` credential helper for session git-auth.
   Quality-of-life for every fleet build; not a production blocker
   for customers but a real cost on the build cadence.

### What changed from the original assessment

- **Promoted to P0:** the bare-`prisma.auditLog.create` finding (N1)
  is more urgent than P0-3 by blast radius — it's a live edge-path
  500 in production.
- **Slack/Teams scope claim corrected:** the no-outbound triple belt
  is Gmail/Outlook-only. The Slack scope set includes `chat:write`/
  `im:write`; Teams includes `ChannelMessage.Send`. Slack enforces
  approval-token-at-call; Teams does not.
- **Teams MCP no-approval-gate flagged (N3):** new P1.
- **`Inquiry` RLS implicit dependency (N2):** new P2 (contract test
  to pin).
- **Audit-log call-site checklist (N4):** added to the P0-1 fix
  scope — once `WebhookEvent` gets RLS, the bare
  `webhook-idempotency.ts` reads/writes need wrapping.

### What was confirmed

- The five-skill loop shape (§3) — sound, no changes.
- The no-outbound architecture FOR THE EMAIL LOOP — sound; the
  triple-belt construction is real for Gmail/Outlook.
- MCP-first integration pattern — sound. Adapter portability holds
  across all integrations audited.
- Cold-start safety — every cron body re-reads durable state per
  fire. No memoization across fires found in any of the four
  Inngest functions.
- Verify-after-create discipline — present and load-bearing in the
  renewal sweep, the webhook receivers, and the GHA commit-back
  path.
- Two-substrate cron split (Inngest + GHA) — the right call for
  the work shapes.

### Open doc corrections appended to the appendix

Add to §Appendix: the wrapper-order claim in `docs/fleet-architecture.md:295`
(line "Three concentric wrappers, in order from outside in: 1.
`runWithDisableGate`, 2. `withCronMonitor`, 3. `withInngestErrorReporting`")
is correct against the code. The SVG-04 ("Cron substrates") diagram
shows the OPPOSITE order — `withInngestErrorReporting` outermost,
`runWithDisableGate` innermost — and is wrong. See
`docs/visuals-tech-accuracy-review.md`.
