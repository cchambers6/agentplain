// Wave-2 skill marketplace — install state + runtime gate.
//
// Read at fire time by every sweep candidate lister so the customer's
// install / uninstall choices flow into the live runtime. Default-
// install logic lives in code (not in the table): a workspace with NO
// row for a `live` catalog skill that's either `vertical='all'` or
// matches `workspace.vertical` is treated as "installed by default" —
// the customer has to write a `disabledAt`-set row to opt out.
//
// Per `feedback_runner_portability.md`: every function takes an
// optional systemContext runner so the unit tests don't need Postgres.
//
// Per `feedback_cold_start_safe_agents.md`: callers re-read on every
// fire. No in-memory cache.
//
// Per `project_no_outbound_architecture.md`: this module is read/write
// of customer state only — it never sends anything.

import type { Prisma, Vertical } from "@prisma/client";
import type { DbTransactionClient } from "@/lib/db";
import { withSystemContext as defaultWithSystemContext } from "@/lib/db";
import { verticalSlugFromEnum } from "@/lib/auth/vertical-enum";
import { SKILL_CATALOG, type SkillCatalogEntry } from "./registry";

export type SystemContextRunner = <T>(
  fn: (tx: DbTransactionClient) => Promise<T>,
) => Promise<T>;

export interface SkillInstallationRow {
  workspaceId: string;
  skillSlug: string;
  installedAt: Date;
  installedByUserId: string | null;
  disabledAt: Date | null;
}

export interface ListInstalledSkillsOpts {
  systemContext?: SystemContextRunner;
}

/**
 * The full set of slugs the workspace has explicitly touched. The
 * caller still needs to intersect with default-install rules — use
 * `resolveInstallationStatus` for the live "is this installed?" check.
 */
export async function listSkillInstallationRows(
  workspaceId: string,
  opts: ListInstalledSkillsOpts = {},
): Promise<SkillInstallationRow[]> {
  const ctx = opts.systemContext ?? defaultWithSystemContext;
  const rows = await ctx((tx) =>
    tx.workspaceSkillInstallation.findMany({
      where: { workspaceId },
      select: {
        workspaceId: true,
        skillSlug: true,
        installedAt: true,
        installedByUserId: true,
        disabledAt: true,
      },
    }),
  );
  return rows;
}

export interface ResolveInstallationStatusInput {
  workspaceId: string;
  workspaceVertical: Vertical;
  systemContext?: SystemContextRunner;
}

export interface SkillInstallationStatus {
  slug: string;
  /** Honest catalog runtime — `live` / `schema-only` / `coming-soon`. */
  runtime: "live" | "schema-only" | "coming-soon";
  /** True when the runtime caller should fire this skill for the
   *  workspace today. Encodes the default-install rule + the customer's
   *  explicit install / uninstall choice. */
  installed: boolean;
  /** True when the install state comes from the customer's explicit
   *  choice (a row in WorkspaceSkillInstallation). False = the default
   *  install rule decided. */
  customerExplicit: boolean;
}

/**
 * Per-skill effective install state for a workspace. Caller passes the
 * workspace's vertical enum (already loaded in candidate listers) so
 * the default-install rule can match the vertical without an extra DB
 * read.
 */
export async function resolveInstallationStatus(
  input: ResolveInstallationStatusInput,
): Promise<SkillInstallationStatus[]> {
  const rows = await listSkillInstallationRows(input.workspaceId, {
    systemContext: input.systemContext,
  });
  const verticalSlug = verticalSlugFromEnum(input.workspaceVertical);
  const byCatalog = new Map(rows.map((r) => [r.skillSlug, r]));

  return SKILL_CATALOG.map((entry) => {
    const runtime = entry.runtime ?? "schema-only";
    const row = byCatalog.get(entry.slug);
    if (row) {
      return {
        slug: entry.slug,
        runtime,
        installed: row.disabledAt === null,
        customerExplicit: true,
      };
    }
    // No row — fall through to default-install rule.
    return {
      slug: entry.slug,
      runtime,
      installed:
        runtime === "live" && isSkillInstalledByDefault(entry, verticalSlug),
      customerExplicit: false,
    };
  });
}

/**
 * Default-install rule. A skill is installed-by-default for a workspace when:
 *   - The skill is runtime=live, AND
 *   - The skill's vertical is `'all'` OR matches the workspace's vertical.
 *
 * Schema-only / coming-soon skills are NEVER default-installed —
 * installing one is the customer's explicit choice and the UI badges
 * the consequence (the skill won't fire until the wiring lands).
 */
export function isSkillInstalledByDefault(
  entry: SkillCatalogEntry,
  workspaceVerticalSlug: string | null,
): boolean {
  if (entry.vertical === "all") return true;
  if (workspaceVerticalSlug && entry.vertical === workspaceVerticalSlug) {
    return true;
  }
  return false;
}

/**
 * Single-skill effective install check. Used at fire time by sweep
 * candidate listers + the webhook-event chain. Returns `true` when
 * the runtime should fire the skill for this workspace.
 *
 * Honest semantic: `live` skill with no row → installed-by-default
 * rule decides. `live` skill with `disabledAt=null` row → installed.
 * `live` skill with `disabledAt!=null` row → opted out. `schema-only`
 * skill with `disabledAt=null` row → customer installed but the
 * caller has no production caller yet — returns true so the gate is
 * accurate (the caller is the gatekeeper for runtime presence).
 */
export async function isSkillInstalledForWorkspace(input: {
  workspaceId: string;
  workspaceVertical: Vertical;
  skillSlug: string;
  systemContext?: SystemContextRunner;
}): Promise<boolean> {
  const ctx = input.systemContext ?? defaultWithSystemContext;
  const row = await ctx((tx) =>
    tx.workspaceSkillInstallation.findUnique({
      where: {
        workspaceId_skillSlug: {
          workspaceId: input.workspaceId,
          skillSlug: input.skillSlug,
        },
      },
      select: { disabledAt: true },
    }),
  );
  if (row) return row.disabledAt === null;
  const entry = SKILL_CATALOG.find((s) => s.slug === input.skillSlug);
  if (!entry) return false;
  const runtime = entry.runtime ?? "schema-only";
  if (runtime !== "live") return false;
  return isSkillInstalledByDefault(
    entry,
    verticalSlugFromEnum(input.workspaceVertical),
  );
}

export interface InstallSkillInput {
  workspaceId: string;
  skillSlug: string;
  installedByUserId: string | null;
  systemContext?: SystemContextRunner;
}

export async function installSkill(input: InstallSkillInput): Promise<void> {
  const entry = SKILL_CATALOG.find((s) => s.slug === input.skillSlug);
  if (!entry) {
    throw new Error(`installSkill: unknown skill slug "${input.skillSlug}"`);
  }
  const ctx = input.systemContext ?? defaultWithSystemContext;
  await ctx(async (tx) => {
    await tx.workspaceSkillInstallation.upsert({
      where: {
        workspaceId_skillSlug: {
          workspaceId: input.workspaceId,
          skillSlug: input.skillSlug,
        },
      },
      create: {
        workspaceId: input.workspaceId,
        skillSlug: input.skillSlug,
        installedByUserId: input.installedByUserId,
      },
      update: {
        // Re-install path — clear the disabledAt stamp.
        disabledAt: null,
        installedAt: new Date(),
        installedByUserId: input.installedByUserId,
      },
    });
    await tx.auditLog.create({
      data: {
        workspaceId: input.workspaceId,
        actorUserId: input.installedByUserId,
        action: "skill.installed",
        targetTable: "WorkspaceSkillInstallation",
        targetId: input.skillSlug,
        payload: {
          skillSlug: input.skillSlug,
          runtime: entry.runtime ?? "schema-only",
        } satisfies Prisma.InputJsonValue,
      },
    });
  });
}

export async function uninstallSkill(input: InstallSkillInput): Promise<void> {
  const entry = SKILL_CATALOG.find((s) => s.slug === input.skillSlug);
  if (!entry) {
    throw new Error(`uninstallSkill: unknown skill slug "${input.skillSlug}"`);
  }
  const ctx = input.systemContext ?? defaultWithSystemContext;
  const now = new Date();
  await ctx(async (tx) => {
    await tx.workspaceSkillInstallation.upsert({
      where: {
        workspaceId_skillSlug: {
          workspaceId: input.workspaceId,
          skillSlug: input.skillSlug,
        },
      },
      create: {
        workspaceId: input.workspaceId,
        skillSlug: input.skillSlug,
        installedByUserId: input.installedByUserId,
        disabledAt: now,
      },
      update: {
        disabledAt: now,
        installedByUserId: input.installedByUserId,
      },
    });
    await tx.auditLog.create({
      data: {
        workspaceId: input.workspaceId,
        actorUserId: input.installedByUserId,
        action: "skill.uninstalled",
        targetTable: "WorkspaceSkillInstallation",
        targetId: input.skillSlug,
        payload: {
          skillSlug: input.skillSlug,
        } satisfies Prisma.InputJsonValue,
      },
    });
  });
}
