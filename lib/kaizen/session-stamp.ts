/**
 * lib/kaizen/session-stamp.ts
 *
 * Deliverable C — the per-session post-write hook that makes the data layer
 * actually populate.
 *
 * Right now session-costs.yaml and cv-bar-scores.yaml are essentially empty
 * (the Librarian's audit confirmed it): the schema exists but nothing writes
 * rows. This module is what a session calls on completion to record its cost +
 * outcome (and, for a PR, its cv-bar self-score).
 *
 * It respects the write contract (memory/data/README.md): it does NOT mutate
 * the YAML data files directly — concurrent sessions would clobber each other.
 * Instead it drops a timestamped payload into memory/inbox/, which the Librarian
 * merges into the right file on its 15-minute cadence. Writes are serialized
 * through the Librarian; this stays append-only and collision-free.
 *
 * Usage (from a session wrapping mcp__dispatch__start_code_task, or any session
 * at its end):
 *
 *   await stampSessionCost({
 *     session_id, title, model, model_context_size,
 *     started_at, completed_at, tokens_in, tokens_out,
 *     outcome, tier, pr_number, pr_url, notes,
 *   });
 *   // estimated_cost_usd is computed from the token counts if omitted.
 *
 *   await stampCvBarScore({
 *     pr_number, pr_title, session_id, model,
 *     self_score, persona, reasoning,
 *   });
 */

import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';
import { estimateCostUsd } from './pricing.js';
import type { SessionOutcome, SessionCost, CvBarScore } from '../memory/data-readers.js';

function inboxDir(): string {
  return path.join(process.cwd(), 'memory', 'inbox');
}

/** UTC YYYYMMDD-HHMMSS for the inbox filename. */
function stamp(now: Date): string {
  const p = (n: number, w = 2) => String(n).padStart(w, '0');
  return (
    `${now.getUTCFullYear()}${p(now.getUTCMonth() + 1)}${p(now.getUTCDate())}` +
    `-${p(now.getUTCHours())}${p(now.getUTCMinutes())}${p(now.getUTCSeconds())}`
  );
}

function writePayload(
  kind: string,
  payload: Record<string, unknown>,
  now: Date,
  dir: string,
): string {
  fs.mkdirSync(dir, { recursive: true });
  // Disambiguate within the same second with a short suffix from the payload.
  const tag = (payload.session_id ?? payload.pr_number ?? 'item')
    .toString()
    .replace(/[^a-z0-9]+/gi, '')
    .slice(-8);
  const file = path.join(dir, `${stamp(now)}-${kind}-${tag}.yaml`);
  fs.writeFileSync(file, yaml.dump(payload), 'utf-8');
  return file;
}

// ─── Session cost ────────────────────────────────────────────────────────────

export interface SessionCostStamp {
  session_id: string;
  title: string;
  model: string;
  model_context_size: string;
  started_at: string;
  completed_at: string;
  tokens_in: number;
  tokens_out: number;
  outcome: SessionOutcome;
  tier: number;
  /** Optional — recomputed from tokens if omitted. */
  estimated_cost_usd?: number;
  pr_number?: number;
  pr_url?: string;
  notes?: string;
}

/**
 * Build the INBOX payload for a session-cost row (no I/O — testable directly).
 * `estimated_cost_usd` is filled from the token counts when the caller omits
 * it; if the model isn't priced it stays at the caller's value or 0 and a
 * `cost_unpriced` flag is set so the Librarian/retro can see it's not real.
 */
export function buildSessionCostPayload(s: SessionCostStamp): {
  type: 'session-cost';
  target: 'session-costs.yaml';
  session_cost: SessionCost;
  cost_unpriced?: boolean;
} {
  const computed = estimateCostUsd(s.model, s.tokens_in, s.tokens_out);
  const estimated_cost_usd =
    s.estimated_cost_usd ?? computed ?? 0;
  const session_cost: SessionCost = {
    session_id: s.session_id,
    title: s.title,
    model: s.model,
    model_context_size: s.model_context_size,
    started_at: s.started_at,
    completed_at: s.completed_at,
    tokens_in: s.tokens_in,
    tokens_out: s.tokens_out,
    estimated_cost_usd,
    outcome: s.outcome,
    tier: s.tier,
    ...(s.pr_number !== undefined ? { pr_number: s.pr_number } : {}),
    ...(s.pr_url !== undefined ? { pr_url: s.pr_url } : {}),
    ...(s.notes !== undefined ? { notes: s.notes } : {}),
  };
  return {
    type: 'session-cost',
    target: 'session-costs.yaml',
    session_cost,
    ...(computed === null && s.estimated_cost_usd === undefined
      ? { cost_unpriced: true }
      : {}),
  };
}

/** Write a session-cost payload to the INBOX. Returns the file path written. */
export async function stampSessionCost(
  s: SessionCostStamp,
  opts?: { inboxDir?: string; now?: Date },
): Promise<string> {
  const now = opts?.now ?? new Date();
  const dir = opts?.inboxDir ?? inboxDir();
  return writePayload('session-cost', buildSessionCostPayload(s), now, dir);
}

// ─── cv-bar score ──────────────────────────────────────────────────────────────

export interface CvBarStamp {
  pr_number: number;
  pr_title: string;
  session_id: string;
  model: string;
  self_score: number;
  persona: string;
  reasoning: string;
  /** Optional — defaults to now (ISO) at write time. */
  scored_at?: string;
}

export function buildCvBarPayload(
  c: CvBarStamp,
  now: Date,
): { type: 'cv-bar-score'; target: 'cv-bar-scores.yaml'; cv_bar_score: CvBarScore } {
  if (c.self_score < 1 || c.self_score > 5) {
    throw new Error(
      `cv-bar self_score must be 1–5, got ${c.self_score} (pr#${c.pr_number})`,
    );
  }
  return {
    type: 'cv-bar-score',
    target: 'cv-bar-scores.yaml',
    cv_bar_score: {
      pr_number: c.pr_number,
      pr_title: c.pr_title,
      session_id: c.session_id,
      model: c.model,
      self_score: c.self_score,
      persona: c.persona,
      reasoning: c.reasoning,
      scored_at: c.scored_at ?? now.toISOString(),
    },
  };
}

/** Write a cv-bar-score payload to the INBOX. Returns the file path written. */
export async function stampCvBarScore(
  c: CvBarStamp,
  opts?: { inboxDir?: string; now?: Date },
): Promise<string> {
  const now = opts?.now ?? new Date();
  const dir = opts?.inboxDir ?? inboxDir();
  return writePayload('cv-bar-score', buildCvBarPayload(c, now), now, dir);
}
