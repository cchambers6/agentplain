// Thin wrapper that runs an Inngest function body iff the per-function
// disable flag is not set to the literal "true". The flag is now
// DB-backed (P0-4) — read from the `OpsFlag` table on every invocation
// so a pause takes effect on the NEXT cron tick. The env-var path
// remains as a cold-start cache / fallback for the case the DB is
// unreachable, preserving the prior strict-equality semantic.
//
// Why the gate reads on every invocation (no in-process TTL cache):
// the correctness bar is "a pause takes effect within one tick." A
// stale cache could keep firing for the cache TTL after the operator
// flipped the flag — exactly the lag this PR exists to remove. The
// underlying read is a single indexed PK lookup, dwarfed by anything
// the function body does, so the unconditional read is the right
// trade. If cron call volume ever climbs high enough to matter, layer
// the cache at the store level rather than at the gate.
//
// Cron functions look like:
//
//   inngest.createFunction(
//     { id: "agentplain-trial-warnings" },
//     { cron: "0 10 * * *" },
//     async (ctx) =>
//       runWithDisableGate("agentplain-trial-warnings", () => doWork(ctx)),
//   );
//
// Per project_state PR-B notes: this helper is the ~30 LOC seam that
// every Inngest function composes with. The flag-store interface
// (`lib/ops/flag-store`) is dependency-free at the type level — Prisma
// is only pulled in when the lazy default store is constructed on
// first invocation, so this module stays edge-runtime importable.

import { isFunctionDisabled, disableFlagEnvName } from "./disable-flag";
import type { OpsFlagStore } from "../ops/flag-store";

export interface DisableGateResult<T> {
  disabled: boolean;
  /** Where the disable decision came from: `'db'` when the OpsFlag row
   *  drove it, `'env'` when the env fallback drove it. Useful for tests
   *  + future observability ("are we still relying on the env cache?"). */
  source: "db" | "env";
  /** The handler return value when run; null when the gate short-circuited. */
  result: T | null;
}

export interface RunWithDisableGateOptions {
  /**
   * DB-backed flag store. Defaults — only at first call time, never at
   * module load — to a `PrismaOpsFlagStore`. Tests pass an
   * `InMemoryOpsFlagStore` to bypass Prisma entirely.
   *
   * A lazy default keeps this module importable from edge runtimes that
   * cannot construct Prisma at load time; the production store is only
   * built on the first cron / webhook invocation that runs in a Node.js
   * Inngest worker.
   */
  flagStore?: OpsFlagStore;
  /**
   * Environment snapshot for the cold-start cache / fallback. Defaults
   * to `process.env`. Tests pass a fixture.
   */
  env?: NodeJS.ProcessEnv;
}

/**
 * Lazily-constructed default Prisma store. We import it dynamically so a
 * test that passes `flagStore` never touches `@prisma/client` and so the
 * top-level module graph stays edge-safe.
 */
let _defaultFlagStore: OpsFlagStore | null = null;
async function getDefaultFlagStore(): Promise<OpsFlagStore> {
  if (_defaultFlagStore) return _defaultFlagStore;
  const { PrismaOpsFlagStore } = await import("../ops/prisma-flag-store");
  _defaultFlagStore = new PrismaOpsFlagStore();
  return _defaultFlagStore;
}

/** Test-only hook: reset the lazily-constructed default store so a unit
 *  test can re-prime it. NOT for production callers. */
export function __resetDefaultFlagStoreForTests(): void {
  _defaultFlagStore = null;
}

export async function runWithDisableGate<T>(
  functionId: string,
  fn: () => Promise<T>,
  options: RunWithDisableGateOptions = {},
): Promise<DisableGateResult<T>> {
  const env = options.env ?? process.env;
  const store = options.flagStore ?? (await getDefaultFlagStore());

  // ─── DB-first ────────────────────────────────────────────────────
  // The OpsFlag row keyed by the env-var name (e.g.
  // INNGEST_FN_DISABLE_AGENTPLAIN_TRIAL_WARNINGS) is the source of
  // truth. A row with value === 'true' pauses the function; any other
  // value treats the function as active (matches the env semantic so
  // operators reading the DB see the same string they would write to
  // env).
  const flagName = disableFlagEnvName(functionId);
  const dbRead = await store.get(flagName);
  if (dbRead.ok && dbRead.value !== null) {
    if (dbRead.value.value === "true") {
      return { disabled: true, source: "db", result: null };
    }
    // Explicit DB row says "not disabled" — honor it; skip env. A row
    // with any other value short-circuits the fallback so an operator
    // who wrote `value: 'false'` cannot be silently overridden by a
    // stale env entry.
    const result = await fn();
    return { disabled: false, source: "db", result };
  }

  // ─── Env fallback ────────────────────────────────────────────────
  // DB has no row OR the read failed (UPSTREAM_ERROR). Fall back to the
  // env-var cold-start cache so the system stays in a known state when
  // the DB is unreachable. The strict-equality semantic from
  // `disable-flag.ts` is preserved by construction.
  if (isFunctionDisabled(functionId, env)) {
    return { disabled: true, source: "env", result: null };
  }
  const result = await fn();
  return { disabled: false, source: "env", result };
}
