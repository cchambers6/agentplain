/**
 * lib/llm/budget-enforcing-provider.ts
 *
 * Transparent gate that sits in front of the real LLM provider and blocks a
 * completion when the calling workspace has reached its operator-set monthly
 * token cap. Wraps the inner provider; the default factory composes it as
 *
 *   Logging( BudgetEnforcing( Caching( inner ) ), { recorder } )
 *
 * i.e. budget wraps caching, so an OVER-budget call:
 *   - never reaches the cache lookup or the model (no tokens spent),
 *   - writes NO `LlmUsageRecord` row (the recorder only fires on a successful
 *     completion with usage), and
 *   - is logged by the logging wrapper as `ok:false, error_code: OVER_BUDGET`.
 *
 * Per `feedback_no_silent_vendor_lock` + `feedback_runner_portability`: this
 * is a provider-neutral wrapper. It imports the `BudgetGate` *type* from the
 * billing seam (a plain callback) — never Prisma, never the Anthropic SDK —
 * so it composes with any current or future provider and tests pin a stub
 * gate without standing up a DB.
 *
 * Per the no-throw adapter convention (`lib/llm/types.ts`): enforcement
 * surfaces as a typed `llmError('OVER_BUDGET', ...)` result, not a thrown
 * exception, so every existing call site that already handles the discriminated
 * union degrades gracefully (no draft this cycle) instead of crashing. Callers
 * that want the "raise + queue for operator review" semantics check for the
 * `OVER_BUDGET` code (or use `WorkspaceOverBudgetError` from
 * `lib/billing/budget.ts`).
 */

import type { BudgetGate } from '../billing/budget';
import { llmError } from './types';
import type {
  LlmCompletion,
  LlmCompletionRequest,
  LlmProvider,
  LlmResult,
} from './types';

export class BudgetEnforcingLlmProvider implements LlmProvider {
  private readonly inner: LlmProvider;
  private readonly gate: BudgetGate;

  constructor(inner: LlmProvider, gate: BudgetGate) {
    this.inner = inner;
    this.gate = gate;
  }

  /** Delegate the provider identity to the wrapped provider so downstream
   *  code that branches on `provider.name` (e.g. startup logging) is
   *  unaffected by the gate. */
  get name(): LlmProvider['name'] {
    return this.inner.name;
  }

  async complete(
    request: LlmCompletionRequest,
  ): Promise<LlmResult<LlmCompletion>> {
    const decision = await this.evaluate(request);
    if (decision === 'BLOCK') {
      const workspaceId = request.meta?.workspaceId ?? 'unknown';
      return llmError(
        'OVER_BUDGET',
        `Workspace ${workspaceId} has reached its monthly token budget; ` +
          `this call was not sent to the model. It will be retried after the ` +
          `monthly reset or once an operator raises the budget.`,
        { reference: 'workspace_over_budget' },
      );
    }
    return this.inner.complete(request);
  }

  /** Run the gate, failing OPEN on any gate error (defense in depth — the
   *  production gate already fails open internally, but a stub gate that
   *  throws must never break the value loop). Returns 'BLOCK' only on an
   *  explicit OVER decision. */
  private async evaluate(
    request: LlmCompletionRequest,
  ): Promise<'ALLOW' | 'BLOCK'> {
    try {
      const decision = await this.gate(request.meta);
      return decision.outcome === 'BLOCK' ? 'BLOCK' : 'ALLOW';
    } catch {
      return 'ALLOW';
    }
  }
}
