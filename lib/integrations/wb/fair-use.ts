/**
 * lib/integrations/wb/fair-use.ts
 *
 * Fair-use evaluation for ABSORBED ('included') we-bring services. An included
 * service has no per-use charge, so the only guard against pathological usage
 * is a soft cap. Crossing it doesn't bill the customer — it flags the workspace
 * for a tier conversation. Pure functions.
 */

import { getWeBringService, type WeBringService } from './registry';
import type { UsageMeterReading } from './types';

export type FairUseStatus = 'within' | 'approaching' | 'over';

/** Fraction of the cap at which we flag a service as `approaching`. */
export const FAIR_USE_APPROACHING_FRACTION = 0.8;

export interface FairUseVerdict {
  serviceId: string;
  /** Raw units used in the period. */
  used: number;
  /** The soft cap, in the service's meter unit. */
  cap: number;
  /** used / cap, clamped to [0, ∞). */
  fraction: number;
  status: FairUseStatus;
}

/**
 * Evaluate a usage reading against its service's fair-use cap. Returns null
 * when the service has no cap — pass-through services (the customer pays for
 * what they use) and flat infra both have nothing to evaluate.
 */
export function evaluateFairUse(
  reading: UsageMeterReading,
  service: WeBringService | null = getWeBringService(reading.serviceId),
): FairUseVerdict | null {
  if (!service) return null;
  if (service.costModel !== 'included') return null; // only absorbed services cap
  const cap = service.fairUseCap;
  if (cap == null || cap <= 0) return null; // no cap configured
  const fraction = reading.quantity / cap;
  return {
    serviceId: service.id,
    used: reading.quantity,
    cap,
    fraction,
    status: statusForFraction(fraction),
  };
}

export function statusForFraction(fraction: number): FairUseStatus {
  if (fraction >= 1) return 'over';
  if (fraction >= FAIR_USE_APPROACHING_FRACTION) return 'approaching';
  return 'within';
}

/**
 * Evaluate every reading, dropping the ones with no applicable cap. The
 * operator observability view lists the `over` and `approaching` ones.
 */
export function evaluateAllFairUse(
  readings: readonly UsageMeterReading[],
): FairUseVerdict[] {
  const out: FairUseVerdict[] = [];
  for (const reading of readings) {
    const v = evaluateFairUse(reading);
    if (v) out.push(v);
  }
  return out;
}
