// Thin wrapper that runs an Inngest function body iff the per-function
// disable env var is not set to the literal "true". The primitive lives
// in `disable-flag.ts`; this wrapper threads it onto every cron handler
// so we have one place to add audit / metrics later (org-ops control
// plane lives at `lib/ops/inngest/control.ts`).
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
// future Inngest functions compose with. Keep it dependency-free so
// any function file can import without pulling Prisma, fetch, etc.

import { isFunctionDisabled } from "./disable-flag";

export interface DisableGateResult<T> {
  disabled: boolean;
  /** The handler return value when run; null when the gate short-circuited. */
  result: T | null;
}

export async function runWithDisableGate<T>(
  functionId: string,
  fn: () => Promise<T>,
  /** Optional environment override — tests pass a fixture; production
   *  callers omit this and the helper reads `process.env`. */
  env: NodeJS.ProcessEnv = process.env,
): Promise<DisableGateResult<T>> {
  if (isFunctionDisabled(functionId, env)) {
    return { disabled: true, result: null };
  }
  const result = await fn();
  return { disabled: false, result };
}
