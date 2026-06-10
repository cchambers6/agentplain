/**
 * Inngest cron: daily FleetHealthCheck — the fleet's heartbeat (Pillar 6).
 *
 * THE BAR (the "if Conner died tomorrow" test): this surface IS the 24h
 * guarantee. Once a day it computes a structured health snapshot across every
 * other pillar — LLM spend vs cap, integration breakage, support backlog age,
 * unsupported-vertical signups, aged PAST_DUE accounts, the volume of human
 * pages, and (self-monitoring) how long since the heartbeat itself last
 * succeeded. ANY breach pages a NAMED human (pageHuman → FLEET_TRUSTED_HUMAN_
 * EMAIL, falling back to the operator allowlist with a loud nudge) with a
 * concrete recommended action per item. All-green weekdays send NOTHING; a
 * Monday all-green digest still fires so the human knows the pipe works.
 *
 * Schedule: 06:00 America/New_York every day. Inngest cron supports the
 * `TZ=` prefix, so we pin the timezone honestly rather than hard-coding a UTC
 * offset that would drift an hour across DST. On Mondays the same run also
 * emits the weekly all-green confirmation.
 *
 * Persistence: every snapshot is written as an AuditLog row (action
 * `ops.fleet_health_snapshot`) so trends are queryable, AND the latest snapshot
 * is mirrored onto an OpsFlag (`OPS_FLEET_HEALTH_LATEST`) the operator panel
 * reads in one cheap lookup. The last-SUCCESS timestamp lives on a second
 * OpsFlag (`OPS_FLEET_HEALTH_LAST_SUCCESS`) so a dead heartbeat is visible on
 * the panel even when the cron is failing.
 *
 * Self-monitoring: if the cron throws, Inngest retries (and our error-reporting
 * wrapper surfaces it). The panel renders "last successful health check: <ts>"
 * from the OpsFlag above, so a stalled heartbeat is observable. When a run
 * finally succeeds after a >48h gap, the digest says so up top.
 *
 * Cold-start safe (feedback_cold_start_safe_agents): reads thresholds from env
 * and all metrics from durable state on every fire; no in-memory health cache.
 * No-throw core (computeFleetHealthSnapshot + the readers) so a single metric
 * read failing degrades that metric, not the whole heartbeat.
 *
 * No new migration: persistence reuses AuditLog + OpsFlag (no-DB-default ids on
 * both). No vendor SDK is touched directly here — email goes through pageHuman
 * (lib/email seam); DB through withSystemContext; budget through lib/billing.
 */

import type { Prisma } from "@prisma/client";
import { inngest } from "../client";
import { runWithDisableGate } from "../run-with-disable-gate";
import {
  reportInngestItemFailure,
  withInngestErrorReporting,
} from "../with-error-reporting";
import { getLogger, withCronMonitor } from "@/lib/observability";
import { withSystemContext as defaultWithSystemContext } from "@/lib/db/rls";
import { pageHuman as defaultPageHuman } from "@/lib/ops/page-human";
import { PrismaOpsFlagStore } from "@/lib/ops/prisma-flag-store";
import type { OpsFlagStore } from "@/lib/ops/flag-store";
import { getFleetBudgetSnapshots } from "@/lib/billing/budget";
import { credentialHealthFlagName } from "./credential-test-sweep";
import type { ProbeProvider } from "@/lib/ops/credential-probes";
import {
  computeFleetHealthSnapshot,
  renderFleetHealthDigest,
  resolveThresholds,
  verticalHasLiveWorkflow,
  type FleetHealthInputs,
  type FleetHealthSnapshot,
} from "@/lib/ops/fleet-health";
import { PAGE_HUMAN_AUDIT_ACTION } from "@/lib/ops/page-human";

export const FLEET_HEALTH_CHECK_FUNCTION_ID = "agentplain-fleet-health-check";
/** 06:00 America/New_York, every day. TZ-pinned so DST never drifts the hour.
 *  The weekly all-green digest rides the Monday occurrence of this same run. */
export const FLEET_HEALTH_CHECK_CRON = "TZ=America/New_York 0 6 * * *";
export const FLEET_HEALTH_CHECK_REQUESTED_EVENT =
  "agentplain/ops.fleet-health.requested";

/** OpsFlag holding the JSON of the latest snapshot — the operator panel's one
 *  cheap read. */
export const FLEET_HEALTH_LATEST_FLAG = "OPS_FLEET_HEALTH_LATEST";
/** OpsFlag holding the ISO timestamp of the last SUCCESSFUL run. Drives the
 *  "last successful health check: <ts>" line + the heartbeat-staleness metric. */
export const FLEET_HEALTH_LAST_SUCCESS_FLAG = "OPS_FLEET_HEALTH_LAST_SUCCESS";
/** AuditLog action for each persisted snapshot (queryable trend history). */
export const FLEET_HEALTH_SNAPSHOT_ACTION = "ops.fleet_health_snapshot";

/** The fleet-global credentials whose health flag a dead key flips invalid. */
const GLOBAL_PROVIDERS: ProbeProvider[] = ["STRIPE", "RESEND", "ANTHROPIC"];

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

/**
 * The metric readers — the IO seam. Live implementation reads the DB / budget
 * seam / ops flags; tests pass an in-memory scriptable one. Each reader is
 * independently fallible: the gatherInputs orchestrator catches a thrower and
 * degrades just that metric (logged), so one slow query never blinds the whole
 * heartbeat.
 */
export interface FleetHealthReaders {
  /** Fleet LLM spend (USD) + summed explicit caps (USD) over the period. */
  llmSpend(): Promise<{ spendUsd: number; capUsd: number }>;
  /** True when the Anthropic primary key is sentinel-paused. */
  sentinelPaused(): Promise<boolean>;
  /** Names of fleet-global credentials currently flagged invalid. */
  invalidGlobalCredentials(): Promise<string[]>;
  /** Count of per-workspace integration credentials in a broken state. */
  brokenWorkspaceIntegrations(): Promise<number>;
  /** Age (hours) of the oldest unanswered support conversation / pending
   *  support-reply approval. 0 when the backlog is empty. */
  oldestSupportBacklogHours(now: Date): Promise<number>;
  /** Workspaces created in the last 24h whose vertical has no live workflow. */
  unsupportedVerticalSignups24h(now: Date): Promise<number>;
  /** Workspaces PAST_DUE for more than 7 days. */
  pastDueAgedWorkspaces(now: Date): Promise<number>;
  /** pageHuman calls in the last 24h. */
  pagesLast24h(now: Date): Promise<number>;
  /** Hours since the last successful fleet-health run; null if none on record. */
  hoursSinceLastSuccess(now: Date): Promise<number | null>;
}

export interface FleetHealthCheckDeps {
  readers?: FleetHealthReaders;
  flagStore?: OpsFlagStore;
  page?: typeof defaultPageHuman;
  systemContext?: typeof defaultWithSystemContext;
  env?: NodeJS.ProcessEnv;
  now?: Date;
}

export interface FleetHealthCheckReport {
  snapshot: FleetHealthSnapshot;
  /** True when a digest email was sent (breach on any day, or Monday weekly). */
  digestSent: boolean;
  /** Which digest fired, if any. */
  digestKind: "breach" | "weekly" | null;
  /** True when the page reached a human (delivered). */
  pageDelivered: boolean;
  /** True when the snapshot was persisted (AuditLog + OpsFlag). */
  persisted: boolean;
}

/** Is `now` a Monday (in UTC — the weekly cadence is robust to ±1 day; the
 *  point is a regular all-green heartbeat, not a precise wall-clock day). */
function isMonday(now: Date): boolean {
  return now.getUTCDay() === 1;
}

/**
 * The testable core. Gathers inputs (each reader degrading independently),
 * computes the snapshot, persists it, then decides whether to page/email:
 *   - any breach → breach digest (pages a human).
 *   - all green + Monday → weekly confirmation digest.
 *   - all green + non-Monday → nothing (silence the human can trust).
 * Never throws — a reader or persist failure is captured in the report.
 */
export async function runFleetHealthCheck(
  deps: FleetHealthCheckDeps = {},
): Promise<FleetHealthCheckReport> {
  const now = deps.now ?? new Date();
  const envSnapshot = deps.env ?? process.env;
  const flagStore = deps.flagStore ?? new PrismaOpsFlagStore();
  const systemContext = deps.systemContext ?? defaultWithSystemContext;
  const readers =
    deps.readers ?? new PrismaFleetHealthReaders({ systemContext, flagStore });
  const page = deps.page ?? defaultPageHuman;
  const thresholds = resolveThresholds(envSnapshot);
  const logger = getLogger().child({
    boundary: "inngest",
    function_id: FLEET_HEALTH_CHECK_FUNCTION_ID,
  });

  const inputs = await gatherInputs(readers, now, logger);
  const snapshot = computeFleetHealthSnapshot({ inputs, thresholds, now });

  // ── Persist (best-effort, ALWAYS attempted) ────────────────────────────
  let persisted = false;
  try {
    await persistSnapshot(snapshot, { systemContext, flagStore, now });
    persisted = true;
  } catch (err) {
    logger.warn("fleet-health snapshot persist failed", {
      error: err instanceof Error ? err.message : String(err),
    });
  }

  // ── Decide on the digest ───────────────────────────────────────────────
  let digestSent = false;
  let digestKind: "breach" | "weekly" | null = null;
  let pageDelivered = false;

  if (snapshot.anyBreached) {
    const digest = renderFleetHealthDigest(snapshot, "breach");
    const result = await page({
      severity: digest.severity,
      summary: digest.summary,
      details: digest.details,
      // A 24h restore deadline on the critical-class heartbeat: the named human
      // owns acting within the day. (warn-only digests still carry it — it is
      // the upper bound the pillar promises.)
      deadline: new Date(now.getTime() + DAY_MS),
      source: "fleet-health-check",
    });
    digestSent = true;
    digestKind = "breach";
    pageDelivered = result.delivered;
  } else if (isMonday(now)) {
    const digest = renderFleetHealthDigest(snapshot, "weekly");
    const result = await page({
      severity: digest.severity,
      summary: digest.summary,
      details: digest.details,
      source: "fleet-health-check",
    });
    digestSent = true;
    digestKind = "weekly";
    pageDelivered = result.delivered;
  }
  // all-green weekday → no email (silence the human can trust).

  logger.info("fleet-health check finished", {
    any_breached: snapshot.anyBreached,
    overall_severity: snapshot.overallSeverity,
    breaches: snapshot.breaches.map((b) => b.id),
    digest_kind: digestKind,
    page_delivered: pageDelivered,
    heartbeat_was_stale: snapshot.heartbeatWasStale,
  });

  return { snapshot, digestSent, digestKind, pageDelivered, persisted };
}

/** Run every reader, degrading a thrower to its safe default + a log line.
 *  This is what makes one bad query degrade a single metric, not the pillar. */
async function gatherInputs(
  readers: FleetHealthReaders,
  now: Date,
  logger: ReturnType<typeof getLogger>,
): Promise<FleetHealthInputs> {
  async function safe<T>(name: string, fn: () => Promise<T>, fallback: T): Promise<T> {
    try {
      return await fn();
    } catch (err) {
      logger.warn(`fleet-health reader '${name}' failed; degrading metric`, {
        error: err instanceof Error ? err.message : String(err),
      });
      return fallback;
    }
  }

  const [spend, paused, invalidGlobal, brokenWs, supportHrs, unsupported, pastDue, pages, staleHrs] =
    await Promise.all([
      safe("llmSpend", () => readers.llmSpend(), { spendUsd: 0, capUsd: 0 }),
      safe("sentinelPaused", () => readers.sentinelPaused(), false),
      safe("invalidGlobalCredentials", () => readers.invalidGlobalCredentials(), [] as string[]),
      safe("brokenWorkspaceIntegrations", () => readers.brokenWorkspaceIntegrations(), 0),
      safe("oldestSupportBacklogHours", () => readers.oldestSupportBacklogHours(now), 0),
      safe("unsupportedVerticalSignups24h", () => readers.unsupportedVerticalSignups24h(now), 0),
      safe("pastDueAgedWorkspaces", () => readers.pastDueAgedWorkspaces(now), 0),
      safe("pagesLast24h", () => readers.pagesLast24h(now), 0),
      safe("hoursSinceLastSuccess", () => readers.hoursSinceLastSuccess(now), null as number | null),
    ]);

  return {
    llmSpendUsd: spend.spendUsd,
    llmCapUsd: spend.capUsd,
    sentinelPaused: paused,
    invalidGlobalCredentials: invalidGlobal,
    brokenWorkspaceIntegrations: brokenWs,
    oldestSupportBacklogHours: supportHrs,
    unsupportedVerticalSignups24h: unsupported,
    pastDueAgedWorkspaces: pastDue,
    pagesLast24h: pages,
    hoursSinceLastSuccess: staleHrs,
  };
}

/** Write the AuditLog history row + mirror onto the latest/last-success flags. */
async function persistSnapshot(
  snapshot: FleetHealthSnapshot,
  ctx: {
    systemContext: typeof defaultWithSystemContext;
    flagStore: OpsFlagStore;
    now: Date;
  },
): Promise<void> {
  await ctx.systemContext((tx) =>
    tx.auditLog.create({
      data: {
        workspaceId: null,
        action: FLEET_HEALTH_SNAPSHOT_ACTION,
        targetTable: "OpsFleetHealth",
        targetId: null,
        // The snapshot is a plain serializable object; round-trip to a bare
        // JSON value so Prisma accepts it as InputJsonValue without a cast
        // through the typed FleetHealthSnapshot shape.
        payload: JSON.parse(JSON.stringify(snapshot)) as Prisma.InputJsonValue,
      },
      select: { id: true },
    }),
  );
  await ctx.flagStore.set(FLEET_HEALTH_LATEST_FLAG, JSON.stringify(snapshot), {
    updatedBy: "system:fleet-health-check",
    note: `${snapshot.breaches.length} breach(es) at ${snapshot.computedAt}`,
  });
  // Stamp last-success LAST so a partial persist never falsely advances it.
  await ctx.flagStore.set(FLEET_HEALTH_LAST_SUCCESS_FLAG, ctx.now.toISOString(), {
    updatedBy: "system:fleet-health-check",
    note: "successful fleet-health run",
  });
}

// ════════════════════════════════════════════════════════════════════════
// Live readers — the Prisma-backed implementation. The ONLY place this file
// touches the DB / budget seam / ops flags.
// ════════════════════════════════════════════════════════════════════════

export class PrismaFleetHealthReaders implements FleetHealthReaders {
  private readonly systemContext: typeof defaultWithSystemContext;
  private readonly flagStore: OpsFlagStore;
  private readonly env: NodeJS.ProcessEnv;

  constructor(opts: {
    systemContext?: typeof defaultWithSystemContext;
    flagStore?: OpsFlagStore;
    env?: NodeJS.ProcessEnv;
  } = {}) {
    this.systemContext = opts.systemContext ?? defaultWithSystemContext;
    this.flagStore = opts.flagStore ?? new PrismaOpsFlagStore();
    this.env = opts.env ?? process.env;
  }

  async llmSpend(): Promise<{ spendUsd: number; capUsd: number }> {
    // One pass over the fleet budget snapshots (two queries inside) gives both
    // the summed spend and the summed explicit caps, derived through the SAME
    // budget seam the operator inspector + the enforcement gate use.
    const snapshots = await this.systemContext((tx) => getFleetBudgetSnapshots(tx));
    let spendUsd = 0;
    let capUsd = 0;
    for (const s of snapshots) {
      spendUsd += s.consumedUsd;
      if (s.capUsdMonthly !== null) capUsd += s.capUsdMonthly;
    }
    return { spendUsd: Math.round(spendUsd * 100) / 100, capUsd };
  }

  async sentinelPaused(): Promise<boolean> {
    const key = this.env.ANTHROPIC_API_KEY ?? "";
    return key.startsWith("sk-ant-PAUSED-");
  }

  async invalidGlobalCredentials(): Promise<string[]> {
    const invalid: string[] = [];
    for (const provider of GLOBAL_PROVIDERS) {
      const res = await this.flagStore.get(credentialHealthFlagName(provider));
      if (res.ok && res.value && res.value.value === "invalid") {
        invalid.push(provider);
      }
    }
    return invalid;
  }

  async brokenWorkspaceIntegrations(): Promise<number> {
    return this.systemContext((tx) =>
      tx.integrationCredential.count({
        where: { status: { in: ["EXPIRED", "REVOKED", "ERROR"] } },
      }),
    );
  }

  async oldestSupportBacklogHours(now: Date): Promise<number> {
    // The oldest of (a) a pending support-reply approval and (b) a SUPPORT
    // conversation with no later reply — whichever has waited longest. We take
    // the proposedAt of the oldest pending SUPPORT_HANDLER_REPLY_DRAFT plus the
    // createdAt of the oldest SUPPORT PlainoConversation that is still pending,
    // and report the larger age.
    const [oldestApproval, oldestConversation] = await Promise.all([
      this.systemContext((tx) =>
        tx.workApprovalQueueItem.findFirst({
          where: { kind: "SUPPORT_HANDLER_REPLY_DRAFT", status: "PENDING" },
          orderBy: { proposedAt: "asc" },
          select: { proposedAt: true },
        }),
      ),
      this.systemContext((tx) =>
        tx.plainoConversation.findFirst({
          where: { mode: "SUPPORT" },
          orderBy: { updatedAt: "asc" },
          select: { updatedAt: true },
        }),
      ),
    ]);
    const ages: number[] = [];
    if (oldestApproval) {
      ages.push((now.getTime() - oldestApproval.proposedAt.getTime()) / HOUR_MS);
    }
    // A SUPPORT conversation whose last activity is very old is a proxy for an
    // unanswered thread; we only count it toward the gauge, the approval is the
    // primary signal.
    if (oldestConversation) {
      ages.push((now.getTime() - oldestConversation.updatedAt.getTime()) / HOUR_MS);
    }
    return ages.length === 0 ? 0 : Math.max(0, Math.max(...ages));
  }

  async unsupportedVerticalSignups24h(now: Date): Promise<number> {
    const since = new Date(now.getTime() - DAY_MS);
    const recent = await this.systemContext((tx) =>
      tx.workspace.findMany({
        where: { createdAt: { gte: since } },
        select: { vertical: true },
      }),
    );
    return recent.filter((w) => !verticalHasLiveWorkflow(w.vertical)).length;
  }

  async pastDueAgedWorkspaces(now: Date): Promise<number> {
    const cutoff = new Date(now.getTime() - 7 * DAY_MS);
    // A subscription that has been PAST_DUE and last updated > 7d ago is the
    // cheapest proxy for "aged past-due" without a separate state-change log.
    return this.systemContext((tx) =>
      tx.subscription.count({
        where: { status: "PAST_DUE", updatedAt: { lt: cutoff } },
      }),
    );
  }

  async pagesLast24h(now: Date): Promise<number> {
    const since = new Date(now.getTime() - DAY_MS);
    return this.systemContext((tx) =>
      tx.auditLog.count({
        where: { action: PAGE_HUMAN_AUDIT_ACTION, occurredAt: { gte: since } },
      }),
    );
  }

  async hoursSinceLastSuccess(now: Date): Promise<number | null> {
    const res = await this.flagStore.get(FLEET_HEALTH_LAST_SUCCESS_FLAG);
    if (!res.ok || !res.value) return null;
    const last = new Date(res.value.value);
    if (Number.isNaN(last.getTime())) return null;
    return Math.max(0, (now.getTime() - last.getTime()) / HOUR_MS);
  }
}

export const fleetHealthCheckFn = inngest.createFunction(
  {
    id: FLEET_HEALTH_CHECK_FUNCTION_ID,
    name: "agentplain fleet health check",
    triggers: [
      { cron: FLEET_HEALTH_CHECK_CRON },
      { event: FLEET_HEALTH_CHECK_REQUESTED_EVENT },
    ],
  },
  async () =>
    runWithDisableGate(FLEET_HEALTH_CHECK_FUNCTION_ID, () =>
      withCronMonitor(
        {
          slug: FLEET_HEALTH_CHECK_FUNCTION_ID,
          schedule: FLEET_HEALTH_CHECK_CRON,
        },
        () =>
          withInngestErrorReporting(
            { functionId: FLEET_HEALTH_CHECK_FUNCTION_ID },
            async () => {
              const logger = getLogger().child({
                boundary: "inngest",
                function_id: FLEET_HEALTH_CHECK_FUNCTION_ID,
              });
              logger.info("fleet-health check started");
              try {
                return await runFleetHealthCheck();
              } catch (err) {
                // The core is no-throw by design; this defensive catch keeps a
                // surprise from crashing the heartbeat silently (Inngest then
                // retries + the last-success flag exposes the gap).
                reportInngestItemFailure(err, {
                  functionId: FLEET_HEALTH_CHECK_FUNCTION_ID,
                });
                throw err;
              }
            },
          ),
      ),
    ),
);
