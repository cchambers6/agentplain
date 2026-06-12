import {
  ApEyebrow,
  ApRootedEmptyState,
} from "@/components/ui/ap";
import { requireWorkspaceMember } from "@/lib/auth";
import { withRls } from "@/lib/db";
import { servicePartnerForWorkspace } from "@/lib/onboarding/service-partner";
import { decryptPayloadForRead } from "@/lib/security/payload-crypto";
import Link from "next/link";
import { ActivityFeed, classifyOutcome, type ActivityRow } from "./ActivityFeed";

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ kind?: string }>;
}

export const dynamic = "force-dynamic";

// Daily activity feed — every handoff the fleet has executed.
// Each row drills into an ApPaperSheet showing the full payload.
// Per design language §4.5.

export default async function WorkspaceActivityPage({
  params,
  searchParams,
}: PageProps) {
  const { id: workspaceId } = await params;
  const member = await requireWorkspaceMember(workspaceId, ["BROKER_OWNER"]);
  const { kind: kindFilter } = await searchParams;

  const ctx = { userId: member.userId, workspaceId, isOperator: false };
  const partner = servicePartnerForWorkspace(workspaceId);

  const entries = await withRls(ctx, (tx) =>
    tx.handoffLogEntry.findMany({
      where: { workspaceId },
      orderBy: { occurredAt: "desc" },
      take: 200,
    }),
  );

  const rows: ActivityRow[] = entries.map((e) => {
    const payload = decryptPayloadForRead(e.payload);
    const { ok, errorCode } = readStepStatus(payload);
    const { outcome, issue } = classifyOutcome({
      handoffType: e.handoffType,
      ok,
      errorCode,
    });
    return {
      id: e.id,
      fromAgent: e.fromAgent,
      toAgent: e.toAgent,
      handoffType: e.handoffType,
      occurredAtIso: e.occurredAt.toISOString(),
      relatedSubjectTable: e.relatedSubjectTable ?? null,
      relatedSubjectId: e.relatedSubjectId ?? null,
      payload,
      summary: summarizePayload(e.handoffType, payload),
      outcome,
      issue,
      errorCode,
    };
  });

  const filteredRows = filterRows(rows, kindFilter);
  const counts = buildCounts(rows);
  const failedCount = counts.issues;

  return (
    <div>
      <ApEyebrow className="mb-3">what we&rsquo;ve been doing</ApEyebrow>
      <h1 className="font-display text-3xl text-ink">
        Activity
      </h1>
      <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-ink-soft">
        Every handoff your fleet has executed — and the ones that didn&rsquo;t
        go through. Nothing happens behind the curtain: flagged items move to
        Compliance, drafts move to Approvals, and anything that fails surfaces
        here instead of failing quietly.
      </p>

      {failedCount > 0 ? (
        <aside
          role="status"
          className="mt-6 border border-flag/40 bg-flag/5 p-4 text-[14px] leading-relaxed text-ink"
        >
          <p>
            <span className="font-mono text-[11px] tracking-eyebrow uppercase text-flag">
              needs a look
            </span>{" "}
            {failedCount === 1
              ? "1 step didn’t complete"
              : `${failedCount} steps didn’t complete`}{" "}
            in the last run. Nothing was sent — {partner} flagged{" "}
            {failedCount === 1 ? "it" : "them"} rather than guess.{" "}
            <Link
              href={`/app/workspace/${workspaceId}/activity?kind=issues`}
              className="rounded-none underline underline-offset-4 hover:text-flag focus:outline-none focus-visible:ring-2 focus-visible:ring-flag focus-visible:ring-offset-2 focus-visible:ring-offset-paper"
            >
              see what&nbsp;&amp;&nbsp;why&nbsp;→
            </Link>
          </p>
        </aside>
      ) : null}

      {rows.length === 0 ? (
        <div className="mt-8">
          <ApRootedEmptyState
            scene="empty-activity"
            reality={`No handoffs yet. ${partner} is watching your inbox.`}
            change="The first row lands once new mail or a webhook fires."
          />
        </div>
      ) : (
        <>
          <FilterStrip
            workspaceId={workspaceId}
            counts={counts}
            activeKind={kindFilter ?? null}
          />
          <div className="mt-6">
            {filteredRows.length === 0 ? (
              <ApRootedEmptyState
                motif="plow"
                reality={
                  kindFilter === "issues"
                    ? "Nothing failed. Every step in the feed completed or skipped cleanly."
                    : `Nothing under ${kindFilter ?? "this filter"} yet.`
                }
                change="Clear the filter to see the full feed, or wait — items land as the fleet works."
              />
            ) : (
              <ActivityFeed rows={filteredRows} partner={partner} />
            )}
          </div>
        </>
      )}
    </div>
  );
}

function FilterStrip({
  workspaceId,
  counts,
  activeKind,
}: {
  workspaceId: string;
  counts: ActivityCounts;
  activeKind: string | null;
}) {
  const base = `/app/workspace/${workspaceId}/activity`;
  const items: Array<{
    key: string | null;
    label: string;
    count: number;
    issue?: boolean;
  }> = [
    { key: null, label: "all", count: counts.all },
    { key: "drafts", label: "drafts", count: counts.drafts },
    { key: "schedules", label: "schedules", count: counts.schedules },
    { key: "reads", label: "reads", count: counts.reads },
    { key: "flags", label: "flags", count: counts.flags },
  ];
  // The issues chip only appears when there's something to see — a work queue
  // shouldn't carry a permanent "issues" tab that always reads 0.
  if (counts.issues > 0) {
    items.push({ key: "issues", label: "issues", count: counts.issues, issue: true });
  }
  return (
    <nav
      className="mt-8 flex flex-wrap gap-2"
      aria-label="filter activity"
    >
      {items.map((item) => {
        const active = (item.key ?? null) === (activeKind ?? null);
        const tone = item.issue
          ? active
            ? "border-flag bg-flag text-paper"
            : "border-flag/50 bg-flag/5 text-flag hover:border-flag"
          : active
            ? "border-clay bg-clay text-paper"
            : "border-rule bg-paper text-mute hover:border-ink hover:text-ink";
        return (
          <a
            key={item.key ?? "all"}
            href={item.key ? `${base}?kind=${item.key}` : base}
            aria-current={active ? "page" : undefined}
            className={`inline-flex min-h-[44px] items-center rounded-none border px-3 py-2 font-mono text-[11px] tracking-eyebrow uppercase transition focus:outline-none focus-visible:ring-2 focus-visible:ring-clay focus-visible:ring-offset-2 focus-visible:ring-offset-paper ${tone}`}
          >
            {item.label} · {item.count}
          </a>
        );
      })}
    </nav>
  );
}

function filterRows(rows: ActivityRow[], kindFilter?: string): ActivityRow[] {
  if (!kindFilter) return rows;
  if (kindFilter === "issues") {
    return rows.filter((r) => r.outcome === "failed");
  }
  return rows.filter((r) => matchesKind(r.handoffType, kindFilter));
}

interface ActivityCounts {
  all: number;
  drafts: number;
  schedules: number;
  reads: number;
  flags: number;
  /** Rows whose step failed — drives the issues chip + attention banner. */
  issues: number;
}

function buildCounts(rows: ActivityRow[]): ActivityCounts {
  return {
    all: rows.length,
    drafts: rows.filter((r) => matchesKind(r.handoffType, "drafts")).length,
    schedules: rows.filter((r) => matchesKind(r.handoffType, "schedules")).length,
    reads: rows.filter((r) => matchesKind(r.handoffType, "reads")).length,
    flags: rows.filter((r) => matchesKind(r.handoffType, "flags")).length,
    issues: rows.filter((r) => r.outcome === "failed").length,
  };
}

function matchesKind(handoffType: string, kind: string): boolean {
  const t = handoffType.toLowerCase();
  switch (kind) {
    case "drafts":
      return /(draft|reply|compose)/.test(t);
    case "schedules":
      return /(schedul|propose|calendar|slot)/.test(t);
    case "reads":
      return /(read|sync|inbox|fetch|sweep)/.test(t);
    case "flags":
      return /(flag|complian)/.test(t);
    default:
      return true;
  }
}

/**
 * Read the step's success flag + error code from the decrypted handoff
 * payload. `persistSkillRunArtifacts` writes `{ ok, errorCode }` on every
 * row (lib/skills/persist-artifacts.ts:434). Legacy rows written before
 * that field existed have neither — they default to ok:true (success), which
 * is the correct read: a row with no failure signal is a success.
 */
function readStepStatus(payload: unknown): {
  ok?: boolean;
  errorCode: string | null;
} {
  if (!payload || typeof payload !== "object") {
    return { ok: undefined, errorCode: null };
  }
  const p = payload as Record<string, unknown>;
  const ok = typeof p.ok === "boolean" ? p.ok : undefined;
  const errorCode =
    typeof p.errorCode === "string" && p.errorCode.length > 0
      ? p.errorCode
      : null;
  return { ok, errorCode };
}

function summarizePayload(handoffType: string, payload: unknown): string {
  if (!payload || typeof payload !== "object") {
    return humanType(handoffType);
  }
  const p = payload as Record<string, unknown>;
  const subject = pickString(p, ["subject", "topic", "title"]);
  const recipient = pickString(p, ["to", "recipient", "email"]);
  const count = pickNumber(p, ["count", "total", "n"]);
  const status = pickString(p, ["status", "outcome", "result"]);

  if (subject && recipient) {
    return `${subject} → ${recipient}`;
  }
  if (subject) return subject;
  if (count != null) {
    return `${count} ${count === 1 ? "item" : "items"}${
      status ? ` · ${status}` : ""
    }`;
  }
  if (status) return status;
  return humanType(handoffType);
}

function humanType(t: string): string {
  return t.replace(/_/g, " ").toLowerCase();
}

function pickString(
  p: Record<string, unknown>,
  keys: string[],
): string | undefined {
  for (const k of keys) {
    const v = p[k];
    if (typeof v === "string" && v.trim().length > 0) return v;
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
