/**
 * lib/measurement/weekly-digest.ts
 *
 * Weekly "what Plaino did for you" proof-of-value digest — RENDER + PERSIST.
 *
 * NEW module (wave cv-x2). Imports the data layer (`./weekly-digest-data`)
 * and the existing value-ledger seam transitively; modifies NOTHING under
 * lib/measurement that already existed.
 *
 * Delivery pattern (deliberately REUSED, not reinvented): the digest is
 * persisted as a `WorkspaceBriefing` row — the exact same surface the daily
 * briefing generator writes (`lib/skills/briefing-generator`). The web
 * briefings page and the mobile briefing route both already list every
 * WorkspaceBriefing row ordered by `generatedAt`, so the weekly digest
 * shows up with zero new UI, zero new WorkApprovalKind, zero new channel,
 * and zero schema migration. We distinguish it from a daily briefing with:
 *   - a WEEKLY status string (`WEEKLY_READY` / `WEEKLY_EMPTY`), and
 *   - a `forDate` anchored to the reported week's SUNDAY, which can never
 *     collide with a Mon–Fri daily briefing's `forDate` (the @@unique key).
 *
 * Rendering is DETERMINISTIC — no LLM in the hot path (ANTHROPIC_API_KEY is
 * paused, and a proof-of-ROI surface must be reproducible, not generative).
 * Voice is Plaino heritage: calm, specific, never chirpy, no emoji.
 *
 * Per `feedback_cold_start_safe_agents.md`: reads durable state only.
 * Per `project_no_outbound_architecture.md`: writes ONE row; the optional
 *   notification email is a separate product-side concern, same scope as
 *   the daily briefing notice.
 */

import type { Prisma } from '@prisma/client';
import { withSystemContext as defaultWithSystemContext } from '@/lib/db';
import type { DbTransactionClient } from '@/lib/db';
import { encrypt } from '@/lib/security/encryption';
import {
  computeWeeklyDigestData,
  formatUsd,
  type SkillBreakdownRow,
  type WeeklyDigestData,
} from './weekly-digest-data';

export const WEEKLY_DIGEST_STATUS_READY = 'WEEKLY_READY';
export const WEEKLY_DIGEST_STATUS_EMPTY = 'WEEKLY_EMPTY';

export type SystemContextRunner = <T>(
  fn: (tx: DbTransactionClient) => Promise<T>,
) => Promise<T>;

export interface GenerateWeeklyDigestInput {
  workspaceId: string;
  /** Any instant in or after the week to report. Defaults to "now". The
   *  data layer resolves the prior completed Mon–Sun week from it. */
  now?: Date;
  /** Override for tests; live caller uses `withSystemContext`. */
  systemContext?: SystemContextRunner;
}

export interface GenerateWeeklyDigestResult {
  /** WorkspaceBriefing.id when the row was persisted; null on a PERMISSION
   *  corner case (RLS denies the row). */
  briefingId: string | null;
  /** The deterministic plaintext digest body (the persisted column is the
   *  encrypted ciphertext). */
  body: string;
  forDate: string;
  status: typeof WEEKLY_DIGEST_STATUS_READY | typeof WEEKLY_DIGEST_STATUS_EMPTY;
  /** True iff this call wrote a new row. False = same-week digest already
   *  existed and was returned unchanged (idempotent retry). */
  inserted: boolean;
  /** The structured numbers, surfaced for the notification email + tests. */
  data: WeeklyDigestData;
}

/**
 * Generate AND persist this week's proof-of-value digest for one workspace.
 *
 * Idempotent via the shared WorkspaceBriefing `@@unique([workspaceId,
 * forDate])`: a same-week re-run loads the existing Sunday-anchored row and
 * returns it unchanged. The cron iterates active workspaces and calls this
 * once per.
 */
export async function generateWeeklyDigestForWorkspace(
  input: GenerateWeeklyDigestInput,
): Promise<GenerateWeeklyDigestResult> {
  const now = input.now ?? new Date();
  const systemContext = input.systemContext ?? defaultWithSystemContext;

  // Compute the data first (read window) so we know the forDate anchor and
  // can short-circuit on an existing same-week row.
  const data = await systemContext(async (tx) => {
    const workspace = await tx.workspace.findUnique({
      where: { id: input.workspaceId },
      select: { id: true, name: true },
    });
    if (!workspace) {
      throw new Error(
        `generateWeeklyDigestForWorkspace: workspace ${input.workspaceId} not found`,
      );
    }
    return computeWeeklyDigestData(tx, {
      workspaceId: workspace.id,
      workspaceName: workspace.name,
      now,
    });
  });

  const status = data.isEmpty
    ? WEEKLY_DIGEST_STATUS_EMPTY
    : WEEKLY_DIGEST_STATUS_READY;
  const body = renderWeeklyDigestBody(data);
  const summary = buildDigestSummary(data);

  // Idempotent short-circuit + insert in one short transaction window.
  const persisted = await systemContext(async (tx) => {
    const existing = await tx.workspaceBriefing.findUnique({
      where: {
        workspaceId_forDate: {
          workspaceId: input.workspaceId,
          forDate: data.forDate,
        },
      },
      select: { id: true },
    });
    if (existing) {
      return { id: existing.id, inserted: false };
    }
    const row = await tx.workspaceBriefing.create({
      data: {
        workspaceId: input.workspaceId,
        forDate: data.forDate,
        body: encrypt(body),
        summary: summary as unknown as Prisma.InputJsonValue,
        status,
      },
      select: { id: true },
    });
    await tx.auditLog.create({
      data: {
        workspaceId: input.workspaceId,
        action: data.isEmpty
          ? 'weekly_digest.generated_empty'
          : 'weekly_digest.generated',
        targetTable: 'WorkspaceBriefing',
        targetId: row.id,
        payload: {
          forDate: data.forDate,
          hoursSaved: data.hoursSaved,
          dollarsInfluenced: data.dollarsInfluenced,
          actionsTaken: data.actionsTaken,
          actionsAutoExecuted: data.actionsAutoExecuted,
          hasRealDollars: data.hasRealDollars,
        } satisfies Prisma.InputJsonValue,
      },
    });
    return { id: row.id, inserted: true };
  });

  return {
    briefingId: persisted.id,
    body,
    forDate: data.forDate,
    status,
    inserted: persisted.inserted,
    data,
  };
}

// ── Deterministic renderer (Plaino heritage voice) ──────────────────────────

/**
 * Render the digest body as plain-language prose + a compact ledger. No
 * LLM: every sentence is a template filled from real numbers, so the same
 * data always renders the same words (a proof surface must be reproducible).
 */
export function renderWeeklyDigestBody(data: WeeklyDigestData): string {
  if (data.isEmpty) {
    return renderEmptyBody(data);
  }

  const weekLabel = `${ymd(data.weekStart)} – ${ymd(data.weekEnd, -1)}`;
  const lines: string[] = [];

  // Lede — the one number that matters for renewal.
  lines.push(
    `Last week (${weekLabel}), Plaino took ${count(
      data.actionsTaken,
      'action',
    )} for ${data.workspaceName} — saving about ${formatHours(
      data.hoursSaved,
    )} and influencing ${formatUsd(data.dollarsInfluenced)}${
      data.hasRealDollars ? ' in real invoice and estimate dollars' : ''
    }.`,
  );
  lines.push('');

  // Actions split — what you reviewed vs what ran on its own.
  if (data.actionsAutoExecuted > 0) {
    lines.push(
      `Of those, ${count(
        data.actionsStaged,
        'item',
      )} came to you for review, and ${count(
        data.actionsAutoExecuted,
        'item',
      )} the fleet handled on its own under the limits you set — each one logged in your audit trail.`,
    );
  } else {
    lines.push(
      `All ${count(
        data.actionsStaged,
        'item',
      )} came to you for review — nothing ran without your sign-off.`,
    );
  }
  lines.push('');

  // Dollars — the top line items that drove the influenced figure.
  if (data.topDollarLineItems.length > 0) {
    lines.push('What moved the dollars:');
    for (const li of data.topDollarLineItems) {
      const tag = li.real ? '' : ' (time-based estimate)';
      lines.push(`- ${formatUsd(li.dollars)} — ${li.label}${tag}`);
    }
    lines.push('');
  }

  // Per-skill breakdown — which agents did the work.
  if (data.bySkill.length > 0) {
    lines.push('By skill:');
    for (const s of topSkills(data.bySkill)) {
      lines.push(`- ${renderSkillLine(s)}`);
    }
    lines.push('');
  }

  // Honest cost footer — net value, including when it's negative.
  lines.push(
    `Plaino's own running cost this week was ${formatUsdCents(
      data.tokenCostUsd,
    )}, so the net value Plaino returned was ${formatUsd(data.netValueUsd)}.`,
  );

  return lines.join('\n').trim();
}

function renderEmptyBody(data: WeeklyDigestData): string {
  const weekLabel = `${ymd(data.weekStart)} – ${ymd(data.weekEnd, -1)}`;
  return (
    `Last week (${weekLabel}) was quiet for ${data.workspaceName} — Plaino ` +
    `didn't have an approved action to point to yet. That's normal early on: ` +
    `Plaino is still learning your business, watching your inbox and your ` +
    `systems so it knows what's worth bringing to you. As soon as the first ` +
    `drafts and follow-ups start landing in your approvals, this digest will ` +
    `fill in with the hours and dollars behind them.`
  );
}

function renderSkillLine(s: SkillBreakdownRow): string {
  const parts = [`${s.agentSlug}: ${count(s.actions, 'action')}`];
  if (s.autoExecuted > 0) parts.push(`${s.autoExecuted} auto`);
  if (s.hours > 0) parts.push(`~${formatHours(s.hours)}`);
  if (s.dollars > 0) parts.push(formatUsd(s.dollars));
  return parts.join(' · ');
}

/** Cap the per-skill list at the 6 highest-value skills so the body stays
 *  glanceable; the structured summary JSON keeps the full breakdown. */
function topSkills(rows: SkillBreakdownRow[]): SkillBreakdownRow[] {
  return rows.slice(0, 6);
}

// ── Structured summary (persisted on WorkspaceBriefing.summary JSON) ─────────

/**
 * The structured numbers persisted alongside the prose body, so a future
 * richer card UI (or the mobile app) can render the digest as data without
 * re-parsing prose. Shape is intentionally flat + JSON-safe.
 */
export interface WeeklyDigestSummary {
  weekly: true;
  weekStart: string;
  weekEnd: string;
  hoursSaved: number;
  dollarsInfluenced: number;
  hasRealDollars: boolean;
  actionsTaken: number;
  actionsStaged: number;
  actionsAutoExecuted: number;
  netValueUsd: number;
  tokenCostUsd: number;
  topDollarLineItems: WeeklyDigestData['topDollarLineItems'];
  bySkill: WeeklyDigestData['bySkill'];
}

export function buildDigestSummary(data: WeeklyDigestData): WeeklyDigestSummary {
  return {
    weekly: true,
    weekStart: data.weekStart,
    weekEnd: data.weekEnd,
    hoursSaved: data.hoursSaved,
    dollarsInfluenced: data.dollarsInfluenced,
    hasRealDollars: data.hasRealDollars,
    actionsTaken: data.actionsTaken,
    actionsStaged: data.actionsStaged,
    actionsAutoExecuted: data.actionsAutoExecuted,
    netValueUsd: data.netValueUsd,
    tokenCostUsd: data.tokenCostUsd,
    topDollarLineItems: data.topDollarLineItems,
    bySkill: data.bySkill,
  };
}

// ── Formatting helpers ───────────────────────────────────────────────────────

function count(n: number, noun: string): string {
  return `${n} ${noun}${n === 1 ? '' : 's'}`;
}

/** Hours as a human phrase: "45 minutes" under an hour, else "3.5 hours". */
function formatHours(hours: number): string {
  if (hours <= 0) return '0 hours';
  if (hours < 1) {
    const mins = Math.round(hours * 60);
    return `${mins} minute${mins === 1 ? '' : 's'}`;
  }
  const rounded = Math.round(hours * 10) / 10;
  return `${rounded} hour${rounded === 1 ? '' : 's'}`;
}

/** Token cost keeps cents because it's typically a few dollars. */
function formatUsdCents(n: number): string {
  return `$${n.toFixed(2)}`;
}

/** ISO datetime → Y-M-D, with an optional whole-day offset (e.g. −1 to show
 *  the inclusive last day of an exclusive end boundary). */
function ymd(iso: string, dayOffset = 0): string {
  const d = new Date(iso);
  if (dayOffset !== 0) {
    d.setUTCDate(d.getUTCDate() + dayOffset);
  }
  return d.toISOString().slice(0, 10);
}
