/**
 * lib/llm/model-tiers.ts
 *
 * Single source of truth for the per-skill model tier strings. Skills set
 * `model: MODEL_OPUS` / `MODEL_SONNET` / `MODEL_HAIKU` on their
 * `LlmCompletionRequest` so the per-call model is explicit at the call
 * site, not hidden in the global default.
 *
 * Why this file exists (wave 8, 2026-05-29): every skill used to fall
 * through to `lib/llm/anthropic-provider.ts`'s `DEFAULT_MODEL`, which is
 * a single global string. That meant internal classifiers (Plaino
 * dispatcher, office-admin) paid the same per-token rate as customer-
 * facing drafts (Draft, support-handler, briefings). Conner's calibration
 * — "keep Opus on every surface customers READ, downgrade only where
 * Haiku/Sonnet reach the same answer" — needs per-call routing. See
 * `docs/skill-model-routing-2026-05-29.md` for the full audit.
 *
 * If a customer ever wants a premium tier on a Sonnet/Haiku-tier skill,
 * the `SkillConfig` per-skill override is the escape hatch — it can pass
 * a different `model` value at construction time.
 *
 * Per `feedback_no_silent_vendor_lock`: this file is the in-house tier
 * surface above the provider. If Anthropic ships a new model tomorrow,
 * one file changes; the 19 skill call sites stay put.
 */

/** Customer-facing draft / brief / synthesis. Quality over cost. */
export const MODEL_OPUS = 'claude-opus-4-7';

/** Customer-adjacent moderate-reasoning work (extraction, refine, schedule
 *  proposals). Same wall-clock quality bar as today's default; ~5×
 *  cheaper than Opus. */
export const MODEL_SONNET = 'claude-sonnet-4-6';

/** Internal narrow classifier — discrete categorical / binary decisions
 *  (dispatcher path, office-admin kind, categorize bin). Haiku reaches
 *  the same answer as Opus on these and is ~25× cheaper. */
export const MODEL_HAIKU = 'claude-haiku-4-5-20251001';
