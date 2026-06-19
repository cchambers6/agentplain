/**
 * lib/integrations/connection-catalog.ts
 *
 * The UNIFIED connection catalog — every connection agentplain offers, on
 * either side of the BYO / we-bring split, in one list. It merges the
 * Customer-Brought marketplace (`marketplace.ts`) with the We-Bring service
 * registry (`wb/registry.ts`) and classifies each into exactly one bucket.
 *
 * It also carries the MIGRATION SAFETY NET: `classifyConnections()` walks both
 * sides and emits warnings for anything misclassified — a marketplace tile that
 * declares itself `we-bring`, an id that collides across the two sides, a
 * known we-bring vendor that leaked into the marketplace, or a registry entry
 * with an internally-inconsistent cost model. A test asserts the shipped
 * catalog produces zero warnings; `scripts/classify-connections.ts` prints the
 * full table for humans.
 */

import {
  BYO_COST_MODEL,
  COST_MODEL_LABEL,
  type CostModel,
  type IntegrationSourcing,
} from './sourcing';
import {
  entrySourcing,
  listIntegrations,
  type MarketplaceEntry,
} from './marketplace';
import { listWeBringServices, type WeBringService } from './wb/registry';

export interface ConnectionCatalogEntry {
  id: string;
  name: string;
  category: string;
  description: string;
  sourcing: IntegrationSourcing;
  costModel: CostModel;
  costModelLabel: string;
  /** Present only for we-bring services. */
  meterUnit?: string | null;
  observable?: boolean;
}

/** Map a marketplace (BYO) entry onto a unified catalog entry. */
function fromMarketplace(entry: MarketplaceEntry): ConnectionCatalogEntry {
  return {
    id: entry.id,
    name: entry.name,
    category: entry.category,
    description: entry.description,
    sourcing: entrySourcing(entry), // 'byo'
    costModel: BYO_COST_MODEL, // 'customer-direct'
    costModelLabel: COST_MODEL_LABEL[BYO_COST_MODEL],
  };
}

/** Map a we-bring service onto a unified catalog entry. */
function fromWeBring(service: WeBringService): ConnectionCatalogEntry {
  return {
    id: service.id,
    name: service.name,
    category: service.category,
    description: service.description,
    sourcing: 'we-bring',
    costModel: service.costModel,
    costModelLabel: COST_MODEL_LABEL[service.costModel],
    meterUnit: service.meterUnit,
    observable: service.observable,
  };
}

/** The full unified catalog: BYO marketplace first, then we-bring services. */
export function buildConnectionCatalog(): ConnectionCatalogEntry[] {
  return [
    ...listIntegrations().map(fromMarketplace),
    ...listWeBringServices().map(fromWeBring),
  ];
}

export type WarningSeverity = 'error' | 'warn';

export interface ClassificationWarning {
  id: string;
  severity: WarningSeverity;
  message: string;
}

/**
 * Vendor-name fragments that belong to WE-BRING services. If one of these shows
 * up as a marketplace (BYO) tile id or name, it's almost certainly a
 * misclassification — a we-bring service leaked into the customer-brought
 * catalog. Heuristic, deliberately conservative.
 */
const WE_BRING_VENDOR_FRAGMENTS = [
  'anthropic',
  'claude',
  'openai',
  'embedding',
  'elevenlabs',
  'twilio',
  'resend',
  'vercel',
  'neon',
  'inngest',
];

/**
 * Classify every connection and collect misclassification warnings. The shipped
 * catalog must return zero warnings (enforced by test).
 */
export function classifyConnections(): {
  entries: ConnectionCatalogEntry[];
  warnings: ClassificationWarning[];
} {
  const warnings: ClassificationWarning[] = [];
  const marketplace = listIntegrations();
  const weBring = listWeBringServices();

  // 1. No marketplace tile may declare itself we-bring — tiles are BYO.
  for (const entry of marketplace) {
    if (entry.sourcing === 'we-bring') {
      warnings.push({
        id: entry.id,
        severity: 'error',
        message: `Marketplace tile "${entry.id}" is tagged sourcing:'we-bring'. Marketplace tiles are Customer-Brought by definition — move it to lib/integrations/wb/registry.ts or drop the tag.`,
      });
    }
  }

  // 2. A we-bring vendor name must not appear as a BYO marketplace tile.
  for (const entry of marketplace) {
    const hay = `${entry.id} ${entry.name}`.toLowerCase();
    const hit = WE_BRING_VENDOR_FRAGMENTS.find((frag) => hay.includes(frag));
    if (hit) {
      warnings.push({
        id: entry.id,
        severity: 'warn',
        message: `Marketplace tile "${entry.id}" looks like the we-bring vendor "${hit}". If agentplain owns this account, it belongs in the we-bring registry, not the customer-brought marketplace.`,
      });
    }
  }

  // 3. Ids must be unique across the two sides (the dashboard keys on id).
  const seen = new Map<string, IntegrationSourcing>();
  for (const e of marketplace) seen.set(e.id, 'byo');
  for (const s of weBring) {
    if (seen.has(s.id)) {
      warnings.push({
        id: s.id,
        severity: 'error',
        message: `Id "${s.id}" exists on both the marketplace (BYO) and the we-bring registry. Ids must be unique across the split.`,
      });
    }
    seen.set(s.id, 'we-bring');
  }

  // 4. We-bring cost-model self-consistency.
  for (const s of weBring) {
    if (s.costModel === 'pass-through') {
      if (!s.stripeMeterEnvKey) {
        warnings.push({
          id: s.id,
          severity: 'error',
          message: `We-bring service "${s.id}" is pass-through but has no stripeMeterEnvKey — nothing to bill against.`,
        });
      }
      if (s.fairUseCap != null) {
        warnings.push({
          id: s.id,
          severity: 'warn',
          message: `We-bring service "${s.id}" is pass-through (customer pays per use) yet declares a fairUseCap — a cap only makes sense on an absorbed service.`,
        });
      }
    }
    if (s.observable && s.meterUnit == null) {
      warnings.push({
        id: s.id,
        severity: 'warn',
        message: `We-bring service "${s.id}" is marked observable but has no meterUnit — there is no unit to report usage in.`,
      });
    }
    if (!s.observable && s.meterUnit != null) {
      warnings.push({
        id: s.id,
        severity: 'warn',
        message: `We-bring service "${s.id}" declares a meterUnit but is not observable — usage can't surface per customer.`,
      });
    }
  }

  return { entries: buildConnectionCatalog(), warnings };
}

/** Convenience: just the warnings (for the test + script exit code). */
export function classificationWarnings(): ClassificationWarning[] {
  return classifyConnections().warnings;
}
