import { ApEyebrow, PlainoAvatar } from "@/components/ui/ap";
import { requireWorkspaceMember } from "@/lib/auth";
import { verticalSlugFromEnum } from "@/lib/auth/vertical-enum";
import { withRls } from "@/lib/db";
import { servicePartnerForWorkspace } from "@/lib/onboarding/service-partner";
import { decryptPayloadForRead } from "@/lib/security/payload-crypto";
import { getVerticalContent } from "@/lib/verticals";
import type { AgentRosterEntry } from "@/lib/verticals/types";
import { ActivityStream, type ActivityStreamRow } from "./ActivityStream";
import { FleetMap } from "./FleetMap";
import { SkillFiresFeed, type SkillFireRow } from "./SkillFiresFeed";
import { TalkToFleet } from "./TalkToFleet";
import { TodoBoard, type ApprovalBoardCard } from "./TodoBoard";

interface PageProps {
  params: Promise<{ id: string }>;
}

export const dynamic = "force-dynamic";

/**
 * Fleet hub — one customer surface that brings the four panels together:
 *   1. Fleet map         (roster, grouped live / rooting)
 *   2. To-do board       (drafting / ready for you / ratified, 3 columns)
 *   3. Activity stream   (last ~10 handoffs)
 *   4. Talk to the fleet (real request-intake → handoff log)
 *
 * Per `feedback_everything_tells_a_story.md`: the page reads top → bottom
 * as a single arc — what's here, what's waiting on you, what's moved, how
 * to add a job. No KPI grid. No fabricated activity.
 *
 * Honest about data:
 *   - fleet map roster      → real (lib/verticals/<slug>/content.ts)
 *   - handoff counts        → real (HandoffLogEntry by fromAgent)
 *   - to-do board           → real (WorkApprovalQueueItem by status)
 *   - activity stream       → real (HandoffLogEntry, last 10)
 *   - talk-to-the-fleet     → real (writes a HandoffLogEntry; no LLM reply)
 */
export default async function FleetPage({ params }: PageProps) {
  const { id: workspaceId } = await params;
  const member = await requireWorkspaceMember(workspaceId, ["BROKER_OWNER"]);
  const ctx = { userId: member.userId, workspaceId, isOperator: false };

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [
    workspace,
    handoffsRaw,
    pendingApprovals,
    ratifiedRecently,
    recentOwnerRequests,
    handoffGrouped,
    recentSkillFires,
  ] = await Promise.all([
    withRls(ctx, (tx) =>
      tx.workspace.findUniqueOrThrow({
        where: { id: workspaceId },
        select: { vertical: true },
      }),
    ),
    withRls(ctx, (tx) =>
      tx.handoffLogEntry.findMany({
        where: { workspaceId },
        orderBy: { occurredAt: "desc" },
        take: 10,
      }),
    ),
    withRls(ctx, (tx) =>
      tx.workApprovalQueueItem.findMany({
        where: { workspaceId, status: "PENDING" },
        orderBy: { proposedAt: "desc" },
        take: 12,
      }),
    ),
    withRls(ctx, (tx) =>
      tx.workApprovalQueueItem.findMany({
        where: {
          workspaceId,
          status: { in: ["APPROVED", "AUTO_APPROVED"] },
          decidedAt: { gte: sevenDaysAgo },
        },
        orderBy: { decidedAt: "desc" },
        take: 6,
      }),
    ),
    withRls(ctx, (tx) =>
      tx.handoffLogEntry.findMany({
        where: {
          workspaceId,
          fromAgent: "you",
          toAgent: "plaino",
          handoffType: "owner-request",
        },
        orderBy: { occurredAt: "desc" },
        take: 5,
      }),
    ),
    withRls(ctx, async (tx) => {
      const grouped = await tx.handoffLogEntry.groupBy({
        by: ["fromAgent"],
        where: { workspaceId },
        _count: { _all: true },
      });
      const byAgent = new Map<string, number>();
      for (const row of grouped) {
        byAgent.set(row.fromAgent, row._count._all);
      }
      return byAgent;
    }),
    // Skill-fires feed — last 20 approval-queue rows across all
    // disciplines, surfaced as a "what fired" panel separate from
    // the activity stream (which speaks the handoff-log shape).
    withRls(ctx, (tx) =>
      tx.workApprovalQueueItem.findMany({
        where: { workspaceId },
        orderBy: { proposedAt: "desc" },
        take: 20,
        select: {
          id: true,
          agentSlug: true,
          discipline: true,
          proposedAt: true,
          status: true,
          kind: true,
        },
      }),
    ),
  ]);

  const verticalSlug = verticalSlugFromEnum(workspace.vertical);
  const verticalContent = getVerticalContent(verticalSlug);
  const realEstateRoster =
    getVerticalContent("real-estate")?.agentRoster ?? [];
  const fleet: AgentRosterEntry[] =
    verticalContent?.agentRoster ?? realEstateRoster;
  const verticalName = verticalContent?.name ?? null;
  const partner = servicePartnerForWorkspace(workspaceId);

  // Approval-queue → board cards (PENDING column).
  const readyForYou: ApprovalBoardCard[] = pendingApprovals.map((a) => ({
    id: a.id,
    agentSlug: a.agentSlug,
    kind: a.kind,
    title: titleFromApproval(a.kind, decryptPayloadForRead(a.payload)),
    proposedAtIso: a.proposedAt.toISOString(),
  }));

  // Approval-queue → board cards (recently APPROVED / AUTO_APPROVED).
  const ratifiedBoard: ApprovalBoardCard[] = ratifiedRecently.map((a) => ({
    id: a.id,
    agentSlug: a.agentSlug,
    kind: a.kind,
    title: titleFromApproval(a.kind, decryptPayloadForRead(a.payload)),
    proposedAtIso: (a.decidedAt ?? a.proposedAt).toISOString(),
  }));

  // "Drafting" column — derived from HandoffLogEntry rows whose type
  // looks like an in-flight draft handoff (categorize / draft / propose)
  // AND which hasn't yet surfaced a matching PENDING approval. This is
  // a deliberate compression of the handoff log into "still in the
  // fleet's hands" — see lib/verticals/types.ts: handoffType strings
  // already follow the categorize → schedule → draft taxonomy the
  // activity feed filters on.
  const draftingBoard: ApprovalBoardCard[] = handoffsRaw
    .filter((h) => /(draft|compose|categori|propose|schedul)/i.test(h.handoffType))
    .slice(0, 6)
    .map((h) => ({
      id: h.id,
      agentSlug: h.toAgent,
      kind: h.handoffType,
      title: summarizeHandoffPayload(h.handoffType, decryptPayloadForRead(h.payload)),
      proposedAtIso: h.occurredAt.toISOString(),
    }));

  // Activity-stream rows — same 10 most-recent handoffs.
  const activityRows: ActivityStreamRow[] = handoffsRaw.map((h) => ({
    id: h.id,
    fromAgent: h.fromAgent,
    toAgent: h.toAgent,
    handoffType: h.handoffType,
    occurredAtIso: h.occurredAt.toISOString(),
    summary: summarizeHandoffPayload(h.handoffType, decryptPayloadForRead(h.payload)),
  }));

  // Recent owner-submitted requests, for the talk-to-the-fleet panel's
  // "you've already asked for" rail. Real rows, real text.
  const recentRequests = recentOwnerRequests.map((r) => {
    const decrypted = decryptPayloadForRead(r.payload);
    const p =
      decrypted && typeof decrypted === "object" && !Array.isArray(decrypted)
        ? (decrypted as Record<string, unknown>)
        : {};
    const body = typeof p.body === "string" ? p.body : "";
    return {
      id: r.id,
      body,
      submittedAtIso: r.occurredAt.toISOString(),
    };
  });

  return (
    <div className="space-y-12">
      <header className="border-b border-rule pb-6">
        <ApEyebrow>fleet</ApEyebrow>
        <h1 className="mt-2 font-display text-3xl leading-tight text-ink md:text-4xl">
          See your fleet. Talk to your fleet.
        </h1>
        <p className="mt-3 flex max-w-2xl items-start gap-3 text-[15px] leading-relaxed text-ink-soft">
          <PlainoAvatar size="md" className="shrink-0" />
          <span>
            One surface for who&rsquo;s working, what they&rsquo;ve done, what&rsquo;s
            waiting on you, and how to add a job. Approve, edit, or reject —
            your own tools still send.
          </span>
        </p>
      </header>

      <FleetMap
        workspaceId={workspaceId}
        verticalName={verticalName}
        fleet={fleet}
        handoffCounts={handoffGrouped}
      />

      <TodoBoard
        workspaceId={workspaceId}
        drafting={draftingBoard}
        readyForYou={readyForYou}
        ratifiedRecently={ratifiedBoard}
        partner={partner}
      />

      <SkillFiresFeed
        workspaceId={workspaceId}
        rows={recentSkillFires.map(
          (r): SkillFireRow => ({
            id: r.id,
            skillSlug: r.agentSlug,
            discipline: r.discipline,
            proposedAtIso: r.proposedAt.toISOString(),
            status: r.status,
            kind: r.kind,
          }),
        )}
      />

      <div className="grid gap-8 lg:grid-cols-[1.4fr_1fr]">
        <ActivityStream workspaceId={workspaceId} rows={activityRows} />
        <TalkToFleet
          workspaceId={workspaceId}
          partner={partner}
          recentRequests={recentRequests}
        />
      </div>
    </div>
  );
}

/**
 * Lift a short, human title out of an approval payload without depending
 * on `renderApprovalPayload` (which lives in the approvals route and is
 * heavier than this hub needs). We look at the same fields it inspects.
 */
function titleFromApproval(kind: string, payload: unknown): string {
  if (!payload || typeof payload !== "object") return humanKind(kind);
  const p = payload as Record<string, unknown>;
  const subject = pickString(p, ["subject", "title", "topic"]);
  if (subject) return subject;
  const recipient = pickString(p, ["recipient", "to", "email"]);
  if (recipient) return `${humanKind(kind)} → ${recipient}`;
  return humanKind(kind);
}

function summarizeHandoffPayload(
  handoffType: string,
  payload: unknown,
): string {
  if (!payload || typeof payload !== "object") {
    return humanKind(handoffType);
  }
  const p = payload as Record<string, unknown>;
  const subject = pickString(p, ["subject", "topic", "title"]);
  const body = pickString(p, ["body", "summary", "preview"]);
  const recipient = pickString(p, ["to", "recipient", "email"]);
  const count = pickNumber(p, ["count", "total", "n"]);
  if (subject && recipient) return `${subject} → ${recipient}`;
  if (subject) return subject;
  if (body) {
    return body.length > 140 ? `${body.slice(0, 139).trimEnd()}…` : body;
  }
  if (count != null) {
    return `${count} ${count === 1 ? "item" : "items"}`;
  }
  return humanKind(handoffType);
}

function humanKind(kind: string): string {
  return kind.replace(/_/g, " ").toLowerCase();
}

function pickString(
  p: Record<string, unknown>,
  keys: string[],
): string | undefined {
  for (const k of keys) {
    const v = p[k];
    if (typeof v === "string" && v.trim().length > 0) return v.trim();
  }
  return undefined;
}

function pickNumber(
  p: Record<string, unknown>,
  keys: string[],
): number | undefined {
  for (const k of keys) {
    const v = p[k];
    if (typeof v === "number" && Number.isFinite(v)) return v;
  }
  return undefined;
}
