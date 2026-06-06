/**
 * lib/billing/budget.ts
 *
 * Per-workspace token-budget governor. THE shared interface between the
 * LLM-call enforcement seam (`lib/llm/budget-enforcing-provider.ts`), the
 * operator alarm (`/operator/fleet`, `/operator/workspaces`), and the
 * customer transparency pane (`/settings/billing`). Built entirely on the
 * existing `LlmUsageRecord` substrate + the `lib/pricing/tiers.ts` ladder —
 * NO new schema (production+growth plan §2: "build a budget governor on top
 * of the existing `LlmUsageRecord` substrate — no new schema needed").
 *
 * ── The economics this enforces ──────────────────────────────────────────
 * `outputs/production_growth_plan_2026_06_03/PLAN.md` §2 establishes that at
 * the post-wave-8 model mix a heavy single-seat workspace costs ~$162–279/mo
 * in Anthropic tokens against a $99–199/mo subscription — i.e. at/below
 * break-even on the heaviest customers. The governor caps token COGS at a
 * fraction of the workspace's MRR so margin stays healthy:
 *
 *   token ceiling = MRR × (1 − gross-margin target)
 *                 = MRR × 0.30   (at a 70% gross-margin target, PLAN §2)
 *
 * This reproduces the plan's "Break-even token budget per workspace" table:
 *   $199/seat → ~$60/mo ceiling   (Regular, 1 seat)
 *   $149/seat → ~$45/mo ceiling   (Regular, 10–24 band)
 *   $99/seat  → ~$30/mo ceiling   (Regular, 50–99 band)
 *
 * Because the ceiling is MRR-proportional, the higher-priced Partner (PLUS)
 * tier automatically carries a higher cap ("Partner customers expect more
 * usage") and the quote-based Max tier is uncapped by default (per-engagement
 * ceilings are negotiated out of band; `ceilingMicroCents === null`).
 *
 * ── Why a soft, operator-facing governor (not a hard kill) ────────────────
 * Per `project_no_outbound_architecture` the service-partnership model keeps
 * the operator in the loop on judgment calls. The governor:
 *   - OK    (< 80% of ceiling) → allow.
 *   - WATCH (≥ 80%)            → allow + emit a warning event; surfaces as a
 *                                "cost review" chip for the operator.
 *   - OVER  (≥ 100%)           → block the call (raise OVER_BUDGET / queue);
 *                                operator moves the workspace to a higher
 *                                tier or grants a per-skill override.
 *
 * ── Cold-start safety ─────────────────────────────────────────────────────
 * Per `feedback_cold_start_safe_agents`: correctness reads durable state
 * (`LlmUsageRecord` + `Subscription`) on every decision. The in-process
 * snapshot cache (`snapshotForGate`) is PERFORMANCE ONLY — a soft monthly
 * budget tolerates a ≤60s-stale read, and the cache rebuilds from the DB on
 * any cold start.
 */

import type { Prisma, WorkspaceVerticalTier } from '@prisma/client';
import { withSystemContext } from '@/lib/db';
import { getLogger } from '@/lib/observability/logger';
import type { LlmRequestMeta } from '@/lib/llm/types';
import {
  perSeatMonthlyUsdCents,
  seatBandForSeats,
  tierFromVerticalTier,
  type TierName,
} from '@/lib/pricing/tiers';

// ── Policy constants (cited) ──────────────────────────────────────────────

/** Target gross margin per seat (PLAN §2 "Break-even token budget per
 *  workspace" — the one explicitly-labeled target, not an on-disk fact). */
export const BUDGET_GROSS_MARGIN_TARGET = 0.7;

/** Fraction of MRR that token COGS may consume before a workspace is OVER
 *  budget. 1 − margin target = 0.30 of MRR (PLAN §2). */
export const BUDGET_COGS_CEILING_FRACTION = 1 - BUDGET_GROSS_MARGIN_TARGET;

/** Fraction of the ceiling at which a workspace flips to WATCH (warn but
 *  still allow). PLAN §2 / §10 "abnormal token spend (>80% of MRR ceiling)". */
export const BUDGET_WATCH_FRACTION = 0.8;

/** 1 cent = 1,000,000 micro-cents (matches `LlmUsageRecord.costMicroCents`). */
const MICRO_CENTS_PER_CENT = 1_000_000n;

const UUID_RE =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

// ── Types ─────────────────────────────────────────────────────────────────

export type BudgetStatus = 'OK' | 'WATCH' | 'OVER';

export interface WorkspaceBudgetInputs {
  tier: TierName;
  /** Monthly recurring revenue for the whole workspace, in USD cents. */
  mrrCents: number;
  seats: number;
  /** Where the MRR was resolved from — useful for the operator surface to
   *  distinguish a Stripe-billed workspace from a manual-invoice one. */
  source: 'subscription' | 'workspace-manual' | 'workspace-default';
}

export interface WorkspaceBudgetSnapshot {
  workspaceId: string;
  tier: TierName;
  mrrCents: number;
  seats: number;
  /** This calendar month's token spend (sum of `costMicroCents`). */
  spendMicroCents: bigint;
  /** Monthly ceiling in micro-cents, or `null` when uncapped (Max tier). */
  ceilingMicroCents: bigint | null;
  /** spend / ceiling, 0..>1. 0 when uncapped (no meaningful ratio). */
  fraction: number;
  status: BudgetStatus;
  /** Inclusive UTC start of the spend window (start of the calendar month). */
  periodStart: Date;
}

/** The decision the enforcement wrapper acts on. */
export interface BudgetGateDecision {
  outcome: 'ALLOW' | 'WARN' | 'BLOCK';
  /** Resolved workspace id, or null when the call was not workspace-tagged
   *  (operator / system scaffolding — never budgeted). */
  workspaceId: string | null;
  status: BudgetStatus | null;
  snapshot: WorkspaceBudgetSnapshot | null;
}

/** The seam the `BudgetEnforcingLlmProvider` calls per completion. Dependency-
 *  inverted (a plain callback, not an imported class) so `lib/llm` stays free
 *  of a Prisma dependency and tests can pin a stub gate. */
export type BudgetGate = (
  meta: LlmRequestMeta | undefined,
) => Promise<BudgetGateDecision>;

/** Raised (or surfaced as the `OVER_BUDGET` typed result) when a workspace
 *  has reached its monthly ceiling. Carries the snapshot so an operator-side
 *  caller can present the numbers without re-querying. */
export class WorkspaceOverBudgetError extends Error {
  readonly workspaceId: string;
  readonly snapshot: WorkspaceBudgetSnapshot | null;
  constructor(workspaceId: string, snapshot: WorkspaceBudgetSnapshot | null) {
    super(
      `Workspace ${workspaceId} has reached its monthly token budget` +
        (snapshot?.ceilingMicroCents != null
          ? ` (${snapshot.spendMicroCents} / ${snapshot.ceilingMicroCents} micro-cents)`
          : ''),
    );
    this.name = 'WorkspaceOverBudgetError';
    this.workspaceId = workspaceId;
    this.snapshot = snapshot;
  }
}

// ── Pure helpers (no IO) ──────────────────────────────────────────────────

/** Inclusive UTC start of the calendar month containing `now`. We use the
 *  calendar month (not the Stripe billing period) so the cap resets on a
 *  predictable, customer-legible boundary and the customer surface can say
 *  "this month" honestly. */
export function startOfMonthUtc(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

/** Monthly token-cost ceiling in micro-cents for a (tier, MRR) pair. Returns
 *  `null` for the quote-based Max tier (uncapped by default). */
export function monthlyTokenCeilingMicroCents(
  tier: TierName,
  mrrCents: number,
): bigint | null {
  if (tier === 'max') return null;
  const ceilingCents = Math.round(
    Math.max(0, mrrCents) * BUDGET_COGS_CEILING_FRACTION,
  );
  return BigInt(ceilingCents) * MICRO_CENTS_PER_CENT;
}

/** Classify a spend against a ceiling. Uncapped (null/≤0) ceiling is always
 *  OK. All comparisons are BigInt-exact. */
export function budgetStatusFor(
  spendMicroCents: bigint,
  ceilingMicroCents: bigint | null,
): BudgetStatus {
  if (ceilingMicroCents === null || ceilingMicroCents <= 0n) return 'OK';
  if (spendMicroCents >= ceilingMicroCents) return 'OVER';
  // WATCH at spend/ceiling >= 0.80, expressed BigInt-safe:
  //   spend * 100 >= ceiling * 80
  const watchPercent = BigInt(Math.round(BUDGET_WATCH_FRACTION * 100));
  if (spendMicroCents * 100n >= ceilingMicroCents * watchPercent) return 'WATCH';
  return 'OK';
}

/** spend/ceiling as a float for display. 0 when uncapped. Safe: monthly
 *  micro-cent totals stay far below `Number.MAX_SAFE_INTEGER`. */
export function budgetFractionFor(
  spendMicroCents: bigint,
  ceilingMicroCents: bigint | null,
): number {
  if (!ceilingMicroCents || ceilingMicroCents <= 0n) return 0;
  return Number(spendMicroCents) / Number(ceilingMicroCents);
}

// ── Workspace-shape resolution (pure given a selected row) ────────────────

/** The minimal Workspace shape the budget resolver needs. Selected by the
 *  query helpers below and by the operator fleet board's single findMany. */
export interface WorkspaceBudgetRow {
  verticalTier: WorkspaceVerticalTier;
  /** Manual-invoice override price in USD cents (Workspace.tierPriceUsdMonthly). */
  tierPriceUsdMonthly: number | null;
  subscription: { tier: WorkspaceVerticalTier; seats: number } | null;
}

/** Per-seat charge × seats, clamping out-of-ladder (100+) seat counts to the
 *  top band so we never throw on a custom/large workspace (Max is uncapped
 *  anyway). */
function safeMonthlyChargeCents(tier: TierName, seats: number): number {
  const clampedForBand = Math.min(99, Math.max(1, seats));
  const band = seatBandForSeats(clampedForBand);
  const perSeat = perSeatMonthlyUsdCents(tier, band);
  return perSeat * Math.max(1, seats);
}

/** Resolve (tier, MRR, seats) from a selected workspace row. Prefers the live
 *  Subscription; falls back to the workspace's manual-invoice price; finally
 *  to ladder pricing at 1 seat. */
export function budgetInputsFromRow(
  row: WorkspaceBudgetRow,
): WorkspaceBudgetInputs {
  const sub = row.subscription;
  if (sub) {
    const tier = tierFromVerticalTier(sub.tier);
    const seats = Math.max(1, sub.seats);
    return {
      tier,
      seats,
      mrrCents: safeMonthlyChargeCents(tier, seats),
      source: 'subscription',
    };
  }
  const tier = tierFromVerticalTier(row.verticalTier);
  if (row.tierPriceUsdMonthly != null && row.tierPriceUsdMonthly > 0) {
    return {
      tier,
      seats: 1,
      mrrCents: row.tierPriceUsdMonthly,
      source: 'workspace-manual',
    };
  }
  return {
    tier,
    seats: 1,
    mrrCents: safeMonthlyChargeCents(tier, 1),
    source: 'workspace-default',
  };
}

/** Build a snapshot from already-resolved inputs + a measured spend. Pure. */
export function composeSnapshot(args: {
  workspaceId: string;
  inputs: WorkspaceBudgetInputs;
  spendMicroCents: bigint;
  periodStart: Date;
}): WorkspaceBudgetSnapshot {
  const ceiling = monthlyTokenCeilingMicroCents(
    args.inputs.tier,
    args.inputs.mrrCents,
  );
  return {
    workspaceId: args.workspaceId,
    tier: args.inputs.tier,
    mrrCents: args.inputs.mrrCents,
    seats: args.inputs.seats,
    spendMicroCents: args.spendMicroCents,
    ceilingMicroCents: ceiling,
    fraction: budgetFractionFor(args.spendMicroCents, ceiling),
    status: budgetStatusFor(args.spendMicroCents, ceiling),
    periodStart: args.periodStart,
  };
}

// ── Read API (callers pass their own RLS-scoped tx) ───────────────────────

const SNAPSHOT_SELECT = {
  verticalTier: true,
  tierPriceUsdMonthly: true,
  subscription: { select: { tier: true, seats: true } },
} as const;

/** Resolve a single workspace's budget inputs from the DB. Caller supplies
 *  the RLS-scoped transaction client (operator/system context, or the
 *  workspace's own context). */
export async function resolveWorkspaceBudgetInputs(
  tx: Prisma.TransactionClient,
  workspaceId: string,
): Promise<WorkspaceBudgetInputs | null> {
  const row = await tx.workspace.findUnique({
    where: { id: workspaceId },
    select: SNAPSHOT_SELECT,
  });
  if (!row) return null;
  return budgetInputsFromRow(row);
}

/** Sum this calendar month's token spend for a workspace. Uses the
 *  `(workspaceId, createdAt DESC)` index. */
export async function workspaceMonthSpendMicroCents(
  tx: Prisma.TransactionClient,
  workspaceId: string,
  now: Date = new Date(),
): Promise<bigint> {
  const agg = await tx.llmUsageRecord.aggregate({
    where: { workspaceId, createdAt: { gte: startOfMonthUtc(now) } },
    _sum: { costMicroCents: true },
  });
  return agg._sum.costMicroCents ?? 0n;
}

/** Full snapshot for one workspace. Used by the customer billing pane and by
 *  the enforcement gate. */
export async function getWorkspaceBudgetSnapshot(
  tx: Prisma.TransactionClient,
  args: { workspaceId: string; now?: Date },
): Promise<WorkspaceBudgetSnapshot | null> {
  const inputs = await resolveWorkspaceBudgetInputs(tx, args.workspaceId);
  if (!inputs) return null;
  const now = args.now ?? new Date();
  const periodStart = startOfMonthUtc(now);
  const spendMicroCents = await workspaceMonthSpendMicroCents(
    tx,
    args.workspaceId,
    now,
  );
  return composeSnapshot({
    workspaceId: args.workspaceId,
    inputs,
    spendMicroCents,
    periodStart,
  });
}

/** Snapshots for every workspace, sorted by budget consumption DESC. Two
 *  queries total (workspaces + one grouped spend aggregate) — does NOT issue
 *  a query per workspace. For the operator fleet board / cost-review chip. */
export async function getFleetBudgetSnapshots(
  tx: Prisma.TransactionClient,
  args: { now?: Date; atRiskOnly?: boolean } = {},
): Promise<WorkspaceBudgetSnapshot[]> {
  const now = args.now ?? new Date();
  const periodStart = startOfMonthUtc(now);
  const [workspaces, spendRows] = await Promise.all([
    tx.workspace.findMany({ select: { id: true, ...SNAPSHOT_SELECT } }),
    tx.llmUsageRecord.groupBy({
      by: ['workspaceId'],
      where: { createdAt: { gte: periodStart } },
      _sum: { costMicroCents: true },
    }),
  ]);
  const spendByWorkspace = new Map<string, bigint>();
  for (const r of spendRows) {
    spendByWorkspace.set(r.workspaceId, r._sum.costMicroCents ?? 0n);
  }
  const snapshots = workspaces.map((w) =>
    composeSnapshot({
      workspaceId: w.id,
      inputs: budgetInputsFromRow(w),
      spendMicroCents: spendByWorkspace.get(w.id) ?? 0n,
      periodStart,
    }),
  );
  const filtered = args.atRiskOnly
    ? snapshots.filter((s) => s.status !== 'OK')
    : snapshots;
  return filtered.sort((a, b) => b.fraction - a.fraction);
}

// ── Enforcement gate (system-context, cached) ─────────────────────────────

const ALLOW_SKIP: BudgetGateDecision = {
  outcome: 'ALLOW',
  workspaceId: null,
  status: null,
  snapshot: null,
};

interface CacheEntry {
  snapshot: WorkspaceBudgetSnapshot;
  expiresAtMs: number;
}

/** Per-workspace snapshot cache. Performance only — see file header. On a
 *  serverless instance this is naturally bounded (per-instance, short TTL). */
const snapshotCache = new Map<string, CacheEntry>();

function cacheTtlMs(): number {
  const raw = process.env.LLM_BUDGET_CACHE_TTL_MS;
  if (raw === undefined) return 60_000;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : 60_000;
}

/** Test seam — clear the snapshot cache between cases. */
export function __resetBudgetCacheForTests(): void {
  snapshotCache.clear();
}

async function snapshotForGate(
  workspaceId: string,
): Promise<WorkspaceBudgetSnapshot | null> {
  const ttl = cacheTtlMs();
  const nowMs = Date.now();
  const cached = snapshotCache.get(workspaceId);
  if (cached && cached.expiresAtMs > nowMs) return cached.snapshot;
  // System context: the gate runs mid-LLM-call under an arbitrary RLS
  // context (or none). withSystemContext bypasses RLS the same way the
  // usage recorder's writer path does.
  const snapshot = await withSystemContext((tx) =>
    getWorkspaceBudgetSnapshot(tx, { workspaceId }),
  );
  if (snapshot && ttl > 0) {
    snapshotCache.set(workspaceId, { snapshot, expiresAtMs: nowMs + ttl });
  }
  return snapshot;
}

/** Production gate, wired into the default provider by `lib/llm/index.ts`.
 *  Skips (ALLOW) when the call is not workspace-tagged. FAILS OPEN on any
 *  error — budget accounting must never take down a customer-facing LLM
 *  call (same principle as the usage recorder swallowing write failures). */
export const persistBudgetGate: BudgetGate = async (meta) => {
  const workspaceId = meta?.workspaceId;
  if (!workspaceId || !UUID_RE.test(workspaceId)) return ALLOW_SKIP;
  try {
    const snapshot = await snapshotForGate(workspaceId);
    if (!snapshot) return ALLOW_SKIP;
    const outcome: BudgetGateDecision['outcome'] =
      snapshot.status === 'OVER'
        ? 'BLOCK'
        : snapshot.status === 'WATCH'
          ? 'WARN'
          : 'ALLOW';
    if (outcome !== 'ALLOW') {
      const line = {
        workspace_id: workspaceId,
        skill: meta?.skill ?? null,
        source_surface: meta?.sourceSurface ?? null,
        tier: snapshot.tier,
        status: snapshot.status,
        spend_micro_cents: snapshot.spendMicroCents.toString(),
        ceiling_micro_cents: snapshot.ceilingMicroCents?.toString() ?? null,
        fraction: Math.round(snapshot.fraction * 100) / 100,
      };
      if (outcome === 'BLOCK') {
        getLogger().warn('llm.budget.blocked', line);
      } else {
        getLogger().info('llm.budget.warning', line);
      }
    }
    return { outcome, workspaceId, status: snapshot.status, snapshot };
  } catch (err) {
    getLogger().warn('llm.budget.gate_failed', {
      workspace_id: workspaceId,
      error: err instanceof Error ? err.message : String(err),
    });
    return ALLOW_SKIP;
  }
};
