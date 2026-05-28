/**
 * lib/billing/usage/pricing.ts
 *
 * Pure pricing function that maps a single LLM call's token usage to a
 * cost in micro-cents (1 cent = 1,000,000 micro-cents). Stored as
 * BigInt on `LlmUsageRecord.costMicroCents` so we accumulate millions of
 * rows without rounding drift.
 *
 * Rates are Anthropic's published list pricing. Cached source:
 *   https://www.anthropic.com/pricing  (read 2026-05-28)
 *   https://docs.anthropic.com/en/docs/about-claude/models/overview
 *   https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching
 *
 * Per-million-token rates (USD) used below:
 *   Claude Sonnet 4.5 — input $3, output $15, cache write (5m) $3.75,
 *     cache read $0.30
 *   Claude Opus 4.x   — input $15, output $75, cache write (5m) $18.75,
 *     cache read $1.50
 *   Claude Haiku 4.5  — input $1, output $5, cache write (5m) $1.25,
 *     cache read $0.10
 *
 * Cache-write is ~1.25× input; cache-read is ~0.10× input. Output is
 * 5× input on every Claude model. Match-by-substring on the model id so
 * minor version suffixes ("claude-sonnet-4-5", "claude-sonnet-4-5-20251001")
 * resolve to the same table. Unknown models default to Sonnet pricing —
 * the conservative middle of the Claude family so we never *under*-bill
 * an Opus call.
 *
 * Pure function: no env reads, no DB, no IO. Test by computing a few
 * hand-known cases and asserting `===`.
 *
 * Per `feedback_no_silent_vendor_lock`: this lives under `lib/billing/`,
 * not inside the Anthropic adapter — the cost is a customer-facing
 * billing concern owned by the billing seam, not the LLM provider.
 */

// ── Per-million-token rates, in micro-cents ─────────────────────────────
//
// 1 USD = 100 cents = 100_000_000 micro-cents.
// $3 / million tokens = 300_000_000 micro-cents / million tokens.
//
// Storing as `bigint` keeps the multiplication exact: token counts are
// `number` (Int) but the per-million scaling is a BigInt multiply.

export interface ModelRates {
  /** Input tokens (uncached). */
  inputPerMillionMicroCents: bigint;
  /** Output tokens. */
  outputPerMillionMicroCents: bigint;
  /** `cache_creation_input_tokens` — ~1.25× input. */
  cacheWritePerMillionMicroCents: bigint;
  /** `cache_read_input_tokens` — ~0.10× input. */
  cacheReadPerMillionMicroCents: bigint;
}

const MICRO_CENTS_PER_DOLLAR = 100_000_000n;

const usdToMicroCentsPerMillion = (dollars: number): bigint => {
  // dollars per million tokens -> micro-cents per million tokens.
  // Round to nearest micro-cent for the rare fractional rate (e.g. $3.75).
  // 100_000_000 * dollars gives micro-cents; Math.round handles float dust.
  return BigInt(Math.round(dollars * Number(MICRO_CENTS_PER_DOLLAR)));
};

/** Anthropic list pricing per family. Read date: 2026-05-28. */
const SONNET_RATES: ModelRates = {
  inputPerMillionMicroCents: usdToMicroCentsPerMillion(3),
  outputPerMillionMicroCents: usdToMicroCentsPerMillion(15),
  cacheWritePerMillionMicroCents: usdToMicroCentsPerMillion(3.75),
  cacheReadPerMillionMicroCents: usdToMicroCentsPerMillion(0.3),
};

const OPUS_RATES: ModelRates = {
  inputPerMillionMicroCents: usdToMicroCentsPerMillion(15),
  outputPerMillionMicroCents: usdToMicroCentsPerMillion(75),
  cacheWritePerMillionMicroCents: usdToMicroCentsPerMillion(18.75),
  cacheReadPerMillionMicroCents: usdToMicroCentsPerMillion(1.5),
};

const HAIKU_RATES: ModelRates = {
  inputPerMillionMicroCents: usdToMicroCentsPerMillion(1),
  outputPerMillionMicroCents: usdToMicroCentsPerMillion(5),
  cacheWritePerMillionMicroCents: usdToMicroCentsPerMillion(1.25),
  cacheReadPerMillionMicroCents: usdToMicroCentsPerMillion(0.1),
};

/** Family resolver. Match by substring so minor-version suffixes share
 *  the same table — "claude-sonnet-4-5" and "claude-sonnet-4-5-20251001"
 *  both resolve to Sonnet. Unknown models default to Sonnet because:
 *    (1) Sonnet is what every shipped agentplain skill calls today; and
 *    (2) defaulting *up* to Opus would over-bill, defaulting *down* to
 *        Haiku would under-bill an Opus call. Sonnet is the safe middle. */
export function ratesForModel(model: string): ModelRates {
  const m = model.toLowerCase();
  if (m.includes('opus')) return OPUS_RATES;
  if (m.includes('haiku')) return HAIKU_RATES;
  // sonnet, unknown, or anything starting with "claude-" but unfamiliar
  return SONNET_RATES;
}

/** Compute the cost in micro-cents for a single LLM call. Pure; safe
 *  to call millions of times — no IO. */
export function costMicroCentsForUsage(
  model: string,
  inputTokens: number,
  outputTokens: number,
  cacheCreationTokens: number,
  cacheReadTokens: number,
): bigint {
  const rates = ratesForModel(model);
  // tokens × (micro-cents per million) / 1_000_000.
  // All arithmetic in BigInt; final divide is exact-floor (we don't
  // bill the customer for sub-micro-cents).
  const MILLION = 1_000_000n;
  const input = BigInt(Math.max(0, inputTokens));
  const output = BigInt(Math.max(0, outputTokens));
  const cw = BigInt(Math.max(0, cacheCreationTokens));
  const cr = BigInt(Math.max(0, cacheReadTokens));
  const cost =
    (input * rates.inputPerMillionMicroCents) / MILLION +
    (output * rates.outputPerMillionMicroCents) / MILLION +
    (cw * rates.cacheWritePerMillionMicroCents) / MILLION +
    (cr * rates.cacheReadPerMillionMicroCents) / MILLION;
  return cost;
}

/** Display helper. Pure. Converts a BigInt micro-cents amount to a USD
 *  string like "$1.23". Used by the customer-facing usage pane and by
 *  log lines. Falls back to "$0.0001" minimum for non-zero amounts so
 *  a single cheap call still shows up as a real number, not "$0.00". */
export function formatMicroCentsAsUsd(microCents: bigint): string {
  if (microCents === 0n) return '$0.00';
  // 1 cent = 1_000_000 micro-cents; 1 dollar = 100 cents.
  // Round to nearest cent for the headline number.
  const cents = Number(microCents) / 1_000_000;
  const dollars = cents / 100;
  if (dollars < 0.01) return '$<0.01';
  return `$${dollars.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
