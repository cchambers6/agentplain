/**
 * lib/integrations/cost-attribution.ts
 *
 * Builds the per-integration cost-attribution view that powers the
 * `usage/connections` dashboard. It answers, for every connection, the only
 * question that matters to a customer reading a bill: who pays, and how much?
 *
 *   BYO connection            → "You're paying directly" (no agentplain charge)
 *   we-bring, included         → "Included" (we absorb it; usage shown for trust)
 *   we-bring, pass-through     → "Pass-through" (metered onto your invoice)
 *
 * Pure. The page assembles the inputs (which BYO connectors are live, the
 * we-bring usage readings) and renders the rows this returns.
 */

import {
  COST_MODEL_EXPLAINER,
  COST_MODEL_LABEL,
  type CostModel,
  type IntegrationSourcing,
} from './sourcing';
import type { MarketplaceEntry } from './marketplace';
import {
  listWeBringServices,
  type WeBringService,
} from './wb/registry';
import { evaluateFairUse, type FairUseVerdict } from './wb/fair-use';
import { withMarkupMicroCents } from './wb/passthrough';
import type { UsageMeterReading } from './wb/types';

export interface AttributionRow {
  id: string;
  name: string;
  category: string;
  sourcing: IntegrationSourcing;
  costModel: CostModel;
  /** "You're paying directly" | "Included" | "Pass-through". */
  costModelLabel: string;
  /** One-line plain-language explanation. */
  explainer: string;
  /** Usage, if metered + present. */
  usageQuantity: number | null;
  usageUnit: string | null;
  /** What this costs agentplain (included + pass-through). null for BYO. */
  agentplainCostMicroCents: bigint | null;
  /** What lands on the CUSTOMER's invoice. Non-zero only for pass-through. */
  customerChargeMicroCents: bigint | null;
  /** Fair-use verdict for absorbed services with a cap, if over/approaching. */
  fairUse: FairUseVerdict | null;
}

export interface CostAttributionInput {
  /** BYO connectors that currently have an ACTIVE credential. */
  connectedByo: readonly MarketplaceEntry[];
  /** We-bring usage readings for the period (from the meter + LLM usage path).
   *  Keyed by we-bring service id. Services with no reading still render (as
   *  zero / "no usage yet") so the customer sees the whole picture. */
  weBringReadings: readonly UsageMeterReading[];
  /** Pass-through markup fraction (Conner-set; default flat at cost). */
  markupFraction?: number;
}

/** The BYO half: one row per live customer-brought connection. */
function byoRows(connected: readonly MarketplaceEntry[]): AttributionRow[] {
  return connected.map((entry) => ({
    id: entry.id,
    name: entry.name,
    category: entry.category,
    sourcing: 'byo' as const,
    costModel: 'customer-direct' as const,
    costModelLabel: COST_MODEL_LABEL['customer-direct'],
    explainer: COST_MODEL_EXPLAINER['customer-direct'],
    usageQuantity: null,
    usageUnit: null,
    agentplainCostMicroCents: null,
    customerChargeMicroCents: null,
    fairUse: null,
  }));
}

/** The we-bring half: one row per service (always all of them). */
function weBringRows(
  readings: readonly UsageMeterReading[],
  markupFraction: number | undefined,
): AttributionRow[] {
  const byId = new Map(readings.map((r) => [r.serviceId, r]));
  return listWeBringServices().map((service: WeBringService) => {
    const reading = byId.get(service.id) ?? null;
    const cost = reading?.costMicroCents ?? null;
    const isPassThrough = service.costModel === 'pass-through';
    const customerCharge =
      isPassThrough && cost != null
        ? withMarkupMicroCents(cost, markupFraction)
        : isPassThrough
          ? 0n
          : null; // included services never charge the customer
    return {
      id: service.id,
      name: service.name,
      category: service.category,
      sourcing: 'we-bring' as const,
      costModel: service.costModel,
      costModelLabel: COST_MODEL_LABEL[service.costModel],
      explainer: COST_MODEL_EXPLAINER[service.costModel],
      usageQuantity: service.observable ? (reading?.quantity ?? 0) : null,
      usageUnit: service.meterUnit,
      agentplainCostMicroCents: cost,
      customerChargeMicroCents: customerCharge,
      fairUse: reading ? evaluateFairUse(reading, service) : null,
    };
  });
}

/**
 * Build the full attribution table: BYO connections first, then every we-bring
 * service. Pure — the page renders it directly.
 */
export function buildCostAttribution(
  input: CostAttributionInput,
): AttributionRow[] {
  return [
    ...byoRows(input.connectedByo),
    ...weBringRows(input.weBringReadings, input.markupFraction),
  ];
}

/** Total that actually hits the customer's invoice from we-bring usage. */
export function totalCustomerChargeMicroCents(rows: AttributionRow[]): bigint {
  return rows.reduce(
    (sum, r) => sum + (r.customerChargeMicroCents ?? 0n),
    0n,
  );
}

/** Total cost agentplain ABSORBED on the customer's behalf (transparency). */
export function totalAbsorbedMicroCents(rows: AttributionRow[]): bigint {
  return rows.reduce((sum, r) => {
    if (r.costModel !== 'included') return sum;
    return sum + (r.agentplainCostMicroCents ?? 0n);
  }, 0n);
}
