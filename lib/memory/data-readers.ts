/**
 * lib/memory/data-readers.ts
 *
 * Typed readers for the Librarian-managed YAML data layer (memory/data/*.yaml).
 *
 * These are pure read functions. They do NOT write. All writes go through the
 * Librarian's INBOX (memory/inbox/) — see memory/data/README.md for the
 * contract. Calling code must NOT mutate the returned objects and re-serialize
 * them directly into the YAML files.
 *
 * All paths are resolved relative to process.cwd() so this works both from
 * the project root (Next.js / node:test) and from worktrees (same CWD).
 */

import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';

// ─── Path helpers ──────────────────────────────────────────────────────────

function dataFile(name: string): string {
  return path.join(process.cwd(), 'memory', 'data', name);
}

function loadYaml<T>(filename: string): T {
  const raw = fs.readFileSync(dataFile(filename), 'utf-8');
  return yaml.load(raw) as T;
}

// ─── Types ─────────────────────────────────────────────────────────────────

export type SessionOutcome = 'delivered' | 'errored' | 'killed' | 'partial';

export interface SessionCost {
  session_id: string;
  title: string;
  model: string;
  model_context_size: string;
  started_at: string;
  completed_at: string;
  tokens_in: number;
  tokens_out: number;
  estimated_cost_usd: number;
  outcome: SessionOutcome;
  pr_number?: number;
  pr_url?: string;
  tier: number;
  notes?: string;
}

export interface CvBarScore {
  pr_number: number;
  pr_title: string;
  session_id: string;
  model: string;
  self_score: number;
  persona: string;
  reasoning: string;
  scored_at: string;
}

export interface PromptPattern {
  pattern: string;
  typical_outcome: string;
  sample_size: number;
  first_pass_success_rate: number;
}

export interface ModelRoutingEntry {
  work_type: string;
  model: string;
  typical_cost_usd: number;
  typical_quality: string;
  notes?: string;
}

export interface WastePattern {
  pattern: string;
  instances: string[];
  rule: string;
}

export interface Calibration {
  schema_version: number;
  last_rollup_at: string | null;
  prompt_patterns: PromptPattern[];
  model_routing: ModelRoutingEntry[];
  known_waste_patterns: WastePattern[];
}

export type ConnerPriority = 'low' | 'medium' | 'high' | 'blocker';

export interface ConnerQueueItem {
  id: string;
  title: string;
  raised_at: string;
  raised_by: string;
  source: string;
  recommended_default: string;
  priority: ConnerPriority;
  age_days: number;
  estimated_conner_time_min: number;
  blocks: string[];
}

export interface ConnerResolvedItem {
  id: string;
  resolved_at: string;
  resolution: string;
}

export interface TierBudget {
  cap_usd: number;
  spent_usd: number;
  remaining_usd: number;
  pct_used: number;
}

export interface Tier5Budget {
  active: boolean;
  activated_by: string | null;
  cap_usd_lift: number | null;
}

export interface WeekBudget {
  starts_at: string;
  ends_at: string;
  tier_1_continuous: TierBudget;
  tier_2_daily: TierBudget;
  tier_3_weekly: TierBudget;
  tier_4_wholistic: TierBudget;
  tier_5_burst: Tier5Budget;
  total_cap_usd: number;
  total_spent_usd: number;
  total_projected_eow_usd: number;
}

export interface HistoricalWeek {
  starts_at: string;
  ends_at: string;
  total_cap_usd: number;
  total_spent_usd: number;
  tier_1_spent_usd: number;
  tier_2_spent_usd: number;
  tier_3_spent_usd: number;
  tier_4_spent_usd: number;
  tier_5_spent_usd: number;
}

export interface BudgetState {
  schema_version: number;
  current_week: WeekBudget;
  historical_weeks: HistoricalWeek[];
}

// ─── Raw YAML shapes (nullable arrays come back as null when empty) ─────────

interface RawSessionCosts {
  schema_version: number;
  sessions: SessionCost[] | null;
}

interface RawCvBarScores {
  schema_version: number;
  scores: CvBarScore[] | null;
}

interface RawCalibration {
  schema_version: number;
  last_rollup_at: string | null;
  prompt_patterns: PromptPattern[] | null;
  model_routing: ModelRoutingEntry[] | null;
  known_waste_patterns: WastePattern[] | null;
}

interface RawConnerQueue {
  schema_version: number;
  pending: ConnerQueueItem[] | null;
  resolved: ConnerResolvedItem[] | null;
}

// ─── Readers ───────────────────────────────────────────────────────────────

export async function readSessionCosts(opts?: {
  since?: Date;
  tier?: number;
}): Promise<SessionCost[]> {
  const raw = loadYaml<RawSessionCosts>('session-costs.yaml');
  let sessions = raw.sessions ?? [];

  if (opts?.since) {
    const cutoff = opts.since.getTime();
    sessions = sessions.filter((s) => new Date(s.started_at).getTime() >= cutoff);
  }

  if (opts?.tier !== undefined) {
    sessions = sessions.filter((s) => s.tier === opts.tier);
  }

  return sessions;
}

export async function readCvBarScores(opts?: {
  minScore?: number;
  lastN?: number;
}): Promise<CvBarScore[]> {
  const raw = loadYaml<RawCvBarScores>('cv-bar-scores.yaml');
  let scores = raw.scores ?? [];

  if (opts?.minScore !== undefined) {
    scores = scores.filter((s) => s.self_score >= opts.minScore!);
  }

  if (opts?.lastN !== undefined) {
    scores = scores.slice(-opts.lastN);
  }

  return scores;
}

export async function readCalibration(): Promise<Calibration> {
  const raw = loadYaml<RawCalibration>('calibration.yaml');
  return {
    schema_version: raw.schema_version,
    last_rollup_at: raw.last_rollup_at,
    prompt_patterns: raw.prompt_patterns ?? [],
    model_routing: raw.model_routing ?? [],
    known_waste_patterns: raw.known_waste_patterns ?? [],
  };
}

export async function readConnerQueue(opts?: {
  priority?: ConnerPriority;
  unresolved?: boolean;
}): Promise<ConnerQueueItem[]> {
  const raw = loadYaml<RawConnerQueue>('conner-queue.yaml');
  let items = raw.pending ?? [];

  if (opts?.priority !== undefined) {
    items = items.filter((i) => i.priority === opts.priority);
  }

  return items;
}

export async function readBudgetState(): Promise<BudgetState> {
  const raw = loadYaml<BudgetState>('budget-state.yaml');
  return {
    ...raw,
    historical_weeks: raw.historical_weeks ?? [],
  };
}

// ─── Helper ────────────────────────────────────────────────────────────────

const TIER_KEYS: Record<number, keyof WeekBudget> = {
  1: 'tier_1_continuous',
  2: 'tier_2_daily',
  3: 'tier_3_weekly',
  4: 'tier_4_wholistic',
};

export async function canSpend(
  tier: number,
  estimatedUsd: number,
): Promise<{ ok: boolean; reason?: string }> {
  const state = await readBudgetState();
  const week = state.current_week;

  // Tier 5 is burst — always allowed when active, else check total headroom.
  if (tier === 5) {
    if (!week.tier_5_burst.active) {
      return { ok: false, reason: 'Tier 5 burst not activated' };
    }
    return { ok: true };
  }

  const key = TIER_KEYS[tier];
  if (!key) {
    return { ok: false, reason: `Unknown tier ${tier}` };
  }

  const bucket = week[key] as TierBudget;
  if (bucket.remaining_usd < estimatedUsd) {
    return {
      ok: false,
      reason: `Tier ${tier} cap exceeded — $${bucket.remaining_usd.toFixed(2)} remaining, need $${estimatedUsd.toFixed(2)}`,
    };
  }

  return { ok: true };
}
