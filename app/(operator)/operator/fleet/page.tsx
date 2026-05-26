// /operator/fleet — cross-vertical owner-only dashboard.
//
// One surface that aggregates every workspace's fleet, work, and pending
// approvals so Conner can see the entire agentplain estate at a glance —
// without clicking into each workspace one at a time.
//
// Gate: this route lives under `app/(operator)/layout.tsx` which already
// redirects non-operator sessions to `/app`. We re-assert `isOperator` here
// for defense in depth — same pattern `/operator/leadership-board` follows.
// NOT customer-sellable; owner/internal only.
//
// Data sourcing follows `feedback_no_guesses_no_estimates.md`:
//   - workspace list        → real (prisma.workspace, all rows)
//   - fleet roster          → real (lib/verticals/<slug>/content.ts per workspace)
//   - handoff counts        → real (HandoffLogEntry groupBy fromAgent, cross-workspace)
//   - pending approvals     → real (WorkApprovalQueueItem where status=PENDING)
//   - recent activity       → real (HandoffLogEntry last 25 across all workspaces)
//   - to-do columns         → real (WorkApprovalQueueItem PENDING + recently APPROVED)
// Any field whose source isn't real reads "—" or a labelled placeholder; no
// fabricated metrics. The page works against an empty DB by showing honest
// empty states rather than zeros that imply motion.
//
// Cross-workspace queries deliberately use `withSystemContext` (operator
// GUC), not `withRls`, because operators are the audience and the standard
// per-workspace RLS branch would scope reads to their personal memberships.
// The layout already enforces that only operator sessions reach this code
// path. Same approach `/operator/workspaces` uses.

import Link from "next/link";
import { redirect } from "next/navigation";
import { ApEyebrow, ApPaperCard, PlainoAvatar } from "@/components/ui/ap";
import { requireUser } from "@/lib/auth/server";
import { verticalSlugFromEnum } from "@/lib/auth/vertical-enum";
import { withSystemContext } from "@/lib/db/rls";
import { getVerticalContent } from "@/lib/verticals";
import type { AgentRosterEntry, VerticalContent } from "@/lib/verticals/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface WorkspaceRow {
  id: string;
  name: string;
  slug: string;
  vertical: string;
  verticalSlug: string;
  verticalContent: VerticalContent | null;
  liveCount: number;
  rootingCount: number;
  pendingApprovals: number;
  totalHandoffs: number;
  recentHandoffAt: Date | null;
}

interface CrossActivityRow {
  id: string;
  workspaceId: string;
  workspaceName: string;
  verticalSlug: string;
  fromAgent: string;
  toAgent: string;
  handoffType: string;
  occurredAt: Date;
  summary: string;
}

interface CrossApprovalRow {
  id: string;
  workspaceId: string;
  workspaceName: string;
  verticalSlug: string;
  agentSlug: string;
  kind: string;
  title: string;
  proposedAt: Date;
}

export default async function OperatorFleetPage() {
  const session = await requireUser();
  if (!session.isOperator) {
    redirect("/app");
  }

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  // Workspace is RLS-policied (workspace_member_read gates SELECT on
  // is_operator OR id=app.workspace_id) AND now FORCE'd via the force_rls
  // migration, so even the migration-owner role obeys the policy. We must
  // open the system context so the policy's is_operator='true' branch
  // resolves to TRUE; otherwise findMany returns zero rows under FORCE.
  const workspaces = await withSystemContext((tx) =>
    tx.workspace.findMany({
      select: { id: true, name: true, slug: true, vertical: true },
      orderBy: { createdAt: "desc" },
    }),
  );

  const [
    handoffsGrouped,
    pendingApprovalsByWorkspace,
    recentHandoffs,
    pendingApprovals,
    recentApprovalsRatified,
    pendingApprovalsTotal,
    handoffsTotal,
  ] = await withSystemContext(async (tx) =>
    Promise.all([
      // Cross-workspace per-agent handoff counts. Used to mark "live" cards
      // as having logged activity AND to fill the per-workspace totals card.
      tx.handoffLogEntry.groupBy({
        by: ["workspaceId", "fromAgent"],
        _count: { _all: true },
        _max: { occurredAt: true },
      }),
      tx.workApprovalQueueItem.groupBy({
        by: ["workspaceId"],
        where: { status: "PENDING" },
        _count: { _all: true },
      }),
      // Last 25 handoffs, cross-workspace.
      tx.handoffLogEntry.findMany({
        orderBy: { occurredAt: "desc" },
        take: 25,
        select: {
          id: true,
          workspaceId: true,
          fromAgent: true,
          toAgent: true,
          handoffType: true,
          occurredAt: true,
          payload: true,
        },
      }),
      // Pending approvals across the estate — ready for owner action.
      tx.workApprovalQueueItem.findMany({
        where: { status: "PENDING" },
        orderBy: { proposedAt: "desc" },
        take: 25,
        select: {
          id: true,
          workspaceId: true,
          agentSlug: true,
          kind: true,
          payload: true,
          proposedAt: true,
        },
      }),
      tx.workApprovalQueueItem.findMany({
        where: {
          status: { in: ["APPROVED", "AUTO_APPROVED"] },
          decidedAt: { gte: sevenDaysAgo },
        },
        orderBy: { decidedAt: "desc" },
        take: 12,
        select: {
          id: true,
          workspaceId: true,
          agentSlug: true,
          kind: true,
          payload: true,
          proposedAt: true,
          decidedAt: true,
        },
      }),
      tx.workApprovalQueueItem.count({ where: { status: "PENDING" } }),
      tx.handoffLogEntry.count(),
    ]),
  );

  // Build a (workspaceId → workspace meta) lookup so we can label rows.
  const workspaceById = new Map<string, { name: string; verticalSlug: string }>();
  for (const w of workspaces) {
    workspaceById.set(w.id, {
      name: w.name,
      verticalSlug: verticalSlugFromEnum(w.vertical),
    });
  }

  // (workspaceId → Map<agentSlug, count>) and recent timestamp per workspace.
  const handoffsByWorkspace = new Map<string, Map<string, number>>();
  const handoffsTotalByWorkspace = new Map<string, number>();
  const recentByWorkspace = new Map<string, Date>();
  for (const row of handoffsGrouped) {
    const byAgent =
      handoffsByWorkspace.get(row.workspaceId) ?? new Map<string, number>();
    byAgent.set(row.fromAgent, row._count._all);
    handoffsByWorkspace.set(row.workspaceId, byAgent);
    handoffsTotalByWorkspace.set(
      row.workspaceId,
      (handoffsTotalByWorkspace.get(row.workspaceId) ?? 0) + row._count._all,
    );
    const max = row._max.occurredAt;
    if (max) {
      const prev = recentByWorkspace.get(row.workspaceId);
      if (!prev || max > prev) recentByWorkspace.set(row.workspaceId, max);
    }
  }

  const pendingByWorkspace = new Map<string, number>();
  for (const row of pendingApprovalsByWorkspace) {
    pendingByWorkspace.set(row.workspaceId, row._count._all);
  }

  // Compose the per-workspace rows with vertical content joined.
  const rows: WorkspaceRow[] = workspaces.map((w) => {
    const verticalSlug = verticalSlugFromEnum(w.vertical);
    const verticalContent = getVerticalContent(verticalSlug);
    const roster: AgentRosterEntry[] = verticalContent?.agentRoster ?? [];
    const live = roster.filter(
      (a) => a.runtime === "live" || a.runtime === undefined,
    ).length;
    const rooting = roster.filter((a) => a.runtime === "rooting").length;
    return {
      id: w.id,
      name: w.name,
      slug: w.slug,
      vertical: w.vertical,
      verticalSlug,
      verticalContent,
      liveCount: live,
      rootingCount: rooting,
      pendingApprovals: pendingByWorkspace.get(w.id) ?? 0,
      totalHandoffs: handoffsTotalByWorkspace.get(w.id) ?? 0,
      recentHandoffAt: recentByWorkspace.get(w.id) ?? null,
    };
  });

  // Group workspaces by vertical for the per-vertical lanes.
  const byVertical = new Map<string, WorkspaceRow[]>();
  for (const r of rows) {
    const arr = byVertical.get(r.verticalSlug) ?? [];
    arr.push(r);
    byVertical.set(r.verticalSlug, arr);
  }
  const verticalSlugs = Array.from(byVertical.keys()).sort((a, b) => {
    const ca = byVertical.get(a)?.length ?? 0;
    const cb = byVertical.get(b)?.length ?? 0;
    if (ca !== cb) return cb - ca;
    return a.localeCompare(b);
  });

  // Cross-vertical aggregate counts. Real numbers only.
  const totalWorkspaces = workspaces.length;
  const totalVerticalsActive = byVertical.size;
  const totalLive = rows.reduce((s, r) => s + r.liveCount, 0);
  const totalRooting = rows.reduce((s, r) => s + r.rootingCount, 0);

  // Compose the cross-workspace activity feed rows.
  const activityRows: CrossActivityRow[] = recentHandoffs.map((h) => {
    const meta = workspaceById.get(h.workspaceId);
    return {
      id: h.id,
      workspaceId: h.workspaceId,
      workspaceName: meta?.name ?? "(unknown workspace)",
      verticalSlug: meta?.verticalSlug ?? "",
      fromAgent: h.fromAgent,
      toAgent: h.toAgent,
      handoffType: h.handoffType,
      occurredAt: h.occurredAt,
      summary: summarizeHandoffPayload(h.handoffType, h.payload),
    };
  });

  // Cross-workspace pending approvals — ready for you across everything.
  const approvalRows: CrossApprovalRow[] = pendingApprovals.map((a) => {
    const meta = workspaceById.get(a.workspaceId);
    return {
      id: a.id,
      workspaceId: a.workspaceId,
      workspaceName: meta?.name ?? "(unknown workspace)",
      verticalSlug: meta?.verticalSlug ?? "",
      agentSlug: a.agentSlug,
      kind: a.kind,
      title: titleFromApproval(a.kind, a.payload),
      proposedAt: a.proposedAt,
    };
  });

  const recentRatifiedRows = recentApprovalsRatified.map((a) => {
    const meta = workspaceById.get(a.workspaceId);
    return {
      id: a.id,
      workspaceId: a.workspaceId,
      workspaceName: meta?.name ?? "(unknown workspace)",
      verticalSlug: meta?.verticalSlug ?? "",
      agentSlug: a.agentSlug,
      kind: a.kind,
      title: titleFromApproval(a.kind, a.payload),
      decidedAt: a.decidedAt ?? a.proposedAt,
    };
  });

  return (
    <div className="container-wide space-y-12 py-10">
      <header className="border-b border-rule pb-6">
        <ApEyebrow>operator · cross-vertical fleet</ApEyebrow>
        <h1 className="mt-2 font-display text-3xl leading-tight text-ink md:text-4xl">
          Every workspace. Every vertical. One view.
        </h1>
        <p className="mt-3 flex max-w-2xl items-start gap-3 text-[15px] leading-relaxed text-ink-soft">
          <PlainoAvatar size="md" className="shrink-0" />
          <span>
            Internal owner surface. Real numbers from the live tables —
            fleet rosters, handoffs, pending approvals. Click a workspace
            to open its own fleet hub.
          </span>
        </p>
      </header>

      <section aria-labelledby="estate-totals-heading" className="space-y-4">
        <ApEyebrow id="estate-totals-heading">estate · totals</ApEyebrow>
        <div className="grid gap-px overflow-hidden border border-rule bg-rule sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="workspaces" value={totalWorkspaces.toString()} />
          <Stat
            label="verticals with at least one workspace"
            value={`${totalVerticalsActive} / 10`}
          />
          <Stat
            label="capabilities · awake"
            value={totalLive.toString()}
            hint={`${totalRooting} rooting`}
          />
          <Stat
            label="pending approvals"
            value={pendingApprovalsTotal.toString()}
            hint={`${handoffsTotal} total handoffs logged`}
          />
        </div>
      </section>

      <section aria-labelledby="verticals-heading" className="space-y-6">
        <header className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <div>
            <ApEyebrow id="verticals-heading">verticals</ApEyebrow>
            <h2 className="mt-2 font-display text-2xl text-ink md:text-3xl">
              Fleets grouped by vertical.
            </h2>
            <p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-ink-soft">
              Each card is one workspace. Counts are real — capabilities
              come from the vertical&rsquo;s roster file; handoffs and
              approvals come from the live tables.
            </p>
          </div>
          <Link
            href="/operator/workspaces"
            className="font-mono text-[11px] tracking-eyebrow uppercase text-mute hover:text-ink"
          >
            workspace settings →
          </Link>
        </header>

        {verticalSlugs.length === 0 ? (
          <div className="border border-dashed border-rule bg-paper p-8 text-[13px] leading-relaxed text-mute">
            No workspaces yet. The first workspace lights up here as soon as
            it&rsquo;s created.
          </div>
        ) : (
          verticalSlugs.map((slug) => {
            const list = byVertical.get(slug) ?? [];
            const content = list[0]?.verticalContent ?? getVerticalContent(slug);
            const liveTotal = list.reduce((s, r) => s + r.liveCount, 0);
            const rootingTotal = list.reduce(
              (s, r) => s + r.rootingCount,
              0,
            );
            const pendingTotal = list.reduce(
              (s, r) => s + r.pendingApprovals,
              0,
            );
            const handoffTotal = list.reduce(
              (s, r) => s + r.totalHandoffs,
              0,
            );
            return (
              <article
                key={slug}
                aria-label={`${content?.name ?? slug} vertical`}
                className="border border-rule bg-paper p-5 md:p-6"
              >
                <header className="mb-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <div>
                    <p className="font-mono text-[11px] tracking-eyebrow uppercase text-mute">
                      {slug}
                    </p>
                    <h3 className="mt-1 font-display text-xl text-ink md:text-2xl">
                      {content?.name ?? slug}
                    </h3>
                  </div>
                  <p className="font-mono text-[11px] tracking-eyebrow uppercase text-mute">
                    {list.length} workspace{list.length === 1 ? "" : "s"} ·{" "}
                    {liveTotal} awake · {rootingTotal} rooting ·{" "}
                    {pendingTotal} pending · {handoffTotal} handoffs
                  </p>
                </header>
                <ul className="grid gap-px overflow-hidden border border-rule bg-rule sm:grid-cols-2 xl:grid-cols-3">
                  {list.map((r) => (
                    <li key={r.id}>
                      <WorkspaceCard
                        row={r}
                        handoffsForWorkspace={
                          handoffsByWorkspace.get(r.id) ?? new Map()
                        }
                      />
                    </li>
                  ))}
                </ul>
              </article>
            );
          })
        )}
      </section>

      <section
        aria-labelledby="ready-for-you-heading"
        className="grid gap-8 lg:grid-cols-[1.4fr_1fr]"
      >
        <div>
          <header className="mb-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <ApEyebrow id="ready-for-you-heading">ready for you</ApEyebrow>
            <p className="font-mono text-[11px] tracking-eyebrow uppercase text-mute">
              {pendingApprovalsTotal} pending across estate
            </p>
          </header>
          {approvalRows.length === 0 ? (
            <div className="border border-dashed border-rule bg-paper p-5 text-[13px] leading-relaxed text-mute">
              Nothing waiting on you. As soon as a workspace&rsquo;s fleet
              drafts something gated, it lands here.
            </div>
          ) : (
            <ul
              aria-label="cross-workspace pending approvals"
              className="divide-y divide-rule border border-rule bg-paper"
            >
              {approvalRows.map((a) => (
                <li key={a.id} className="px-4 py-3">
                  <ApprovalRow row={a} />
                </li>
              ))}
            </ul>
          )}
        </div>

        <aside aria-labelledby="recently-ratified-heading">
          <header className="mb-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <ApEyebrow id="recently-ratified-heading">
              recently ratified
            </ApEyebrow>
            <p className="font-mono text-[11px] tracking-eyebrow uppercase text-mute">
              last 7 days
            </p>
          </header>
          {recentRatifiedRows.length === 0 ? (
            <div className="border border-dashed border-rule bg-paper p-5 text-[13px] leading-relaxed text-mute">
              No approvals decided in the last 7 days.
            </div>
          ) : (
            <ul
              aria-label="recently ratified approvals"
              className="divide-y divide-rule border border-rule bg-paper"
            >
              {recentRatifiedRows.map((a) => (
                <li key={a.id} className="px-4 py-3">
                  <p className="font-mono text-[10px] tracking-eyebrow uppercase text-mute">
                    {a.verticalSlug} · {a.workspaceName}
                  </p>
                  <p className="mt-1 text-[14px] text-ink">{a.title}</p>
                  <p className="mt-1 font-mono text-[11px] text-mute">
                    {a.agentSlug} · {a.kind.toLowerCase()} ·{" "}
                    {formatRelative(a.decidedAt)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </aside>
      </section>

      <section aria-labelledby="estate-activity-heading">
        <header className="mb-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <ApEyebrow id="estate-activity-heading">estate · activity</ApEyebrow>
          <p className="font-mono text-[11px] tracking-eyebrow uppercase text-mute">
            last 25 handoffs across all workspaces
          </p>
        </header>
        {activityRows.length === 0 ? (
          <div className="border border-dashed border-rule bg-paper p-5 text-[13px] leading-relaxed text-mute">
            No handoffs yet. The first row lands as soon as a fleet has
            something to hand over.
          </div>
        ) : (
          <ul
            aria-label="cross-workspace activity feed"
            className="divide-y divide-rule border border-rule bg-paper"
          >
            {activityRows.map((r) => (
              <li key={r.id} className="px-4 py-3">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <p className="font-mono text-[10px] tracking-eyebrow uppercase text-mute">
                    {r.verticalSlug} ·{" "}
                    <Link
                      href={`/app/workspace/${r.workspaceId}/activity`}
                      className="underline-offset-2 hover:text-ink hover:underline"
                    >
                      {r.workspaceName}
                    </Link>
                  </p>
                  <p className="font-mono text-[11px] text-mute">
                    {formatRelative(r.occurredAt)}
                  </p>
                </div>
                <p className="mt-1 text-[14px] text-ink-soft">
                  <span className="font-mono text-ink">{r.fromAgent}</span>
                  <span className="mx-2 text-mute">→</span>
                  <span className="font-mono text-ink">{r.toAgent}</span>
                  <span className="ml-2 text-mute">· {r.handoffType}</span>
                </p>
                {r.summary ? (
                  <p className="mt-1 text-[13px] leading-relaxed text-mute">
                    {r.summary}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <footer className="border-t border-rule pt-6 text-[12px] leading-relaxed text-mute">
        <p>
          Owner-only surface (operator gate at{" "}
          <code className="font-mono">app/(operator)/layout.tsx</code> ·{" "}
          <code className="font-mono">requireUser().isOperator</code>). Not
          exposed to customers. Read-only — to edit roster bindings, see{" "}
          <code className="font-mono">lib/verticals/&lt;slug&gt;/content.ts</code>;
          to approve work, click into the workspace.
        </p>
      </footer>
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <ApPaperCard density="dense" className="border-0">
      <p className="font-mono text-[10px] tracking-eyebrow uppercase text-mute">
        {label}
      </p>
      <p className="mt-2 font-display text-3xl leading-none text-ink">
        {value}
      </p>
      {hint ? (
        <p className="mt-2 text-[12px] leading-relaxed text-mute">{hint}</p>
      ) : null}
    </ApPaperCard>
  );
}

function WorkspaceCard({
  row,
  handoffsForWorkspace,
}: {
  row: WorkspaceRow;
  handoffsForWorkspace: Map<string, number>;
}) {
  const roster = row.verticalContent?.agentRoster ?? [];
  const liveSlugs = roster
    .filter((a) => a.runtime === "live" || a.runtime === undefined)
    .map((a) => a.slug);
  const liveWithActivity = liveSlugs.filter(
    (slug) => (handoffsForWorkspace.get(slug) ?? 0) > 0,
  ).length;
  return (
    <Link
      href={`/app/workspace/${row.id}/fleet`}
      className="block h-full bg-paper p-4 transition hover:bg-paper-deep focus:outline-none focus-visible:bg-paper-deep focus-visible:ring-2 focus-visible:ring-clay focus-visible:ring-inset"
    >
      <div className="flex items-baseline justify-between gap-2">
        <p className="font-mono text-[10px] tracking-eyebrow uppercase text-mute">
          {row.slug}
        </p>
        <span
          aria-hidden
          className={
            liveWithActivity > 0
              ? "inline-block h-1.5 w-1.5 bg-moss"
              : "inline-block h-1.5 w-1.5 bg-mute/50"
          }
        />
      </div>
      <p className="mt-2 font-display text-lg leading-tight text-ink">
        {row.name}
      </p>
      <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-[12px] leading-relaxed">
        <dt className="text-mute">awake</dt>
        <dd className="text-ink text-right">{row.liveCount}</dd>
        <dt className="text-mute">rooting</dt>
        <dd className="text-ink text-right">{row.rootingCount}</dd>
        <dt className="text-mute">pending</dt>
        <dd className="text-ink text-right">{row.pendingApprovals}</dd>
        <dt className="text-mute">handoffs</dt>
        <dd className="text-ink text-right">{row.totalHandoffs}</dd>
      </dl>
      <p className="mt-3 text-[12px] leading-relaxed text-mute">
        {row.recentHandoffAt
          ? `last handoff ${formatRelative(row.recentHandoffAt)}`
          : row.liveCount === 0
            ? "no awake capability yet"
            : "no handoffs logged yet"}
      </p>
    </Link>
  );
}

function ApprovalRow({ row }: { row: CrossApprovalRow }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
      <div className="min-w-0 flex-1">
        <p className="font-mono text-[10px] tracking-eyebrow uppercase text-mute">
          {row.verticalSlug} ·{" "}
          <Link
            href={`/app/workspace/${row.workspaceId}/approvals`}
            className="underline-offset-2 hover:text-ink hover:underline"
          >
            {row.workspaceName}
          </Link>
        </p>
        <p className="mt-1 truncate text-[14px] text-ink">{row.title}</p>
        <p className="mt-1 font-mono text-[11px] text-mute">
          {row.agentSlug} · {row.kind.toLowerCase()}
        </p>
      </div>
      <div className="text-right">
        <p className="font-mono text-[11px] text-mute">
          {formatRelative(row.proposedAt)}
        </p>
        <Link
          href={`/app/workspace/${row.workspaceId}/approvals`}
          className="mt-1 inline-block font-mono text-[11px] tracking-eyebrow uppercase text-ink underline-offset-2 hover:underline"
        >
          open →
        </Link>
      </div>
    </div>
  );
}

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
  if (!payload || typeof payload !== "object") return humanKind(handoffType);
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
  if (count != null) return `${count} ${count === 1 ? "item" : "items"}`;
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

function formatRelative(d: Date): string {
  const diffMs = Date.now() - d.getTime();
  const min = Math.round(diffMs / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h}h ago`;
  const day = Math.round(h / 24);
  if (day < 30) return `${day}d ago`;
  return d.toISOString().slice(0, 10);
}
