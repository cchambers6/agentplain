/**
 * lib/skills/bounded-execute.ts
 *
 * Wave-3 (audit-resolution roadmap, pride theme #5 — "the autonomy leap"):
 * BOUNDED AUTO-EXECUTE under a $/risk threshold.
 *
 * ── What this is ──
 * Today every skill DRAFTS and STAGES for human approval. `approval-
 * threshold.ts` (Wave-1) added a first auto-approve path keyed on draft
 * *confidence*. This module is the next, stricter layer: it lets a small
 * set of PRE-APPROVED, low-blast-radius action classes flip from PENDING
 * to AUTO_APPROVED **without** owner approval when ALL of the following
 * hold — the leap from "drafts work" to "does the boring 80%":
 *
 *   1. the action class is on the reversibility ALLOWLIST (hardcoded —
 *      high-risk / compliance-touching kinds are NEVER eligible);
 *   2. the fleet-wide master switch is ON (env, fail-closed);
 *   3. that specific class has been deliberately enabled (OpsFlag row —
 *      per-workspace scoped row first, then the fleet-wide row; cv-x1
 *      makes the OWNER's own setting govern their workspace, see
 *      AUTO_EXEC_WORKSPACE_SCOPE_PREFIX);
 *   4. the estimated dollar/risk of the action is at or below the
 *      effective per-class ceiling — min(workspace, fleet), lower-only,
 *      with a low conservative default when unset;
 *   5. every standing fire gate already passed for this fire —
 *      `gateSkillFire` (vacation/schedule), billing pause, and the
 *      Wave-7 activation gate. This module COMPOSES with those gates; it
 *      does not re-implement them. The caller threads their outcomes in
 *      via `gatesPassed`, and this layer fails CLOSED if any did not pass.
 *
 * When all five hold → AUTO_APPROVED + an immutable AuditLog row records
 * exactly what was done on the owner's behalf, so the activity feed and
 * audit log show it. Otherwise → PENDING (the safe default), unchanged.
 *
 * ── No-outbound constraint (project_no_outbound_architecture.md) ──
 * "Auto-execute" here NEVER means agentplain sends. It means auto-APPROVE
 * + auto-stage the action into the customer's own execution path (their
 * email outbox, their calendar adapter, their CRM). AUTO_APPROVED is "the
 * workspace pre-blessed this draft for its downstream pickup", not "we
 * sent it." Twilio/SendGrid/dialers remain forbidden on our surface.
 *
 * ── Default = CONSERVATIVE (everything OFF) ──
 * This PR ships the MECHANISM. Every action class is OFF until Conner
 * deliberately enables it AND sets a ceiling. Merging changes nothing
 * operationally — the master switch defaults OFF and no class is enabled.
 *
 * ── Cold-start safety (feedback_cold_start_safe_agents.md) ──
 * Auto-execute is CORRECTNESS, not performance. Every decision reads the
 * durable policy fresh (OpsFlag rows + env) — never a cache. A dormant
 * class that started firing because of a stale read would be a safety
 * violation, so every branch fails CLOSED (→ PENDING) on doubt: master
 * off, class not enabled, store read error, missing/zero ceiling,
 * estimate over ceiling, any standing gate not passed.
 *
 * ── No vendor lock (feedback_no_silent_vendor_lock.md) ──
 * Policy persists through the injected `OpsFlagStore` (the same store the
 * activation seam + Inngest disable-gate use). This module imports no
 * `@prisma/client`. The AuditLog write is delegated to a small injected
 * sink so the pure policy decision is testable offline.
 */

import type { WorkApprovalKind, WorkApprovalStatus } from '@prisma/client';
import type { OpsFlagStore } from '@/lib/ops/flag-store';

/** Env var gating the ENTIRE bounded-execute seam. Until set to the
 *  literal `"on"`, NO class auto-executes regardless of per-class DB
 *  state. Strict equality (not truthy) so a typo defaults OFF — the safe
 *  direction for an auto-execute switch. Mirrors the activation seam. */
export const BOUNDED_AUTO_EXECUTE_MASTER_ENV = 'BOUNDED_AUTO_EXECUTE_MASTER';

/** Per-class enable flag prefix in the OpsFlag table. */
export const AUTO_EXEC_ENABLED_FLAG_PREFIX = 'AUTO_EXEC_';

/** Per-class dollar-ceiling flag prefix in the OpsFlag table. */
export const AUTO_EXEC_CEILING_FLAG_PREFIX = 'AUTO_EXEC_CEILING_';

/**
 * Workspace-scope suffix for per-workspace policy rows. The OpsFlag table
 * is a flat key-value store, so workspace scoping is encoded in the flag
 * NAME: `AUTO_EXEC_<KIND>:ws_<workspaceId>`. The unscoped name remains
 * the fleet-wide row — every flag that exists today keeps working
 * unchanged (backward compatible by construction).
 *
 * ── Per-workspace resolution order (cv-x1) ──
 * One customer's comfort level must not be every customer's policy, so
 * each decision resolves policy in this order, reading fresh every time:
 *
 *   ENABLE:  workspace-scoped row → fleet-wide row → default OFF
 *     - scoped value 'true'        → enabled for this workspace
 *     - scoped value '' (cleared)  → no workspace preference; fall through
 *                                    to the fleet-wide row
 *     - scoped value anything else → explicit workspace OPT-OUT — beats a
 *                                    fleet-wide enable (fail closed)
 *     - no scoped row              → fleet-wide row decides (legacy)
 *
 *   CEILING: effective = min(workspace ceiling, fleet ceiling)
 *     - the workspace ceiling can only LOWER the fleet ceiling, never
 *       raise it. A workspace row above the fleet ceiling clamps DOWN to
 *       the fleet value. Absent/cleared workspace row → fleet ceiling
 *       (which itself falls back to the conservative default).
 *
 * The reversibility ALLOWLIST stays hardcoded above BOTH scopes: no
 * workspace (and no fleet flag) can opt a non-allowlisted kind in. Any
 * store read error at either scope fails CLOSED (→ PENDING).
 */
export const AUTO_EXEC_WORKSPACE_SCOPE_PREFIX = ':ws_';

/** Compose the workspace-scope suffix for a flag name. */
export function autoExecWorkspaceScope(workspaceId: string): string {
  return `${AUTO_EXEC_WORKSPACE_SCOPE_PREFIX}${workspaceId}`;
}

/**
 * Conservative default ceiling (USD) applied to an enabled class that has
 * NO explicit ceiling row. Deliberately low: an enabled-but-unbounded
 * class would defeat the "$/risk threshold" promise, so we cap it at a
 * coffee-money blast radius until Conner sets a real number.
 */
export const DEFAULT_AUTO_EXEC_CEILING_USD = 5;

/**
 * The REVERSIBILITY ALLOWLIST — the only action classes that may EVER
 * auto-execute, with the maximum dollar/risk each class can carry. A
 * class absent here is NEVER eligible regardless of OpsFlag state (the
 * compliance / security / pricing / high-blast kinds). This is the
 * hardcoded safety floor that no operator toggle can override.
 *
 * `estUsd` is the conservative ESTIMATED dollar blast radius of letting
 * the action proceed unattended — NOT a token cost. It is what the
 * per-class ceiling is compared against. The estimate is intentionally
 * pessimistic (worst-case for the class) so the ceiling check errs toward
 * requiring approval.
 *
 *   - ADMIN_BILLING_NOTICE: an internal "noted receipt" acknowledgement
 *     draft staged to the customer's outbox. No money moves; reversible
 *     (it is a draft they can delete). estUsd 0.
 *   - ADMIN_TRIAL_ENDING: an internal reminder/no-op file. Filing a
 *     reminder moves no money and is reversible. estUsd 0. (Note: a
 *     trial-CANCEL that stops a recurring charge is NOT this kind — that
 *     would be a distinct, money-moving action and is deliberately absent
 *     from this allowlist.)
 *   - FOLLOW_UP_NUDGE: an invoice-chase / follow-up reply draft staged
 *     to the owner's outbox. Reversible (a draft), low blast — the
 *     downside of an unwanted nudge is a slightly-too-eager email, not a
 *     financial loss. estUsd 0.
 *   - CHIEF_OF_STAFF_TODO: a to-do row written to the workspace. Purely
 *     internal, trivially reversible. estUsd 0.
 *   - CHIEF_OF_STAFF_MEETING: a booking confirmation staged to an
 *     ALREADY-CONNECTED calendar adapter. Reversible (one-tap cancel /
 *     reschedule). Low but non-zero blast (a misbooked slot wastes
 *     someone's time), so a small estUsd keeps it under a tight ceiling.
 *   - ADMIN_VERIFICATION_CODE: surfacing a one-time code is read-only —
 *     nothing executes, the card just gets auto-filed. Reversible. estUsd 0.
 *
 * EXCLUDED ON PURPOSE (never auto-execute): COMPLIANCE_FLAG,
 * COMPLIANCE_DIGEST, ADMIN_SECURITY_ALERT, ADMIN_PASSWORD_RESET,
 * PRICING_RECOMMENDATION, LISTING_RECOMMENDATION, LEAD_TRIAGE,
 * BUYER_INQUIRY_REPLY_DRAFT, PLAINO_INSTRUCTION, and the rest — these are
 * either compliance-touching, money-/reputation-moving, or carry a draft
 * to an external counterparty where a wrong call is hard to walk back.
 * They route through normal approval (and compliance kinds through
 * Sentinel) always.
 */
export interface AllowlistedClass {
  kind: WorkApprovalKind;
  /** Conservative worst-case dollar blast radius for the class. */
  estUsd: number;
  /** Plain-English why-it's-reversible, for the operator surface + audit. */
  reversibility: string;
}

export const AUTO_EXEC_ALLOWLIST: readonly AllowlistedClass[] = [
  {
    kind: 'ADMIN_BILLING_NOTICE',
    estUsd: 0,
    reversibility:
      'Stages an internal "noted receipt" acknowledgement draft. No money moves; the draft is deletable before the owner sends.',
  },
  {
    kind: 'ADMIN_TRIAL_ENDING',
    estUsd: 0,
    reversibility:
      'Files an internal trial/renewal reminder. No money moves; reversible. (Does NOT cancel a trial or stop a charge.)',
  },
  {
    kind: 'ADMIN_VERIFICATION_CODE',
    estUsd: 0,
    reversibility:
      'Auto-files a surfaced one-time code card. Read-only — nothing executes against any external system.',
  },
  {
    kind: 'FOLLOW_UP_NUDGE',
    estUsd: 0,
    reversibility:
      'Stages an invoice-chase / follow-up reply draft to the owner’s outbox. Reversible (a draft); worst case is a slightly-too-eager email.',
  },
  {
    kind: 'CHIEF_OF_STAFF_TODO',
    estUsd: 0,
    reversibility: 'Writes an internal to-do row. Trivially reversible.',
  },
  {
    kind: 'CHIEF_OF_STAFF_MEETING',
    estUsd: 2,
    reversibility:
      'Stages a booking confirmation to an already-connected calendar adapter. One-tap cancel / reschedule; low blast.',
  },
] as const;

/** Resolve an allowlist entry for a kind, or null when the kind is never
 *  eligible. Single lookup seam so every check goes through one place. */
export function getAllowlistedClass(
  kind: WorkApprovalKind,
): AllowlistedClass | null {
  return AUTO_EXEC_ALLOWLIST.find((c) => c.kind === kind) ?? null;
}

/** True when the kind is on the reversibility allowlist at all. */
export function isAutoExecEligibleKind(kind: WorkApprovalKind): boolean {
  return getAllowlistedClass(kind) !== null;
}

/** OpsFlag name holding a class's enable state. Unscoped = fleet-wide
 *  (legacy rows keep working unchanged); pass a workspaceId for the
 *  workspace-scoped row.
 *  ADMIN_BILLING_NOTICE         → AUTO_EXEC_ADMIN_BILLING_NOTICE
 *  ADMIN_BILLING_NOTICE + ws-1  → AUTO_EXEC_ADMIN_BILLING_NOTICE:ws_ws-1 */
export function autoExecEnabledFlagName(
  kind: WorkApprovalKind,
  workspaceId?: string,
): string {
  const base = `${AUTO_EXEC_ENABLED_FLAG_PREFIX}${kind}`;
  return workspaceId ? `${base}${autoExecWorkspaceScope(workspaceId)}` : base;
}

/** OpsFlag name holding a class's dollar ceiling (whole USD as a string).
 *  Unscoped = fleet-wide; pass a workspaceId for the workspace-scoped row.
 *  ADMIN_BILLING_NOTICE → AUTO_EXEC_CEILING_ADMIN_BILLING_NOTICE */
export function autoExecCeilingFlagName(
  kind: WorkApprovalKind,
  workspaceId?: string,
): string {
  const base = `${AUTO_EXEC_CEILING_FLAG_PREFIX}${kind}`;
  return workspaceId ? `${base}${autoExecWorkspaceScope(workspaceId)}` : base;
}

/**
 * Is the fleet-wide bounded-execute master switch ON?
 *
 * Strict equality with `"on"` — any other value (unset, "", "off",
 * "true", "1", "On") returns false. Defaults OFF on a typo — the safe
 * direction for an auto-execute switch.
 */
export function isBoundedAutoExecuteMasterOn(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return env[BOUNDED_AUTO_EXECUTE_MASTER_ENV] === 'on';
}

/** Every reason a bounded-execute decision can resolve to. The `*` reasons
 *  are the deny branches (→ PENDING); `auto-executed` is the single allow. */
export type BoundedExecuteReason =
  | 'auto-executed'
  | 'master-off'
  | 'kind-not-eligible'
  | 'class-not-enabled'
  | 'store-error'
  | 'gate-not-passed'
  | 'over-ceiling';

export interface BoundedExecuteDecision {
  /** True only on the single allow branch. */
  autoExecute: boolean;
  reason: BoundedExecuteReason;
  /** Human-renderable detail for the operator surface + audit payload. */
  detail: string;
  /** The estimated dollar blast radius evaluated (when a kind was
   *  eligible), else null. Surfaced for the audit row. */
  estUsd: number | null;
  /** The ceiling the estimate was checked against (USD), else null. */
  ceilingUsd: number | null;
}

/**
 * The standing gates this layer COMPOSES with. The caller has already
 * run these for the current fire (the cron path runs `gateSkillFire` +
 * the billing-pause gate before any LLM call; the activation gate guards
 * dormant agents). We thread their boolean outcomes in rather than
 * re-querying so there is exactly ONE source of truth per gate. Any gate
 * `false` (or omitted) fails this layer CLOSED.
 */
export interface ComposedGateOutcomes {
  /** `gateSkillFire` allowed this fire (vacation / schedule window). */
  fireGatePassed: boolean;
  /** The billing-pause gate said the workspace is NOT paused. */
  billingActive: boolean;
  /** The Wave-7 activation gate allowed the owning agent to fire.
   *  Omit / true for live callers that are not part of the activation
   *  opt-in (they are governed by the disable-flag, not activation). */
  activationPassed?: boolean;
}

/** Where an effective enable/ceiling resolution came from — surfaced on
 *  the decision detail + the owner settings page so both render the SAME
 *  truth the decision path computed. */
export type AutoExecPolicyScope = 'workspace' | 'fleet' | 'default';

export interface ResolvedAutoExecEnabled {
  enabled: boolean;
  /** 'workspace' when a scoped row decided; 'fleet' when the fleet row
   *  did; 'default' when neither row exists (→ OFF). */
  scope: AutoExecPolicyScope;
}

export interface ResolvedAutoExecCeiling {
  /** The effective ceiling: min(workspace, fleet). Lower-only — a
   *  workspace row can never raise the fleet ceiling. */
  ceilingUsd: number;
  /** 'workspace' when the workspace row set (or lowered to) the
   *  effective value; 'fleet' when the fleet row did; 'default' when no
   *  row exists anywhere and the conservative default applies. */
  scope: AutoExecPolicyScope;
}

/**
 * Resolve the per-class enable state: workspace-scoped row → fleet-wide
 * row → default OFF. Fresh durable reads every call (cold-start safety —
 * this is CORRECTNESS, never cache it). Throws nothing; a store failure
 * surfaces as the `OpsResult` error and the caller fails CLOSED.
 *
 * A scoped row with value '' (cleared via the settings surface) means
 * "no workspace preference" and falls through to the fleet row. Any
 * other non-'true' scoped value is an explicit workspace OPT-OUT and
 * beats a fleet-wide enable.
 */
export async function resolveAutoExecEnabled(
  store: OpsFlagStore,
  kind: WorkApprovalKind,
  workspaceId?: string,
): Promise<
  | { ok: true; value: ResolvedAutoExecEnabled }
  | { ok: false; error: string }
> {
  if (workspaceId) {
    const scoped = await store.get(autoExecEnabledFlagName(kind, workspaceId));
    if (!scoped.ok) {
      return { ok: false, error: `workspace-scoped enable flag unreadable for '${kind}'` };
    }
    if (scoped.value !== null && scoped.value.value !== '') {
      // The workspace said something explicit — it decides, both ways.
      return {
        ok: true,
        value: { enabled: scoped.value.value === 'true', scope: 'workspace' },
      };
    }
  }
  const fleet = await store.get(autoExecEnabledFlagName(kind));
  if (!fleet.ok) {
    return { ok: false, error: `fleet-wide enable flag unreadable for '${kind}'` };
  }
  if (fleet.value === null) {
    return { ok: true, value: { enabled: false, scope: 'default' } };
  }
  return {
    ok: true,
    value: { enabled: fleet.value.value === 'true', scope: 'fleet' },
  };
}

/**
 * Resolve the effective per-class ceiling: min(workspace, fleet), where
 * the fleet ceiling itself falls back to the conservative default when
 * unset/garbage. LOWER-ONLY: a workspace ceiling above the fleet ceiling
 * clamps DOWN to the fleet value — no workspace can widen its own blast
 * radius past what the fleet allows. A scoped row with value '' means
 * "no workspace preference" → fleet ceiling.
 */
export async function resolveAutoExecCeiling(
  store: OpsFlagStore,
  kind: WorkApprovalKind,
  workspaceId?: string,
): Promise<
  | { ok: true; value: ResolvedAutoExecCeiling }
  | { ok: false; error: string }
> {
  const fleet = await store.get(autoExecCeilingFlagName(kind));
  if (!fleet.ok) {
    return { ok: false, error: `fleet-wide ceiling flag unreadable for '${kind}'` };
  }
  const fleetCeiling = resolveCeilingUsd(fleet.value?.value ?? null);
  const fleetScope: AutoExecPolicyScope =
    fleet.value === null ? 'default' : 'fleet';

  if (!workspaceId) {
    return { ok: true, value: { ceilingUsd: fleetCeiling, scope: fleetScope } };
  }
  const scoped = await store.get(autoExecCeilingFlagName(kind, workspaceId));
  if (!scoped.ok) {
    return { ok: false, error: `workspace-scoped ceiling flag unreadable for '${kind}'` };
  }
  if (scoped.value === null || scoped.value.value.trim() === '') {
    return { ok: true, value: { ceilingUsd: fleetCeiling, scope: fleetScope } };
  }
  const workspaceCeiling = resolveCeilingUsd(scoped.value.value);
  // Lower-only clamp. When the workspace value is the lower (or equal)
  // one it decided; when it tried to exceed the fleet, the fleet did.
  if (workspaceCeiling <= fleetCeiling) {
    return {
      ok: true,
      value: { ceilingUsd: workspaceCeiling, scope: 'workspace' },
    };
  }
  return { ok: true, value: { ceilingUsd: fleetCeiling, scope: fleetScope } };
}

export interface DecideBoundedExecuteArgs {
  kind: WorkApprovalKind;
  /** DB-backed flag store. Tests pass `InMemoryOpsFlagStore`. */
  store: OpsFlagStore;
  /** Outcomes of the standing gates for THIS fire. */
  gates: ComposedGateOutcomes;
  /** Env snapshot for the master switch. Defaults to `process.env`. */
  env?: NodeJS.ProcessEnv;
  /** Workspace whose autonomy policy governs this decision. When set,
   *  policy resolves workspace-scoped row → fleet-wide row → default OFF
   *  (see AUTO_EXEC_WORKSPACE_SCOPE_PREFIX). When omitted, behavior is
   *  exactly the legacy fleet-wide resolution — backward compatible. */
  workspaceId?: string;
  /** Optional per-item dollar estimate override. When omitted, the
   *  allowlist's conservative class `estUsd` is used. A caller that can
   *  compute a tighter per-item number (e.g. a booking with a known
   *  deposit) passes it here; it is MAXed with the class floor so a
   *  caller can never under-report below the class's worst-case. */
  estUsdOverride?: number;
}

/**
 * The single "may this action auto-execute right now?" decision. Pure
 * over its injected store + env + gate outcomes; never throws. Fails
 * CLOSED at every branch.
 */
export async function decideBoundedExecute(
  args: DecideBoundedExecuteArgs,
): Promise<BoundedExecuteDecision> {
  const env = args.env ?? process.env;

  // 1. Master switch. One env lever freezes the whole seam.
  if (!isBoundedAutoExecuteMasterOn(env)) {
    return deny(
      'master-off',
      `Bounded auto-execute master switch (${BOUNDED_AUTO_EXECUTE_MASTER_ENV}) is OFF — every action stays in the approval queue.`,
    );
  }

  // 2. Reversibility allowlist. The hardcoded safety floor — no operator
  //    toggle can make a non-allowlisted kind eligible.
  const klass = getAllowlistedClass(args.kind);
  if (!klass) {
    return deny(
      'kind-not-eligible',
      `Kind '${args.kind}' is not on the auto-execute reversibility allowlist — always routed to approval.`,
    );
  }

  // 3. Standing gates. We compose, never duplicate. Any gate not passed
  //    fails this layer CLOSED — bounded execute can only ADD safety on
  //    top of the gates, never bypass one.
  if (!args.gates.fireGatePassed) {
    return deny(
      'gate-not-passed',
      'Skill-fire gate (vacation / schedule window) did not pass for this fire.',
      klass.estUsd,
    );
  }
  if (!args.gates.billingActive) {
    return deny(
      'gate-not-passed',
      'Billing-pause gate: workspace is paused — no auto-execute while billing is not current.',
      klass.estUsd,
    );
  }
  if (args.gates.activationPassed === false) {
    return deny(
      'gate-not-passed',
      'Activation gate: the owning agent is dormant — no auto-execute.',
      klass.estUsd,
    );
  }

  // 4. Per-class enable flag (fresh durable reads; fail-closed on error).
  //    Workspace-scoped row → fleet-wide row → default OFF. The OWNER's
  //    own threshold governs their workspace; an explicit workspace
  //    opt-out beats a fleet-wide enable.
  const enabledRead = await resolveAutoExecEnabled(
    args.store,
    args.kind,
    args.workspaceId,
  );
  if (!enabledRead.ok) {
    return deny(
      'store-error',
      `Auto-execute flag store unreachable (${enabledRead.error}) — failing CLOSED (approval queue).`,
      klass.estUsd,
    );
  }
  if (!enabledRead.value.enabled) {
    const who =
      enabledRead.value.scope === 'workspace'
        ? 'this workspace opted out of auto-execute for the class'
        : `set ${autoExecEnabledFlagName(args.kind, args.workspaceId)}='true' to opt in`;
    return deny(
      'class-not-enabled',
      `Action class '${args.kind}' is not enabled for auto-execute (${who}).`,
      klass.estUsd,
    );
  }

  // 5. Dollar/risk ceiling: effective = min(workspace, fleet), fleet
  //    falling back to the conservative default. Lower-only — a
  //    workspace can tighten its ceiling but never widen past the fleet.
  const ceilingRead = await resolveAutoExecCeiling(
    args.store,
    args.kind,
    args.workspaceId,
  );
  if (!ceilingRead.ok) {
    return deny(
      'store-error',
      `Auto-execute ceiling store unreachable (${ceilingRead.error}) — failing CLOSED.`,
      klass.estUsd,
    );
  }
  const ceilingUsd = ceilingRead.value.ceilingUsd;
  const ceilingScope = ceilingRead.value.scope;

  // The evaluated estimate is the MAX of the class floor and any caller
  // override — a caller can tighten upward but never under-report below
  // the class's conservative worst case.
  const estUsd = Math.max(
    klass.estUsd,
    typeof args.estUsdOverride === 'number' && Number.isFinite(args.estUsdOverride)
      ? args.estUsdOverride
      : 0,
  );

  if (estUsd > ceilingUsd) {
    return {
      autoExecute: false,
      reason: 'over-ceiling',
      detail: `Estimated $${estUsd.toFixed(2)} exceeds the $${ceilingUsd.toFixed(2)} (${ceilingScope}) auto-execute ceiling for '${args.kind}' — routed to approval.`,
      estUsd,
      ceilingUsd,
    };
  }

  // All five hold → auto-execute.
  return {
    autoExecute: true,
    reason: 'auto-executed',
    detail: `Auto-executed '${args.kind}': estimated $${estUsd.toFixed(2)} at or below the $${ceilingUsd.toFixed(2)} ceiling (${ceilingScope}); class enabled (${enabledRead.value.scope}); all standing gates passed.`,
    estUsd,
    ceilingUsd,
  };
}

/**
 * Parse a ceiling OpsFlag value (whole/decimal USD as a string) into a
 * usable ceiling. A missing, empty, malformed, or non-positive value
 * resolves to the conservative default — NEVER to "no ceiling". An
 * operator cannot accidentally uncap a class by writing garbage; the
 * worst a typo does is fall back to the tight default.
 */
export function resolveCeilingUsd(raw: string | null): number {
  if (raw === null) return DEFAULT_AUTO_EXEC_CEILING_USD;
  const n = Number.parseFloat(raw.trim());
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_AUTO_EXEC_CEILING_USD;
  return n;
}

function deny(
  reason: Exclude<BoundedExecuteReason, 'auto-executed'>,
  detail: string,
  estUsd: number | null = null,
): BoundedExecuteDecision {
  return { autoExecute: false, reason, detail, estUsd, ceilingUsd: null };
}

// ── Decision → approval-status flip ─────────────────────────────────────

/** The status + reason a caller writes onto the WorkApprovalQueueItem when
 *  bounded-execute fires. Mirrors `ApprovalThresholdDecision` minus the
 *  decidedBy plumbing the persist site already owns. */
export interface BoundedExecuteStatusFlip {
  status: WorkApprovalStatus;
  decisionReason: string;
}

/**
 * Convert an auto-execute decision into the status flip the persist site
 * applies. Returns null when the decision did NOT auto-execute (caller
 * keeps whatever status the prior threshold layer chose — usually
 * PENDING). When it DID, the row becomes AUTO_APPROVED with a reason that
 * names the bounded-execute path so the audit trail is unambiguous about
 * WHY it auto-approved (vs. the Wave-1 confidence path).
 */
export function boundedExecuteStatusFlip(
  decision: BoundedExecuteDecision,
): BoundedExecuteStatusFlip | null {
  if (!decision.autoExecute) return null;
  return {
    status: 'AUTO_APPROVED',
    decisionReason: `auto-executed by bounded-execute policy — ${decision.detail}`,
  };
}
