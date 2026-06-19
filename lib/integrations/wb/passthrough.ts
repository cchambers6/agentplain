/**
 * lib/integrations/wb/passthrough.ts
 *
 * Pass-through billing for we-bring services that scale with the customer
 * (today: Twilio voice minutes + numbers). The customer's metered usage is
 * reported to Stripe as a meter event, billed at our cost — optionally with a
 * markup percentage Conner sets. Pure mapping from usage readings to the
 * `ReportMeterEventInput` the billing provider already understands; the actual
 * Stripe call stays at the existing billing seam.
 *
 * The Stripe LLM meter prices each unit at "1 micro-cent" and the cron reports
 * summed micro-cents as the quantity. We mirror that convention here so a
 * second meter behaves identically: quantity = pass-through cost in micro-cents.
 */

import type { ReportMeterEventInput } from '@/lib/billing/types';
import { getWeBringService } from './registry';
import type { UsageMeterReading } from './types';

/**
 * Default markup on pass-through cost, as a fraction (0 = flat pass-through at
 * cost). Conner decides the real number (pass-through-with-markup vs
 * flat-rate-per-channel) — tracked in TODOS-FOR-CONNER. Until then we pass
 * Twilio's cost straight through with no markup.
 */
export const DEFAULT_PASS_THROUGH_MARKUP = 0;

/** Apply a markup fraction to a micro-cent cost, rounding to whole units. */
export function withMarkupMicroCents(
  costMicroCents: bigint,
  markupFraction: number = DEFAULT_PASS_THROUGH_MARKUP,
): bigint {
  if (markupFraction <= 0) return costMicroCents;
  // Scale by (1 + markup) using integer math at 1e6 precision to stay exact.
  const scale = BigInt(Math.round((1 + markupFraction) * 1_000_000));
  return (costMicroCents * scale) / 1_000_000n;
}

export interface PassThroughOptions {
  /** The workspace's Stripe customer id. */
  providerCustomerId: string;
  /** A stable UTC date/period stamp for idempotency (e.g. "20260617"). The
   *  caller supplies it so this stays pure (no clock read). */
  periodStamp: string;
  /** Resolves a service's Stripe meter `event_name` from env. The caller wires
   *  this (reading `service.stripeMeterEnvKey` from `process.env`) so the env
   *  read stays out of this pure module. */
  resolveEventName: (stripeMeterEnvKey: string) => string | undefined;
  /** Markup fraction; defaults to flat pass-through (0). */
  markupFraction?: number;
  /** Optional explicit UNIX-seconds timestamp for the meter events. */
  timestampSeconds?: number;
}

/**
 * Build the Stripe meter events for a workspace's pass-through usage. Only
 * `pass-through` services with a configured meter event name and non-zero cost
 * produce an event. Idempotency key = `agentplain-wb-<serviceId>-<periodStamp>`
 * so re-running the same day no-ops, matching the LLM meter cron.
 */
export function passThroughMeterEvents(
  readings: readonly UsageMeterReading[],
  opts: PassThroughOptions,
): ReportMeterEventInput[] {
  const events: ReportMeterEventInput[] = [];
  for (const reading of readings) {
    const service = getWeBringService(reading.serviceId);
    if (!service || service.costModel !== 'pass-through') continue;
    if (!service.stripeMeterEnvKey) continue;
    const eventName = opts.resolveEventName(service.stripeMeterEnvKey);
    if (!eventName) continue; // meter not configured in this environment
    const billed = withMarkupMicroCents(
      reading.costMicroCents,
      opts.markupFraction,
    );
    const quantity = Number(billed);
    if (quantity <= 0) continue;
    events.push({
      eventName,
      providerCustomerId: opts.providerCustomerId,
      quantity,
      identifier: `agentplain-wb-${reading.serviceId}-${opts.periodStamp}`,
      timestampSeconds: opts.timestampSeconds,
    });
  }
  return events;
}
