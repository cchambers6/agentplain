/**
 * lib/fleet/activation.ts
 *
 * Wave-7 agent-activation seam — solves pride theme #4 ("activate dormant
 * agents — charters with no live caller") WITHOUT auto-enabling any live
 * fire.
 *
 * ── The safety model (read this before changing the defaults) ──
 * Activation here is *wiring + a default-OFF master switch*, NOT a green
 * light to start firing against Conner's real systems. The semantic is the
 * deliberate INVERSE of `lib/inngest/disable-flag.ts`:
 *
 *   • disable-flag  → fail-OPEN. A function runs unless someone disables it.
 *     (Correct for the standing crons that are already live + trusted.)
 *   • activation    → fail-CLOSED. A charter stays DORMANT unless BOTH
 *     (a) the fleet master switch is ON, AND
 *     (b) that specific agent has been deliberately activated.
 *
 * So merging this PR changes nothing operationally: every dormant agent is
 * shipped activation-READY but still dormant. Flipping one live is a
 * deliberate, per-agent act (Conner's call) — set the master switch ON,
 * then activate the chosen agent slug. No code change needed to flip an
 * agent later.
 *
 * ── Persistence (no new migration) ──
 * Per the Wave-7 brief: reuse existing durable seams, add NO Prisma
 * migration. We reuse the `OpsFlag` table via the vendor-neutral
 * `OpsFlagStore` (`lib/ops/flag-store.ts`) — the same store the Inngest
 * disable-gate already reads. Activation state lives as rows:
 *
 *     AGENT_ACTIVE_<NORMALIZED_SLUG> = "true"   → activated
 *     (row absent / any other value)            → dormant
 *
 * The master switch is an env var (`FLEET_ACTIVATION_MASTER`) so the whole
 * fleet can be frozen with one flag at the platform boundary, independent
 * of any per-agent DB state. Default (unset / anything but "on") = OFF.
 *
 * Per `feedback_cold_start_safe_agents.md`: every check reads the durable
 * row fresh (no in-process cache). Activation is correctness, not
 * performance — a dormant agent that started firing because of a stale
 * cache would be a safety violation.
 *
 * Per `feedback_no_silent_vendor_lock.md` + `feedback_runner_portability.md`:
 * the store is injected (`InMemoryOpsFlagStore` in tests; the Prisma store
 * in production), so this module never imports `@prisma/client`.
 */

import type { OpsFlagStore } from '@/lib/ops/flag-store';

/** Env var that gates the ENTIRE activation seam. Until this is set to the
 *  literal `"on"`, NO agent activates regardless of per-agent DB state.
 *  Strict equality (not truthy) so a typo defaults to OFF — the safe
 *  direction for an activation switch. */
export const FLEET_ACTIVATION_MASTER_ENV = 'FLEET_ACTIVATION_MASTER';

/** Per-agent activation flag prefix in the OpsFlag table. */
export const AGENT_ACTIVE_FLAG_PREFIX = 'AGENT_ACTIVE_';

/**
 * The agents this seam knows how to activate. These are the "charters with
 * a standing daily/weekly loop but shipped dormant" — each maps to the
 * Inngest cron that already exists for it and the skill it fires. Adding a
 * newly-wired charter = append one row here (the single seam, per the
 * no-vendor-lock rule).
 *
 * Every entry's `firePathGated` MUST be true before it can be listed as
 * activation-ready: an agent we would flip live has to already pass through
 * `gateSkillFire` (vacation pause + schedule window) on its fire path.
 * Wave-7 wires that gate into the five sweeps below, so all five qualify.
 */
export interface ActivatableAgent {
  /** Stable activation slug — normalized into the OpsFlag name. */
  slug: string;
  /** Human label for the operator surface. */
  name: string;
  /** The skill slug this agent fires. */
  skillSlug: string;
  /** Discipline the skill is tagged under (one of `lib/disciplines`). */
  disciplineId: string;
  /** Inngest function id of the standing cron that drives this agent. */
  cronFunctionId: string;
  /** Plain-English cadence for the operator panel. */
  cadence: string;
  /** True once the fire path calls `gateSkillFire`. Gate of record for
   *  "may this be flipped live." */
  firePathGated: boolean;
}

/**
 * Activation-READY agents. All five are dormant-by-default standing sweeps
 * whose fire path passes through `gateSkillFire` as of Wave-7. The
 * follow-up-chaser + chief-of-staff scheduler are intentionally ABSENT:
 * they are already live callers (not dormant), so they are not part of the
 * activation seam — flipping them is governed by the existing disable-flag,
 * not this opt-in.
 */
export const ACTIVATABLE_AGENTS: readonly ActivatableAgent[] = [
  {
    slug: 'analytics-weekly-pulse',
    name: 'Analytics weekly pulse',
    skillSlug: 'analytics-weekly-pulse-general',
    disciplineId: 'analytics',
    cronFunctionId: 'agentplain-analytics-weekly-pulse-sweep',
    cadence: 'Weekly (Mondays 13:00 UTC)',
    firePathGated: true,
  },
  {
    slug: 'finance-pulse',
    name: 'Finance weekly pulse',
    skillSlug: 'finance-pulse-general',
    disciplineId: 'finance',
    cronFunctionId: 'agentplain-finance-pulse-sweep',
    cadence: 'Weekly (Mondays 13:05 UTC)',
    firePathGated: true,
  },
  {
    slug: 'compliance-watch',
    name: 'Compliance watch',
    skillSlug: 'compliance-watch-general',
    disciplineId: 'legal',
    cronFunctionId: 'agentplain-compliance-watch-sweep',
    cadence: 'Daily (13:00 UTC)',
    firePathGated: true,
  },
  {
    slug: 'content-calendar-drafter',
    name: 'Content calendar drafter',
    skillSlug: 'content-calendar-drafter-general',
    disciplineId: 'marketing',
    cronFunctionId: 'agentplain-content-calendar-sweep',
    cadence: 'Weekly (Mondays 13:00 UTC)',
    firePathGated: true,
  },
  {
    slug: 'process-doc-drafter',
    name: 'Process-doc drafter',
    skillSlug: 'process-doc-drafter-general',
    disciplineId: 'operations',
    cronFunctionId: 'agentplain-process-doc-drafter-sweep',
    cadence: 'Weekly',
    firePathGated: true,
  },
];

/** Resolve an activation slug to its record, or null. */
export function getActivatableAgent(slug: string): ActivatableAgent | null {
  return ACTIVATABLE_AGENTS.find((a) => a.slug === slug) ?? null;
}

/**
 * Compute the OpsFlag name that holds a given agent's activation state.
 *
 * Normalization mirrors `disableFlagEnvName`: dashes → underscores, ASCII
 * letters → upper-case. Keeping the two normalizers consistent means an
 * operator reading the OpsFlag table sees the same shape for both gates.
 *
 *   analytics-weekly-pulse → AGENT_ACTIVE_ANALYTICS_WEEKLY_PULSE
 */
export function agentActivationFlagName(slug: string): string {
  if (typeof slug !== 'string' || slug.length === 0) {
    throw new Error('agentActivationFlagName: slug must be a non-empty string');
  }
  return `${AGENT_ACTIVE_FLAG_PREFIX}${slug.replace(/-/g, '_').toUpperCase()}`;
}

/**
 * Is the fleet-wide master activation switch ON?
 *
 * Strict equality with `"on"` — any other value (unset, "", "off", "true",
 * "1", "On") returns false. The activation switch defaults to the SAFE
 * direction (OFF) on a typo, the opposite of the disable flag's "default
 * active on a typo" (which is the safe direction for a kill switch).
 */
export function isFleetActivationMasterOn(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return env[FLEET_ACTIVATION_MASTER_ENV] === 'on';
}

export interface AgentActivationResult {
  /** True iff master is ON AND the agent's flag row is "true". */
  active: boolean;
  /** Why the agent is dormant (when `active` is false). */
  reason:
    | 'active'
    | 'master-off'
    | 'agent-not-activated'
    | 'unknown-agent'
    | 'store-error';
  /** Human-renderable detail for the operator surface. */
  detail: string;
}

export interface IsAgentActivatedArgs {
  /** Activation slug (must be in `ACTIVATABLE_AGENTS`). */
  slug: string;
  /** DB-backed flag store. Tests pass `InMemoryOpsFlagStore`. */
  store: OpsFlagStore;
  /** Env snapshot for the master switch. Defaults to `process.env`. */
  env?: NodeJS.ProcessEnv;
}

/**
 * The single "may this dormant agent fire right now?" check.
 *
 * Fail-CLOSED at every branch:
 *   - master OFF                → dormant
 *   - unknown slug             → dormant (never invent activation)
 *   - flag row absent / ≠"true" → dormant
 *   - store read error          → dormant (a DB blip must NOT silently
 *     activate a charter — the safe direction for an opt-in is OFF)
 *
 * Note the store-error direction is the OPPOSITE of `gateSkillFire`'s
 * fail-OPEN: a transient blip there must not stop an already-live agent,
 * but a transient blip HERE must not start a dormant one.
 */
export async function isAgentActivated(
  args: IsAgentActivatedArgs,
): Promise<AgentActivationResult> {
  const env = args.env ?? process.env;

  if (!isFleetActivationMasterOn(env)) {
    return {
      active: false,
      reason: 'master-off',
      detail: `Fleet activation master switch (${FLEET_ACTIVATION_MASTER_ENV}) is OFF — every agent stays dormant.`,
    };
  }

  const agent = getActivatableAgent(args.slug);
  if (!agent) {
    return {
      active: false,
      reason: 'unknown-agent',
      detail: `No activatable agent registered for slug '${args.slug}'.`,
    };
  }

  const flagName = agentActivationFlagName(agent.slug);
  const read = await args.store.get(flagName);
  if (!read.ok) {
    return {
      active: false,
      reason: 'store-error',
      detail: `Activation flag store unreachable for '${agent.slug}' — failing CLOSED (dormant).`,
    };
  }
  if (read.value === null || read.value.value !== 'true') {
    return {
      active: false,
      reason: 'agent-not-activated',
      detail: `Agent '${agent.slug}' has not been activated (set ${flagName}='true' to flip it live).`,
    };
  }

  return {
    active: true,
    reason: 'active',
    detail: `Agent '${agent.slug}' is activated.`,
  };
}

/**
 * Deliberately flip an agent ON or OFF. The operator/CLI seam that an
 * activation surface would call. Writes the OpsFlag row; the next cron tick
 * reads it fresh. Does NOT touch the master switch — that's an env-level
 * lever changed at the platform boundary.
 */
export async function setAgentActivation(args: {
  slug: string;
  active: boolean;
  store: OpsFlagStore;
  updatedBy?: string | null;
  note?: string | null;
}): Promise<AgentActivationResult> {
  const agent = getActivatableAgent(args.slug);
  if (!agent) {
    return {
      active: false,
      reason: 'unknown-agent',
      detail: `No activatable agent registered for slug '${args.slug}'.`,
    };
  }
  const flagName = agentActivationFlagName(agent.slug);
  const write = await args.store.set(flagName, args.active ? 'true' : 'false', {
    updatedBy: args.updatedBy ?? null,
    note: args.note ?? null,
  });
  if (!write.ok) {
    return {
      active: false,
      reason: 'store-error',
      detail: `Failed to write activation flag for '${agent.slug}'.`,
    };
  }
  return args.active
    ? { active: true, reason: 'active', detail: `Agent '${agent.slug}' activated.` }
    : {
        active: false,
        reason: 'agent-not-activated',
        detail: `Agent '${agent.slug}' deactivated (dormant).`,
      };
}
