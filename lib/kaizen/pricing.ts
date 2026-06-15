/**
 * lib/kaizen/pricing.ts
 *
 * Model price table + cost estimator for the kaizen loop.
 *
 * Per-million-token prices, source: claude-api skill model catalog (read
 * 2026-06-15). Cache reads ≈ 0.1× input; cache writes ≈ 1.25× input (5-min
 * TTL). These are list prices — every cost the kaizen loop reports is an
 * ESTIMATE derived from token counts, never an asserted billed actual (OS spec
 * invariant I-11). Update this table when Anthropic publishes new pricing.
 */

export interface ModelPrice {
  /** USD per 1M input tokens. */
  inputPerM: number;
  /** USD per 1M output tokens. */
  outputPerM: number;
}

/**
 * Keys are the bare model IDs as written in session-costs.yaml. The `[1m]`
 * suffix some sessions carry (e.g. `claude-opus-4-8[1m]`) is stripped before
 * lookup — the 1M context window is included at standard pricing, so the rate
 * is the same.
 */
export const MODEL_PRICES: Record<string, ModelPrice> = {
  'claude-fable-5': { inputPerM: 10, outputPerM: 50 },
  'claude-opus-4-8': { inputPerM: 5, outputPerM: 25 },
  'claude-opus-4-7': { inputPerM: 5, outputPerM: 25 },
  'claude-opus-4-6': { inputPerM: 5, outputPerM: 25 },
  'claude-sonnet-4-6': { inputPerM: 3, outputPerM: 15 },
  'claude-haiku-4-5': { inputPerM: 1, outputPerM: 5 },
};

/** Normalize a model string to a price-table key (strip `[1m]`, date suffixes, speed tags). */
export function normalizeModelId(model: string): string {
  return model
    .trim()
    .toLowerCase()
    .replace(/\[1m\]$/, '')
    .replace(/-fast$/, '')
    .replace(/-\d{8}$/, '');
}

export function priceFor(model: string): ModelPrice | null {
  return MODEL_PRICES[normalizeModelId(model)] ?? null;
}

/**
 * Estimate the USD cost of a session from its token counts. Returns null when
 * the model isn't in the price table (caller should flag this rather than
 * assert a fabricated number).
 */
export function estimateCostUsd(
  model: string,
  tokensIn: number,
  tokensOut: number,
): number | null {
  const price = priceFor(model);
  if (!price) return null;
  const cost =
    (tokensIn / 1_000_000) * price.inputPerM +
    (tokensOut / 1_000_000) * price.outputPerM;
  // Round to cents.
  return Math.round(cost * 100) / 100;
}
