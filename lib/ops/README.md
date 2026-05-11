# `lib/ops` — org-ops-management adapter layer

First concrete piece of `capability_inbox.md` proposal #12. A uniform
control-plane interface (`OpsControlPlane`) plus the first two provider
adapters (GitHub Actions Variables, Inngest) and an in-memory adapter for
tests + dry-run.

## Why this exists

Previously the only way to throttle non-essential cron load was clicking
through GitHub Settings + the Inngest Cloud dashboard by hand. That's:

- Not auditable (no record of who flipped what when).
- Not scriptable (no way to wire it into the org-ops-management agent).
- Not portable (re-implementing the click-path for Vercel, Anthropic
  Console, Stripe Console multiplies the surface).

`OpsControlPlane` collapses every "I need to flip a state on a vendor I
don't fully control" operation behind a single typed interface. Every
mutation goes through the same audit log. Every adapter passes the same
contract test suite.

This is a **first slice**. The full proposal #12 also includes:

- a secrets vault (so credentials stop living in `.env.local`);
- additional provider adapters (Vercel, Anthropic Console, Stripe
  Console);
- the org-ops-management agent itself (the consumer of these adapters);
- a Postgres-backed `ops_audit_log` table (replacing the markdown file).

Those are explicitly **out of scope** for this slice. They will land in
follow-on PRs against the same `OpsControlPlane` contract — the contract
is the load-bearing primitive.

## Contract

```ts
import { OpsControlPlane, OpsResult } from '@/lib/ops/types'
```

Every method returns `OpsResult<T>` — a discriminated union of
`{ ok: true, value }` and `{ ok: false, error }`. **No method throws on
network or vendor errors** — only on programmer error (bad config,
invalid argument before any I/O).

| Method | Purpose |
| --- | --- |
| `getRepoVariable(key)` | Read a GitHub Actions repository variable. `NOT_FOUND` is a normal "first run" signal, not an error. |
| `setRepoVariable(key, value)` | Create-or-update a GitHub Actions repository variable. Caller is expected to read back via `getRepoVariable` to verify (per `feedback_verify_after_create`); the CLI does that automatically. |
| `pauseInngestFunction(fnId)` | Stop an Inngest function from firing. Backed by the in-house env-var flag pattern (see "Inngest control via in-house flag" below). |
| `resumeInngestFunction(fnId)` | Reverse of pause. Sets the flag to `"false"` (rather than deleting) so both states are observable. |
| `getInngestFunctionStatus(fnId)` | Reads the flag back from Vercel; returns `paused`/`active`/`unknown`. |

## Adapters

| File | What it implements | Status |
| --- | --- | --- |
| `lib/ops/github/actions-vars.ts` | Repo variable CRUD via GitHub REST `/repos/{owner}/{repo}/actions/variables`. Returns `NOT_IMPLEMENTED` for Inngest methods (composition signal). | Production. Used by the bridge throttle CLI. |
| `lib/ops/inngest/control.ts` | Pause/resume/status implemented via `INNGEST_FN_DISABLE_*` env vars on the Vercel project (POST `/v9/projects/{id}/env?upsert=true`). Returns `NOT_IMPLEMENTED` for repo-variable methods (composition signal). | Production. Used by the throttle CLI. |
| `lib/ops/test-ops.ts` | Full in-memory implementation for tests + `--dry-run`. Satisfies `feedback_runner_portability`'s two-implementation rule. | Production-quality (used by contract tests). |

### Inngest control via in-house flag

Inngest does not publicly expose a REST API for pausing/resuming
functions. Per https://www.inngest.com/docs/guides/pause-functions
(checked 2026-05-10) pause is exclusively a Cloud-UI operation. Rather
than wait for an upstream API, this repo ships the kill-switch in-house
per `capability_inbox.md` proposal #13:

- **Each Inngest function in `lib/inngest/functions/*.ts` is wrapped at
  handler entry with `runWithDisableGate` (lib/inngest/run-skill.ts).
  The gate calls `isFunctionDisabled(cron.id)` (lib/inngest/disable-flag.ts),
  which reads the env var `INNGEST_FN_DISABLE_<NORMALIZED_ID>`.**
- When set to the literal string `"true"`, the function fires but
  records a `disabled` CronRun row and returns without doing the
  expensive work (no Anthropic call, no Notion write, no memory load).
- Any other value (`"false"`, unset, `"True"`, `"1"`, `"yes"`) means
  the function runs normally. Strict equality, not coercion — a typo
  defaults to active rather than accidentally pausing the function.
- The Vercel REST API edits these env vars
  (lib/ops/inngest/control.ts → POST `/v9/projects/{id}/env?upsert=true`,
  GET `/v9/projects/{id}/env`). Same `OpsControlPlane` contract as the
  GitHub adapter; same audit log; same parameterized contract test.

Naming convention — never deviate (the disable-flag helper computes
this name; the adapter writes that name; the function reads that name):

| Inngest function id | Env var name |
| --- | --- |
| `flatsbo-capability-builder-morning` | `INNGEST_FN_DISABLE_FLATSBO_CAPABILITY_BUILDER_MORNING` |
| `flatsbo-chief-of-staff-daily-brief` | `INNGEST_FN_DISABLE_FLATSBO_CHIEF_OF_STAFF_DAILY_BRIEF` |
| `flatsbo-listing-coord-readiness-sweep` | `INNGEST_FN_DISABLE_FLATSBO_LISTING_COORD_READINESS_SWEEP` |
| `flatsbo-b2b-sales-rep-daily-pre-call-brief` | `INNGEST_FN_DISABLE_FLATSBO_B2B_SALES_REP_DAILY_PRE_CALL_BRIEF` |
| `flatsbo-b2b-sales-rep-daily-reply-sweep` | `INNGEST_FN_DISABLE_FLATSBO_B2B_SALES_REP_DAILY_REPLY_SWEEP` |
| `flatsbo-business-manager-daily` | `INNGEST_FN_DISABLE_FLATSBO_BUSINESS_MANAGER_DAILY` |
| `flatsbo-tech-lead-daily` | `INNGEST_FN_DISABLE_FLATSBO_TECH_LEAD_DAILY` |

Per `feedback_no_silent_vendor_lock` + `project_living_portable_architecture`:
the in-house flag survives any future Inngest API addition. If Inngest
ships a real pause API tomorrow, only `lib/ops/inngest/control.ts`
changes — the gate, the helper, the function handlers, the throttle
CLI, and the contract tests stay put.

## Adding a new provider adapter

Pattern (will be followed by Vercel, Anthropic Console, Stripe Console):

1. Create `lib/ops/<provider>/<surface>.ts`.
2. Export a class implementing `OpsControlPlane`.
3. Constructor takes per-instance config (account id, environment,
   override fetch). Identity NEVER comes from `process.env` directly —
   the adapter receives it from the caller. Credentials may default to
   env (today) but accept explicit overrides (so multiple FlatSBO /
   B2B / agentplain instances can co-exist).
4. Methods that don't apply to this provider return
   `opsError('NOT_IMPLEMENTED', '<provider> does not surface
   <capability>; compose with <peer adapter>')`.
5. Add the new adapter to the parameterized contract test in
   `lib/ops/__tests__/contract.test.ts` so the shared invariants run.
6. If the adapter introduces new failure modes, add codes to
   `OpsErrorCode` in `lib/ops/types.ts` (don't stringly-type them).

## Credentials & where they live

| Surface | Today (this PR) | Tomorrow (proposal #12 follow-on) |
| --- | --- | --- |
| GitHub Actions Variables | `GH_PAT` env var (preferred) or `GITHUB_TOKEN`. **In `.env.local` MUST be a dev-tier PAT scoped to non-production repos** per `feedback_no_prod_secrets_in_dev`. Production value lives in Vercel Production env tier only. | Secrets vault — adapter reads via `vault.get('github_actions_pat')` instead of `process.env`. |
| Vercel project env API (drives Inngest disable flags) | `VERCEL_TOKEN` env var + `VERCEL_PROJECT_ID` (matches what `vercel link` writes). `VERCEL_TEAM_ID` optional. **`VERCEL_TOKEN` is an account-level secret per `feedback_no_prod_secrets_in_dev`.** Production environments use a Vercel-managed CI token that lives ONLY in Production tier (never in Preview or Dev). Local dev should use a SEPARATE scoped token (Vercel → Account Settings → Tokens; scope to a specific project, prefer read-only or limited project access if the dev workflow only needs `getInngestFunctionStatus`). Never share the same token across tiers. | Secrets vault — adapter reads via `vault.get('vercel_admin_token')`. |

The vault is a separate piece of proposal #12. It's NOT shipped here.
The adapters fall back to env so the CLI runs today, and will be
re-pointed at the vault when it lands.

## Using from the CLI

```sh
# Show the three subcommands and credential requirements
npx tsx scripts/ops/throttle.ts --help

# Pause the non-essential cron load — flips USE_GHA_CRON=false on the
# repo (one flag pauses all 5 GHA crons) AND sets
# INNGEST_FN_DISABLE_FLATSBO_CAPABILITY_BUILDER_MORNING=true on the
# Vercel project (gates the Inngest function at handler entry).
# Does NOT touch flatsbo-chief-of-staff-daily-brief (Conner needs the
# morning brief).
npx tsx scripts/ops/throttle.ts pause-non-essential

# Reverse it
npx tsx scripts/ops/throttle.ts resume-non-essential

# Read-only: print observed state of repo var + Inngest pause states
# (read directly from Vercel env)
npx tsx scripts/ops/throttle.ts status
```

If `VERCEL_TOKEN` or `VERCEL_PROJECT_ID` is missing, the Inngest piece
is SKIPPED and a structured `AUTH_MISSING` blocker is recorded in the
audit log — never a fake success. Same pattern as the GH adapter: half
a credential set means half a state mutation, surfaced honestly.

Every subcommand:

- mutates state through the adapter (or calls the read-only API);
- reads back from the adapter to verify the observed result;
- appends an audit row containing the **observed** state (not the
  intended state) plus any structured blockers;
- exits 0 only when there were zero blockers.

## Audit log

`memory/agent-state/ops_audit_log.md`. Append-only markdown. One section
per CLI invocation, structured as:

```markdown
## <ISO-8601 timestamp> — <subcommand>

**Observed (read-back):**
- <key>: `<observed value>`

**Blockers / open errors:**
- <structured error message>
```

The "observed" block is the source of truth. The blocker block surfaces
non-fatal issues (missing creds, NOT_IMPLEMENTED stubs, rate-limit
backoffs) so the next operator (human or agent) sees them immediately.

When the org-ops-management agent ships, this markdown file becomes a
Postgres `ops_audit_log` table. The schema mirrors the markdown shape —
migration is mechanical.

## Tests

```sh
# Just the ops contract tests
node --import tsx --test lib/ops/__tests__/contract.test.ts

# Full repo
npm test
```

The contract test suite is **parameterized over every adapter that
claims to support the operation**. Adding a new adapter that supports
`pause/resume` automatically runs the round-trip test against it; an
adapter that does not gets the `NOT_IMPLEMENTED` assertion path. This
means we cannot accidentally regress the contract on any adapter.

## Why this didn't get patched manually

Per `feedback_no_quick_fixes`: Conner explicitly chose this
adapter-layer path over manual UI clicks because every line in this
directory is load-bearing for the long-term shape of proposal #12. A
five-minute Settings-UI click would have solved today's bridge throttle
once; the adapter solves it forever, for every future provider, with
audit + composition + tests baked in.
