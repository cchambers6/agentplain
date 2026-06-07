/**
 * lib/llm/index.ts
 *
 * Domain-facing entrypoint for the LLM provider. Mirrors the structure
 * of `lib/integrations/index.ts`: a single `getLlmProvider()` that
 * returns the configured adapter, plus `resetLlmProviderForTests()` for
 * the test runner.
 *
 * Provider selection rule (per `feedback_no_silent_vendor_lock` +
 * `feedback_no_prod_secrets_in_dev`):
 *   - `LLM_PROVIDER=test` → always returns the TestLlmProvider.
 *   - Otherwise, when `ANTHROPIC_API_KEY` is set → AnthropicProvider.
 *   - Otherwise → TestLlmProvider with no seed (heuristic mode), so the
 *     skill chain remains exercisable in environments that have not yet
 *     wired up Anthropic credentials.
 *
 * The `sk-ant-PAUSED-…` sentinel (spend paused) is NOT handled here in the
 * inner-provider selection — it is handled by the `Sentinel` wrapper layer
 * (below), which short-circuits to `PAUSED` before the call reaches the
 * cache or the model. Keeping it in a wrapper (rather than swapping the
 * inner provider) is what lets it compose cleanly with the budget governor.
 *
 * In every case the chosen inner provider is wrapped in FOUR transparent
 * layers. The compose order is (innermost first):
 *
 *     Logging( Budget( Sentinel( Caching( inner ) ) ) )
 *
 *   1. `CachingLlmProvider` — auto-applies a prompt-cache breakpoint on the
 *      largest stable prefix (the system prompt) of every call that didn't
 *      already opt in, so caching is the default posture rather than a thing
 *      each skill re-derives. Disable with `LLM_PROMPT_CACHE=off`.
 *   2. `SentinelLlmProvider` — short-circuits to `PAUSED` when
 *      `ANTHROPIC_API_KEY` is the `sk-ant-PAUSED-…` sentinel, BEFORE the
 *      cache layer (the cache only matters if the call would actually
 *      happen) and the model (the doomed 401 round-trip is never burned).
 *      Returns the no-throw `llmError('PAUSED', …)` so the ~dozen existing
 *      callers degrade gracefully. Bypass with `LLM_SENTINEL_BYPASS=on`
 *      (a dev pointing a real key through the full stack).
 *   3. `BudgetEnforcingLlmProvider` — wraps sentinel+caching so an
 *      over-budget call is short-circuited BEFORE the sentinel/cache lookup
 *      (and before the model): no tokens spent, no cache read/write, no
 *      `LlmUsageRecord` row. Blocks only when the workspace has reached its
 *      operator-set explicit cap (`OVER`); `NO_CAP`/`OK` pass through and
 *      `WARN` is logged-but-allowed. Disable with `LLM_BUDGET_ENFORCEMENT=off`.
 *   4. `LoggingLlmProvider` (outermost) — emits a `llm.usage` log line with
 *      cache-hit metrics AND forwards usage to the Prisma `LlmUsageRecord`
 *      recorder. It wraps everything so the usage it observes already
 *      reflects the cache reads/writes the breakpoint produced, captures the
 *      paused/blocked outcomes, and is never written for a blocked call.
 * Tests that want raw counts pull the inner provider via `innerProvider()` or
 * pass an unwrapped provider directly.
 *
 * Budget short-circuits OUTSIDE sentinel deliberately: an over-budget
 * workspace shouldn't even reach the key check, and an unbudgeted call
 * (no workspace tag) passes the gate untouched and lands at the sentinel.
 *
 * This last rule is deliberate: PR-C ships *before* Conner has wired
 * `ANTHROPIC_API_KEY` to a budget — the heuristic test provider keeps
 * the value loop demonstrable on mock data without burning prod tokens.
 * Production-grade output kicks in the moment the key lands.
 */

import { persistBudgetGate } from '../billing/budget';
import { persistUsageRecorder } from '../billing/usage/recorder';
import { AnthropicProvider } from './anthropic-provider';
import { BudgetEnforcingLlmProvider } from './budget-enforcing-provider';
import { CachingLlmProvider } from './cache-wrapper';
import { LoggingLlmProvider } from './logging-provider';
import { SentinelLlmProvider } from './paused';
import { TestLlmProvider, TestLlmSeed } from './test-provider';
import type { LlmProvider } from './types';

let cached: LlmProvider | null = null;

export function resetLlmProviderForTests(provider?: LlmProvider): void {
  cached = provider ?? null;
}

export function getLlmProvider(): LlmProvider {
  if (cached) return cached;
  const built = buildProvider();
  cached = built;
  return built;
}

function buildProvider(): LlmProvider {
  const inner = buildInnerProvider();
  // Innermost: auto-cache the system prompt of any call that didn't opt in.
  // `LLM_PROMPT_CACHE=off` turns the wrapper into a pure pass-through (e.g. to
  // A/B the cost impact, or to debug a suspected cache invalidator).
  const cacheEnabled = process.env.LLM_PROMPT_CACHE !== 'off';
  const caching = new CachingLlmProvider(inner, { enabled: cacheEnabled });
  // Sentinel: when `ANTHROPIC_API_KEY` is the `sk-ant-PAUSED-…` sentinel
  // (spend paused), short-circuit to PAUSED BEFORE the cache layer and the
  // model — the doomed 401 round-trip is never burned and the cache never
  // wraps a credential guaranteed to fail. Returns the no-throw
  // `llmError('PAUSED', …)` so the ~dozen existing callers degrade gracefully.
  //
  // Dev kill-switch: `LLM_SENTINEL_BYPASS=on` disables the short-circuit so a
  // dev can push a real key through the full stack — the §9 kill-switch ethos,
  // matching `LLM_PROMPT_CACHE` / `LLM_BUDGET_ENFORCEMENT`.
  const sentinel = new SentinelLlmProvider(caching, {
    enabled: sentinelEnabled(),
  });
  // Middle: the per-workspace token-budget governor sits IN FRONT of the
  // sentinel + caching so an over-budget call is short-circuited before the
  // key check, the cache lookup, and the model — no tokens spent, no cache
  // read/write, no `LlmUsageRecord` row. It throttles only on the operator-set
  // explicit cap (`OVER`); see `lib/billing/budget.ts` + the production+growth
  // plan §2.
  //
  // Operator kill-switch: `LLM_BUDGET_ENFORCEMENT=off` disables the gate
  // entirely (the recorder + sentinel + caching + logging stay on) — the §9
  // "per-skill / global kill-switch" ethos applied to the cost governor.
  const enforced = budgetEnforcementEnabled()
    ? new BudgetEnforcingLlmProvider(sentinel, persistBudgetGate)
    : sentinel;
  // Outermost: the default factory wires the Prisma-backed usage recorder so
  // every workspace-tagged LLM call writes a `LlmUsageRecord` row used by the
  // customer billing usage pane, the per-skill cache-hit-rate panel on
  // /operator/integrations, and the daily Stripe-meter sweep. Tests that
  // don't want a DB write construct `LoggingLlmProvider` directly or omit the
  // `recorder` option.
  return new LoggingLlmProvider(enforced, { recorder: persistUsageRecorder });
}

/** Budget enforcement defaults ON. `LLM_BUDGET_ENFORCEMENT=off` is the
 *  operator kill-switch (only the BLOCK behavior is suppressed; usage is
 *  still recorded and the operator/customer surfaces still read live). */
function budgetEnforcementEnabled(): boolean {
  return process.env.LLM_BUDGET_ENFORCEMENT !== 'off';
}

/** The sentinel short-circuit defaults ON. `LLM_SENTINEL_BYPASS` set to an
 *  on-ish value (`on` / `1` / `true`) disables it so a dev can point a real
 *  key through the full stack even in an env that would otherwise read a
 *  paused sentinel. Unset (or `off`) keeps the short-circuit active. */
function sentinelEnabled(): boolean {
  const v = process.env.LLM_SENTINEL_BYPASS;
  return v !== 'on' && v !== '1' && v !== 'true';
}

function buildInnerProvider(): LlmProvider {
  const mode = process.env.LLM_PROVIDER;
  if (mode === 'test') {
    return new TestLlmProvider();
  }
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (apiKey && apiKey.length > 0) {
    return new AnthropicProvider({
      apiKey,
      defaultModel: process.env.ANTHROPIC_MODEL,
    });
  }
  // Fall through to the heuristic test provider — the skill chain stays
  // runnable for mock-fixture validation. The runner logs which provider
  // is active so a "why are my drafts terrible" moment is one log-line
  // away from the answer.
  return new TestLlmProvider();
}

export function makeTestLlmProvider(seed?: TestLlmSeed): TestLlmProvider {
  return new TestLlmProvider(seed);
}

export type {
  LlmProvider,
  LlmCompletionRequest,
  LlmCompletion,
  LlmContent,
  LlmContentBlock,
  LlmRequestMeta,
  LlmUsage,
  LlmResult,
  LlmError,
  LlmErrorCode,
} from './types';
export { llmOk, llmError, flattenContent, hasCacheableBlock } from './types';
export { TestLlmProvider, digestRequest } from './test-provider';
export { AnthropicProvider } from './anthropic-provider';
export { CachingLlmProvider, autoCacheRequest, DEFAULT_MIN_SYSTEM_CHARS } from './cache-wrapper';
export { LoggingLlmProvider } from './logging-provider';
export { BudgetEnforcingLlmProvider } from './budget-enforcing-provider';
export {
  SentinelLlmProvider,
  PausedLlmProvider,
  LlmPausedError,
  isPausedApiKey,
  PAUSED_API_KEY_PREFIX,
} from './paused';
