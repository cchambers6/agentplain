/**
 * lib/integrations/health-banner.ts
 *
 * Server-side reader for the customer-facing "we can't reach your <integration>"
 * banner (pfd-2 integration self-heal). The workspace layout calls this once per
 * page render to surface any UNHEALTHY integration the daily health sweep
 * recorded, so a local-business owner finds out FROM US — with a one-click fix —
 * the moment they next open the app, not three weeks of silently-missing drafts
 * later.
 *
 * Reads the IntegrationHealthCheck rows under the caller's RLS context (the
 * workspace member can only see their own rows). Returns a compact, render-ready
 * shape: the display name, the reconnect link, and the honest check-kind so the
 * banner can be truthful about what we verified.
 */

import type { IntegrationProvider } from '@prisma/client';
import { withRls, type RlsContext } from '@/lib/db';
import {
  entryForProviderKey,
  type MarketplaceProviderKey,
} from './marketplace';

export interface UnhealthyIntegrationBanner {
  provider: IntegrationProvider;
  /** Customer-recognizable name ("Gmail", "QuickBooks"). */
  name: string;
  /** Reconnect landing page path, workspace-scoped. */
  reconnectPath: string;
  /** UTC instant the breakage started (for "broken since" copy, optional). */
  unhealthySince: Date | null;
  /** Whether our last check was a real read or only a credential check. */
  checkKind: 'REAL_READ' | 'CREDENTIAL_ONLY';
}

/**
 * Every integration this workspace currently has UNHEALTHY. Empty array when
 * all green (the banner renders nothing). The caller passes its own RLS context
 * (the member viewing the page), so cross-workspace leakage is impossible.
 */
export async function getUnhealthyIntegrations(
  rls: RlsContext,
): Promise<UnhealthyIntegrationBanner[]> {
  // No workspace scope → nothing workspace-specific to surface.
  if (!rls.workspaceId) return [];
  const workspaceId = rls.workspaceId;
  const rows = await withRls(rls, (tx) =>
    tx.integrationHealthCheck.findMany({
      where: { workspaceId, status: 'UNHEALTHY' },
      orderBy: { unhealthySince: 'asc' },
      select: {
        provider: true,
        unhealthySince: true,
        checkKind: true,
      },
    }),
  ).catch(() => []);

  return rows.map((r) => {
    const entry = entryForProviderKey(r.provider as NonNullable<MarketplaceProviderKey>);
    const base = `/app/workspace/${workspaceId}/integrations`;
    return {
      provider: r.provider,
      name: entry?.name ?? r.provider,
      reconnectPath: entry ? `${base}/${entry.id}` : base,
      unhealthySince: r.unhealthySince,
      checkKind: r.checkKind,
    };
  });
}
