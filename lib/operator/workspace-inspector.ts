/**
 * lib/operator/workspace-inspector.ts
 *
 * Pure shaping for the per-workspace operator deep-dive
 * (`/operator/workspaces/[workspaceId]`). Every function here is DB-free and
 * client-safe so the page is a thin loader and the view renders off plain
 * data — the same split the fleet inspector uses
 * (`lib/operator/fleet-activity-filters.ts`), which keeps the heavy logic
 * unit-testable without Postgres.
 *
 * Reuses `deriveFleetStatus` + `FLEET_STATUS_LABEL` from the fleet module so
 * an "activity" row in this inspector classifies a SkillRun identically to
 * how the fleet feed does — one status taxonomy, not two.
 *
 * PII: the activity timeline here intentionally carries NO decrypted queue
 * payload (unlike the fleet feed's `summarizeOutcome`). The operator
 * deep-dive is an at-a-glance health surface; line-level customer content
 * stays behind the read-only impersonation view, which renders the
 * customer's own components.
 */

import {
  deriveFleetStatus,
  FLEET_STATUS_LABEL,
  humanize,
  type FleetStatus,
} from './fleet-activity-filters';

// ── Approval queue depth + age ──────────────────────────────────────────────

export interface ApprovalAgeBucket {
  key: 'lt1h' | 'lt24h' | 'lt7d' | 'gte7d';
  label: string;
  count: number;
}

export interface ApprovalQueueSummary {
  total: number;
  /** Age of the oldest open item in ms, or null when the queue is empty. */
  oldestAgeMs: number | null;
  oldestProposedAt: Date | null;
  /** Fixed-order histogram buckets; always all four, zero-filled. */
  buckets: ApprovalAgeBucket[];
}

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

const EMPTY_BUCKETS = (): ApprovalAgeBucket[] => [
  { key: 'lt1h', label: '< 1h', count: 0 },
  { key: 'lt24h', label: '1–24h', count: 0 },
  { key: 'lt7d', label: '1–7d', count: 0 },
  { key: 'gte7d', label: '> 7d', count: 0 },
];

function bucketFor(ageMs: number): ApprovalAgeBucket['key'] {
  if (ageMs < HOUR_MS) return 'lt1h';
  if (ageMs < DAY_MS) return 'lt24h';
  if (ageMs < 7 * DAY_MS) return 'lt7d';
  return 'gte7d';
}

/** Bucket open approvals by age and surface the oldest. Items must be the
 *  OPEN set (PENDING) — staleness is the operator's signal that a workspace
 *  is sitting on undecided drafts. */
export function buildApprovalQueueSummary(
  items: ReadonlyArray<{ proposedAt: Date }>,
  now: Date,
): ApprovalQueueSummary {
  const buckets = EMPTY_BUCKETS();
  const byKey = new Map(buckets.map((b) => [b.key, b]));
  let oldest: Date | null = null;
  for (const item of items) {
    const ageMs = Math.max(0, now.getTime() - item.proposedAt.getTime());
    byKey.get(bucketFor(ageMs))!.count += 1;
    if (!oldest || item.proposedAt.getTime() < oldest.getTime()) {
      oldest = item.proposedAt;
    }
  }
  return {
    total: items.length,
    oldestAgeMs: oldest ? Math.max(0, now.getTime() - oldest.getTime()) : null,
    oldestProposedAt: oldest,
    buckets,
  };
}

// ── Integration health ──────────────────────────────────────────────────────

export type IntegrationHealth =
  | 'HEALTHY'
  | 'EXPIRING'
  | 'EXPIRED'
  | 'REVOKED'
  | 'ERROR';

/** Days within expiry at which a still-ACTIVE credential is flagged
 *  EXPIRING so an operator can prompt a re-auth before it lapses. */
export const INTEGRATION_EXPIRY_WARN_DAYS = 7;

export interface IntegrationCredentialInput {
  provider: string;
  accountEmail: string;
  status: string;
  scopes: string[];
  expiresAt: Date;
  lastRefreshedAt: Date | null;
}

export interface IntegrationHealthRow {
  provider: string;
  /** Display name from the marketplace catalog; falls back to the raw
   *  provider key when the catalog has no entry. */
  name: string;
  accountEmail: string;
  health: IntegrationHealth;
  /** Whole days until expiry; negative when already past. */
  expiresInDays: number;
  expiresAt: Date;
  lastRefreshedAt: Date | null;
  scopesCount: number;
}

function healthFor(status: string, expiresAt: Date, now: Date): IntegrationHealth {
  switch (status) {
    case 'REVOKED':
      return 'REVOKED';
    case 'ERROR':
      return 'ERROR';
    case 'EXPIRED':
      return 'EXPIRED';
    default: {
      // ACTIVE (or any unknown-but-not-terminal status): expiry is the
      // ground truth. A token past its expiry that the refresher hasn't
      // caught yet reads as EXPIRED, not HEALTHY.
      const ms = expiresAt.getTime() - now.getTime();
      if (ms <= 0) return 'EXPIRED';
      if (ms <= INTEGRATION_EXPIRY_WARN_DAYS * DAY_MS) return 'EXPIRING';
      return 'HEALTHY';
    }
  }
}

export function deriveIntegrationHealth(
  credentials: ReadonlyArray<IntegrationCredentialInput>,
  nameByProvider: Readonly<Record<string, string>>,
  now: Date,
): IntegrationHealthRow[] {
  return credentials
    .map((c): IntegrationHealthRow => {
      const msToExpiry = c.expiresAt.getTime() - now.getTime();
      return {
        provider: c.provider,
        name: nameByProvider[c.provider] ?? c.provider,
        accountEmail: c.accountEmail,
        health: healthFor(c.status, c.expiresAt, now),
        expiresInDays: Math.floor(msToExpiry / DAY_MS),
        expiresAt: c.expiresAt,
        lastRefreshedAt: c.lastRefreshedAt,
        scopesCount: c.scopes.length,
      };
    })
    .sort((a, b) => HEALTH_RANK[a.health] - HEALTH_RANK[b.health]);
}

/** Worst-first ordering so the operator sees problems at the top. */
const HEALTH_RANK: Record<IntegrationHealth, number> = {
  REVOKED: 0,
  ERROR: 1,
  EXPIRED: 2,
  EXPIRING: 3,
  HEALTHY: 4,
};

/** True when any integration needs operator attention. Drives the section
 *  badge on the page. */
export function hasUnhealthyIntegration(
  rows: ReadonlyArray<IntegrationHealthRow>,
): boolean {
  return rows.some((r) => r.health !== 'HEALTHY');
}

// ── Activity timeline ───────────────────────────────────────────────────────

export interface ActivityRunInput {
  id: string;
  skillSlug: string;
  discipline: string | null;
  firedAt: Date;
  completedAt: Date | null;
  outcome: string;
  durationMs: number | null;
  queueStatus: string | null;
}

export interface ActivityRow {
  id: string;
  skillSlug: string;
  skillLabel: string;
  discipline: string | null;
  status: FleetStatus;
  statusLabel: string;
  firedAt: Date;
  durationMs: number | null;
}

/** Map raw SkillRuns to a presentational timeline. No PII — status + which
 *  skill + when, classified through the shared fleet taxonomy. */
export function buildActivityTimeline(
  runs: ReadonlyArray<ActivityRunInput>,
): ActivityRow[] {
  return runs.map((r): ActivityRow => {
    const status = deriveFleetStatus(r.outcome, r.completedAt, r.queueStatus);
    return {
      id: r.id,
      skillSlug: r.skillSlug,
      skillLabel: humanize(r.skillSlug.replace(/-/g, ' ')),
      discipline: r.discipline,
      status,
      statusLabel: FLEET_STATUS_LABEL[status],
      firedAt: r.firedAt,
      durationMs: r.durationMs,
    };
  });
}

/** Counts per status across a window of runs — the small "12 succeeded · 2
 *  failed · 1 awaiting" line above the timeline. */
export function summarizeActivity(
  rows: ReadonlyArray<ActivityRow>,
): Record<FleetStatus, number> {
  const counts = {
    running: 0,
    'awaiting-approval': 0,
    succeeded: 0,
    skipped: 0,
    failed: 0,
  } as Record<FleetStatus, number>;
  for (const r of rows) counts[r.status] += 1;
  return counts;
}

// ── Usage by surface ────────────────────────────────────────────────────────

export interface UsageSurfaceRow {
  surface: string;
  costMicroCents: bigint;
  tokens: number;
  callCount: number;
}

export interface SurfaceSums {
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
  costMicroCents: bigint;
  callCount: number;
}

/** Flatten a usage-report per-surface breakdown into display rows (already
 *  cost-sorted by the aggregator; preserved here). */
export function mapUsageSurfaces(
  periodBySurface: ReadonlyArray<{ sourceSurface: string; sums: SurfaceSums }>,
): UsageSurfaceRow[] {
  return periodBySurface.map((r) => ({
    surface: r.sourceSurface,
    costMicroCents: r.sums.costMicroCents,
    tokens:
      r.sums.inputTokens +
      r.sums.outputTokens +
      r.sums.cacheCreationTokens +
      r.sums.cacheReadTokens,
    callCount: r.sums.callCount,
  }));
}

// ── Last user (human) activity ──────────────────────────────────────────────

/** The latest moment a human acted in the workspace, derived from the
 *  newest of: an approval decision and a user-attributed audit entry. Agent
 *  (SkillRun) activity is excluded on purpose — this answers "is the
 *  customer still showing up?", not "is the fleet running?". Returns null
 *  when neither signal exists. */
export function deriveLastUserActivity(
  signals: ReadonlyArray<Date | null | undefined>,
): Date | null {
  let latest: Date | null = null;
  for (const s of signals) {
    if (s && (!latest || s.getTime() > latest.getTime())) latest = s;
  }
  return latest;
}

// ── Duration formatting (shared by view + timeline) ─────────────────────────

/** Compact human age like "3d", "5h", "12m", "just now". Pure; used for
 *  approval age + last-activity + timeline timestamps. */
export function formatAge(ms: number | null): string {
  if (ms === null) return '—';
  if (ms < 60 * 1000) return 'just now';
  if (ms < HOUR_MS) return `${Math.floor(ms / (60 * 1000))}m`;
  if (ms < DAY_MS) return `${Math.floor(ms / HOUR_MS)}h`;
  return `${Math.floor(ms / DAY_MS)}d`;
}
