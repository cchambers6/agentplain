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
 *   - Otherwise, and when `ANTHROPIC_API_KEY` is set → AnthropicProvider.
 *   - Otherwise → TestLlmProvider with no seed (heuristic mode), so the
 *     skill chain remains exercisable in environments that have not yet
 *     wired up Anthropic credentials.
 *
 * In every case the chosen inner provider is wrapped in a
 * `LoggingLlmProvider` so every call emits a `llm.usage` log line with
 * cache-hit metrics. Tests that want raw counts pull the inner provider
 * via `innerProvider()` or pass an unwrapped provider directly.
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
import { LoggingLlmProvider } from './logging-provider';
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
  // Compose the per-workspace token-budget governor in FRONT of the inner
  // provider so an over-budget call is blocked before it reaches the model
  // (no tokens spent, no `LlmUsageRecord` row written). The governor reads
  // the existing usage substrate + the pricing ladder — no new schema. See
  // `lib/billing/budget.ts` + the production+growth plan §2.
  //
  // Operator kill-switch: `LLM_BUDGET_ENFORCEMENT=off` disables the gate
  // entirely (the recorder + logging stay on) — the §9 "per-skill / global
  // kill-switch" ethos applied to the cost governor.
  const enforced = budgetEnforcementEnabled()
    ? new BudgetEnforcingLlmProvider(inner, persistBudgetGate)
    : inner;
  // The default factory wires the Prisma-backed usage recorder so every
  // workspace-tagged LLM call writes a `LlmUsageRecord` row used by the
  // customer billing usage pane + the daily Stripe-meter sweep. Tests
  // that don't want a DB write construct `LoggingLlmProvider` directly
  // or omit the `recorder` option.
  return new LoggingLlmProvider(enforced, { recorder: persistUsageRecorder });
}

/** Budget enforcement defaults ON. `LLM_BUDGET_ENFORCEMENT=off` is the
 *  operator kill-switch (only the BLOCK behavior is suppressed; usage is
 *  still recorded and the operator/customer surfaces still read live). */
function budgetEnforcementEnabled(): boolean {
  return process.env.LLM_BUDGET_ENFORCEMENT !== 'off';
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
export { LoggingLlmProvider } from './logging-provider';
export { BudgetEnforcingLlmProvider } from './budget-enforcing-provider';
