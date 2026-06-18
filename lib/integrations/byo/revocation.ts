/**
 * lib/integrations/byo/revocation.ts
 *
 * One-tap revocation for Customer-Brought connections. This module produces a
 * pure REVOCATION PLAN the BYO UI previews before the customer confirms. The
 * plan is then carried out by the existing disconnect server action
 * (`app/(product)/app/workspace/[id]/integrations/[integrationId]/actions.ts`),
 * which deletes the credential, deletes the customer data ingested through it,
 * and audits both — per the data-deletion contract already shipped.
 *
 * Keeping the plan here (rather than inlining copy into the button) means the
 * "what disconnecting removes" preview can't drift from what the action does.
 */

import { getMarketplaceEntry, entryCriticality } from '../marketplace';
import type { RevocationPlan } from './types';

/**
 * Build the revocation plan for a BYO integration. Returns null for unknown
 * connectors or coming-soon tiles (no credential to revoke).
 */
export function planRevocation(integrationId: string): RevocationPlan | null {
  const entry = getMarketplaceEntry(integrationId);
  if (!entry || entry.providerKey === null) return null;

  const removes = [
    `agentplain's access grant on your ${entry.name} account`,
    `the ${entry.name} data we ingested into your workspace knowledge base`,
  ];

  // Critical (system-of-record) connectors pause their primary workflow on
  // revoke; non-critical ones only stop a notify/mirror side-effect.
  if (entryCriticality(entry) === 'critical') {
    removes.push(
      `the ${entry.name}-powered workflow until you reconnect (drafts already in your queue stay)`,
    );
  } else {
    removes.push(`${entry.name} notifications (your primary work is unaffected)`);
  }

  return {
    integrationId,
    provider: entry.providerKey,
    removes,
    retains: [
      'your audit trail of everything we read and drafted',
      'any drafts already waiting in your approvals queue',
    ],
  };
}
