# Inngest cron health audit — 2026-05-18

**Branch:** `chore/inngest-cron-audit-2026-05-18` (base: `origin/main @ 2a10b0c`)

**Scope:** verify every Inngest cron is registered, gated, and capable
of firing end-to-end. Per the task brief: don't touch business logic;
verify wiring + run.

**Discipline:** every claim cites a file path + line or a logged
artifact (per `feedback_no_guesses_no_estimates.md`). Where I could
not produce a live signal locally (no `INNGEST_SIGNING_KEY` /
`DATABASE_URL` in the worktree), I say so explicitly and ship a
reproducible recipe rather than a fabricated screenshot.

---

## 1. Function inventory

Single source of truth: the `functions: [...]` array in
`app/api/inngest/route.ts:24-31`.

| # | Function id | File | Trigger | Registered? | Disable env var |
|---|---|---|---|---|---|
| 1 | `agentplain-trial-warnings` | `lib/inngest/functions/trial-expiration-warnings.ts:168-194` | cron `0 10 * * *` (UTC; ~06:00 ET) | YES — `route.ts:27` | `INNGEST_FN_DISABLE_AGENTPLAIN_TRIAL_WARNINGS` |
| 2 | `agentplain-integration-renewal-sweep` | `lib/inngest/functions/integration-renewal-sweep.ts:254-264` | cron `0 */2 * * *` | YES — `route.ts:28` | `INNGEST_FN_DISABLE_AGENTPLAIN_INTEGRATION_RENEWAL_SWEEP` |
| 3 | `agentplain-process-webhook-event` | `lib/inngest/functions/process-webhook-event.ts:153-166` | cron `*/5 * * * *` + on-demand event `agentplain/process-webhook-event.requested` | YES — `route.ts:29` | `INNGEST_FN_DISABLE_AGENTPLAIN_PROCESS_WEBHOOK_EVENT` |

**Orphan check:** `grep -rn "createFunction" lib/inngest/ app/api/inngest/`
returns 5 files (3 function bodies + the wrapper + the README). All
three function-body files export a symbol that appears in `route.ts`.
**Zero orphan functions.**

**Gate check:** all three function bodies wrap their handler with
`runWithDisableGate` — verified at
`trial-expiration-warnings.ts:175`, `integration-renewal-sweep.ts:261`,
`process-webhook-event.ts:163`. The `runWithDisableGate` primitive
itself is `lib/inngest/run-with-disable-gate.ts:28-40`; the
env-var-name normalization rule lives at `lib/inngest/disable-flag.ts:48-54`
and is unit-tested at `lib/inngest/__tests__/disable-flag.test.ts`.

---

## 2. Live dashboard state — what could be verified, what could not

### Verified locally (no creds required)

- **Registration shape** — `lib/inngest/functions/__tests__/process-webhook-event.test.ts:80-92`
  reads `app/api/inngest/route.ts` at test time and asserts the
  literal symbol `processWebhookEventFn` appears in the
  `functions: [...]` array. A regression that drops the function from
  the serve route fails this test before it fails an operator.
- **Build + typecheck + lint** — see §6 of this doc for the run logs.

### Verified after push (cite the deployment)

- **Serve route GET handshake** — `curl -fsS https://<deployment>/api/inngest`
  on the preview deployment should return 200 with all three function
  ids in the response body. The recipe lives in
  `scripts/validate/inngest-health-check.ts --mode=registration --url=…`.
  Result will be appended to this section as `npm run` output once the
  preview URL is known.

### NOT verified — requires creds I do not have in this worktree

- **Last-fired times per function on Inngest Cloud.** Inngest does
  not publish a public REST endpoint for cron run history (verified
  at https://www.inngest.com/docs/guides/pause-functions on
  2026-05-10, cited in `lib/inngest/disable-flag.ts:7`). The
  authoritative view is the Inngest Cloud dashboard. **Action for
  Conner:** open https://app.inngest.com/env/production/functions
  and screenshot the three rows + their "last run" column; attach to
  the PR.
- **Disable-flag state per function in Vercel production.** Vercel's
  env-var listing requires `VERCEL_TOKEN`. **Action for Conner:**
  `vercel env ls production | grep INNGEST_FN_DISABLE_` — any row
  where the value is the literal `"true"` is a paused function.
  Expected state today: no `INNGEST_FN_DISABLE_AGENTPLAIN_*` env vars
  set, or all set to `"false"`. Anything else needs a decision.

### Kill-switch / feature-flag audit

The task brief asks about `USE_GHA_CRON`-style kill switches. agentplain
does **not** use GitHub Actions for crons — Inngest is the sole runtime.
The control surface is one Vercel env var per function
(`INNGEST_FN_DISABLE_*`) written via `lib/ops/inngest/control.ts`. There
is no app-wide off switch by design — pausing is per-function so a
broken cron doesn't take down the rest of the fleet.

---

## 3. Synthetic proof of life — recipe + result placeholder

The full end-to-end proof requires inserting a `WebhookEvent` row tied
to a real `WebhookSubscription` + `IntegrationCredential`, triggering
the on-demand fire event, and watching the row flip to
`processed=true`. I shipped this as a runnable script at
`scripts/validate/inngest-health-check.ts --mode=synthetic-webhook`.

```sh
# After PR merge, against a workspace + Gmail subscription Conner owns:
INNGEST_EVENT_KEY=… DATABASE_URL=… ENCRYPTION_KEY=… \
  npx tsx scripts/validate/inngest-health-check.ts \
    --mode=synthetic-webhook \
    --workspace agentplain-internal \
    --subscription <subscription-uuid> \
    --timeout-seconds=600
```

Exit 0 + a `status:"ok"` JSON line on stdout = the value loop fires
end-to-end. Exit 1 = either the Inngest delivery never came, or the
handler errored on the synthetic row.

**Why I'm not running it from this session:** the worktree has no
`.env*` file and the script writes a row through
`lib/integrations/google/*` token decryption (requires
`ENCRYPTION_KEY` matching the workspace's credential). Forging the
env locally would mean fabricating credentials I shouldn't see. The
right run is from Conner's local with his real `.env.local`, or as a
post-deploy smoke step against a preview deployment.

**Result row (to be appended after the first real run):**

| Run timestamp | Synthetic event id | Elapsed (s) | Inngest run id | Status |
|---|---|---|---|---|
| _pending first run_ | | | | |

---

## 4. Fixes applied in this PR

1. **`lib/inngest/README.md`** — full rewrite. The previous version
   referenced `flatsbo-prod` client id, a `run-skill.ts` file that
   was deliberately NOT ported (per `PROJECT_STATE.md` PR-A note),
   a `CronRun` Prisma model that doesn't exist in agentplain, and the
   wrong `runWithDisableGate` call signature
   (`runWithDisableGate(def, runId, step)` — actual is
   `runWithDisableGate(functionId, fn, env?)` at
   `lib/inngest/run-with-disable-gate.ts:28-40`). Operators copy-
   pasting from the old README would write functions that fail to
   compile and reference an architecture pattern that was explicitly
   rejected during PR-A. New content matches the actual code and
   includes the function-inventory table + verification recipe.
2. **`scripts/validate/inngest-health-check.ts`** — new. Two modes:
   `--mode=registration` (no DB writes, curls the serve route's
   introspection response and asserts the three expected function ids
   are present); `--mode=synthetic-webhook` (writes one synthetic
   `WebhookEvent` row, triggers the on-demand event, polls until
   processed or timeout). Pattern mirrors the existing
   `scripts/validate/gmail-sync-check.ts:1-40`.
3. **`docs/inngest-health-2026-05-18.md`** (this file) — audit
   record. Updated as the verification recipe is run.

**Not changed:** any function body, the serve route, the gate
primitives, or any business logic. The audit found no orphans, no
broken wiring, no missing gate wrap — the structural defect was the
README and the absence of a reproducible health-check recipe.

---

## 5. Decisions for Conner

None of these block the PR; they're "look at the dashboard once and
decide":

1. **Confirm no `INNGEST_FN_DISABLE_AGENTPLAIN_*` env vars are
   accidentally set to `"true"` in Vercel Production.** The three
   function ids are listed in §1. If any are paused, decide
   whether the pause is intentional (and document why) or a stale
   artifact that should be flipped back to `"false"` via the
   throttle CLI.
2. **Confirm the Inngest Cloud dashboard shows three functions
   under `agentplain-prod`,** each with the cron expression from §1
   and a recent "last run" timestamp. If a function shows zero
   runs in the last 24h that isn't disabled, that's the real signal
   to chase.
3. **Schedule the first synthetic-webhook run** after the next
   Gmail OAuth connection lands — that produces the
   `WebhookSubscription` row the script needs as input. The run
   then becomes a permanent reproducible health probe that can fire
   on every deploy or weekly.

---

## 6. Build / lint / typecheck

Logs from this branch — captured in the PR description.

```sh
npm run typecheck   # → exit 0
npm run lint        # → exit 0
npm run build:no-migrate   # → exit 0
```

---

## Appendix — what I deliberately did NOT do

- **Did not create app-wide cron kill switches.** Per-function gates
  via `INNGEST_FN_DISABLE_*` env vars are the project-locked design
  (`lib/inngest/disable-flag.ts:1-34` documents why). A new
  blanket switch would be a band-aid that hides per-function failure
  modes.
- **Did not invent a "dead-letter queue."** `processWebhookEventFn`
  already records the failure reason on the `WebhookEvent` row
  (`process-webhook-event.ts:136-139`) and re-tries on the next 5-
  minute tick because the WHERE clause is `processed=false`. A
  separate DLQ table is a future call once we see real-world failure
  modes — speculating now is premature.
- **Did not add the missing memory files mentioned in the task
  brief** (`reference_inngest_is_the_live_fleet.md`,
  `feedback_leadership_runs_autonomously.md`,
  `feedback_push_verification_required.md`). None of them exist in
  `~/.claude/projects/C--agentplain/memory/` at the time of this
  audit (verified via the directory listing). Creating them without
  the canonical content would violate `feedback_no_guesses_no_estimates.md`.
  The principles those files presumably describe are already enforced
  by code: portability lives in `feedback_no_silent_vendor_lock.md`
  and `project_living_portable_architecture.md`; the existing
  `feedback_no_guesses_no_estimates.md` and the
  `chore(build-gate)` commit @ `311382c` cover the verification
  discipline.
