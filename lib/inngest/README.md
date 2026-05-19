# `lib/inngest` — Inngest cron functions for agentplain

Inngest is the live cron + event runtime for agentplain. Each file in
`functions/*.ts` registers one Inngest function with the singleton client
(`client.ts`, app id `agentplain-prod`). The serve route at
`app/api/inngest/route.ts` is the registration surface that Inngest Cloud
hits at GET (introspection / handshake) and POST (per-invocation
delivery).

## Currently registered functions

Single source of truth: the `functions: [...]` array in
`app/api/inngest/route.ts`. As of 2026-05-18:

| Function id | File | Trigger | Disable env var |
| --- | --- | --- | --- |
| `agentplain-trial-warnings` | `functions/trial-expiration-warnings.ts` | cron `0 10 * * *` (UTC; ~06:00 ET) | `INNGEST_FN_DISABLE_AGENTPLAIN_TRIAL_WARNINGS` |
| `agentplain-integration-renewal-sweep` | `functions/integration-renewal-sweep.ts` | cron `0 */2 * * *` | `INNGEST_FN_DISABLE_AGENTPLAIN_INTEGRATION_RENEWAL_SWEEP` |
| `agentplain-process-webhook-event` | `functions/process-webhook-event.ts` | cron `*/5 * * * *` + on-demand event `agentplain/process-webhook-event.requested` | `INNGEST_FN_DISABLE_AGENTPLAIN_PROCESS_WEBHOOK_EVENT` |

**Adding a function = touch two files:** create
`functions/<name>.ts` and import + push the exported function symbol
into `app/api/inngest/route.ts`'s `functions: [...]` array. The unit
test in `functions/__tests__/process-webhook-event.test.ts` shows the
pattern for pinning registration shape so a future revert that drops a
function from the array fails the suite before it fails an operator.

## Disable-flag wrapping (PR-blocker rule)

**Every Inngest function MUST wrap its handler body with
`runWithDisableGate`.** No exceptions. There is no static check that
catches an un-gated function until it fires, so this is enforced by
code review.

```ts
import { inngest } from '../client';
import { runWithDisableGate } from '../run-with-disable-gate';

export const SOMETHING_NEW_FUNCTION_ID = 'agentplain-something-new';
export const SOMETHING_NEW_CRON = '*/15 * * * *';

export const somethingNewFn = inngest.createFunction(
  {
    id: SOMETHING_NEW_FUNCTION_ID,
    name: 'agentplain something new',
    triggers: [{ cron: SOMETHING_NEW_CRON }],
  },
  async () =>
    runWithDisableGate(SOMETHING_NEW_FUNCTION_ID, () => doWork()),
);
```

The gate (`run-with-disable-gate.ts` + `disable-flag.ts`):

- Reads `process.env.INNGEST_FN_DISABLE_<NORMALIZED_ID>`. Normalization:
  dashes → underscores, ASCII letters → upper-case. Example:
  `agentplain-trial-warnings` → `INNGEST_FN_DISABLE_AGENTPLAIN_TRIAL_WARNINGS`.
- If the env var is the literal string `"true"`, returns
  `{ disabled: true, result: null }` immediately. **The expensive work
  is gated, not just the side effects** (no DB query, no provider
  call).
- Any other value (unset, `"false"`, `"True"`, `"1"`, `"yes"`) lets the
  function run normally. Strict equality, not coercion — a typo
  defaults to active, never to silently paused.

The flag is written on Vercel via the Vercel REST API by
`lib/ops/inngest/control.ts`. The contract tests in
`lib/ops/__tests__/contract.test.ts` cover the pause/resume round-trip
against a fake Vercel fetch.

## Why the gate is at handler entry

We wrap *outside* any per-function business logic so a paused function
still fires (Inngest delivers the invocation), but the body short-
circuits in O(1). That keeps the no-op visible in the Inngest
dashboard's run list (operators see "fired but skipped" rather than
guessing) and keeps the disabled-side bookkeeping cheap.

## Files

| File | Role |
| --- | --- |
| `client.ts` | Singleton Inngest client (id `agentplain-prod`). Reads `INNGEST_EVENT_KEY` from env. |
| `run-with-disable-gate.ts` | Thin (~40 LOC) wrapper that gates handler bodies on `INNGEST_FN_DISABLE_*`. Dependency-free (no Prisma, no fetch) so it imports cleanly from edge runtimes and tests. |
| `disable-flag.ts` | Pure helper — env-var name normalization + check. Imported by the gate, the Vercel adapter, and tests. |
| `functions/*.ts` | One file per Inngest function. Each wraps `runWithDisableGate`. |
| `__tests__/disable-flag.test.ts` | Unit tests for the normalization rule. |
| `functions/__tests__/*.test.ts` | Per-function tests pinning cron metadata + serve-route registration shape. |

## Verifying health in prod / preview

The serve route's GET responds with a 200 + an introspection JSON
listing every registered function. After a push:

```sh
curl -fsS https://<deployment-url>/api/inngest | jq
```

A 200 with the three function ids in the response body proves the
registration is live. The Inngest Cloud dashboard's "Functions" page
should show the same set with their cron schedules. If the GET 200s
but Inngest Cloud shows zero functions, the deployment has the wrong
`INNGEST_SIGNING_KEY` or `INNGEST_EVENT_KEY` and the registration
handshake never completed.

For a synthetic end-to-end proof of `processWebhookEventFn`, see the
recipe in `docs/inngest-health-2026-05-18.md`.

## Tests

```sh
# Disable-flag unit tests
node --import tsx --test lib/inngest/__tests__/disable-flag.test.ts

# Per-function metadata + registration-shape tests
node --import tsx --test lib/inngest/functions/__tests__/*.test.ts

# Full repo
npm test
```

If you change the wrapping pattern in any `functions/*.ts`, re-run the
per-function tests — they pin the registration contract.
