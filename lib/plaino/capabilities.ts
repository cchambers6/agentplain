/**
 * lib/plaino/capabilities.ts
 *
 * Build the workspace-capability snapshot the dispatcher feeds into
 * the system prompt. Reads from the discipline catalog + the
 * marketplace + the IntegrationCredential rows for the workspace so
 * the LIST OF REAL CAPABILITIES never drifts from what's actually
 * wired. Per reference_product_claims_vs_reality.
 *
 * Read posture: the snapshot read goes through withRls under the
 * workspace context so a leaked connection cannot show another
 * workspace's connected set. The marketplace catalog is workspace-
 * agnostic; only the connected-integration list is per-workspace.
 */

import { withRls, type RlsContext } from '../db/rls';
import { listDisciplines } from '../disciplines';
import {
  MARKETPLACE_ENTRIES,
  type MarketplaceEntry,
  type MarketplaceProviderKey,
} from '../integrations/marketplace';
import type { PlainoCapabilitySnapshot } from './types';

/**
 * Snapshot the workspace's current capability surface for Plaino.
 * Pure read; no side effects.
 */
export async function buildCapabilitySnapshot(args: {
  workspaceId: string;
  /** Override the RLS context — defaults to a workspace-scoped customer
   *  context. Server action passes the member's context. */
  ctx?: RlsContext;
}): Promise<PlainoCapabilitySnapshot> {
  const ctx: RlsContext = args.ctx ?? {
    userId: null,
    workspaceId: args.workspaceId,
    isOperator: false,
  };
  const connectedProviders = await withRls(ctx, async (tx) => {
    const rows = await tx.integrationCredential.findMany({
      where: {
        workspaceId: args.workspaceId,
        status: 'ACTIVE',
      },
      select: { provider: true },
    });
    return new Set(rows.map((r) => r.provider as MarketplaceProviderKey));
  });

  const connected: PlainoCapabilitySnapshot['connectedIntegrations'] = [];
  const available: PlainoCapabilitySnapshot['availableButUnconnected'] = [];
  const coming: PlainoCapabilitySnapshot['comingSoon'] = [];
  for (const entry of MARKETPLACE_ENTRIES) {
    const lite = liteEntry(entry);
    if (entry.status === 'coming-soon' || entry.providerKey === null) {
      coming.push(lite);
      continue;
    }
    if (connectedProviders.has(entry.providerKey)) {
      connected.push(lite);
    } else if (entry.status === 'available' || entry.status === 'beta') {
      available.push(lite);
    } else {
      coming.push(lite);
    }
  }

  return {
    disciplines: listDisciplines().map((d) => ({
      id: d.id,
      name: d.name,
      description: d.description,
    })),
    connectedIntegrations: connected,
    availableButUnconnected: available,
    comingSoon: coming,
  };
}

function liteEntry(
  entry: MarketplaceEntry,
): { id: string; name: string; category: string } {
  return { id: entry.id, name: entry.name, category: entry.category };
}

// ── Test surface — synchronous snapshot from a provided connected set ──

/** Build a snapshot from a known connected-provider set. Tests use this
 *  to avoid spinning a DB. Production callers should use the async
 *  buildCapabilitySnapshot above. */
export function buildCapabilitySnapshotSync(args: {
  connectedProviders: ReadonlySet<MarketplaceProviderKey>;
}): PlainoCapabilitySnapshot {
  const connected: PlainoCapabilitySnapshot['connectedIntegrations'] = [];
  const available: PlainoCapabilitySnapshot['availableButUnconnected'] = [];
  const coming: PlainoCapabilitySnapshot['comingSoon'] = [];
  for (const entry of MARKETPLACE_ENTRIES) {
    const lite = liteEntry(entry);
    if (entry.status === 'coming-soon' || entry.providerKey === null) {
      coming.push(lite);
      continue;
    }
    if (args.connectedProviders.has(entry.providerKey)) {
      connected.push(lite);
    } else if (entry.status === 'available' || entry.status === 'beta') {
      available.push(lite);
    } else {
      coming.push(lite);
    }
  }
  return {
    disciplines: listDisciplines().map((d) => ({
      id: d.id,
      name: d.name,
      description: d.description,
    })),
    connectedIntegrations: connected,
    availableButUnconnected: available,
    comingSoon: coming,
  };
}
