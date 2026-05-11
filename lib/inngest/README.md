# `lib/inngest` — Inngest cron functions for the FlatSBO + B2B fleet

Each file in `functions/*.ts` registers one Inngest function. Most are
pure cron triggers; a couple add ad-hoc event triggers (see
`flatsbo-business-manager-daily.ts` and `flatsbo-tech-lead-daily.ts`
for the signal taxonomy). All of them go through the shared `runSkill`
runner in `run-skill.ts`, which is the single source of truth for the
firing lifecycle (CronRun row → memory pre-load → Anthropic call →
optional Notion write → verify-after-create → status update).

## Disable-flag wrapping (PR-blocker rule)

**Every new Inngest function MUST wrap its handler body with
`runWithDisableGate`.** No exceptions. This is enforced by code review
because there is no static check that catches an un-gated function
until it fires.

```ts
import { runWithDisableGate, type CronDefinition } from '@/lib/inngest/run-skill';

const def: CronDefinition = {
  id: 'flatsbo-something-new',  // Must be unique across the fleet.
  // ...
};

export const somethingNew = inngest.createFunction(
  { id: def.id, name: def.name, triggers: [{ cron: def.cron }] },
  async ({ runId, step }) => runWithDisableGate(def, runId, step),
);
```

The gate:

- Reads `process.env.INNGEST_FN_DISABLE_<NORMALIZED_ID>` via
  `lib/inngest/disable-flag.ts`. Normalization: dashes → underscores,
  letters → upper-case.
  (`flatsbo-something-new` →
  `INNGEST_FN_DISABLE_FLATSBO_SOMETHING_NEW`.)
- If the env var is the literal string `"true"`, writes a `disabled`
  CronRun row and returns immediately. **No Anthropic call. No Notion
  write. No memory pre-load.** The expensive work is gated, not just
  the side effects.
- Any other value (unset, `"false"`, `"True"`, `"1"`, `"yes"`) lets
  the function run normally. Strict equality, not coercion.

The flag is written by `lib/ops/inngest/control.ts` via the Vercel REST
API. The `scripts/ops/throttle.ts` CLI is the operator-facing surface.

Per `capability_inbox.md` proposal #13. The pattern survives any future
Inngest API addition: when Inngest ships a real pause API, only the
adapter changes — the gate, the helper, the function handlers, and the
contract tests stay put.

## Why the gate is at handler entry, not inside `runSkill`

We deliberately wrap *outside* `runSkill` so `step.run('skipped-disabled', ...)`
shows up as its own Inngest step. That makes the no-op visible in the
Inngest dashboard's run list (operators see "fired but skipped" rather
than guessing). It also keeps the disabled-side bookkeeping cheap — no
memory load, no API calls.

## Files

| File | Role |
| --- | --- |
| `client.ts` | Singleton Inngest client (id `flatsbo-prod`). |
| `run-skill.ts` | Shared SKILL runner + `runWithDisableGate` + `recordDisabledRun`. |
| `disable-flag.ts` | Pure helper — env-var name normalization + check. No DB, no fetch. Imported by run-skill, the Vercel adapter, and tests. |
| `functions/*.ts` | One file per Inngest function. Each wraps `runWithDisableGate`. |

## Tests

```sh
# Disable-flag unit tests
node --import tsx --test lib/inngest/__tests__/disable-flag.test.ts

# Smoke test of the gate wired into capability-builder-morning
node --import tsx --test lib/inngest/__tests__/disable-gate.smoke.test.ts

# Full repo
npm test
```

The smoke test exercises both gate paths against a real wrapped
function. If you change the wrapping pattern in any
`functions/*.ts`, run that test before pushing.
