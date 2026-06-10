/**
 * lib/plaino/killer-workflow.ts
 *
 * buildKillerWorkflowStep — the pure, cold-start-safe builder behind the
 * killer-workflow ACTIVATION card. The single most important thing Plaino
 * surfaces to a brand-new workspace in its first session: "here is the one
 * thing I'll do for you this month."
 *
 * Spec: the activation mandate (one killer workflow per vertical) layered on
 * top of the existing V27 "what next" card system (docs/explainer-visual-
 * system-2026-06-07.md §4). The killer workflow leads the next-steps card —
 * a single primary step — instead of a generic onboarding checklist.
 *
 * THE OUTCOME: the new customer SEES their vertical's killer workflow within
 * the first 10 minutes. The step is concrete and tappable:
 *   (a) integration CONNECTED  → "see it run" deep-link into the workspace.
 *   (b) integration NOT connected → the named gap + ONE connect CTA for
 *       exactly the integration that unlocks it. The gap becomes generative
 *       (a path forward), never a dead-end — mirrors the DECLINE_HONESTLY
 *       connect-CTA discipline in §4.5.
 *
 * PURE function. No I/O, no LLM (the key is paused — this is deterministic by
 * design), no migration. Reads durable workspace state (vertical + connected
 * providers) on every fire — feedback_cold_start_safe_agents.
 *
 * Brand voice: Plaino's calm heritage register — "Wake up to chased
 * invoices.", "Every lead gets a first touch in 5 minutes." — never chirpy,
 * "local businesses" not "SMB" in any customer-facing string. The headline
 * copy is the canonical activation promise per vertical and must not drift.
 *
 * No-outbound: the step is a deep-link into the workspace's own surfaces
 * (the workflow page or the connect page). Nothing here sends.
 */

import type { Vertical } from '@prisma/client';
import {
  MARKETPLACE_ENTRIES,
  type MarketplaceProviderKey,
} from '../integrations/marketplace';
import type { PlainoCapabilitySnapshot } from './types';
import type { NextStep } from './visual-card';

/**
 * Definition of one vertical's killer workflow. The `headline` is the
 * canonical activation promise (locked copy); `unlockedBy` names the single
 * provider whose connection turns the workflow live; `seeItRunPath` is the
 * in-workspace surface the customer lands on once it is connected.
 */
export interface KillerWorkflowSpec {
  /** Canonical activation promise — locked copy, leads the card. */
  headline: string;
  /** The marketplace provider key whose ACTIVE credential unlocks the
   *  workflow. `null` means the workflow needs no integration to begin
   *  (e.g. a workflow that runs off the inbox the customer already
   *  connected, or an intake screen the customer fills in directly). */
  unlockedBy: MarketplaceProviderKey;
  /** The marketplace tile id the connect CTA deep-links to when
   *  `unlockedBy` is not yet connected. Matches a MARKETPLACE_ENTRIES id. */
  connectIntegrationId: string;
  /** Human label for the integration in the named-gap copy ("Connect
   *  Follow Up Boss"). */
  connectLabel: string;
  /** The in-workspace surface to land on once the workflow is live. A
   *  path segment appended to `/app/workspace/<id>`. */
  seeItRunPath: string;
  /** Plain-language "what unlocking it does" — the one-line rationale on
   *  the connect step. Names the gap concretely. */
  unlockWhy: string;
  /** Plain-language "see it run" rationale once connected. */
  liveWhy: string;
}

/**
 * The canonical killer-workflow registry. ONE per vertical. The headlines
 * are the locked activation copy from the mandate — do not paraphrase.
 *
 * Integration-gated verticals (insurance / mortgage / property-management /
 * title-escrow / ria) lead with the workflow AND the one connect-action that
 * unlocks it — the card shows the promise even before the credential exists.
 * Because those five providers are not in the marketplace catalog as
 * connectable tiles yet, their `connectIntegrationId` points at the closest
 * live substrate the workflow rides on (the inbox / accounting / CRM), so the
 * CTA always lands somewhere real rather than a dead tile.
 */
const KILLER_WORKFLOWS: Record<Vertical, KillerWorkflowSpec> = {
  REAL_ESTATE: {
    headline: 'Every lead gets a first touch in 5 minutes',
    unlockedBy: 'FOLLOW_UP_BOSS',
    connectIntegrationId: 'follow-up-boss',
    connectLabel: 'Follow Up Boss',
    seeItRunPath: 'approvals',
    unlockWhy:
      'connect your CRM and Plaino drafts a first-touch reply for every new lead',
    liveWhy: 'Plaino drafts the first touch — you approve and it is on its way',
  },
  CPA: {
    headline: 'Month-end close assembles itself',
    unlockedBy: 'TAXDOME',
    connectIntegrationId: 'taxdome',
    connectLabel: 'TaxDome',
    seeItRunPath: 'approvals',
    unlockWhy:
      'connect TaxDome and Plaino pulls client-document state into your close',
    liveWhy:
      'Plaino assembles the close from what your clients have already uploaded',
  },
  HOME_SERVICES: {
    headline: 'No estimate dies unanswered',
    unlockedBy: 'QUICKBOOKS',
    connectIntegrationId: 'quickbooks',
    connectLabel: 'QuickBooks',
    seeItRunPath: 'approvals',
    unlockWhy:
      'connect QuickBooks and Plaino follows up on every estimate still waiting',
    liveWhy: 'Plaino drafts the follow-up on each open estimate — you approve',
  },
  LAW: {
    headline: 'Never take a conflicted client',
    // The intake conflict screen runs off the matter list the firm keeps;
    // it needs no third-party credential to begin, so it leads straight to
    // the workflow surface. `connectIntegrationId` is the document substrate
    // the screen reads when one is connected.
    unlockedBy: null,
    connectIntegrationId: 'onedrive',
    connectLabel: 'your document library',
    seeItRunPath: 'approvals',
    unlockWhy:
      'point Plaino at your matter list and it screens every new intake for conflicts',
    liveWhy: 'Plaino screens each new intake against your matters before you take it',
  },
  // ── Integration-gated verticals ─────────────────────────────────────────
  // No connectable tile in the catalog yet; the card leads with the promise
  // and routes the connect CTA at the live substrate the workflow rides on.
  INSURANCE: {
    headline: 'COI in 4 minutes',
    unlockedBy: 'GOOGLE',
    connectIntegrationId: 'gmail',
    connectLabel: 'your inbox',
    seeItRunPath: 'approvals',
    unlockWhy:
      'connect the inbox the COI requests land in and Plaino drafts the certificate',
    liveWhy: 'Plaino drafts each certificate of insurance from the request — you approve',
  },
  MORTGAGE: {
    headline: 'The file chases itself',
    unlockedBy: 'GOOGLE',
    connectIntegrationId: 'gmail',
    connectLabel: 'your inbox',
    seeItRunPath: 'approvals',
    unlockWhy:
      'connect the inbox the conditions come through and Plaino chases each missing item',
    liveWhy: 'Plaino chases each outstanding condition on the file — you approve the nudge',
  },
  PROPERTY_MANAGEMENT: {
    headline: 'Rent collects itself politely',
    unlockedBy: 'QUICKBOOKS',
    connectIntegrationId: 'quickbooks',
    connectLabel: 'QuickBooks',
    seeItRunPath: 'approvals',
    unlockWhy:
      'connect QuickBooks and Plaino drafts a courteous reminder on every late rent',
    liveWhy: 'Plaino drafts a polite reminder on each late rent — you approve it',
  },
  TITLE_ESCROW: {
    headline: 'No closing slips on a missing doc',
    unlockedBy: 'GOOGLE',
    connectIntegrationId: 'gmail',
    connectLabel: 'your inbox',
    seeItRunPath: 'approvals',
    unlockWhy:
      'connect the inbox the closing files come through and Plaino flags each missing doc',
    liveWhy: 'Plaino flags every missing document before the closing — you stay ahead',
  },
  RIA: {
    headline: 'Quarterly client letters in one tap',
    unlockedBy: null,
    connectIntegrationId: 'onedrive',
    connectLabel: 'your document library',
    seeItRunPath: 'approvals',
    unlockWhy:
      'point Plaino at your client list and it drafts each quarterly letter',
    liveWhy: 'Plaino drafts every quarterly client letter — you review and send',
  },
  // Recruiting has no canonical killer workflow in the activation mandate
  // yet; it falls back to the general workflow below until one is defined.
  RECRUITING: {
    headline: 'Wake up to chased invoices',
    unlockedBy: 'QUICKBOOKS',
    connectIntegrationId: 'quickbooks',
    connectLabel: 'QuickBooks',
    seeItRunPath: 'approvals',
    unlockWhy:
      'connect QuickBooks and Plaino chases every overdue invoice while you sleep',
    liveWhy: 'Plaino drafts the chase on each overdue invoice — you approve it',
  },
};

/** The general (no-vertical / unknown-vertical) killer workflow. */
const GENERAL_KILLER_WORKFLOW: KillerWorkflowSpec = {
  headline: 'Wake up to chased invoices',
  unlockedBy: 'QUICKBOOKS',
  connectIntegrationId: 'quickbooks',
  connectLabel: 'QuickBooks',
  seeItRunPath: 'approvals',
  unlockWhy:
    'connect QuickBooks and Plaino chases every overdue invoice while you sleep',
  liveWhy: 'Plaino drafts the chase on each overdue invoice — you approve it',
};

/**
 * Resolve the killer-workflow spec for a workspace vertical. `null`
 * vertical (not yet picked) resolves to the general workflow so a brand-new
 * workspace still leads with a concrete promise.
 */
export function killerWorkflowFor(
  vertical: Vertical | null | undefined,
): KillerWorkflowSpec {
  if (!vertical) return GENERAL_KILLER_WORKFLOW;
  return KILLER_WORKFLOWS[vertical] ?? GENERAL_KILLER_WORKFLOW;
}

export interface BuildKillerWorkflowStepArgs {
  workspaceId: string;
  vertical: Vertical | null | undefined;
  /** The set of providers the workspace currently has an ACTIVE credential
   *  for. Read from the capability snapshot's connected set. */
  connectedProviders: ReadonlySet<MarketplaceProviderKey>;
}

/**
 * Build the single activation step that leads the next-steps card. Always
 * returns a PRIMARY step (the caller may re-weight, but the killer workflow
 * is the headline).
 *
 * Connected branch: a "see it run" step into the workspace surface where the
 * workflow's drafts land.
 *
 * Unconnected branch: the named-gap connect CTA. The label leads with the
 * headline promise; the `why` names exactly what connecting unlocks; the
 * href deep-links to the one integration's connect page — turning the gap
 * into a path forward.
 */
export function buildKillerWorkflowStep(
  args: BuildKillerWorkflowStepArgs,
): NextStep {
  const base = `/app/workspace/${args.workspaceId}`;
  const spec = killerWorkflowFor(args.vertical);

  const connected =
    spec.unlockedBy !== null && args.connectedProviders.has(spec.unlockedBy);

  if (connected) {
    // The workflow is live — lead straight to where its work lands.
    return {
      label: `${spec.headline} — see it run`,
      href: `${base}/${spec.seeItRunPath}`,
      weight: 'primary',
      why: spec.liveWhy,
    };
  }

  // Not connected (or no integration needed but we still route at the
  // substrate the workflow rides on): generative connect CTA.
  return {
    label: `${spec.headline} — connect ${spec.connectLabel}`,
    href: `${base}/integrations/${spec.connectIntegrationId}`,
    weight: 'primary',
    why: spec.unlockWhy,
  };
}

/**
 * Derive the set of connected provider keys from a capability snapshot. The
 * snapshot lists connected integrations by marketplace tile id; this maps
 * each id back to its provider key via the catalog (the single source of
 * truth). Production callers pass `snapshot.connectedIntegrations` so the
 * killer step branches on the same connected set the dispatcher already
 * computed — no second DB read.
 */
export function connectedProvidersFromSnapshot(
  snapshot: PlainoCapabilitySnapshot,
): ReadonlySet<MarketplaceProviderKey> {
  const byId = new Map(MARKETPLACE_ENTRIES.map((e) => [e.id, e.providerKey]));
  const out = new Set<MarketplaceProviderKey>();
  for (const conn of snapshot.connectedIntegrations) {
    const key = byId.get(conn.id);
    if (key) out.add(key);
  }
  return out;
}
