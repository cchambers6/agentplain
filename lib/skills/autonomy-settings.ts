/**
 * lib/skills/autonomy-settings.ts
 *
 * cv-x1 — the owner-facing read/write seam over the per-workspace
 * bounded-auto-execute policy (lib/skills/bounded-execute.ts).
 *
 * Before this wave, bounded auto-execute keyed ALL policy off fleet-wide
 * OpsFlag rows — one customer's comfort level was every customer's
 * policy. This seam lets each owner set THEIR OWN per-class toggle and
 * dollar ceiling, persisted as workspace-scoped OpsFlag rows
 * (`AUTO_EXEC_<KIND>:ws_<workspaceId>`). Resolution order and the
 * lower-only ceiling clamp live in bounded-execute.ts (the decision
 * path); this module READS through the exact same resolvers so the
 * settings page renders the same truth the decision path computes — no
 * second policy interpretation to drift.
 *
 * Safety floor: the hardcoded reversibility ALLOWLIST is enforced at
 * write time too — this module refuses to write a row for any kind that
 * is not allowlisted, so a workspace can never opt INTO a kind the
 * platform considers irreversible. Workspaces can only opt in/out of
 * allowlisted classes and set a ceiling that clamps to min(workspace,
 * fleet).
 *
 * No vendor lock: pure over the injected `OpsFlagStore` (two
 * implementations — Prisma + in-memory). No `@prisma/client` import.
 * Cold-start safe: every read is a fresh durable read; nothing cached.
 */

import type { WorkApprovalKind } from '@prisma/client';
import type { OpsFlagStore } from '@/lib/ops/flag-store';
import {
  AUTO_EXEC_ALLOWLIST,
  autoExecCeilingFlagName,
  autoExecEnabledFlagName,
  getAllowlistedClass,
  isBoundedAutoExecuteMasterOn,
  resolveAutoExecCeiling,
  resolveAutoExecEnabled,
  type AllowlistedClass,
  type AutoExecPolicyScope,
} from './bounded-execute';

/** The owner's three-way per-class preference. 'inherit' = no workspace
 *  row (the fleet-wide default governs); 'on'/'off' = explicit workspace
 *  opt-in/opt-out. Stored as ''/'true'/'false' on the scoped flag row. */
export type WorkspaceAutonomyPreference = 'inherit' | 'on' | 'off';

export interface WorkspaceAutonomyClassView {
  kind: WorkApprovalKind;
  /** Plain-English reversibility string from the hardcoded allowlist. */
  reversibility: string;
  /** Conservative worst-case dollar blast radius for the class. */
  estUsd: number;
  /** The owner's stored preference ('inherit' when no scoped row). */
  preference: WorkspaceAutonomyPreference;
  /** The owner's stored ceiling, or null when none set (inherit). */
  workspaceCeilingUsd: number | null;
  /** What the decision path would resolve RIGHT NOW for this class. */
  effectiveEnabled: boolean;
  effectiveEnabledScope: AutoExecPolicyScope;
  effectiveCeilingUsd: number;
  effectiveCeilingScope: AutoExecPolicyScope;
}

export interface WorkspaceAutonomySettings {
  /** The fleet master switch (env). When OFF nothing auto-executes
   *  anywhere regardless of per-class settings — surfaced so the page
   *  can be honest about it. */
  masterOn: boolean;
  classes: WorkspaceAutonomyClassView[];
}

export type AutonomyReadResult =
  | { ok: true; value: WorkspaceAutonomySettings }
  | { ok: false; error: string };

/**
 * Read the full autonomy panel for one workspace: per-class stored
 * preference + the EFFECTIVE policy the decision path would resolve
 * right now (same resolvers, same truth). Fails loud on a store error —
 * a settings page must never render a guess about an autonomy policy.
 */
export async function readWorkspaceAutonomySettings(args: {
  store: OpsFlagStore;
  workspaceId: string;
  env?: NodeJS.ProcessEnv;
}): Promise<AutonomyReadResult> {
  const { store, workspaceId } = args;
  const classes: WorkspaceAutonomyClassView[] = [];
  for (const klass of AUTO_EXEC_ALLOWLIST) {
    const scopedEnable = await store.get(
      autoExecEnabledFlagName(klass.kind, workspaceId),
    );
    if (!scopedEnable.ok) {
      return { ok: false, error: scopedEnable.error.message };
    }
    const scopedCeiling = await store.get(
      autoExecCeilingFlagName(klass.kind, workspaceId),
    );
    if (!scopedCeiling.ok) {
      return { ok: false, error: scopedCeiling.error.message };
    }
    const effectiveEnabled = await resolveAutoExecEnabled(
      store,
      klass.kind,
      workspaceId,
    );
    if (!effectiveEnabled.ok) {
      return { ok: false, error: effectiveEnabled.error };
    }
    const effectiveCeiling = await resolveAutoExecCeiling(
      store,
      klass.kind,
      workspaceId,
    );
    if (!effectiveCeiling.ok) {
      return { ok: false, error: effectiveCeiling.error };
    }
    classes.push({
      kind: klass.kind,
      reversibility: klass.reversibility,
      estUsd: klass.estUsd,
      preference: preferenceFromStored(scopedEnable.value?.value ?? null),
      workspaceCeilingUsd: storedCeilingUsd(scopedCeiling.value?.value ?? null),
      effectiveEnabled: effectiveEnabled.value.enabled,
      effectiveEnabledScope: effectiveEnabled.value.scope,
      effectiveCeilingUsd: effectiveCeiling.value.ceilingUsd,
      effectiveCeilingScope: effectiveCeiling.value.scope,
    });
  }
  return {
    ok: true,
    value: {
      masterOn: isBoundedAutoExecuteMasterOn(args.env ?? process.env),
      classes,
    },
  };
}

export interface WriteWorkspaceAutonomyArgs {
  store: OpsFlagStore;
  workspaceId: string;
  kind: WorkApprovalKind;
  preference: WorkspaceAutonomyPreference;
  /** Owner's ceiling in USD, or null to clear (inherit the fleet
   *  ceiling). Must be a finite positive number when set. */
  ceilingUsd: number | null;
  /** Audit attribution written onto the OpsFlag rows, e.g. `user:<id>`. */
  updatedBy: string;
}

export type AutonomyWriteResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Persist one class's workspace-scoped autonomy preference. Refuses
 * non-allowlisted kinds (safety floor — a workspace can never opt INTO a
 * kind the platform considers irreversible) and malformed ceilings.
 * Never throws.
 */
export async function writeWorkspaceAutonomySetting(
  args: WriteWorkspaceAutonomyArgs,
): Promise<AutonomyWriteResult> {
  const klass: AllowlistedClass | null = getAllowlistedClass(args.kind);
  if (!klass) {
    return {
      ok: false,
      error: `Kind '${args.kind}' is not on the auto-execute reversibility allowlist — it can never be enabled, for any workspace.`,
    };
  }
  if (
    args.ceilingUsd !== null &&
    (!Number.isFinite(args.ceilingUsd) || args.ceilingUsd <= 0)
  ) {
    return {
      ok: false,
      error: 'Ceiling must be a positive dollar amount (or blank to inherit).',
    };
  }

  const enableValue =
    args.preference === 'inherit'
      ? ''
      : args.preference === 'on'
        ? 'true'
        : 'false';
  const note = `workspace autonomy setting (settings/autonomy)`;

  const enableWrite = await args.store.set(
    autoExecEnabledFlagName(args.kind, args.workspaceId),
    enableValue,
    { updatedBy: args.updatedBy, note },
  );
  if (!enableWrite.ok) {
    return { ok: false, error: enableWrite.error.message };
  }
  const ceilingWrite = await args.store.set(
    autoExecCeilingFlagName(args.kind, args.workspaceId),
    args.ceilingUsd === null ? '' : String(args.ceilingUsd),
    { updatedBy: args.updatedBy, note },
  );
  if (!ceilingWrite.ok) {
    return { ok: false, error: ceilingWrite.error.message };
  }
  return { ok: true };
}

/** Map a stored scoped enable value back to the owner's preference.
 *  Mirrors resolveAutoExecEnabled: '' / missing = inherit, 'true' = on,
 *  anything else = explicit off. */
export function preferenceFromStored(
  raw: string | null,
): WorkspaceAutonomyPreference {
  if (raw === null || raw === '') return 'inherit';
  return raw === 'true' ? 'on' : 'off';
}

/** Parse a stored scoped ceiling value for display. '' / missing /
 *  garbage → null (inherit). Mirrors resolveAutoExecCeiling's "treat a
 *  cleared row as no workspace preference". */
export function storedCeilingUsd(raw: string | null): number | null {
  if (raw === null || raw.trim() === '') return null;
  const n = Number.parseFloat(raw.trim());
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}
