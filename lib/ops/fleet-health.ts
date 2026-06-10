/**
 * lib/ops/fleet-health.ts
 *
 * The PURE core of the fleet-health heartbeat — Pillar 6 of the self-healing
 * fleet. Everything here is IO-free and deterministic so the whole threshold +
 * digest model is unit-testable without a DB, an Inngest harness, or a clock.
 *
 * The bar (the "if Conner died tomorrow" test): this pillar IS the 24h
 * guarantee. It is the heartbeat that notices everything else (dead keys,
 * broken integrations, a support backlog rotting, customers signing up into a
 * vertical with no live workflow, accounts going PAST_DUE) and tells a NAMED
 * human within 24h. Acceptable outcomes: self-heal / self-route / fail loud.
 * Silent failure is the one thing this surface may never do.
 *
 * Division of labour with the cron (lib/inngest/functions/fleet-health-check.ts):
 *   - The cron owns IO: it reads the DB / budget seam / ops flags through the
 *     `FleetHealthReaders` interface, persists the snapshot, and pages.
 *   - THIS file owns the MODEL: the metric definitions, the env-tunable
 *     thresholds (+ their documented defaults), the breach → severity logic,
 *     and the rendered digest (with a concrete RECOMMENDED ACTION per breach).
 *
 * Two-implementation rule (feedback_runner_portability): the readers are an
 * interface; the cron supplies the live Prisma-backed implementation and the
 * tests supply a scriptable in-memory one. Neither this file nor the tests
 * touch a real database.
 *
 * Cold-start safe (feedback_cold_start_safe_agents): thresholds resolve from
 * the env snapshot on every call; nothing is cached in module state.
 */

import type { PageSeverity } from "./page-human";

/** The metrics the heartbeat watches. Stable string ids — also the OpsFlag /
 *  digest keys, so renaming one is a deliberate, visible change. */
export type FleetHealthMetricId =
  | "llm_spend_vs_cap"
  | "integration_breakage"
  | "support_backlog_age"
  | "unsupported_vertical_signups"
  | "past_due_aged"
  | "pages_last_24h"
  | "heartbeat_staleness";

/** One metric's computed value + how it scored against its threshold. */
export interface FleetHealthMetric {
  id: FleetHealthMetricId;
  /** Human label for the digest + operator panel. */
  label: string;
  /** The observed value (already reduced to the scalar the threshold compares
   *  against — e.g. oldest-backlog-age in HOURS, count of breakages, etc.). */
  value: number;
  /** The unit the value + threshold are expressed in (for the digest copy). */
  unit: string;
  /** The configured threshold this value is compared against. */
  threshold: number;
  /** True when the value breached its threshold (strictly greater-than for
   *  every metric — all of these are "too high is bad" gauges). */
  breached: boolean;
  /** Severity if breached. `critical` = customer-impacting / 24h-class;
   *  `warn` = needs eyes but not an emergency. Greens carry their resting
   *  severity for the digest's color but never page. */
  severity: PageSeverity;
  /** One-line context shown under the metric in the digest + panel. */
  detail: string;
  /** Concrete next action when breached — names the exact surface / lever a
   *  human pulls ("restore key in Vercel", "open workspace X integrations").
   *  Empty string when green. */
  recommendedAction: string;
}

/** The raw inputs the readers hand the core. Every field is a plain scalar /
 *  small struct so the core stays pure. */
export interface FleetHealthInputs {
  /** Fleet-wide LLM spend this period, in whole USD. */
  llmSpendUsd: number;
  /** Sum of explicit per-workspace monthly caps, in whole USD. 0 when no
   *  workspace has a cap set (then the spend gauge compares against the env
   *  absolute ceiling instead — see resolveThresholds). */
  llmCapUsd: number;
  /** True when the Anthropic primary key is sentinel-paused (degraded mode). */
  sentinelPaused: boolean;
  /** Names of fleet-global credentials currently flagged invalid
   *  (OPS_CREDENTIAL_HEALTH_* = invalid). Each one is a fleet-wide outage. */
  invalidGlobalCredentials: string[];
  /** Count of per-workspace integration credentials in a broken state
   *  (EXPIRED / REVOKED / ERROR). */
  brokenWorkspaceIntegrations: number;
  /** Age in HOURS of the oldest unanswered support conversation / pending
   *  support-reply approval. 0 when the backlog is empty. */
  oldestSupportBacklogHours: number;
  /** Count of workspaces created in the last 24h whose vertical has no live
   *  killer workflow (derived from registry truth). */
  unsupportedVerticalSignups24h: number;
  /** Count of workspaces PAST_DUE for more than the aged threshold (>7d). */
  pastDueAgedWorkspaces: number;
  /** Count of pageHuman calls in the last 24h (AuditLog rows). A high number
   *  means the fleet is firefighting — the human should know the volume. */
  pagesLast24h: number;
  /** Hours since the last SUCCESSFUL fleet-health run. A large value means the
   *  heartbeat itself was down — a dead heartbeat must be loud. `null` when
   *  there is no prior successful run on record (first-ever run). */
  hoursSinceLastSuccess: number | null;
}

/** Env-tunable thresholds. Each has a documented default; an operator can
 *  ratify or adjust via the env vars named in resolveThresholds. */
export interface FleetHealthThresholds {
  /** Fraction of the summed cap (or absolute USD ceiling) at which spend
   *  warns. Default 0.9 (90%). */
  llmSpendWarnFraction: number;
  /** Absolute fleet spend ceiling in USD used when NO per-workspace cap is
   *  set (the summed cap is 0). Default 1000. */
  llmAbsoluteCeilingUsd: number;
  /** Broken per-workspace integrations above this count warns. Default 3. */
  integrationBreakageMax: number;
  /** Oldest support backlog older than this many hours warns. Default 24. */
  supportBacklogMaxHours: number;
  /** Unsupported-vertical signups in 24h above this count warns. Default 0
   *  (ANY such signup is worth a human's eyes — a customer is paying into a
   *  vertical with no live workflow). */
  unsupportedVerticalSignupsMax: number;
  /** PAST_DUE-aged workspaces above this count warns. Default 0 (any aged
   *  past-due account is a dollar leaving the door). */
  pastDueAgedMax: number;
  /** pageHuman calls in 24h above this count warns (firefighting volume).
   *  Default 5. */
  pagesLast24hMax: number;
  /** Hours since last successful run above which the heartbeat-staleness
   *  notice fires. Default 48 (the mandate's stale-heartbeat ceiling). */
  heartbeatStaleMaxHours: number;
}

/** The documented defaults. CONNER DECISION: ratify or adjust. Each maps to a
 *  FLEET_HEALTH_* env var (resolveThresholds). */
export const DEFAULT_FLEET_HEALTH_THRESHOLDS: FleetHealthThresholds = {
  llmSpendWarnFraction: 0.9,
  llmAbsoluteCeilingUsd: 1000,
  integrationBreakageMax: 3,
  supportBacklogMaxHours: 24,
  unsupportedVerticalSignupsMax: 0,
  pastDueAgedMax: 0,
  pagesLast24hMax: 5,
  heartbeatStaleMaxHours: 48,
};

function num(raw: string | undefined, fallback: number): number {
  if (raw === undefined) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

/** Resolve thresholds from the env snapshot, defaulting each independently.
 *  Cold-start safe — reads env on every call. */
export function resolveThresholds(
  envSnapshot: NodeJS.ProcessEnv = process.env,
): FleetHealthThresholds {
  const d = DEFAULT_FLEET_HEALTH_THRESHOLDS;
  return {
    llmSpendWarnFraction: num(
      envSnapshot.FLEET_HEALTH_LLM_SPEND_WARN_FRACTION,
      d.llmSpendWarnFraction,
    ),
    llmAbsoluteCeilingUsd: num(
      envSnapshot.FLEET_HEALTH_LLM_ABSOLUTE_CEILING_USD,
      d.llmAbsoluteCeilingUsd,
    ),
    integrationBreakageMax: num(
      envSnapshot.FLEET_HEALTH_INTEGRATION_BREAKAGE_MAX,
      d.integrationBreakageMax,
    ),
    supportBacklogMaxHours: num(
      envSnapshot.FLEET_HEALTH_SUPPORT_BACKLOG_MAX_HOURS,
      d.supportBacklogMaxHours,
    ),
    unsupportedVerticalSignupsMax: num(
      envSnapshot.FLEET_HEALTH_UNSUPPORTED_VERTICAL_SIGNUPS_MAX,
      d.unsupportedVerticalSignupsMax,
    ),
    pastDueAgedMax: num(
      envSnapshot.FLEET_HEALTH_PAST_DUE_AGED_MAX,
      d.pastDueAgedMax,
    ),
    pagesLast24hMax: num(
      envSnapshot.FLEET_HEALTH_PAGES_LAST_24H_MAX,
      d.pagesLast24hMax,
    ),
    heartbeatStaleMaxHours: num(
      envSnapshot.FLEET_HEALTH_HEARTBEAT_STALE_MAX_HOURS,
      d.heartbeatStaleMaxHours,
    ),
  };
}

/** The whole computed snapshot. Persisted as a row + rendered to the panel
 *  + (on breach / Monday) emailed as the digest. */
export interface FleetHealthSnapshot {
  /** When the snapshot was computed (UTC). */
  computedAt: string;
  /** Every metric, green or breached. */
  metrics: FleetHealthMetric[];
  /** Just the breached metrics, for quick rendering. */
  breaches: FleetHealthMetric[];
  /** Overall: the highest severity among breaches, or "info" when all green. */
  overallSeverity: PageSeverity;
  /** True when at least one metric breached. */
  anyBreached: boolean;
  /** True when the heartbeat itself had been stale (>threshold) before this
   *  run — surfaced prominently in the digest. */
  heartbeatWasStale: boolean;
}

/** Severity ranking for "highest among breaches". */
const SEVERITY_RANK: Record<PageSeverity, number> = {
  info: 0,
  warn: 1,
  critical: 2,
};

/**
 * The pure heart: turn raw inputs + thresholds into the scored snapshot. No IO,
 * no clock beyond the supplied `now`. The cron calls this with live inputs; the
 * tests call it with hand-built ones.
 */
export function computeFleetHealthSnapshot(args: {
  inputs: FleetHealthInputs;
  thresholds: FleetHealthThresholds;
  now: Date;
}): FleetHealthSnapshot {
  const { inputs, thresholds: t, now } = args;
  const metrics: FleetHealthMetric[] = [];

  // ── 1) LLM spend vs cap ────────────────────────────────────────────────
  // When the fleet has explicit caps summed > 0, gauge against that; otherwise
  // fall back to the absolute USD ceiling so an uncapped fleet still has a
  // tripwire (the margin-risk headline — a heavy workspace's tokens can rival
  // its subscription).
  {
    const hasCap = inputs.llmCapUsd > 0;
    const ceiling = hasCap ? inputs.llmCapUsd : t.llmAbsoluteCeilingUsd;
    const fraction = ceiling > 0 ? inputs.llmSpendUsd / ceiling : 0;
    const warnAt = hasCap ? t.llmSpendWarnFraction : 1; // absolute ceiling = hard 100%
    const breached = fraction > warnAt;
    const critical = fraction >= 1;
    // The sentinel-paused state is itself a warn-worthy degraded mode even when
    // spend is fine — surface it in the detail and force at least a warn.
    const pausedNudge = inputs.sentinelPaused
      ? " Anthropic primary is sentinel-paused (degraded to the calm 'briefly offline' copy)."
      : "";
    const effBreached = breached || inputs.sentinelPaused;
    metrics.push({
      id: "llm_spend_vs_cap",
      label: "LLM spend vs cap",
      value: round2(inputs.llmSpendUsd),
      unit: "USD",
      threshold: round2(hasCap ? ceiling * warnAt : ceiling),
      breached: effBreached,
      severity: critical ? "critical" : "warn",
      detail:
        `Fleet LLM spend $${round2(inputs.llmSpendUsd)} against a ` +
        (hasCap
          ? `summed cap of $${round2(ceiling)} (${pct(fraction)}).`
          : `$${round2(ceiling)} absolute ceiling (no per-workspace caps set, ${pct(fraction)}).`) +
        pausedNudge,
      recommendedAction: effBreached
        ? inputs.sentinelPaused
          ? "Confirm the Anthropic key is intentionally paused; if not, restore ANTHROPIC_API_KEY in Vercel Production. Review /operator/workspaces for the heaviest spenders and set per-workspace caps."
          : "Open /operator/workspaces, sort by spend, and set or tighten the explicit monthly cap on the heaviest workspaces (lib/billing/budget.ts)."
        : "",
    });
  }

  // ── 2) Integration breakage ────────────────────────────────────────────
  {
    const globalCount = inputs.invalidGlobalCredentials.length;
    const wsCount = inputs.brokenWorkspaceIntegrations;
    // A dead FLEET-GLOBAL key is always critical (every customer at once);
    // per-workspace breakage warns once it crosses the count threshold.
    const breached = globalCount > 0 || wsCount > thresholds_max(t.integrationBreakageMax, wsCount);
    const critical = globalCount > 0;
    const globalNote =
      globalCount > 0
        ? `Fleet-global credentials INVALID: ${inputs.invalidGlobalCredentials.join(", ")}. `
        : "";
    metrics.push({
      id: "integration_breakage",
      label: "Integration breakage",
      value: wsCount,
      unit: "broken workspace integrations",
      threshold: t.integrationBreakageMax,
      breached,
      severity: critical ? "critical" : "warn",
      detail:
        globalNote +
        `${wsCount} per-workspace integration credential(s) in EXPIRED/REVOKED/ERROR state.`,
      recommendedAction: breached
        ? critical
          ? "A fleet-global key is dead — restore it in Vercel Production immediately (see the OPS_CREDENTIAL_HEALTH_* page). Then check /operator/integrations for broken per-workspace credentials."
          : "Open /operator/integrations, filter for non-ACTIVE credentials, and trigger reconnect prompts for those workspaces."
        : "",
    });
  }

  // ── 3) Support backlog age ─────────────────────────────────────────────
  {
    const hours = inputs.oldestSupportBacklogHours;
    const breached = hours > t.supportBacklogMaxHours;
    // Past 2x the threshold a customer has been waiting a very long time —
    // escalate to critical.
    const critical = hours > t.supportBacklogMaxHours * 2;
    metrics.push({
      id: "support_backlog_age",
      label: "Support backlog age",
      value: round2(hours),
      unit: "hours",
      threshold: t.supportBacklogMaxHours,
      breached,
      severity: critical ? "critical" : "warn",
      detail:
        hours > 0
          ? `Oldest unanswered support conversation / pending reply is ${round2(hours)}h old.`
          : "No unanswered support conversations.",
      recommendedAction: breached
        ? "Open /operator/support (and each workspace's /approvals SUPPORT_HANDLER_REPLY_DRAFT queue) and clear the oldest items — a customer has been waiting longer than the SLA."
        : "",
    });
  }

  // ── 4) Unsupported-vertical signups (last 24h) ─────────────────────────
  {
    const count = inputs.unsupportedVerticalSignups24h;
    const breached = count > t.unsupportedVerticalSignupsMax;
    metrics.push({
      id: "unsupported_vertical_signups",
      label: "Unsupported-vertical signups (24h)",
      value: count,
      unit: "signups",
      threshold: t.unsupportedVerticalSignupsMax,
      breached,
      severity: "warn",
      detail:
        count > 0
          ? `${count} workspace(s) signed up in the last 24h into a vertical with NO live killer workflow — they are paying into an empty room.`
          : "Every signup in the last 24h landed in a vertical with a live workflow.",
      recommendedAction: breached
        ? "Open /operator/workspaces, find the new signups in unsupported verticals, and either reach out with a manual first-value touch or prioritize that vertical's killer workflow (lib/plaino/killer-workflow.ts)."
        : "",
    });
  }

  // ── 5) PAST_DUE aged > 7d ──────────────────────────────────────────────
  {
    const count = inputs.pastDueAgedWorkspaces;
    const breached = count > t.pastDueAgedMax;
    metrics.push({
      id: "past_due_aged",
      label: "PAST_DUE aged > 7 days",
      value: count,
      unit: "workspaces",
      threshold: t.pastDueAgedMax,
      breached,
      severity: "warn",
      detail:
        count > 0
          ? `${count} workspace(s) have been PAST_DUE for more than 7 days — billing has not recovered.`
          : "No workspaces aged past 7 days in PAST_DUE.",
      recommendedAction: breached
        ? "Open /operator/workspaces, filter to PAST_DUE, and decide per account: dunning retry, a personal email, or controlled offboarding. Each aged account is recurring revenue leaking."
        : "",
    });
  }

  // ── 6) pageHuman volume (last 24h) ─────────────────────────────────────
  {
    const count = inputs.pagesLast24h;
    const breached = count > t.pagesLast24hMax;
    metrics.push({
      id: "pages_last_24h",
      label: "Human pages (last 24h)",
      value: count,
      unit: "pages",
      threshold: t.pagesLast24hMax,
      breached,
      severity: "warn",
      detail:
        count > 0
          ? `${count} pageHuman alert(s) fired in the last 24h. A spike means the fleet is firefighting.`
          : "No human pages fired in the last 24h.",
      recommendedAction: breached
        ? "Review the AuditLog ops.page_human feed on /operator/fleet-health — a cluster of pages usually shares one root cause (a dead key, a provider outage). Fix the root, not each page."
        : "",
    });
  }

  // ── 7) Heartbeat staleness (self-monitoring) ───────────────────────────
  {
    const hours = inputs.hoursSinceLastSuccess;
    const breached = hours !== null && hours > t.heartbeatStaleMaxHours;
    metrics.push({
      id: "heartbeat_staleness",
      label: "Heartbeat freshness",
      value: hours === null ? 0 : round2(hours),
      unit: "hours since last success",
      threshold: t.heartbeatStaleMaxHours,
      breached,
      // A dead heartbeat is critical — it means EVERY other metric above was
      // un-watched for that whole window.
      severity: "critical",
      detail:
        hours === null
          ? "First fleet-health run on record (no prior successful snapshot)."
          : breached
            ? `The previous successful fleet-health run was ${round2(hours)}h ago — the heartbeat itself had stopped, so nothing above was being watched.`
            : `Previous successful run was ${round2(hours)}h ago (healthy daily cadence).`,
      recommendedAction: breached
        ? "The fleet-health cron itself stopped firing. Check Inngest Cloud for the agentplain-fleet-health-check function, confirm the disable gate (FLEET_HEALTH_CHECK_DISABLED) is off, and review the function's run history for repeated failures."
        : "",
    });
  }

  const breaches = metrics.filter((m) => m.breached);
  const overallSeverity = breaches.reduce<PageSeverity>(
    (acc, m) => (SEVERITY_RANK[m.severity] > SEVERITY_RANK[acc] ? m.severity : acc),
    "info",
  );

  return {
    computedAt: now.toISOString(),
    metrics,
    breaches,
    overallSeverity,
    anyBreached: breaches.length > 0,
    heartbeatWasStale:
      inputs.hoursSinceLastSuccess !== null &&
      inputs.hoursSinceLastSuccess > t.heartbeatStaleMaxHours,
  };
}

/** Helper kept explicit so the integration-breakage line reads clearly: a
 *  count threshold is "max allowed", breach is strictly greater. */
function thresholds_max(max: number, _value: number): number {
  return max;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function pct(fraction: number): string {
  return `${Math.round(fraction * 100)}%`;
}

// ════════════════════════════════════════════════════════════════════════
// Digest rendering — pure. The cron hands the result to pageHuman.
// ════════════════════════════════════════════════════════════════════════

export interface FleetHealthDigest {
  severity: PageSeverity;
  summary: string;
  details: string;
}

/**
 * Render the email digest from a snapshot.
 *
 *   - `kind: "breach"` → only fired when something breached. Leads with the
 *     breaches + their RECOMMENDED ACTIONS, then the all-clear metrics for
 *     context. This is what pages a human.
 *   - `kind: "weekly"` → the Monday all-green confirmation. Proves the pipe
 *     itself works even when there is nothing wrong, so silence is trustworthy.
 */
export function renderFleetHealthDigest(
  snapshot: FleetHealthSnapshot,
  kind: "breach" | "weekly",
): FleetHealthDigest {
  if (kind === "weekly" && !snapshot.anyBreached) {
    return renderWeeklyAllGreen(snapshot);
  }
  return renderBreachDigest(snapshot);
}

function renderWeeklyAllGreen(snapshot: FleetHealthSnapshot): FleetHealthDigest {
  const lines: string[] = [];
  lines.push(
    "All fleet-health metrics are green. This is the weekly Monday confirmation that the heartbeat itself is alive — if this email keeps arriving on Mondays, silence on the other days means everything is genuinely fine.",
  );
  lines.push("");
  lines.push("Metrics:");
  for (const m of snapshot.metrics) {
    lines.push(`  • ${m.label}: ${m.value} ${m.unit} (threshold ${m.threshold}) — OK`);
  }
  lines.push("");
  lines.push(`Snapshot computed at ${snapshot.computedAt}.`);
  return {
    severity: "info",
    summary: "Fleet health: all green (weekly heartbeat confirmation)",
    details: lines.join("\n"),
  };
}

function renderBreachDigest(snapshot: FleetHealthSnapshot): FleetHealthDigest {
  const lines: string[] = [];
  const breachCount = snapshot.breaches.length;

  if (snapshot.heartbeatWasStale) {
    lines.push(
      "⚠ THE HEARTBEAT ITSELF HAD STOPPED. The previous successful fleet-health run was longer ago than the staleness threshold — for that entire window, none of the metrics below were being watched. Treat this digest as catch-up after a blind spot.",
    );
    lines.push("");
  }

  lines.push(
    `${breachCount} fleet-health metric(s) breached their threshold. Each item below has the value, the threshold, and a concrete recommended action.`,
  );
  lines.push("");
  lines.push("── BREACHES (act on these) ───────────────────────────────");
  for (const m of snapshot.breaches) {
    lines.push("");
    lines.push(`[${m.severity.toUpperCase()}] ${m.label}`);
    lines.push(`  value: ${m.value} ${m.unit}   (threshold: ${m.threshold})`);
    lines.push(`  ${m.detail}`);
    lines.push(`  → ACTION: ${m.recommendedAction}`);
  }

  const greens = snapshot.metrics.filter((m) => !m.breached);
  if (greens.length > 0) {
    lines.push("");
    lines.push("── Green (for context) ───────────────────────────────────");
    for (const m of greens) {
      lines.push(`  • ${m.label}: ${m.value} ${m.unit} (threshold ${m.threshold}) — OK`);
    }
  }

  lines.push("");
  lines.push(`Snapshot computed at ${snapshot.computedAt}.`);
  lines.push("Full panel: /operator/fleet-health");

  return {
    severity: snapshot.overallSeverity,
    summary: `Fleet health: ${breachCount} metric(s) breached${
      snapshot.heartbeatWasStale ? " (after a stale heartbeat)" : ""
    }`,
    details: lines.join("\n"),
  };
}

// ════════════════════════════════════════════════════════════════════════
// Unsupported-vertical registry truth (minimal local resolver).
//
// CONVERGENCE NOTE: wave pfd-4 is building the canonical vertical→live-workflow
// resolver on a SEPARATE branch. This is a deliberately minimal read that
// mirrors registry truth from lib/plaino/killer-workflow.ts + the fleet's
// "fireable now" set (memory: general/realty/cpa/home-services/law confirmed
// fireable; the integration-gated verticals are READY-ON-UNLOCK). At merge,
// this set should be replaced by pfd-4's resolver so there is one source of
// truth for "is this vertical's workflow live". Until then the cron reads here.
// ════════════════════════════════════════════════════════════════════════

import type { Vertical } from "@prisma/client";

/**
 * Verticals whose killer workflow is LIVE today (fires draft-and-approve work
 * without an unmet credential gate). Per CUSTOMER_VALUE_WAVES_2026_06_09:
 * general + REAL_ESTATE + CPA + HOME_SERVICES + LAW are fireable now; the
 * integration-gated verticals lead with the promise but cannot fire until a
 * partner-gated credential lands, so a signup there has no live workflow yet.
 */
export const LIVE_WORKFLOW_VERTICALS: ReadonlySet<Vertical> = new Set<Vertical>([
  "REAL_ESTATE",
  "CPA",
  "HOME_SERVICES",
  "LAW",
]);

/** True when a workspace's vertical has a live killer workflow today. A null
 *  vertical (not yet picked) is treated as supported — the general invoice-
 *  chase workflow fires for it. */
export function verticalHasLiveWorkflow(
  vertical: Vertical | null | undefined,
): boolean {
  if (!vertical) return true; // general workflow covers the no-vertical case
  return LIVE_WORKFLOW_VERTICALS.has(vertical);
}
