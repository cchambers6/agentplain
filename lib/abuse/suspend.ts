/**
 * lib/abuse/suspend.ts
 *
 * Auto-suspend + appeals state machine for confirmed-or-suspected abuse.
 *
 * The flow the ToS / AUP commits to:
 *   1. Detected abuse (signals from `detector.ts`) → SOFT suspend. The
 *      workspace drops to read-only, the owner is emailed, and a 24-hour
 *      review window opens. Nothing is deleted; the customer keeps full read +
 *      export access to their own data (that data is theirs — see
 *      `/data-rights`).
 *   2. The owner can appeal by replying to the email. An upheld appeal lifts
 *      the suspension entirely.
 *   3. Confirmed abuse (operator review, or an unappealed window that ages
 *      out under a Conner-approved timeline) → HARD suspend. Data is preserved
 *      per the ToS retention terms; Conner is notified.
 *
 * Design:
 *   - The decision core is PURE: every function takes the current record + the
 *     inputs + an explicit `now`, and returns the next record plus a list of
 *     side-effect *intents* (email the owner, notify Conner). It performs no
 *     I/O and reads no clock — so it is fully deterministic and unit-testable,
 *     and `feedback_cold_start_safe_agents` holds (state is read in, not
 *     remembered).
 *   - Persistence + email + read-only enforcement live behind ports
 *     (`SuspensionStore`, and the effects the caller drains). The production
 *     store writes the record into `Workspace.settings.abuse` (no migration)
 *     and the read-only gate is enforced by the existing
 *     `lib/billing/workspace-paused-gate.ts` seam; wiring those is the
 *     integration step gated on Conner's escalation-timeline sign-off (see
 *     docs/strategic-build-2026-06-17/TODOS-FOR-CONNER.md).
 *
 * Nothing in this file hard-suspends autonomously without either an operator
 * decision or an explicitly-enabled, Conner-approved auto-escalation window.
 * A false positive must never silently lock a paying customer out for good.
 */

import type { AbuseCategory, AbuseSignal } from './detector';
import { strongestAction, worstSeverity } from './detector';

// ── State ────────────────────────────────────────────────────────────────

export type SuspensionState = 'NONE' | 'SOFT' | 'HARD';

export type AppealOutcome = 'PENDING' | 'UPHELD' | 'REJECTED';

export interface AppealRecord {
  /** Free-text the owner supplied (stored as-is; it's their own words). */
  message: string;
  submittedAt: string;
  outcome: AppealOutcome;
  resolvedAt: string | null;
  /** Operator note on the resolution. */
  resolutionNote: string | null;
}

export interface SuspensionRecord {
  workspaceId: string;
  state: SuspensionState;
  /** What triggered the current state. */
  category: AbuseCategory | null;
  reason: string;
  /** Redacted detector rule ids that drove the suspension, for audit. */
  rules: string[];
  softSuspendedAt: string | null;
  hardSuspendedAt: string | null;
  /** End of the 24h owner-review window (ISO). Null when not SOFT. */
  reviewWindowEndsAt: string | null;
  appeal: AppealRecord | null;
  /** Monotonic counter of how many times this workspace has been soft-suspended
   *  — repeat offenders escalate faster. */
  priorSoftSuspensions: number;
}

export function emptySuspension(workspaceId: string): SuspensionRecord {
  return {
    workspaceId,
    state: 'NONE',
    category: null,
    reason: '',
    rules: [],
    softSuspendedAt: null,
    hardSuspendedAt: null,
    reviewWindowEndsAt: null,
    appeal: null,
    priorSoftSuspensions: 0,
  };
}

/** True when the workspace should be in read-only mode right now. */
export function isReadOnly(record: SuspensionRecord): boolean {
  return record.state === 'SOFT' || record.state === 'HARD';
}

/** True when the workspace is fully suspended (no read either, beyond export). */
export function isHardSuspended(record: SuspensionRecord): boolean {
  return record.state === 'HARD';
}

// ── Side-effect intents ──────────────────────────────────────────────────

export type SuspensionEffect =
  | {
      type: 'EMAIL_OWNER';
      template: 'SOFT_SUSPEND_NOTICE' | 'HARD_SUSPEND_NOTICE' | 'APPEAL_UPHELD';
      reason: string;
      reviewWindowEndsAt: string | null;
    }
  | { type: 'NOTIFY_CONNER'; reason: string; severity: 'MEDIUM' | 'HIGH' };

export interface SuspensionDecision {
  record: SuspensionRecord;
  effects: SuspensionEffect[];
  /** Whether the record changed (caller skips a write when false). */
  changed: boolean;
}

const REVIEW_WINDOW_HOURS = 24;

function addHours(iso: string, hours: number): string {
  return new Date(new Date(iso).getTime() + hours * 60 * 60 * 1000).toISOString();
}

// ── Decisions ────────────────────────────────────────────────────────────

export interface AbuseDecisionInput {
  existing: SuspensionRecord;
  signals: AbuseSignal[];
  now: Date;
  /** Override the review window for tests / a Conner-tuned value. */
  reviewWindowHours?: number;
}

/**
 * Decide what to do given fresh abuse signals against the current state.
 *
 *   - No signals, or only LOG-level → no state change (the access-audit layer
 *     still records them; this decider only acts on FLAG / SOFT_SUSPEND).
 *   - SOFT_SUSPEND-recommended signals, or a FLAG against a workspace already
 *     carrying recent flags → enter SOFT suspend, email owner, open the review
 *     window, notify Conner.
 *   - Already SOFT or HARD → accumulate the rules but don't re-fire the email.
 *
 * Confirmation to HARD is a separate, explicit step (`confirmAbuse`) — never a
 * silent consequence of more signals.
 */
export function decideOnAbuse(input: AbuseDecisionInput): SuspensionDecision {
  const { existing, signals, now } = input;
  const windowHours = input.reviewWindowHours ?? REVIEW_WINDOW_HOURS;
  const nowIso = now.toISOString();

  if (signals.length === 0) {
    return { record: existing, effects: [], changed: false };
  }

  const action = strongestAction(signals);
  const severity = worstSeverity(signals) ?? 'LOW';
  const rules = [...new Set([...existing.rules, ...signals.map((s) => s.rule)])];
  const category = signals[0]?.category ?? existing.category;
  const reason = signals
    .map((s) => s.reason)
    .slice(0, 3)
    .join(' ');

  // Already hard-suspended: just record the rules, no further effect.
  if (existing.state === 'HARD') {
    return {
      record: { ...existing, rules },
      effects: [],
      changed: rules.length !== existing.rules.length,
    };
  }

  // Already soft-suspended: accumulate evidence, don't re-notify.
  if (existing.state === 'SOFT') {
    return {
      record: { ...existing, rules, reason: reason || existing.reason },
      effects: [],
      changed: true,
    };
  }

  // Decide whether to soft-suspend now. SOFT_SUSPEND-recommended → yes.
  // A FLAG is enough to soft-suspend only when the workspace has prior
  // soft-suspensions (a repeat pattern); a first-time FLAG is left to the
  // access-audit roll-up + operator review.
  const shouldSoftSuspend =
    action === 'SOFT_SUSPEND' ||
    (action === 'FLAG' && existing.priorSoftSuspensions > 0);

  if (!shouldSoftSuspend) {
    return { record: existing, effects: [], changed: false };
  }

  const reviewWindowEndsAt = addHours(nowIso, windowHours);
  const record: SuspensionRecord = {
    ...existing,
    state: 'SOFT',
    category,
    reason,
    rules,
    softSuspendedAt: nowIso,
    reviewWindowEndsAt,
    appeal: null,
    priorSoftSuspensions: existing.priorSoftSuspensions + 1,
  };

  return {
    record,
    changed: true,
    effects: [
      {
        type: 'EMAIL_OWNER',
        template: 'SOFT_SUSPEND_NOTICE',
        reason,
        reviewWindowEndsAt,
      },
      {
        type: 'NOTIFY_CONNER',
        reason: `Soft-suspended ${existing.workspaceId}: ${reason}`,
        severity: severity === 'HIGH' ? 'HIGH' : 'MEDIUM',
      },
    ],
  };
}

/** The owner submits an appeal (by replying to the soft-suspend email). */
export function submitAppeal(
  record: SuspensionRecord,
  message: string,
  now: Date,
): SuspensionDecision {
  if (record.state !== 'SOFT') {
    // Appeals only apply to a live soft suspension.
    return { record, effects: [], changed: false };
  }
  const appeal: AppealRecord = {
    message,
    submittedAt: now.toISOString(),
    outcome: 'PENDING',
    resolvedAt: null,
    resolutionNote: null,
  };
  return {
    record: { ...record, appeal },
    changed: true,
    effects: [
      {
        type: 'NOTIFY_CONNER',
        reason: `Appeal submitted for ${record.workspaceId}`,
        severity: 'MEDIUM',
      },
    ],
  };
}

/**
 * Operator (or Conner) resolves the appeal.
 *   - UPHELD   → lift the suspension entirely, email the owner.
 *   - REJECTED → confirmed abuse → HARD suspend (data preserved), notify Conner.
 */
export function resolveAppeal(
  record: SuspensionRecord,
  outcome: 'UPHELD' | 'REJECTED',
  now: Date,
  resolutionNote = '',
): SuspensionDecision {
  if (record.state !== 'SOFT' || record.appeal == null) {
    return { record, effects: [], changed: false };
  }
  const nowIso = now.toISOString();
  const appeal: AppealRecord = {
    ...record.appeal,
    outcome,
    resolvedAt: nowIso,
    resolutionNote: resolutionNote || null,
  };

  if (outcome === 'UPHELD') {
    return {
      record: { ...emptySuspension(record.workspaceId), priorSoftSuspensions: record.priorSoftSuspensions, appeal },
      changed: true,
      effects: [
        {
          type: 'EMAIL_OWNER',
          template: 'APPEAL_UPHELD',
          reason: 'Appeal upheld — full access restored.',
          reviewWindowEndsAt: null,
        },
      ],
    };
  }

  // Rejected → hard suspend.
  return hardSuspend({ ...record, appeal }, now, 'Appeal rejected — abuse confirmed.');
}

/**
 * Confirm abuse and move straight to HARD suspend — the operator-review path
 * (used when an operator confirms without an appeal having been filed). Data
 * is preserved per the ToS; Conner is notified.
 */
export function confirmAbuse(
  record: SuspensionRecord,
  now: Date,
  note = 'Abuse confirmed by review.',
): SuspensionDecision {
  if (record.state === 'HARD') {
    return { record, effects: [], changed: false };
  }
  return hardSuspend(record, now, note);
}

function hardSuspend(
  record: SuspensionRecord,
  now: Date,
  note: string,
): SuspensionDecision {
  const nowIso = now.toISOString();
  return {
    record: {
      ...record,
      state: 'HARD',
      hardSuspendedAt: nowIso,
      reviewWindowEndsAt: null,
      reason: note,
    },
    changed: true,
    effects: [
      {
        type: 'EMAIL_OWNER',
        template: 'HARD_SUSPEND_NOTICE',
        reason: note,
        reviewWindowEndsAt: null,
      },
      {
        type: 'NOTIFY_CONNER',
        reason: `Hard-suspended ${record.workspaceId}: ${note}`,
        severity: 'HIGH',
      },
    ],
  };
}

/**
 * Whether a soft suspension's 24h review window has aged out with no upheld
 * appeal. This is the INPUT to a Conner-approved auto-escalation; it does NOT
 * escalate on its own. A cron that wants to auto-hard-suspend reads this and
 * calls `confirmAbuse` only once the escalation timeline is signed off.
 */
export function reviewWindowExpired(
  record: SuspensionRecord,
  now: Date,
): boolean {
  if (record.state !== 'SOFT' || record.reviewWindowEndsAt == null) return false;
  // An open / upheld appeal pauses the clock.
  if (record.appeal && record.appeal.outcome !== 'REJECTED') return false;
  return now.getTime() > new Date(record.reviewWindowEndsAt).getTime();
}

// ── Persistence port ─────────────────────────────────────────────────────

/**
 * Storage seam for the suspension record. The production implementation reads
 * and writes `Workspace.settings.abuse` (a JSON sub-key — no schema migration);
 * tests use the in-memory implementation below. Two implementations satisfy the
 * two-implementation rule (`feedback_runner_portability`).
 */
export interface SuspensionStore {
  read(workspaceId: string): Promise<SuspensionRecord>;
  write(record: SuspensionRecord): Promise<void>;
}

/** Deterministic in-memory store for tests + local runs. */
export class InMemorySuspensionStore implements SuspensionStore {
  private readonly map = new Map<string, SuspensionRecord>();
  async read(workspaceId: string): Promise<SuspensionRecord> {
    return this.map.get(workspaceId) ?? emptySuspension(workspaceId);
  }
  async write(record: SuspensionRecord): Promise<void> {
    this.map.set(record.workspaceId, record);
  }
}
