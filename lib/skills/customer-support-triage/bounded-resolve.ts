/**
 * lib/skills/customer-support-triage/bounded-resolve.ts
 *
 * Detect + gate bounded account actions the triage layer may auto-resolve.
 * These are zero-dollar, reversible account chores — reconnect-integration
 * prompt, workspace pause/resume, resend magic link — that ride the
 * EXISTING bounded-execute rails (lib/skills/bounded-execute.ts, #204
 * per-workspace autonomy + the reversibility allowlist). We do NOT invent
 * a new autonomy mechanism: every action maps to an allowlisted
 * WorkApprovalKind and goes through decideBoundedExecute, so the owner's
 * per-workspace autonomy setting governs. Autonomy OFF → drafts, always.
 *
 * Anything touching money is deliberately NOT detectable here — those fall
 * through to the answer/draft path (or escalate, for disputes over the
 * threshold).
 *
 * Cold-start safe + no-vendor-lock: pure over the injected OpsFlagStore;
 * the actual gate decision is delegated to bounded-execute.ts.
 */

import {
  decideBoundedExecute,
  type ComposedGateOutcomes,
} from '../bounded-execute';
import type { OpsFlagStore } from '../../ops/flag-store';
import {
  BOUNDED_ACTION_KIND,
  type BoundedAccountAction,
  type SupportMessageSnapshot,
} from './types';

/** Deterministic detection of a bounded account-action intent in the
 *  message. Conservative: only fires on a clear, unambiguous request. */
export function detectBoundedAction(
  message: SupportMessageSnapshot,
): BoundedAccountAction | null {
  const text = `${message.subject}\n${message.body}`.toLowerCase();

  // resend magic link — sign-in help
  if (
    has(text, ['resend', 'send another', 'new link', 'send a new']) &&
    has(text, ['magic link', 'sign-in link', 'sign in link', 'login link', 'log in link'])
  ) {
    return 'resend-magic-link';
  }

  // reconnect integration — a tool dropped its connection
  if (
    has(text, ['reconnect', 're-connect', 'connect again', 'connection dropped', 'disconnected', 'lost connection', 'reauthorize', 're-authorize', 'reauthenticate']) &&
    has(text, ['integration', 'gmail', 'outlook', 'calendar', 'quickbooks', 'docusign', 'tool', 'account', 'connection'])
  ) {
    return 'reconnect-integration-prompt';
  }

  // pause the fleet
  if (has(text, ['pause the fleet', 'pause my fleet', 'pause everything', 'pause the workspace', 'put on hold', 'going on vacation', 'pause my workspace', 'stop the fleet'])) {
    return 'workspace-pause';
  }

  // resume the fleet
  if (has(text, ['resume the fleet', 'resume my fleet', 'unpause', 'un-pause', 'turn it back on', 'start the fleet again', 'resume the workspace'])) {
    return 'workspace-resume';
  }

  return null;
}

function has(text: string, phrases: string[]): boolean {
  return phrases.some((p) => text.includes(p));
}

export interface BoundedResolveDecision {
  /** True when the action may auto-resolve right now. */
  autoResolve: boolean;
  action: BoundedAccountAction;
  /** Why — for the operator surface + audit. */
  detail: string;
}

/**
 * Decide whether a detected bounded action may auto-resolve, by running
 * the existing bounded-execute gate against its mapped WorkApprovalKind +
 * the workspace's autonomy policy. When the gate denies (autonomy off,
 * over ceiling, master off, store error) → draft-for-review.
 */
export async function decideBoundedResolve(args: {
  action: BoundedAccountAction;
  workspaceId: string;
  store: OpsFlagStore;
  /** Standing gates already evaluated for this fire (gateSkillFire +
   *  billing-pause). Threaded in, never re-queried. */
  gates: ComposedGateOutcomes;
  env?: NodeJS.ProcessEnv;
}): Promise<BoundedResolveDecision> {
  const kind = BOUNDED_ACTION_KIND[args.action];
  const decision = await decideBoundedExecute({
    kind,
    store: args.store,
    gates: args.gates,
    workspaceId: args.workspaceId,
    env: args.env,
  });
  return {
    autoResolve: decision.autoExecute,
    action: args.action,
    detail: decision.detail,
  };
}
