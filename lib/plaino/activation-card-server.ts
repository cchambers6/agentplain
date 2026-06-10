/**
 * lib/plaino/activation-card-server.ts
 *
 * The deterministic, no-LLM seam that turns durable workspace state into the
 * activation card a brand-new customer SEES in their first session. This is
 * the production wiring behind `buildActivationCard` (lib/plaino/next-steps.ts)
 * for the onboarding surface — the genuine first-10-minutes experience.
 *
 * WHY THIS EXISTS: the killer-workflow card is fully deterministic (it reads
 * the workspace's vertical + connected-integration set and renders the one
 * workflow that matters). It has ZERO LLM dependency — it does not ride the
 * /talk dispatcher, which short-circuits in degraded mode. So the onboarding
 * page (server-rendered React, always available) is where it mounts. The
 * card appears for every workspace in onboarding, leading with the vertical's
 * killer workflow promise + the one connect CTA that unlocks it.
 *
 * Two shapes:
 *   - `buildActivationCardFromState` — PURE. Takes already-loaded durable
 *     state (vertical, connected providers, onboarding/approval/compliance
 *     slices) and returns a NextStepsCard. Cold-start safe, unit-testable,
 *     no I/O. The onboarding page calls this with state it already loaded.
 *   - `loadActivationCard` — the async convenience wrapper that builds the
 *     capability snapshot from the DB when the caller hasn't already. Used
 *     where the snapshot isn't already in hand.
 *
 * No migration. No new approval kind. The card is additive metadata; the
 * prose answer (the onboarding copy) is always present above it, so the
 * surface stays screen-reader complete without the card
 * (feedback_everything_tells_a_story + the locked additive/accessible rule).
 *
 * No-outbound: every step is a deep link into the workspace's OWN surfaces
 * (the workflow page or the connect page). Nothing here sends.
 */

import type { Vertical } from '@prisma/client';
import type { RlsContext } from '../db/rls';
import { buildCapabilitySnapshot, buildCapabilitySnapshotSync } from './capabilities';
import type { MarketplaceProviderKey } from '../integrations/marketplace';
import { buildActivationCard } from './next-steps';
import type {
  NextStepsApprovalState,
  NextStepsComplianceState,
  NextStepsOnboardingState,
} from './next-steps';
import type { PlainoCapabilitySnapshot } from './types';
import type { NextStepsCard } from './visual-card';

export interface BuildActivationCardFromStateArgs {
  workspaceId: string;
  /** The workspace vertical — picks which killer workflow leads. `null`
   *  (not yet picked) falls back to the general workflow so a brand-new
   *  workspace still leads with a concrete promise. */
  vertical: Vertical | null;
  /** The capability snapshot the caller already computed (the onboarding
   *  page derives it from the connected-integration rows it already read).
   *  Pass it through so there's no second DB read. */
  snapshot: PlainoCapabilitySnapshot;
  /** Whether the workspace is still in its first session (onboarding not
   *  yet complete). Leads the card with the killer workflow. Typically
   *  `!onboardingState.completedAt`. */
  firstSession: boolean;
  /** Onboarding milestone state — drives the setup-gap steps beneath the
   *  killer-workflow lead. */
  onboarding: NextStepsOnboardingState;
  /** Approval-queue snapshot. Defaults to an empty queue when the caller
   *  hasn't loaded it (the onboarding surface has no drafts yet). */
  approvals?: NextStepsApprovalState;
  /** Compliance snapshot. Defaults to no open flags. */
  compliance?: NextStepsComplianceState;
}

const EMPTY_APPROVALS: NextStepsApprovalState = {
  draftsWaiting: 0,
  oldestAgeHrs: 0,
};

const EMPTY_COMPLIANCE: NextStepsComplianceState = {
  openFlags: 0,
};

/**
 * PURE assembler — build the activation card from already-loaded durable
 * state. No I/O, no LLM. The onboarding page calls this with the workspace
 * vertical + the snapshot it derived from the connected-integration rows it
 * already read, so the card leads with the killer workflow within the first
 * 10 minutes. Cold-start safe: reads only the state passed in.
 */
export function buildActivationCardFromState(
  args: BuildActivationCardFromStateArgs,
): NextStepsCard {
  return buildActivationCard({
    workspaceId: args.workspaceId,
    vertical: args.vertical,
    snapshot: args.snapshot,
    onboarding: args.onboarding,
    approvals: args.approvals ?? EMPTY_APPROVALS,
    compliance: args.compliance ?? EMPTY_COMPLIANCE,
    firstSession: args.firstSession,
  });
}

/**
 * Build an activation card straight from a known connected-provider set,
 * without touching the DB. The onboarding page already reads its connected
 * integrations; it maps them to provider keys and passes them here, so the
 * card branches on the same connected set the page rendered. Pure + sync.
 */
export function buildActivationCardFromConnectedProviders(args: {
  workspaceId: string;
  vertical: Vertical | null;
  firstSession: boolean;
  connectedProviders: ReadonlySet<MarketplaceProviderKey>;
  onboarding: NextStepsOnboardingState;
  approvals?: NextStepsApprovalState;
  compliance?: NextStepsComplianceState;
}): NextStepsCard {
  const snapshot = buildCapabilitySnapshotSync({
    connectedProviders: args.connectedProviders,
  });
  return buildActivationCardFromState({
    workspaceId: args.workspaceId,
    vertical: args.vertical,
    snapshot,
    firstSession: args.firstSession,
    onboarding: args.onboarding,
    approvals: args.approvals,
    compliance: args.compliance,
  });
}

/**
 * Async convenience wrapper — builds the capability snapshot from the DB
 * (workspace-scoped RLS read) when the caller hasn't already, then assembles
 * the activation card. Still zero LLM — the snapshot read is the same
 * deterministic IntegrationCredential scan the dispatcher uses.
 */
export async function loadActivationCard(args: {
  workspaceId: string;
  vertical: Vertical | null;
  firstSession: boolean;
  onboarding: NextStepsOnboardingState;
  approvals?: NextStepsApprovalState;
  compliance?: NextStepsComplianceState;
  ctx?: RlsContext;
}): Promise<NextStepsCard> {
  const snapshot = await buildCapabilitySnapshot({
    workspaceId: args.workspaceId,
    ctx: args.ctx,
  });
  return buildActivationCardFromState({
    workspaceId: args.workspaceId,
    vertical: args.vertical,
    snapshot,
    firstSession: args.firstSession,
    onboarding: args.onboarding,
    approvals: args.approvals,
    compliance: args.compliance,
  });
}
