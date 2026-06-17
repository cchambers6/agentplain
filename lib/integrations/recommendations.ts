/**
 * lib/integrations/recommendations.ts
 *
 * Vertical-aware connector RECOMMENDATIONS for the Connections tab. The
 * marketplace already FILTERS tiles by vertical (`entryAppliesToVertical`);
 * this goes a step further and RANKS them into "connect this first" guidance
 * so a brand-new workspace isn't left to guess which of a dozen tiles
 * unlocks the most.
 *
 * The lead recommendation is the connector that unlocks the workspace's
 * KILLER WORKFLOW (from `lib/plaino/killer-workflow`) — connect it and the
 * single most valuable thing Plaino does for this vertical goes live. The
 * rest are the other vertical-relevant tiles (available first, then the
 * coming-soon ones so the owner sees what's on the way), capped so the
 * "first connect" surface stays a short, honest shortlist.
 *
 *   CPA  → TaxDome (unlock) · Karbon · QuickBooks
 *   Law  → your document library (OneDrive, unlock) · Clio · MyCase
 *   RE   → Follow Up Boss (unlock) · Sierra · (kvCORE/BoldTrail soon)
 *   PM   → QuickBooks (unlock) · Buildium
 *   general → QuickBooks (unlock) · Gmail · Notion
 *
 * Honest by construction (project_no_silent_vendor_lock + registry truth):
 * every recommendation carries its real marketplace `status`, so a
 * `coming-soon` connector is never dressed up as connectable.
 *
 * PURE. Reads the catalog + killer-workflow registry; no I/O.
 */

import type { Vertical } from '@prisma/client';
import { verticalSlugFromEnum } from '@/lib/auth/vertical-enum';
import { killerWorkflowFor } from '@/lib/plaino/killer-workflow';
import {
  MARKETPLACE_ENTRIES,
  entryAppliesToVertical,
  getMarketplaceEntry,
  type MarketplaceEntry,
  type MarketplaceStatus,
} from './marketplace';

export interface ConnectorRecommendation {
  /** Marketplace tile id — the connect CTA deep-links to it. */
  id: string;
  name: string;
  category: string;
  status: MarketplaceStatus;
  /** Why this connector matters for the workspace — one line. */
  reason: string;
  /** True for the single connector that unlocks the killer workflow. */
  unlocksKillerWorkflow: boolean;
}

export interface VerticalRecommendations {
  /** The killer-workflow activation promise — the headline the lead
   *  recommendation is in service of. */
  killerWorkflowHeadline: string;
  /** The connector that turns the killer workflow live. `null` only if the
   *  killer workflow's connect target isn't in the catalog (shouldn't
   *  happen — every spec points at a real tile). */
  primary: ConnectorRecommendation | null;
  /** Other vertical-relevant + essential connectors, ranked. Available
   *  first, then coming-soon. Excludes `primary`. Capped. */
  others: ConnectorRecommendation[];
}

/** Horizontal connectors most local businesses connect first, in order. Used
 *  to round out a vertical's shortlist (and as the spine of the general
 *  recommendation). */
const HORIZONTAL_ESSENTIALS = ['gmail', 'quickbooks', 'notion'] as const;

const MAX_OTHERS = 4;

function toRecommendation(
  entry: MarketplaceEntry,
  opts: { reason: string; unlocksKillerWorkflow?: boolean },
): ConnectorRecommendation {
  return {
    id: entry.id,
    name: entry.name,
    category: entry.category,
    status: entry.status,
    reason: opts.reason,
    unlocksKillerWorkflow: opts.unlocksKillerWorkflow ?? false,
  };
}

/**
 * Rank the connectors to recommend for a workspace's vertical. `null`
 * vertical (not picked yet) resolves to the general shortlist so a brand-new
 * workspace still gets a confident "connect this first".
 */
export function recommendedConnectorsFor(
  vertical: Vertical | null | undefined,
): VerticalRecommendations {
  const slug = vertical ? verticalSlugFromEnum(vertical) : null;
  const spec = killerWorkflowFor(vertical);

  // 1. The lead recommendation: the killer-workflow unlock connector.
  const primaryEntry = getMarketplaceEntry(spec.connectIntegrationId);
  const primary = primaryEntry
    ? toRecommendation(primaryEntry, {
        reason: spec.unlockWhy,
        unlocksKillerWorkflow: true,
      })
    : null;

  // 2. Build the ranked "others" pool, skipping whatever is already primary.
  const seen = new Set<string>(primary ? [primary.id] : []);
  const others: ConnectorRecommendation[] = [];

  const push = (entry: MarketplaceEntry, reason: string) => {
    if (seen.has(entry.id)) return;
    if (others.length >= MAX_OTHERS) return;
    seen.add(entry.id);
    others.push(toRecommendation(entry, { reason }));
  };

  // 2a. Vertical-SPECIFIC tiles (not 'all') — the ones bespoke to this
  //     business. Available first, then coming-soon, so the shortlist leads
  //     with what can connect today.
  if (slug) {
    const verticalSpecific = MARKETPLACE_ENTRIES.filter(
      (e) =>
        e.verticalRelevance !== 'all' &&
        entryAppliesToVertical(e, slug),
    );
    for (const e of sortByConnectability(verticalSpecific)) {
      push(e, e.description);
    }
  }

  // 2b. Round out with horizontal essentials (Gmail/QuickBooks/Notion) the
  //     vertical can also use — only the ones that apply + are available.
  for (const id of HORIZONTAL_ESSENTIALS) {
    const e = getMarketplaceEntry(id);
    if (!e) continue;
    if (slug && !entryAppliesToVertical(e, slug)) continue;
    push(e, 'most local businesses connect this early');
  }

  return {
    killerWorkflowHeadline: spec.headline,
    primary,
    others,
  };
}

/** Available connectors sort ahead of coming-soon/beta — the shortlist
 *  should lead with what the owner can actually turn on today. */
function sortByConnectability(entries: MarketplaceEntry[]): MarketplaceEntry[] {
  const rank: Record<MarketplaceStatus, number> = {
    available: 0,
    beta: 1,
    'coming-soon': 2,
  };
  return [...entries].sort((a, b) => rank[a.status] - rank[b.status]);
}
