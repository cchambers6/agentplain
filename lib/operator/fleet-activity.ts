/**
 * Fleet activity inspector — server data layer for /operator/fleet (Stream D.1).
 *
 * The pure, client-safe core (types, filters, status derivation, WHERE builder,
 * cursor, redaction, row mapping) lives in `fleet-activity-filters.ts`. This
 * module is the SERVER half: it imports prisma (`withSystemContext`) and the
 * payload-crypto seam, runs the queries, decrypts payloads, and assembles the
 * drawer detail. Keeping the split means the `"use client"` view can import
 * filter helpers without dragging Prisma into the browser bundle.
 *
 * ── What an "action" is ───────────────────────────────────────────────────
 * The feed spine is `SkillRun` — the canonical per-fire audit ("every cron /
 * Inngest entry seam writes a SkillRun row before any expensive work; the
 * outcome column is updated at end", schema.prisma). It is the only table
 * that records the STATUS of every fire, so it is the honest answer to "what
 * did the fleet just do". Each run LEFT-joins its `WorkApprovalQueueItem`
 * (FK `queueItemId`), which carries the AGENT attribution (`agentSlug`), the
 * produced artifact (`payload`), and the approval state — so one row shows
 * both the agent (queue item) and the skill (run) from real columns.
 *
 * ── Provenance (the drawer) ───────────────────────────────────────────────
 * `loadFleetActivityDetail` reads, fresh from the DB on every open (no cached
 * snapshot that can drift): the SkillRun row, its queue item (decrypted +
 * PII-redacted output), the skill-chain `HandoffLogEntry` rows keyed on the
 * queue item's subject (read → categorize → draft → …), and the inbound
 * `WebhookEvent` rows time-correlated to the fire.
 *
 * ── Honesty notes (feedback_no_guesses_no_estimates) ──────────────────────
 *  - SkillRun has no agent column; agent attribution comes from the joined
 *    queue item's `agentSlug`, falling back to `discipline`, then "—".
 *  - There is no FK from SkillRun → WebhookEvent. The drawer correlates inbound
 *    events by (workspace, receivedAt within a window before firedAt) and
 *    LABELS them as time-correlated rather than implying a hard causal link.
 *  - Free-text search covers slugs, discipline, agent, and error text. The
 *    encrypted queue payload is AES-GCM ciphertext at rest and is NOT
 *    server-side searchable by design.
 *
 * Every query runs through `withSystemContext` (operator GUC) — same reason
 * the rest of /operator/* does; the `app/(operator)/layout.tsx` gate already
 * confines this code path to operators.
 */

import type { Prisma } from "@prisma/client";
import { withSystemContext } from "@/lib/db/rls";
import { decryptPayloadForRead } from "@/lib/security/payload-crypto";
import { getSkillCatalogEntry } from "@/lib/skills/registry";
import { verticalSlugFromEnum } from "@/lib/auth/vertical-enum";
import {
  FLEET_STATUSES,
  buildFeedWhere,
  cursorToWhere,
  decodeFleetCursor,
  deriveFleetStatus,
  humanize,
  mapRunToRow,
  paginateRuns,
  redactPii,
  redactPiiString,
  summarizeOutcome,
  type FleetActivityDetail,
  type FleetActivityPage,
  type FleetFilterOptions,
  type FleetFilters,
  type RawFleetRun,
  type WorkspaceMeta,
} from "./fleet-activity-filters";

export type {
  FleetActivityDetail,
  FleetActivityPage,
  FleetActivityRow,
  FleetFilterOptions,
  FleetFilters,
  FleetHandoffStep,
  FleetStatus,
  FleetWebhookRef,
  FleetWorkspaceOption,
} from "./fleet-activity-filters";

const FEED_SELECT = {
  id: true,
  workspaceId: true,
  skillSlug: true,
  discipline: true,
  firedAt: true,
  completedAt: true,
  outcome: true,
  durationMs: true,
  errorMessage: true,
  queueItem: {
    select: {
      id: true,
      status: true,
      kind: true,
      agentSlug: true,
      refTable: true,
      refId: true,
      payload: true,
    },
  },
} satisfies Prisma.SkillRunSelect;

export interface LoadFeedParams {
  filters: FleetFilters;
  cursor?: string | null;
  limit?: number;
  now?: Date;
}

export async function loadFleetActivityFeed(
  params: LoadFeedParams,
): Promise<FleetActivityPage> {
  const limit = Math.min(Math.max(params.limit ?? 50, 1), 200);
  const now = params.now ?? new Date();
  const baseWhere = buildFeedWhere(params.filters, now);
  const cursor = decodeFleetCursor(params.cursor);
  const where: Prisma.SkillRunWhereInput = cursor
    ? { AND: [baseWhere, cursorToWhere(cursor)] }
    : baseWhere;

  const { runs, workspaceById } = await withSystemContext(async (tx) => {
    const runs = (await tx.skillRun.findMany({
      where,
      orderBy: [{ firedAt: "desc" }, { id: "desc" }],
      take: limit + 1,
      select: FEED_SELECT,
    })) as unknown as RawFleetRun[];

    const ids = Array.from(new Set(runs.map((r) => r.workspaceId)));
    const workspaces = ids.length
      ? await tx.workspace.findMany({
          where: { id: { in: ids } },
          select: { id: true, name: true, vertical: true },
        })
      : [];
    const workspaceById = new Map<string, WorkspaceMeta>();
    for (const w of workspaces) {
      workspaceById.set(w.id, {
        name: w.name,
        verticalSlug: verticalSlugFromEnum(w.vertical),
      });
    }
    return { runs, workspaceById };
  });

  const mapped = runs.map((r) =>
    mapRunToRow(
      r,
      workspaceById,
      r.queueItem ? decryptPayloadForRead(r.queueItem.payload) : null,
    ),
  );
  return paginateRuns(mapped, limit);
}

// ---------------------------------------------------------------------------
// Drawer detail
// ---------------------------------------------------------------------------

/** Window before firedAt within which an inbound webhook is "near" the fire. */
const INBOUND_CORRELATION_WINDOW_MS = 15 * 60 * 1000;

function prettyRedacted(value: unknown): string {
  return JSON.stringify(redactPii(value), null, 2);
}

function handoffSummary(handoffType: string, payload: unknown): string {
  if (!payload || typeof payload !== "object") return humanize(handoffType);
  const p = payload as Record<string, unknown>;
  for (const key of ["subject", "topic", "title"]) {
    const v = p[key];
    if (typeof v === "string" && v.trim()) return redactPiiString(v.trim());
  }
  for (const key of ["summary", "preview", "body"]) {
    const v = p[key];
    if (typeof v === "string" && v.trim()) {
      const t = v.trim();
      return redactPiiString(t.length > 120 ? `${t.slice(0, 119).trimEnd()}…` : t);
    }
  }
  return humanize(handoffType);
}

export async function loadFleetActivityDetail(
  skillRunId: string,
): Promise<FleetActivityDetail | null> {
  return withSystemContext(async (tx) => {
    const run = await tx.skillRun.findUnique({
      where: { id: skillRunId },
      select: FEED_SELECT,
    });
    if (!run) return null;
    const typed = run as unknown as RawFleetRun;

    const workspace = await tx.workspace.findUnique({
      where: { id: typed.workspaceId },
      select: { id: true, name: true, vertical: true },
    });

    const chainPromise =
      typed.queueItem?.refTable && typed.queueItem?.refId
        ? tx.handoffLogEntry.findMany({
            where: {
              workspaceId: typed.workspaceId,
              relatedSubjectTable: typed.queueItem.refTable,
              relatedSubjectId: typed.queueItem.refId,
            },
            orderBy: { occurredAt: "asc" },
            take: 50,
            select: {
              id: true,
              fromAgent: true,
              toAgent: true,
              handoffType: true,
              occurredAt: true,
              payload: true,
            },
          })
        : Promise.resolve([]);

    const windowStart = new Date(
      typed.firedAt.getTime() - INBOUND_CORRELATION_WINDOW_MS,
    );
    const inboundPromise = tx.webhookEvent.findMany({
      where: {
        workspaceId: typed.workspaceId,
        receivedAt: { gte: windowStart, lte: typed.firedAt },
      },
      orderBy: { receivedAt: "desc" },
      take: 5,
      select: {
        id: true,
        receivedAt: true,
        processed: true,
        processedAt: true,
        dedupeKey: true,
        rawPayload: true,
      },
    });

    const [chain, inbound] = await Promise.all([chainPromise, inboundPromise]);

    const verticalSlug = workspace
      ? verticalSlugFromEnum(workspace.vertical)
      : "";
    const status = deriveFleetStatus(
      typed.outcome,
      typed.completedAt,
      typed.queueItem?.status ?? null,
    );
    const decryptedQueuePayload = typed.queueItem
      ? decryptPayloadForRead(typed.queueItem.payload)
      : null;

    return {
      run: {
        id: typed.id,
        workspaceId: typed.workspaceId,
        workspaceName: workspace?.name ?? "(unknown workspace)",
        verticalSlug,
        skillSlug: typed.skillSlug,
        skillName: getSkillCatalogEntry(typed.skillSlug)?.name ?? typed.skillSlug,
        discipline: typed.discipline,
        agentSlug: typed.queueItem?.agentSlug ?? typed.discipline ?? null,
        status,
        outcomeLine: summarizeOutcome(typed, status, decryptedQueuePayload),
        firedAt: typed.firedAt.toISOString(),
        completedAt: typed.completedAt?.toISOString() ?? null,
        durationMs: typed.durationMs,
        errorMessage: typed.errorMessage,
      },
      output: typed.queueItem
        ? {
            queueItemId: typed.queueItem.id,
            kind: typed.queueItem.kind,
            approvalStatus: typed.queueItem.status,
            redactedPayload: prettyRedacted(decryptedQueuePayload),
          }
        : null,
      skillChain: chain.map((h) => ({
        id: h.id,
        fromAgent: h.fromAgent,
        toAgent: h.toAgent,
        handoffType: h.handoffType,
        occurredAt: h.occurredAt.toISOString(),
        summary: handoffSummary(h.handoffType, decryptPayloadForRead(h.payload)),
      })),
      inboundEvents: inbound.map((e) => ({
        id: e.id,
        receivedAt: e.receivedAt.toISOString(),
        processed: e.processed,
        processedAt: e.processedAt?.toISOString() ?? null,
        dedupeKey: e.dedupeKey,
        redactedPayload: prettyRedacted(e.rawPayload),
      })),
      workspaceActivityHref: `/app/workspace/${typed.workspaceId}/activity`,
      approvalsHref: typed.queueItem
        ? `/app/workspace/${typed.workspaceId}/approvals`
        : null,
    } satisfies FleetActivityDetail;
  });
}

// ---------------------------------------------------------------------------
// Filter options + drift-sweep banner count
// ---------------------------------------------------------------------------

export async function loadFleetFilterOptions(): Promise<FleetFilterOptions> {
  return withSystemContext(async (tx) => {
    const [workspaces, skillGroups, disciplineGroups, agentGroups] =
      await Promise.all([
        tx.workspace.findMany({
          select: { id: true, name: true, vertical: true },
          orderBy: { name: "asc" },
        }),
        tx.skillRun.groupBy({ by: ["skillSlug"] }),
        tx.skillRun.groupBy({ by: ["discipline"] }),
        tx.workApprovalQueueItem.groupBy({ by: ["agentSlug"] }),
      ]);

    return {
      workspaces: workspaces.map((w) => ({
        id: w.id,
        name: w.name,
        verticalSlug: verticalSlugFromEnum(w.vertical),
      })),
      skillSlugs: skillGroups
        .map((g) => g.skillSlug)
        .sort((a, b) => a.localeCompare(b))
        .map((slug) => ({
          slug,
          name: getSkillCatalogEntry(slug)?.name ?? slug,
        })),
      disciplines: disciplineGroups
        .map((g) => g.discipline)
        .filter((d): d is string => !!d)
        .sort((a, b) => a.localeCompare(b)),
      agentSlugs: agentGroups
        .map((g) => g.agentSlug)
        .filter((a): a is string => !!a)
        .sort((a, b) => a.localeCompare(b)),
      statuses: FLEET_STATUSES,
    };
  });
}

/**
 * Capability proposals awaiting Conner — feeds the top-of-page drift-sweep
 * banner. Counts the not-yet-resolved states; RATIFIED / REJECTED /
 * SUPERSEDED are terminal and excluded.
 */
export async function countPendingCapabilityProposals(): Promise<number> {
  return withSystemContext((tx) =>
    tx.capabilityProposal.count({
      where: {
        state: { in: ["DRAFT", "AWAITING_VOICE_BLOCK", "AWAITING_REVIEW"] },
      },
    }),
  );
}
