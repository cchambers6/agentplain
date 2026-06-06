/**
 * lib/feedback/store.ts
 *
 * Prisma read/write boundary for PreferenceFeedback. The only file that
 * constructs these rows. Callers receive plain views, never Prisma model
 * types (feedback_no_silent_vendor_lock).
 *
 * Workspace-scoped reads/writes take an RlsContext and run under
 * `withRls`. The cross-workspace reads + the CapabilityProposal write used
 * by the weekly drift sweep and the operator leadership board run under
 * `withSystemContext` (is_operator='true'), which the RLS policies on
 * PreferenceFeedback + CapabilityProposal both honor.
 */

import { withRls, withSystemContext, type RlsContext } from '../db/rls';
import { buildProposalBody, driftMarker } from './drift';
import {
  CATEGORY_TO_DB,
  DB_TO_CATEGORY,
  FEEDBACK_REASON_MAX_CHARS,
  FEEDBACK_TEXT_MAX_CHARS,
  type FeedbackCategory,
  type PreferenceFeedbackView,
  type WorkspaceDriftRow,
} from './types';

interface PrismaFeedbackRow {
  id: string;
  workspaceId: string;
  userId: string | null;
  targetSkillSlug: string;
  category: string;
  reason: string;
  createdAt: Date;
}

function toView(row: PrismaFeedbackRow): PreferenceFeedbackView {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    userId: row.userId,
    targetSkillSlug: row.targetSkillSlug,
    category: DB_TO_CATEGORY[row.category] ?? 'other',
    reason: row.reason,
    createdAt: row.createdAt,
  };
}

function clip(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 1).trimEnd() + '…';
}

export interface RecordFeedbackArgs {
  workspaceId: string;
  userId: string | null;
  targetSkillSlug: string;
  category: FeedbackCategory;
  reason: string;
  originalDraft?: string | null;
  correctedDraft?: string | null;
}

/** Persist one categorized correction. Workspace-scoped. */
export async function recordPreferenceFeedback(
  ctx: RlsContext,
  args: RecordFeedbackArgs,
): Promise<PreferenceFeedbackView> {
  return withRls(ctx, async (tx) => {
    const row = (await tx.preferenceFeedback.create({
      data: {
        workspaceId: args.workspaceId,
        userId: args.userId,
        targetSkillSlug: args.targetSkillSlug,
        category: CATEGORY_TO_DB[args.category] as never,
        reason: clip(args.reason.trim(), FEEDBACK_REASON_MAX_CHARS),
        originalDraft: args.originalDraft
          ? clip(args.originalDraft, FEEDBACK_TEXT_MAX_CHARS)
          : null,
        correctedDraft: args.correctedDraft
          ? clip(args.correctedDraft, FEEDBACK_TEXT_MAX_CHARS)
          : null,
      },
    })) as PrismaFeedbackRow;
    return toView(row);
  });
}

/** Workspace-scoped read of this-window feedback for the /briefings
 *  section. Newest first. */
export async function listWorkspaceFeedbackSince(
  ctx: RlsContext,
  workspaceId: string,
  since: Date,
): Promise<PreferenceFeedbackView[]> {
  return withRls(ctx, async (tx) => {
    const rows = (await tx.preferenceFeedback.findMany({
      where: { workspaceId, createdAt: { gte: since } },
      orderBy: { createdAt: 'desc' },
      take: 500,
    })) as PrismaFeedbackRow[];
    return rows.map(toView);
  });
}

export interface WorkspaceFeedbackBatch {
  workspaceId: string;
  workspaceName: string;
  rows: PreferenceFeedbackView[];
}

/** Cross-workspace read for the drift sweep: every ACTIVE workspace that
 *  has at least one correction since `since`, with its rows grouped.
 *  System context — one query, grouped in JS (launch-scale fan-out). */
export async function listWorkspaceFeedbackBatchesSince(
  since: Date,
): Promise<WorkspaceFeedbackBatch[]> {
  return withSystemContext(async (tx) => {
    const rows = (await tx.preferenceFeedback.findMany({
      where: {
        createdAt: { gte: since },
        workspace: { closureStatus: 'ACTIVE' },
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        workspaceId: true,
        userId: true,
        targetSkillSlug: true,
        category: true,
        reason: true,
        createdAt: true,
        workspace: { select: { name: true } },
      },
    })) as Array<PrismaFeedbackRow & { workspace: { name: string } }>;

    const batches = new Map<string, WorkspaceFeedbackBatch>();
    for (const row of rows) {
      let batch = batches.get(row.workspaceId);
      if (!batch) {
        batch = {
          workspaceId: row.workspaceId,
          workspaceName: row.workspace.name,
          rows: [],
        };
        batches.set(row.workspaceId, batch);
      }
      batch.rows.push(toView(row));
    }
    return [...batches.values()];
  });
}

/** Idempotency guard: has the sweep already queued a proposal for this
 *  workspace+skill+category since `since`? Matches the drift marker the
 *  proposal body carries. */
export async function hasOpenDriftProposal(
  workspaceId: string,
  targetSkillSlug: string,
  category: FeedbackCategory,
  since: Date,
): Promise<boolean> {
  const marker = driftMarker(targetSkillSlug, category);
  return withSystemContext(async (tx) => {
    const existing = await tx.capabilityProposal.findFirst({
      where: {
        workspaceId,
        targetAgentSlug: targetSkillSlug,
        createdAt: { gte: since },
        body: { contains: marker },
      },
      select: { id: true },
    });
    return existing !== null;
  });
}

export interface CreateDriftProposalArgs {
  workspaceId: string;
  targetSkillSlug: string;
  category: FeedbackCategory;
  count: number;
  weekStartIso: string;
  weekEndIso: string;
}

/** Queue a workspace-scoped CapabilityProposal from the drift sweep.
 *  Operator-only table — system context. State DRAFT (the operator
 *  triages it like any other proposal). */
export async function createDriftProposal(
  args: CreateDriftProposalArgs,
): Promise<string> {
  const body = buildProposalBody({
    targetSkillSlug: args.targetSkillSlug,
    category: args.category,
    count: args.count,
    weekStartIso: args.weekStartIso,
    weekEndIso: args.weekEndIso,
  });
  return withSystemContext(async (tx) => {
    const row = await tx.capabilityProposal.create({
      data: {
        workspaceId: args.workspaceId,
        targetAgentSlug: args.targetSkillSlug,
        proposer: 'customer-feedback-drift-sweep',
        body,
        state: 'DRAFT',
      },
      select: { id: true },
    });
    return row.id;
  });
}

/** Operator leadership-board cross-workspace drift signal: workspaces
 *  ranked by correction count since `since`. System context. */
export async function summarizeCorrectionRatesSince(
  since: Date,
  limit = 10,
): Promise<WorkspaceDriftRow[]> {
  const batches = await listWorkspaceFeedbackBatchesSince(since);
  const rows: WorkspaceDriftRow[] = batches.map((b) => {
    const counts = new Map<FeedbackCategory, number>();
    for (const r of b.rows) {
      counts.set(r.category, (counts.get(r.category) ?? 0) + 1);
    }
    let topCategory: FeedbackCategory | null = null;
    let topCount = 0;
    for (const [cat, n] of counts) {
      if (n > topCount) {
        topCount = n;
        topCategory = cat;
      }
    }
    return {
      workspaceId: b.workspaceId,
      workspaceName: b.workspaceName,
      corrections: b.rows.length,
      topCategory,
    };
  });
  return rows
    .sort((a, b) => b.corrections - a.corrections)
    .slice(0, Math.max(1, limit));
}
