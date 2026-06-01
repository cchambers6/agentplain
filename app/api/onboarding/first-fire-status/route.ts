/**
 * GET /api/onboarding/first-fire-status?workspaceId=…
 *
 * Drives the wave-9 wizard's polling watch panel. Reads the
 * OnboardingState.pickedSkillSlugs + firstFireRequestedAt timestamp,
 * then queries SkillRun for rows with `firedAt >= firstFireRequestedAt`
 * for each picked slug. Returns a per-slug status snapshot:
 *
 *   { picked: [{ slug, name, status, reason?, queueItemHref? }],
 *     resolved: boolean,
 *     requestedAt: ISO | null }
 *
 * `status` collapses the SkillRunOutcome enum into one of four
 * customer-readable buckets:
 *   - drafted        — wrote at least one WorkApprovalQueueItem
 *   - skipped        — ran cleanly but produced no draft (no inputs, or
 *                      gracefully degraded — e.g. finance-pulse with no
 *                      QuickBooks)
 *   - failed         — runtime error; row carries an errorMessage
 *   - pending        — no SkillRun row yet (still running or hasn't
 *                      started)
 *
 * `resolved` is true when every picked skill has at least one SkillRun
 * row in a terminal state. The client stops polling once this flips.
 *
 * RBAC: requires an active membership on the workspace. Operators are
 * implicitly allowed (they can watch any workspace's onboarding).
 *
 * Per project_no_outbound_architecture.md: read-only; no DB mutations.
 *
 * Per feedback_no_silent_vendor_lock.md: this route is the only seam
 * the wizard polls. Internals can change without touching the client.
 */

import { NextResponse, type NextRequest } from "next/server";
import { getCurrentSession } from "@/lib/auth";
import { withRls, withSystemContext } from "@/lib/db";
import { readPickedSlugs, resolvePickableSkills } from "@/lib/onboarding/picked-skills";
import { SKILL_CATALOG } from "@/lib/skills/registry";
import { decryptPayloadForRead } from "@/lib/security/payload-crypto";
import {
  extractDraftPreview,
  type DraftPreview,
} from "@/lib/onboarding/draft-preview";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface SkillStatus {
  slug: string;
  name: string;
  status: "pending" | "drafted" | "skipped" | "failed";
  reason?: string;
  queueItemHref?: string;
  /** Wave-10 phase-3b: customer-readable preview of the actual draft
   *  body. Populated only when the caller passes `?includeDraft=1`,
   *  status is `drafted`, the SkillRun row has a `queueItemId`, and
   *  the payload decrypts to a known shape. Renders inline in the
   *  wizard's watch panel. */
  draftPreview?: DraftPreview;
}

const TERMINAL_OUTCOMES = new Set<string>([
  "DRAFTED",
  "SUCCEEDED_NO_DRAFT",
  "SKIPPED_PAUSED",
  "SKIPPED_UNINSTALLED",
  "SKIPPED_WINDOW",
  "SKIPPED_DISCIPLINE_DISABLED",
  "SKIPPED_DRY_RUN",
  "FAILED",
]);

function mapOutcome(
  outcome: string,
  errorMessage: string | null,
): { status: SkillStatus["status"]; reason?: string } {
  if (outcome === "DRAFTED") return { status: "drafted" };
  if (outcome === "FAILED") {
    return {
      status: "failed",
      reason: errorMessage ?? "Something went sideways. Plaino is taking a look.",
    };
  }
  if (outcome.startsWith("SKIPPED")) {
    const map: Record<string, string> = {
      SKIPPED_PAUSED: "Workspace is paused.",
      SKIPPED_UNINSTALLED: "Not installed yet — pick it from the marketplace.",
      SKIPPED_WINDOW: "Outside this skill's run window.",
      SKIPPED_DISCIPLINE_DISABLED: "Discipline is turned off for this workspace.",
      SKIPPED_DRY_RUN: "Dry-run mode — no draft written.",
    };
    return { status: "skipped", reason: map[outcome] ?? "Skipped cleanly." };
  }
  // SUCCEEDED_NO_DRAFT — ran fine, nothing to draft today
  return {
    status: "skipped",
    reason: "Ran cleanly — nothing in the window needed a draft.",
  };
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }
  const workspaceId = req.nextUrl.searchParams.get("workspaceId") ?? "";
  if (!workspaceId) {
    return NextResponse.json(
      { error: "Missing workspaceId" },
      { status: 400 },
    );
  }

  // Inline membership check — `requireWorkspaceMember` calls redirect()
  // on miss, which we can't return from a JSON route handler. Operators
  // implicitly pass so the wizard surface stays observable from the
  // operator console without bouncing on RBAC.
  const membership = session.isOperator
    ? { role: "BROKER_OWNER" as const }
    : await withSystemContext((tx) =>
        tx.membership.findFirst({
          where: {
            userId: session.userId,
            workspaceId,
            status: "ACTIVE",
          },
          select: { role: true },
        }),
      );
  if (!membership) {
    return NextResponse.json({ error: "Not a member" }, { status: 403 });
  }

  const rls = {
    userId: session.userId,
    workspaceId,
    isOperator: session.isOperator,
  };

  const state = await withRls(rls, (tx) =>
    tx.onboardingState.findUnique({
      where: { workspaceId },
      select: {
        pickedSkillSlugs: true,
        firstFireRequestedAt: true,
      },
    }),
  );

  const pickedSlugs = readPickedSlugs(state?.pickedSkillSlugs ?? []);
  const requestedAt = state?.firstFireRequestedAt ?? null;

  // If we have no request timestamp yet, return every picked skill as
  // pending so the panel renders the placeholder rows.
  if (!requestedAt || pickedSlugs.length === 0) {
    const picked: SkillStatus[] = pickedSlugs.map((slug) => ({
      slug,
      name: skillName(slug),
      status: "pending",
    }));
    return NextResponse.json({
      picked,
      resolved: pickedSlugs.length === 0,
      requestedAt: requestedAt ? requestedAt.toISOString() : null,
    });
  }

  // Read the SkillRun row(s) per slug that landed at or after the
  // first-fire request. The skill writes ONE row per fire; we take the
  // most recent matching row per slug.
  const runs = await withRls(rls, (tx) =>
    tx.skillRun.findMany({
      where: {
        workspaceId,
        skillSlug: { in: pickedSlugs },
        firedAt: { gte: requestedAt },
      },
      select: {
        skillSlug: true,
        outcome: true,
        errorMessage: true,
        queueItemId: true,
        firedAt: true,
      },
      orderBy: { firedAt: "desc" },
    }),
  );

  const latestBySlug = new Map<string, (typeof runs)[number]>();
  for (const r of runs) {
    if (!latestBySlug.has(r.skillSlug)) latestBySlug.set(r.skillSlug, r);
  }

  // Wave-10 phase-3b — when `?includeDraft=1`, batch-fetch every
  // queueItem payload for slugs whose latest run drafted (one query,
  // not per-slug). RLS-scoped: workspace boundary enforced on read.
  const includeDraft = req.nextUrl.searchParams.get("includeDraft") === "1";
  const draftedItemIds: string[] = [];
  if (includeDraft) {
    for (const row of latestBySlug.values()) {
      if (
        row.queueItemId &&
        TERMINAL_OUTCOMES.has(row.outcome) &&
        row.outcome === "DRAFTED"
      ) {
        draftedItemIds.push(row.queueItemId);
      }
    }
  }
  const previewByItemId = new Map<string, DraftPreview>();
  if (draftedItemIds.length > 0) {
    const items = await withRls(rls, (tx) =>
      tx.workApprovalQueueItem.findMany({
        where: { id: { in: draftedItemIds }, workspaceId },
        select: { id: true, kind: true, payload: true },
      }),
    );
    for (const item of items) {
      const decrypted = decryptPayloadForRead(item.payload);
      const preview = extractDraftPreview(item.kind, decrypted);
      if (preview) previewByItemId.set(item.id, preview);
    }
  }

  const picked: SkillStatus[] = pickedSlugs.map((slug) => {
    const row = latestBySlug.get(slug);
    if (!row || !TERMINAL_OUTCOMES.has(row.outcome)) {
      return { slug, name: skillName(slug), status: "pending" };
    }
    const { status, reason } = mapOutcome(row.outcome, row.errorMessage);
    const draftPreview =
      includeDraft && row.queueItemId
        ? previewByItemId.get(row.queueItemId)
        : undefined;
    return {
      slug,
      name: skillName(slug),
      status,
      reason,
      queueItemHref: row.queueItemId
        ? `/app/workspace/${workspaceId}/approvals?focus=${encodeURIComponent(row.queueItemId)}`
        : undefined,
      draftPreview,
    };
  });

  const resolved = picked.every((p) => p.status !== "pending");

  return NextResponse.json({
    picked,
    resolved,
    requestedAt: requestedAt.toISOString(),
  });
}

function skillName(slug: string): string {
  const entry = SKILL_CATALOG.find((s) => s.slug === slug);
  if (entry) return entry.name;
  // Fall back to a humanized slug rather than the raw kebab so the
  // wizard never shows a developer-coded id to the customer.
  const pickable = resolvePickableSkills({ hasInbox: true });
  const p = pickable.find((x) => x.slug === slug);
  return p?.name ?? slug.replace(/-/g, " ");
}
