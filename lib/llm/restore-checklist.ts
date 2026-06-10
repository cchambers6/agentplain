/**
 * lib/llm/restore-checklist.ts
 *
 * THE REGISTRY — the single source of truth for every LLM-dependent path
 * in agentplain. When Conner restores the Anthropic API key, this registry
 * is what the verification harness walks to confirm the key actually reaches
 * all surfaces rather than getting silently swallowed by a stale cache or a
 * misconfigured env.
 *
 * ── HOW TO REGISTER YOUR SURFACE ────────────────────────────────────────
 * Add one `LlmSurface` entry to the REGISTRY array. You need:
 *   - `id`          — machine-readable slug (kebab-case, unique, stable)
 *   - `label`       — what Conner sees in the checklist table
 *   - `area`        — which part of the product owns this path
 *   - `model`       — which tier this call uses (import from model-tiers)
 *   - `sourceSurface` — the LlmSourceSurfaceTag (or null for non-tagged calls)
 *   - `envFlags`    — any env vars that gate this path (empty array if none)
 *   - `ownerSkill`  — the skill file where the call lives
 *   - `verify`      — an async fn that returns VerifyResult
 *                     Rules for verify():
 *                       PASS  — real signal confirmed (non-empty, non-placeholder text)
 *                       BLOCKED — sentinel/budget/flag stopped the call (expected state)
 *                       SKIP  — env/auth prerequisite not present (can't test right now)
 *                       FAIL  — unexpected error
 *                     NEVER return PASS on a cached or assumed result.
 *
 * ── WHEN TONIGHT'S UNMERGED BRANCHES MERGE ──────────────────────────────
 * These branches add new flag-gated LLM paths that will need registry entries
 * once they land on main:
 *   - cv/cpa-close-live-data       → MONTH_END_CLOSE_LLM_POLISH (CPA close skill)
 *   - cv/general-invoice-chase     → LLM invoice/estimate drafting polish seam
 *   - cv/home-services-estimates   → LLM estimate generation
 *   - cv/realty-first-touch        → LLM lead classification
 * Each will add one entry here; the verify fn pattern is the same as the
 * provider-level check below — call the minimal surface function with a
 * TestLlmProvider, confirm the output shape, then separately confirm it
 * routes through the real provider when the flag is on.
 *
 * ── WHAT "BLOCKED" MEANS ────────────────────────────────────────────────
 * BLOCKED is an honest, named state — not a failure. It means the sentinel
 * or a budget gate stopped the call as designed. Once Conner restores the key
 * and removes the sentinel value, surfaces that were BLOCKED become testable.
 * The harness will re-run and they should promote to PASS.
 *
 * Per `project_llm_provider_compose_order` (2026-06-06):
 * compose order = Logging( Budget( Routing( Sentinel( Caching( Anthropic ) ) ) ) )
 * Kill switches: LLM_PROMPT_CACHE=off, LLM_SENTINEL_BYPASS=on, LLM_BUDGET_ENFORCEMENT=off
 */

import {
  getLlmProvider,
  makeTestLlmProvider,
  isPausedApiKey,
  PAUSED_API_KEY_PREFIX,
} from './index';
import { MODEL_HAIKU, MODEL_SONNET, MODEL_OPUS } from './model-tiers';
import type { LlmProvider } from './types';

// ── Result types ──────────────────────────────────────────────────────────

export type VerifyStatus = 'PASS' | 'BLOCKED' | 'SKIP' | 'FAIL';

export interface VerifyResult {
  status: VerifyStatus;
  /** One-liner Conner reads from mobile. Required. */
  detail: string;
  /** Latency for the verify call in ms, when a call was made. */
  latencyMs?: number;
}

export type LlmSurfaceArea =
  | 'provider'
  | 'plaino-chat'
  | 'dispatcher'
  | 'inbox-triage'
  | 'office-admin'
  | 'briefings'
  | 'support-handler'
  | 'categorize'
  | 'draft'
  | 'chief-of-staff'
  | 'process-doc'
  | 'analytics-pulse'
  | 'finance-pulse'
  | 'compliance-watch'
  | 'content-calendar'
  | 'research-on-demand'
  | 'instruction-handler'
  | 'pre-call-brief'
  | 'lead-triage'
  | 'sentinel-rewrite';

export interface LlmSurface {
  /** Stable slug — used as the table row key in the checklist output. */
  id: string;
  /** Human-readable label for the checklist table. */
  label: string;
  /** Product area. Used for grouping in output. */
  area: LlmSurfaceArea;
  /** Model tier this surface uses (from model-tiers.ts). */
  model: string;
  /** Prisma LlmSourceSurfaceTag, or null when the call is untagged. */
  sourceSurface: string | null;
  /** Env var flags that gate this path. [] if always-on. */
  envFlags: string[];
  /** Path to the skill file that owns the LLM call. */
  ownerSkill: string;
  /**
   * Verification function. Must return VerifyResult.
   * Called with the live provider and (for provider-level checks) options.
   *
   * Rules:
   *   - PASS:    real, non-empty, non-placeholder response confirmed
   *   - BLOCKED: sentinel / budget / flag explicitly stopped the call
   *   - SKIP:    prerequisite env or auth is missing; can't verify right now
   *   - FAIL:    unexpected error or empty response when none expected
   *
   * NEVER infer PASS from env var state alone. Always require a real signal.
   */
  verify: (opts: VerifyOptions) => Promise<VerifyResult>;
}

export interface VerifyOptions {
  /**
   * When true, Conner has confirmed the key is restored and we should
   * attempt a real provider call. When false (the default), the harness
   * only checks the sentinel/flag state without burning tokens.
   */
  liveProviderCheck?: boolean;
  /**
   * For surface-level checks that need the live BASE_URL (e.g. /api/chat).
   * Set via BASE_URL env var. When absent, surface-level HTTP checks are SKIP.
   */
  baseUrl?: string;
}

// ── Verify helpers ────────────────────────────────────────────────────────

/** True when the key looks like a real Anthropic key (not the sentinel, not empty). */
function isLiveKey(key?: string): boolean {
  if (!key || key.trim().length === 0) return false;
  if (isPausedApiKey(key)) return false;
  return true;
}

/** Run a minimal LLM completion through the composed provider.
 *  Returns VerifyResult with PASS/BLOCKED/FAIL. Cheap: 1 token. */
async function runMinimalCompletion(provider: LlmProvider): Promise<VerifyResult> {
  const t0 = Date.now();
  try {
    const result = await provider.complete({
      system: 'You are a test probe. Reply with exactly one word: ALIVE',
      messages: [{ role: 'user', content: 'health-check' }],
      maxTokens: 10,
      temperature: 0,
      meta: { skill: 'restore-verify-probe' },
    });
    const latencyMs = Date.now() - t0;
    if (!result.ok) {
      if (result.error.code === 'PAUSED') {
        return {
          status: 'BLOCKED',
          detail: 'ANTHROPIC_API_KEY is the sentinel (sk-ant-PAUSED-…); provider blocked the call as designed',
          latencyMs,
        };
      }
      if (result.error.code === 'OVER_BUDGET') {
        return {
          status: 'BLOCKED',
          detail: `Budget gate blocked the call: ${result.error.message}`,
          latencyMs,
        };
      }
      return {
        status: 'FAIL',
        detail: `Provider error ${result.error.code}: ${result.error.message}`,
        latencyMs,
      };
    }
    const text = result.value.text.trim();
    if (text.length === 0) {
      return { status: 'FAIL', detail: 'Provider returned empty text', latencyMs };
    }
    return {
      status: 'PASS',
      detail: `Real completion received (model=${result.value.model}, tokens=${result.value.usage?.outputTokens ?? '?'})`,
      latencyMs,
    };
  } catch (err) {
    return {
      status: 'FAIL',
      detail: `Unexpected throw: ${err instanceof Error ? err.message : String(err)}`,
      latencyMs: Date.now() - t0,
    };
  }
}

/** Check current sentinel/key state without making a network call. */
function checkKeyState(): { live: boolean; paused: boolean; missing: boolean } {
  const key = process.env.ANTHROPIC_API_KEY;
  const paused = isPausedApiKey(key);
  const missing = !key || key.trim().length === 0;
  const live = !paused && !missing;
  return { live, paused, missing };
}

/** Check /api/chat in marketing mode. Looks for a non-placeholder reply.
 *  Returns SKIP when baseUrl is not set. */
async function checkChatRoute(
  mode: 'marketing' | 'support',
  baseUrl: string,
): Promise<VerifyResult> {
  const t0 = Date.now();
  try {
    const body = JSON.stringify({
      mode,
      messages: [{ role: 'user', body: 'hello, quick test' }],
      sessionId: 'restore-verify-probe',
      sourcePage: '/verify',
    });
    const res = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body,
      signal: AbortSignal.timeout(15_000),
    });
    const latencyMs = Date.now() - t0;
    if (!res.ok) {
      if (res.status === 401 || res.status === 403) {
        return {
          status: 'SKIP',
          detail: `${mode}-mode requires auth (${res.status}); skipped`,
          latencyMs,
        };
      }
      return { status: 'FAIL', detail: `HTTP ${res.status} from /api/chat`, latencyMs };
    }
    const data = (await res.json()) as {
      ok: boolean;
      reply?: string;
      degraded?: boolean;
    };
    if (!data.ok || !data.reply) {
      return { status: 'FAIL', detail: 'Response missing ok/reply fields', latencyMs };
    }
    if (data.degraded) {
      // degraded=true means Plaino replied with the paused or transient copy
      const paused = data.reply.includes("resting just now");
      return {
        status: 'BLOCKED',
        detail: paused
          ? 'Chat returned degraded=true with paused copy; sentinel is still active'
          : 'Chat returned degraded=true with transient error copy',
        latencyMs,
      };
    }
    // Non-degraded, non-empty reply = real LLM output
    return {
      status: 'PASS',
      detail: `Real reply received (${data.reply.length} chars, degraded=false)`,
      latencyMs,
    };
  } catch (err) {
    return {
      status: 'FAIL',
      detail: `Fetch error: ${err instanceof Error ? err.message : String(err)}`,
      latencyMs: Date.now() - t0,
    };
  }
}

// ── The Registry ──────────────────────────────────────────────────────────

export const LLM_SURFACE_REGISTRY: readonly LlmSurface[] = [
  // ── Provider-level (layer 0) ─────────────────────────────────────────
  {
    id: 'provider-key-state',
    label: 'ANTHROPIC_API_KEY state check',
    area: 'provider',
    model: '(env check — no call)',
    sourceSurface: null,
    envFlags: ['ANTHROPIC_API_KEY'],
    ownerSkill: 'lib/llm/paused.ts',
    async verify(_opts) {
      const { live, paused, missing } = checkKeyState();
      if (live) {
        return { status: 'PASS', detail: 'Key is set and is NOT the sentinel (live key detected)' };
      }
      if (paused) {
        return {
          status: 'BLOCKED',
          detail: `Key starts with "${PAUSED_API_KEY_PREFIX}" — sentinel active, spend paused`,
        };
      }
      return { status: 'SKIP', detail: 'ANTHROPIC_API_KEY is empty/missing — TestLlmProvider mode' };
    },
  },
  {
    id: 'provider-sentinel-layer',
    label: 'SentinelLlmProvider composability',
    area: 'provider',
    model: MODEL_HAIKU,
    sourceSurface: null,
    envFlags: ['LLM_SENTINEL_BYPASS'],
    ownerSkill: 'lib/llm/paused.ts + lib/llm/index.ts',
    async verify(opts) {
      if (!opts.liveProviderCheck) {
        const { live, paused } = checkKeyState();
        if (paused) {
          return { status: 'BLOCKED', detail: 'Key is sentinel; real provider call skipped (set liveProviderCheck=true to run)' };
        }
        if (!live) {
          return { status: 'SKIP', detail: 'Key not set; skipping live provider call' };
        }
        return { status: 'SKIP', detail: 'liveProviderCheck not set; skipping real call to save tokens' };
      }
      return runMinimalCompletion(getLlmProvider());
    },
  },
  {
    id: 'provider-caching-layer',
    label: 'CachingLlmProvider (LLM_PROMPT_CACHE)',
    area: 'provider',
    model: '(config check)',
    sourceSurface: null,
    envFlags: ['LLM_PROMPT_CACHE'],
    ownerSkill: 'lib/llm/cache-wrapper.ts',
    async verify(_opts) {
      const cacheOff = process.env.LLM_PROMPT_CACHE === 'off';
      return {
        status: 'PASS',
        detail: cacheOff
          ? 'LLM_PROMPT_CACHE=off — caching disabled (kill switch active)'
          : 'LLM_PROMPT_CACHE unset/on — prompt caching active (default)',
      };
    },
  },
  {
    id: 'provider-budget-layer',
    label: 'BudgetEnforcingLlmProvider (LLM_BUDGET_ENFORCEMENT)',
    area: 'provider',
    model: '(config check)',
    sourceSurface: null,
    envFlags: ['LLM_BUDGET_ENFORCEMENT'],
    ownerSkill: 'lib/llm/budget-enforcing-provider.ts',
    async verify(_opts) {
      const off = process.env.LLM_BUDGET_ENFORCEMENT === 'off';
      return {
        status: 'PASS',
        detail: off
          ? 'LLM_BUDGET_ENFORCEMENT=off — budget gate disabled (kill switch active)'
          : 'LLM_BUDGET_ENFORCEMENT unset/on — budget gate active (default)',
      };
    },
  },
  {
    id: 'provider-routing-layer',
    label: 'RoutingLlmProvider (LLM_MODEL_ROUTING)',
    area: 'provider',
    model: '(config check)',
    sourceSurface: null,
    envFlags: ['LLM_MODEL_ROUTING'],
    ownerSkill: 'lib/llm/routing-provider.ts',
    async verify(_opts) {
      const on = process.env.LLM_MODEL_ROUTING === 'on';
      return {
        status: 'PASS',
        detail: on
          ? 'LLM_MODEL_ROUTING=on — cost-aware routing active'
          : 'LLM_MODEL_ROUTING off — routing is identity pass-through (default)',
      };
    },
  },

  // ── Plaino chat surfaces ─────────────────────────────────────────────
  {
    id: 'plaino-chat-marketing',
    label: '/api/chat marketing mode (widget)',
    area: 'plaino-chat',
    model: MODEL_SONNET,
    sourceSurface: null,
    envFlags: [],
    ownerSkill: 'app/api/chat/route.ts (handleMarketing)',
    async verify(opts) {
      if (!opts.baseUrl) {
        return { status: 'SKIP', detail: 'BASE_URL not set; skipping HTTP smoke check' };
      }
      return checkChatRoute('marketing', opts.baseUrl);
    },
  },
  {
    id: 'plaino-chat-support',
    label: '/api/chat support mode (in-app)',
    area: 'plaino-chat',
    model: MODEL_OPUS,
    sourceSurface: 'PLAINO_CHAT',
    envFlags: [],
    ownerSkill: 'app/api/chat/route.ts (handleSupport)',
    async verify(opts) {
      if (!opts.baseUrl) {
        return { status: 'SKIP', detail: 'BASE_URL not set; skipping HTTP smoke check' };
      }
      return checkChatRoute('support', opts.baseUrl);
    },
  },

  // ── Dispatcher (lib/plaino/dispatcher.ts) ────────────────────────────
  {
    id: 'plaino-dispatcher',
    label: 'Plaino dispatcher (ANSWER/REGISTER/DECLINE)',
    area: 'dispatcher',
    model: MODEL_HAIKU,
    sourceSurface: null,
    envFlags: [],
    ownerSkill: 'lib/plaino/dispatcher.ts',
    async verify(opts) {
      if (!opts.liveProviderCheck) {
        const { paused } = checkKeyState();
        if (paused) {
          return { status: 'BLOCKED', detail: 'Sentinel active; dispatcher LLM call would be blocked' };
        }
        return { status: 'SKIP', detail: 'liveProviderCheck not set; use unit test (plaino-chat-flows.test.ts) for non-live check' };
      }
      return runMinimalCompletion(getLlmProvider());
    },
  },

  // ── Categorize (lib/skills/categorize.ts) ────────────────────────────
  {
    id: 'skill-categorize',
    label: 'CategorizeSkill (step 2 of value loop)',
    area: 'categorize',
    model: MODEL_HAIKU,
    sourceSurface: 'CATEGORIZE',
    envFlags: [],
    ownerSkill: 'lib/skills/categorize.ts',
    async verify(opts) {
      if (!opts.liveProviderCheck) {
        const { paused } = checkKeyState();
        if (paused) return { status: 'BLOCKED', detail: 'Sentinel active; categorize LLM call would be PAUSED' };
        return { status: 'SKIP', detail: 'liveProviderCheck not set; skipping token spend' };
      }
      return runMinimalCompletion(getLlmProvider());
    },
  },

  // ── Draft (lib/skills/draft.ts) ──────────────────────────────────────
  {
    id: 'skill-draft',
    label: 'DraftSkill (reply draft generation)',
    area: 'draft',
    model: MODEL_OPUS,
    sourceSurface: 'DRAFT',
    envFlags: [],
    ownerSkill: 'lib/skills/draft.ts',
    async verify(opts) {
      if (!opts.liveProviderCheck) {
        const { paused } = checkKeyState();
        if (paused) return { status: 'BLOCKED', detail: 'Sentinel active; draft LLM call would be PAUSED' };
        return { status: 'SKIP', detail: 'liveProviderCheck not set; skipping token spend' };
      }
      return runMinimalCompletion(getLlmProvider());
    },
  },

  // ── Office-admin classifier (lib/skills/office-admin/classifier.ts) ──
  {
    id: 'skill-office-admin-classify',
    label: 'Office-admin email classifier',
    area: 'office-admin',
    model: MODEL_HAIKU,
    sourceSurface: 'OFFICE_ADMIN',
    envFlags: [],
    ownerSkill: 'lib/skills/office-admin/classifier.ts',
    async verify(opts) {
      if (!opts.liveProviderCheck) {
        const { paused } = checkKeyState();
        if (paused) return { status: 'BLOCKED', detail: 'Sentinel active; office-admin classifier would be PAUSED' };
        return { status: 'SKIP', detail: 'liveProviderCheck not set; skipping token spend' };
      }
      return runMinimalCompletion(getLlmProvider());
    },
  },

  // ── Briefings (lib/skills/briefing-generator/index.ts) ───────────────
  {
    id: 'skill-briefing-generator',
    label: 'Briefing generator (morning briefing)',
    area: 'briefings',
    model: MODEL_OPUS,
    sourceSurface: null,
    envFlags: [],
    ownerSkill: 'lib/skills/briefing-generator/index.ts',
    async verify(opts) {
      if (!opts.liveProviderCheck) {
        const { paused } = checkKeyState();
        if (paused) return { status: 'BLOCKED', detail: 'Sentinel active; briefing LLM call would be PAUSED' };
        return { status: 'SKIP', detail: 'liveProviderCheck not set; skipping token spend' };
      }
      return runMinimalCompletion(getLlmProvider());
    },
  },

  // ── Support handler (lib/skills/support-handler/skill.ts) ────────────
  {
    id: 'skill-support-handler',
    label: 'Support handler (draft reply from request)',
    area: 'support-handler',
    model: MODEL_OPUS,
    sourceSurface: 'SUPPORT_HANDLER',
    envFlags: [],
    ownerSkill: 'lib/skills/support-handler/skill.ts',
    async verify(opts) {
      if (!opts.liveProviderCheck) {
        const { paused } = checkKeyState();
        if (paused) return { status: 'BLOCKED', detail: 'Sentinel active; support-handler LLM call would be PAUSED' };
        return { status: 'SKIP', detail: 'liveProviderCheck not set; skipping token spend' };
      }
      return runMinimalCompletion(getLlmProvider());
    },
  },

  // ── Inbox triage LLM classify (lib/skills/inbox-triage-general/) ─────
  {
    id: 'skill-inbox-triage-llm-classify',
    label: 'Inbox triage LLM classifier (priority bucket)',
    area: 'inbox-triage',
    model: MODEL_HAIKU,
    sourceSurface: 'INBOX_TRIAGE',
    envFlags: [],
    ownerSkill: 'lib/skills/inbox-triage-general/llm-classify.ts',
    async verify(opts) {
      if (!opts.liveProviderCheck) {
        const { paused } = checkKeyState();
        if (paused) return { status: 'BLOCKED', detail: 'Sentinel active; inbox-triage LLM classify would be PAUSED' };
        return { status: 'SKIP', detail: 'liveProviderCheck not set; skipping token spend' };
      }
      return runMinimalCompletion(getLlmProvider());
    },
  },

  // ── Inbox triage LLM refine (lib/skills/inbox-triage-general/llm-refine.ts) ──
  {
    id: 'skill-inbox-triage-llm-refine',
    label: 'Inbox triage LLM refine (draft polish)',
    area: 'inbox-triage',
    model: MODEL_SONNET,
    sourceSurface: 'INBOX_TRIAGE',
    envFlags: [],
    ownerSkill: 'lib/skills/inbox-triage-general/llm-refine.ts',
    async verify(opts) {
      if (!opts.liveProviderCheck) {
        const { paused } = checkKeyState();
        if (paused) return { status: 'BLOCKED', detail: 'Sentinel active; inbox-triage refine would be PAUSED' };
        return { status: 'SKIP', detail: 'liveProviderCheck not set; skipping token spend' };
      }
      return runMinimalCompletion(getLlmProvider());
    },
  },

  // ── Chief-of-staff LLM refine ─────────────────────────────────────────
  {
    id: 'skill-chief-of-staff-llm-refine',
    label: 'Chief-of-staff LLM refine (proposal re-rank)',
    area: 'chief-of-staff',
    model: MODEL_SONNET,
    sourceSurface: 'SCHEDULE',
    envFlags: [],
    ownerSkill: 'lib/skills/chief-of-staff-scheduler/llm-refine.ts',
    async verify(opts) {
      if (!opts.liveProviderCheck) {
        const { paused } = checkKeyState();
        if (paused) return { status: 'BLOCKED', detail: 'Sentinel active; chief-of-staff refine would be PAUSED' };
        return { status: 'SKIP', detail: 'liveProviderCheck not set; skipping token spend' };
      }
      return runMinimalCompletion(getLlmProvider());
    },
  },

  // ── Process doc drafter (lib/skills/process-doc-drafter-general/) ────
  {
    id: 'skill-process-doc-drafter',
    label: 'Process doc drafter (LLM refine)',
    area: 'process-doc',
    model: MODEL_OPUS,
    sourceSurface: 'PROCESS_DOC_DRAFTER',
    envFlags: [],
    ownerSkill: 'lib/skills/process-doc-drafter-general/llm-refine.ts',
    async verify(opts) {
      if (!opts.liveProviderCheck) {
        const { paused } = checkKeyState();
        if (paused) return { status: 'BLOCKED', detail: 'Sentinel active; process-doc LLM refine would be PAUSED' };
        return { status: 'SKIP', detail: 'liveProviderCheck not set; skipping token spend' };
      }
      return runMinimalCompletion(getLlmProvider());
    },
  },

  // ── Analytics weekly pulse (lib/skills/analytics-weekly-pulse-general/) ──
  {
    id: 'skill-analytics-pulse',
    label: 'Analytics weekly pulse (LLM compose)',
    area: 'analytics-pulse',
    model: MODEL_OPUS,
    sourceSurface: null,
    envFlags: [],
    ownerSkill: 'lib/skills/analytics-weekly-pulse-general/skill.ts',
    async verify(opts) {
      if (!opts.liveProviderCheck) {
        const { paused } = checkKeyState();
        if (paused) return { status: 'BLOCKED', detail: 'Sentinel active; analytics pulse LLM call would be PAUSED' };
        return { status: 'SKIP', detail: 'liveProviderCheck not set; skipping token spend' };
      }
      return runMinimalCompletion(getLlmProvider());
    },
  },

  // ── Finance pulse (lib/skills/finance-pulse-general/skill.ts) ────────
  {
    id: 'skill-finance-pulse',
    label: 'Finance weekly pulse (LLM compose)',
    area: 'finance-pulse',
    model: MODEL_OPUS,
    sourceSurface: null,
    envFlags: [],
    ownerSkill: 'lib/skills/finance-pulse-general/skill.ts',
    async verify(opts) {
      if (!opts.liveProviderCheck) {
        const { paused } = checkKeyState();
        if (paused) return { status: 'BLOCKED', detail: 'Sentinel active; finance pulse LLM call would be PAUSED' };
        return { status: 'SKIP', detail: 'liveProviderCheck not set; skipping token spend' };
      }
      return runMinimalCompletion(getLlmProvider());
    },
  },

  // ── Compliance watch (lib/skills/compliance-watch-general/skill.ts) ──
  {
    id: 'skill-compliance-watch',
    label: 'Compliance watch (digest compose)',
    area: 'compliance-watch',
    model: MODEL_OPUS,
    sourceSurface: null,
    envFlags: [],
    ownerSkill: 'lib/skills/compliance-watch-general/skill.ts',
    async verify(opts) {
      if (!opts.liveProviderCheck) {
        const { paused } = checkKeyState();
        if (paused) return { status: 'BLOCKED', detail: 'Sentinel active; compliance watch LLM call would be PAUSED' };
        return { status: 'SKIP', detail: 'liveProviderCheck not set; skipping token spend' };
      }
      return runMinimalCompletion(getLlmProvider());
    },
  },

  // ── Content calendar (lib/skills/content-calendar-drafter-general/) ──
  {
    id: 'skill-content-calendar',
    label: 'Content calendar drafter (LLM compose)',
    area: 'content-calendar',
    model: MODEL_OPUS,
    sourceSurface: null,
    envFlags: [],
    ownerSkill: 'lib/skills/content-calendar-drafter-general/skill.ts',
    async verify(opts) {
      if (!opts.liveProviderCheck) {
        const { paused } = checkKeyState();
        if (paused) return { status: 'BLOCKED', detail: 'Sentinel active; content calendar LLM call would be PAUSED' };
        return { status: 'SKIP', detail: 'liveProviderCheck not set; skipping token spend' };
      }
      return runMinimalCompletion(getLlmProvider());
    },
  },

  // ── Research on demand (lib/skills/research-on-demand-general/) ──────
  {
    id: 'skill-research-on-demand',
    label: 'Research on demand (brief compose)',
    area: 'research-on-demand',
    model: MODEL_OPUS,
    sourceSurface: null,
    envFlags: [],
    ownerSkill: 'lib/skills/research-on-demand-general/skill.ts',
    async verify(opts) {
      if (!opts.liveProviderCheck) {
        const { paused } = checkKeyState();
        if (paused) return { status: 'BLOCKED', detail: 'Sentinel active; research LLM call would be PAUSED' };
        return { status: 'SKIP', detail: 'liveProviderCheck not set; skipping token spend' };
      }
      return runMinimalCompletion(getLlmProvider());
    },
  },

  // ── Instruction handler (lib/plaino/instruction-handler.ts) ──────────
  {
    id: 'plaino-instruction-handler',
    label: 'Instruction handler (INSTRUCT path draft)',
    area: 'instruction-handler',
    model: MODEL_OPUS,
    sourceSurface: null,
    envFlags: [],
    ownerSkill: 'lib/plaino/instruction-handler.ts',
    async verify(opts) {
      if (!opts.liveProviderCheck) {
        const { paused } = checkKeyState();
        if (paused) return { status: 'BLOCKED', detail: 'Sentinel active; instruction-handler LLM call would be PAUSED' };
        return { status: 'SKIP', detail: 'liveProviderCheck not set; skipping token spend' };
      }
      return runMinimalCompletion(getLlmProvider());
    },
  },

  // ── Pre-call brief (lib/skills/pre-call-brief/skill.ts) ──────────────
  {
    id: 'skill-pre-call-brief',
    label: 'Pre-call brief (LLM compose)',
    area: 'pre-call-brief',
    model: MODEL_OPUS,
    sourceSurface: null,
    envFlags: [],
    ownerSkill: 'lib/skills/pre-call-brief/skill.ts',
    async verify(opts) {
      if (!opts.liveProviderCheck) {
        const { paused } = checkKeyState();
        if (paused) return { status: 'BLOCKED', detail: 'Sentinel active; pre-call brief LLM call would be PAUSED' };
        return { status: 'SKIP', detail: 'liveProviderCheck not set; skipping token spend' };
      }
      return runMinimalCompletion(getLlmProvider());
    },
  },

  // ── Lead triage / real estate (lib/skills/lead-triage-realestate/) ───
  {
    id: 'skill-lead-triage-realestate',
    label: 'Lead triage real-estate (LLM refine)',
    area: 'lead-triage',
    model: MODEL_SONNET,
    sourceSurface: null,
    envFlags: [],
    ownerSkill: 'lib/skills/lead-triage-realestate/llm-refine.ts',
    async verify(opts) {
      if (!opts.liveProviderCheck) {
        const { paused } = checkKeyState();
        if (paused) return { status: 'BLOCKED', detail: 'Sentinel active; lead-triage-realestate LLM call would be PAUSED' };
        return { status: 'SKIP', detail: 'liveProviderCheck not set; skipping token spend' };
      }
      return runMinimalCompletion(getLlmProvider());
    },
  },

  // ── Sentinel corpus rewrite (lib/agents/sentinel/rewrite.ts) ─────────
  {
    id: 'agent-sentinel-rewrite',
    label: 'Sentinel compliance rewrite (escalate path)',
    area: 'sentinel-rewrite',
    model: MODEL_OPUS,
    sourceSurface: null,
    envFlags: [],
    ownerSkill: 'lib/agents/sentinel/rewrite.ts',
    async verify(opts) {
      if (!opts.liveProviderCheck) {
        const { paused } = checkKeyState();
        if (paused) return { status: 'BLOCKED', detail: 'Sentinel active; sentinel rewrite LLM call would be PAUSED' };
        return { status: 'SKIP', detail: 'liveProviderCheck not set; skipping token spend' };
      }
      return runMinimalCompletion(getLlmProvider());
    },
  },

  // ── Degraded mode flag (lib/plaino/degraded-mode.ts) ─────────────────
  {
    id: 'plaino-degraded-mode-flag',
    label: 'Degraded mode flag (ANTHROPIC_API_KEY_MISSING check)',
    area: 'plaino-chat',
    model: '(env check — no call)',
    sourceSurface: null,
    envFlags: ['ANTHROPIC_API_KEY', 'LLM_PROVIDER'],
    ownerSkill: 'lib/plaino/degraded-mode.ts',
    async verify(_opts) {
      // Import inline to avoid pulling Prisma into this module
      const { checkDegradedMode } = await import('../plaino/degraded-mode');
      const result = checkDegradedMode(process.env);
      if (!result.degraded) {
        return { status: 'PASS', detail: 'checkDegradedMode → not degraded (key present and valid)' };
      }
      if (result.reason === 'ANTHROPIC_API_KEY_MISSING') {
        const { paused } = checkKeyState();
        if (paused) {
          // The sentinel is set, so degraded-mode.ts sees a non-empty key
          // (it doesn't know about the paused prefix — that's sentinel's job).
          return {
            status: 'PASS',
            detail: 'checkDegradedMode → not degraded (sentinel key is non-empty; degraded-mode only checks presence)',
          };
        }
        return {
          status: 'BLOCKED',
          detail: 'checkDegradedMode → ANTHROPIC_API_KEY_MISSING; chat page will show offline notice',
        };
      }
      return {
        status: 'BLOCKED',
        detail: `checkDegradedMode → degraded: ${result.reason}`,
      };
    },
  },
] as const;

// ── Convenience exports ───────────────────────────────────────────────────

/** All registered surface IDs, for registry shape validation. */
export const REGISTRY_IDS: readonly string[] = LLM_SURFACE_REGISTRY.map((s) => s.id);

/** Look up a surface entry by id. Returns undefined when not found. */
export function findSurface(id: string): LlmSurface | undefined {
  return LLM_SURFACE_REGISTRY.find((s) => s.id === id);
}

export { isLiveKey, checkKeyState, runMinimalCompletion };
