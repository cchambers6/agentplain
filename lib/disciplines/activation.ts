/**
 * lib/disciplines/activation.ts
 *
 * Read + write boundary for the customer-facing "Discipline panel" toggle
 * introduced by the Strand 3 UX wedge (2026-05-28). Persisted state lives
 * on `WorkspacePreference.disabledDisciplines` (TEXT[]); this module is
 * the only file that touches that column.
 *
 * Default is ON for every discipline — a workspace with no preference row
 * (or an empty `disabledDisciplines` array) gets every discipline
 * enabled. Toggling OFF appends the discipline id to the array; toggling
 * ON removes it.
 *
 * Per `feedback_no_silent_vendor_lock.md`: callers receive plain views,
 * never Prisma model types. Every read + write is wrapped in `withRls`.
 *
 * Wave 1 scope (per the brief): the panel exists, the wiring deepens in
 * later waves. The activation flag is the truth source the later runtime
 * layers will read; for Wave 1 the toggle is UI-only + persisted, and
 * nothing else in the runtime gates on it yet. The Discipline panel +
 * detail page DO honor the flag for the visible state.
 */

import { z } from 'zod';
import { withRls, type RlsContext } from '@/lib/db/rls';
import { asDisciplineId, DISCIPLINE_IDS, type DisciplineId } from './index';

const ToggleArgsSchema = z.object({
  workspaceId: z.string().uuid(),
  discipline: z.enum(DISCIPLINE_IDS as unknown as [DisciplineId, ...DisciplineId[]]),
  enabled: z.boolean(),
});

export type DisciplineToggleArgs = z.infer<typeof ToggleArgsSchema>;

/** Per-discipline activation snapshot for a workspace. */
export interface DisciplineActivationState {
  /** Set of discipline ids the customer has explicitly turned OFF. */
  disabled: readonly DisciplineId[];
}

interface PrismaPreferenceSlice {
  disabledDisciplines: string[];
}

/** Read the workspace's activation state. Returns an empty set when no
 *  preference row exists yet — every discipline is enabled by default. */
export async function getActivationState(
  ctx: RlsContext,
  workspaceId: string,
): Promise<DisciplineActivationState> {
  return withRls(ctx, async (tx) => {
    const row = (await tx.workspacePreference.findUnique({
      where: { workspaceId },
      select: { disabledDisciplines: true },
    })) as PrismaPreferenceSlice | null;
    const disabled = (row?.disabledDisciplines ?? [])
      .map((d) => asDisciplineId(d))
      .filter((d): d is DisciplineId => d !== null);
    return { disabled };
  });
}

/** True when the discipline is enabled for the workspace (the default). */
export function isDisciplineEnabled(
  state: DisciplineActivationState,
  discipline: DisciplineId,
): boolean {
  return !state.disabled.includes(discipline);
}

/** Toggle a discipline on or off. Idempotent — repeated ON / OFF requests
 *  for the same discipline produce the same final state. */
export async function setDisciplineEnabled(
  ctx: RlsContext,
  args: DisciplineToggleArgs,
): Promise<DisciplineActivationState> {
  const parsed = ToggleArgsSchema.parse(args);
  return withRls(ctx, async (tx) => {
    const existing = (await tx.workspacePreference.findUnique({
      where: { workspaceId: parsed.workspaceId },
      select: { disabledDisciplines: true },
    })) as PrismaPreferenceSlice | null;
    const prior = new Set(existing?.disabledDisciplines ?? []);
    if (parsed.enabled) {
      prior.delete(parsed.discipline);
    } else {
      prior.add(parsed.discipline);
    }
    const next = Array.from(prior);
    const row = (await tx.workspacePreference.upsert({
      where: { workspaceId: parsed.workspaceId },
      create: {
        workspaceId: parsed.workspaceId,
        disabledDisciplines: next,
      },
      update: { disabledDisciplines: next },
      select: { disabledDisciplines: true },
    })) as PrismaPreferenceSlice;
    const disabled = row.disabledDisciplines
      .map((d) => asDisciplineId(d))
      .filter((d): d is DisciplineId => d !== null);
    return { disabled };
  });
}
