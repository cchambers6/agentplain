/**
 * buildNextSteps — the pure, cold-start-safe builder behind the V27 "what next"
 * card (the retention payload).
 *
 * Spec: docs/explainer-visual-system-2026-06-07.md §4.2.
 *
 * Priority order (spec): setup gaps → oldest drafts waiting → open compliance
 * flags → one unused high-value capability. Capped at 4. Each step is a real
 * deep link into the workspace.
 *
 * This is a PURE function reading durable workspace state on every fire
 * (feedback_cold_start_safe_agents) — the dispatcher attaches the card
 * deterministically from state, not from model free-text. No LLM, no I/O.
 * Every count it surfaces is real + conservative (feedback_no_guesses_no_estimates).
 */
import type { Vertical } from '@prisma/client';
import type { MarketplaceProviderKey } from '../integrations/marketplace';
import {
  buildKillerWorkflowStep,
  connectedProvidersFromSnapshot,
} from './killer-workflow';
import type { PlainoCapabilitySnapshot } from './types';
import type { NextStep, NextStepsCard, QueueGlance } from './visual-card';

/** The slice of onboarding state the builder needs — kept minimal so the
 *  builder has no coupling to the full onboarding module. */
export interface NextStepsOnboardingState {
  verticalPicked: boolean;
  firstToolConnected: boolean;
  scheduleWindowSet: boolean;
  firstDraftReviewed: boolean;
}

/** Approval-queue snapshot. `oldestAgeHrs` is the age of the oldest waiting
 *  draft (0 if none). */
export interface NextStepsApprovalState {
  draftsWaiting: number;
  oldestAgeHrs: number;
}

/** Compliance snapshot. */
export interface NextStepsComplianceState {
  openFlags: number;
}

/**
 * Activation context — the killer-workflow lead. When present, the card
 * LEADS with the workspace's vertical killer workflow ("the one thing I'll
 * do for you this month") instead of a generic onboarding checklist. Set
 * `lead: true` during the first session (onboarding not yet complete) so a
 * brand-new customer sees the killer workflow within the first 10 minutes.
 */
export interface NextStepsActivationState {
  /** Lead the card with the killer-workflow step. Typically `true` while
   *  the workspace is still in its first session. */
  lead: boolean;
  /** The workspace vertical — picks which killer workflow leads. `null`
   *  (not yet picked) falls back to the general workflow. */
  vertical: Vertical | null;
  /** Providers the workspace currently has an ACTIVE credential for. The
   *  killer step branches on whether the unlocking provider is in here. */
  connectedProviders: ReadonlySet<MarketplaceProviderKey>;
}

export interface BuildNextStepsArgs {
  workspaceId: string;
  snapshot: PlainoCapabilitySnapshot;
  onboarding: NextStepsOnboardingState;
  approvals: NextStepsApprovalState;
  compliance: NextStepsComplianceState;
  /** Optional killer-workflow lead. Omit to keep the legacy behaviour
   *  (setup-gaps-first checklist). */
  activation?: NextStepsActivationState;
}

const MAX_STEPS = 4;

/**
 * Build the prioritized next-step list. Returns at most `MAX_STEPS` steps; the
 * single highest-priority step carries `weight: 'primary'` (rendered clay).
 * Always returns at least one step — when everything is healthy, the step is a
 * positive "you're all set, here's the digest" pointer (a next-step question
 * should never dead-end).
 */
export function buildNextSteps(args: BuildNextStepsArgs): NextStep[] {
  const { workspaceId, snapshot, onboarding, approvals, compliance } = args;
  const base = `/app/workspace/${workspaceId}`;
  const steps: NextStep[] = [];

  // 0 — the killer-workflow lead. During the first session, the card opens
  //     with the vertical's killer workflow ("here's the one thing I'll do
  //     for you this month") — connected → "see it run", not-connected →
  //     the named gap + the one connect CTA that unlocks it. This is the
  //     activation outcome: a brand-new customer sees their killer workflow
  //     within the first 10 minutes, not a generic checklist.
  if (args.activation?.lead) {
    steps.push(
      buildKillerWorkflowStep({
        workspaceId,
        vertical: args.activation.vertical,
        connectedProviders: args.activation.connectedProviders,
      }),
    );
  }

  // 1 — setup gaps (highest priority: the workspace isn't producing value yet).
  if (!onboarding.verticalPicked) {
    steps.push({
      label: 'pick your vertical to tune the fleet',
      href: `${base}/onboarding`,
      weight: 'normal',
      why: 'the fleet drafts differently for each kind of business',
    });
  }
  if (!onboarding.firstToolConnected) {
    steps.push({
      label: 'connect your first tool',
      href: `${base}/integrations`,
      weight: 'normal',
      why: 'about 60 seconds — then the fleet can start reading',
    });
  }
  if (!onboarding.scheduleWindowSet) {
    steps.push({
      label: 'set when the fleet works',
      href: `${base}/settings`,
      weight: 'normal',
      why: 'pick the hours it drafts and pauses',
    });
  }

  // 2 — oldest drafts waiting on the owner.
  if (approvals.draftsWaiting > 0) {
    steps.push({
      label:
        approvals.draftsWaiting === 1
          ? 'review 1 draft waiting on you'
          : `review ${approvals.draftsWaiting} drafts waiting on you`,
      href: `${base}/approvals`,
      weight: 'normal',
      why:
        approvals.oldestAgeHrs >= 24
          ? `the oldest has waited ${Math.floor(approvals.oldestAgeHrs / 24)}d`
          : 'nothing sends until you approve it',
    });
  }

  // 3 — open compliance flags.
  if (compliance.openFlags > 0) {
    steps.push({
      label:
        compliance.openFlags === 1
          ? 'clear 1 compliance flag'
          : `clear ${compliance.openFlags} compliance flags`,
      href: `${base}/compliance`,
      weight: 'normal',
      why: 'the sentinel caught something to check before it goes out',
    });
  }

  // 4 — one unused high-value capability (expansion / retention).
  const firstUnused = snapshot.availableButUnconnected[0];
  if (firstUnused) {
    steps.push({
      label: `connect ${firstUnused.name} to unlock more`,
      href: `${base}/integrations`,
      weight: 'normal',
      why: `lights up ${firstUnused.category} work the fleet can't do yet`,
    });
  }

  // Cold-start safety: never dead-end a "what next?" question.
  if (steps.length === 0) {
    steps.push({
      label: "you're all set — see what the fleet did this week",
      href: `${base}/digest`,
      weight: 'normal',
      why: 'nothing needs you right now',
    });
  }

  const capped = steps.slice(0, MAX_STEPS);
  // Exactly one primary — the first (highest-priority) step.
  capped[0] = { ...capped[0], weight: 'primary' };
  return capped;
}

/**
 * Assemble the full V27 card (steps + queue glance) from the same state. The
 * queue glance is only attached when there's something in it (drafts or flags).
 */
export function buildNextStepsCard(args: BuildNextStepsArgs): NextStepsCard {
  const steps = buildNextSteps(args);
  const card: NextStepsCard = { type: 'next-steps', steps };
  const hasQueue =
    args.approvals.draftsWaiting > 0 || args.compliance.openFlags > 0;
  if (hasQueue) {
    const queue: QueueGlance = {
      drafts: args.approvals.draftsWaiting,
      flags: args.compliance.openFlags,
      oldestAgeHrs: args.approvals.oldestAgeHrs,
    };
    card.queue = queue;
  }
  return card;
}

/**
 * Production assembler — build the next-steps card directly from durable
 * workspace state, deriving the killer-workflow lead automatically. This is
 * the seam a chat / onboarding surface calls: pass the capability snapshot
 * the dispatcher already computed plus the workspace vertical + first-session
 * flag, and the card LEADS with the killer workflow when the workspace is
 * still in its first session.
 *
 * `firstSession` should be true while onboarding is not yet complete (the
 * window in which the killer-workflow promise drives activation). Once the
 * customer has reviewed their first draft and finished onboarding, the card
 * drops the lead and reverts to the standard what-next checklist.
 *
 * Pure + deterministic — no I/O, no LLM. The connected-provider set is
 * derived from the snapshot, so there is no second DB read.
 */
export function buildActivationCard(args: {
  workspaceId: string;
  vertical: Vertical | null;
  snapshot: PlainoCapabilitySnapshot;
  onboarding: NextStepsOnboardingState;
  approvals: NextStepsApprovalState;
  compliance: NextStepsComplianceState;
  /** Lead with the killer workflow. Typically the negation of
   *  "onboarding complete". */
  firstSession: boolean;
}): NextStepsCard {
  const activation: NextStepsActivationState = {
    lead: args.firstSession,
    vertical: args.vertical,
    connectedProviders: connectedProvidersFromSnapshot(args.snapshot),
  };
  return buildNextStepsCard({
    workspaceId: args.workspaceId,
    snapshot: args.snapshot,
    onboarding: args.onboarding,
    approvals: args.approvals,
    compliance: args.compliance,
    activation,
  });
}
