/**
 * lib/inngest/sweep-fire-gate.ts
 *
 * Wave-7 shared gate for the standing skill-firing sweeps.
 *
 * Composes the TWO Wave-7 gates that every dormant-activatable sweep must
 * pass before it fires a skill on a workspace, in the correct order:
 *
 *   1. ACTIVATION (default-OFF) — `lib/fleet/activation.ts`. Fail-CLOSED:
 *      the agent stays dormant unless the fleet master switch is ON AND the
 *      agent has been deliberately activated. This is the master switch that
 *      keeps the whole seam inert until Conner flips an agent live.
 *
 *   2. CUSTOMER FIRE GATE — `gateSkillFire` (`lib/skills/fire-gate.ts`).
 *      Fail-OPEN on a transient DB blip: an already-activated agent honors
 *      the customer's /settings/pause (vacation) + /settings/schedule
 *      window. The audit note "Any NEW skill caller must call gateSkillFire"
 *      is satisfied for every sweep by routing through here.
 *
 * The ordering matters: activation is checked FIRST so a dormant agent never
 * even reads the customer's pause/schedule tables — dormant means *nothing
 * fires*, full stop. Only an activated agent proceeds to honor the customer
 * control gate.
 *
 * Per `feedback_runner_portability.md`: both gates are injectable so a sweep
 * test can pin a deterministic decision without standing up Prisma or the
 * OpsFlag store.
 *
 * Per `feedback_cold_start_safe_agents.md`: both underlying checks read
 * durable state fresh per call. No cache lives here.
 */

import { withSystemContext } from '@/lib/db/rls';
import {
  gateSkillFire,
  type FireGateOutcome,
} from '@/lib/skills/fire-gate';
import {
  isAgentActivated,
  type AgentActivationResult,
} from '@/lib/fleet/activation';
import type { OpsFlagStore } from '@/lib/ops/flag-store';

export type SweepFireDecision =
  | { fire: true }
  | { fire: false; gate: 'activation'; detail: string }
  | { fire: false; gate: 'fire-gate'; reason: string; detail: string };

export interface SweepGateArgs {
  workspaceId: string;
  /** Activation slug (must be in `ACTIVATABLE_AGENTS`). */
  agentSlug: string;
  /** Skill slug the sweep fires — passed to `gateSkillFire`. */
  skillSlug: string;
  /** Discipline the skill is tagged under. */
  disciplineId: string;
  now?: Date;
  /** Activation-check override. Tests inject a deterministic result;
   *  production leaves undefined and the live OpsFlag store is used. */
  isActivated?: (slug: string) => Promise<AgentActivationResult>;
  /** Customer fire-gate override. Tests inject; production leaves undefined
   *  and the live WorkspacePauseConfig + SkillScheduleWindow read runs. */
  gateFire?: (workspaceId: string) => Promise<FireGateOutcome>;
  /** OpsFlag store for the live activation read. Defaults to the lazy
   *  Prisma store; tests inject `InMemoryOpsFlagStore`. Ignored when
   *  `isActivated` is provided. */
  activationStore?: OpsFlagStore;
}

/**
 * Lazily-constructed default OpsFlag store for the activation read. Imported
 * dynamically so this module stays edge-importable and a test that injects
 * `isActivated`/`activationStore` never touches `@prisma/client`.
 */
let _defaultActivationStore: OpsFlagStore | null = null;
async function getDefaultActivationStore(): Promise<OpsFlagStore> {
  if (_defaultActivationStore) return _defaultActivationStore;
  const { PrismaOpsFlagStore } = await import('@/lib/ops/prisma-flag-store');
  _defaultActivationStore = new PrismaOpsFlagStore();
  return _defaultActivationStore;
}

/** Test-only: reset the lazy store so a test can re-prime it. */
export function __resetActivationStoreForTests(): void {
  _defaultActivationStore = null;
}

/**
 * Single "should this sweep fire for this workspace right now?" decision.
 *
 * Returns `{ fire: true }` only when the agent is activated AND the customer
 * fire gate allows. Otherwise returns the gate that blocked + a reason so
 * the caller can increment the right honest skip counter.
 */
export async function shouldSweepFire(
  args: SweepGateArgs,
): Promise<SweepFireDecision> {
  // 1. Activation (default-OFF, fail-CLOSED). A dormant agent does not even
  //    read the customer pause/schedule tables.
  const activation = args.isActivated
    ? await args.isActivated(args.agentSlug)
    : await isAgentActivated({
        slug: args.agentSlug,
        store: args.activationStore ?? (await getDefaultActivationStore()),
      }).catch(
        (): AgentActivationResult => ({
          active: false,
          reason: 'store-error',
          detail:
            'Activation store unreachable — failing CLOSED (dormant).',
        }),
      );
  if (!activation.active) {
    return { fire: false, gate: 'activation', detail: activation.detail };
  }

  // 2. Customer fire gate (fail-OPEN on transient error). Honors
  //    /settings/pause + /settings/schedule for the now-active agent.
  const gate = args.gateFire
    ? await args.gateFire(args.workspaceId)
    : await withSystemContext((tx) =>
        gateSkillFire({
          tx,
          workspaceId: args.workspaceId,
          skillSlug: args.skillSlug,
          disciplineId: args.disciplineId,
          now: args.now,
        }),
      ).catch((): FireGateOutcome => ({ allowed: true }));
  if (!gate.allowed) {
    return {
      fire: false,
      gate: 'fire-gate',
      reason: gate.reason,
      detail: gate.detail,
    };
  }

  return { fire: true };
}
