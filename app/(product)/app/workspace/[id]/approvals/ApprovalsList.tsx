"use client";

import { useMemo, useState, useTransition } from "react";
import {
  ApHeritageButton,
  ApHeritageConfirm,
  ApPaperSheet,
  PlainoStatus,
} from "@/components/ui/ap";
import { listDisciplines, type DisciplineId } from "@/lib/disciplines";
import { isBatchEligible } from "@/lib/approvals/presentation";
import {
  FEEDBACK_CATEGORIES,
  CATEGORY_DESCRIPTION,
} from "@/lib/feedback/types";
import {
  decideApprovalAction,
  editApprovalDraftAction,
  submitDraftFeedbackAction,
  batchApproveAction,
} from "./actions";
import { ApprovalCard, type ApprovalRow } from "./ApprovalCard";
import { ApprovalRowItem } from "./ApprovalRowItem";

export type { ApprovalRow } from "./ApprovalCard";

interface ApprovalsListProps {
  workspaceId: string;
  rows: ApprovalRow[];
  initialDiscipline: DisciplineId | null;
}

const ALL = "all" as const;
type FilterValue = typeof ALL | DisciplineId;
type SortValue = "urgency" | "oldest" | "newest";

/** The narrow set of items the broker MUST read first — Plaino flagged them
 *  critical (admin) or they ride the same priority field (compliance). */
function isNeedsYou(row: ApprovalRow): boolean {
  return row.rendered.admin?.priority === "critical";
}

export function ApprovalsList({
  workspaceId,
  rows,
  initialDiscipline,
}: ApprovalsListProps) {
  const [activeFilter, setActiveFilter] = useState<FilterValue>(
    initialDiscipline ?? ALL,
  );
  const [sort, setSort] = useState<SortValue>("urgency");

  // Detail bottom-sheet: which item is open, and whether we're viewing or
  // editing it inline.
  const [detailId, setDetailId] = useState<string | null>(null);
  const [detailMode, setDetailMode] = useState<"view" | "edit">("view");

  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [feedbackId, setFeedbackId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Batch mode: "approve all 12 chase emails" without opening each.
  const [batchMode, setBatchMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const disciplines = listDisciplines();
  const detail = rows.find((r) => r.id === detailId) ?? null;
  const rejecting = rows.find((r) => r.id === rejectingId) ?? null;
  const givingFeedback = rows.find((r) => r.id === feedbackId) ?? null;

  const filtered = useMemo(() => {
    const base =
      activeFilter === ALL
        ? rows
        : rows.filter((r) => r.discipline === activeFilter);
    const byDate = (a: ApprovalRow, b: ApprovalRow) =>
      a.proposedAtIso.localeCompare(b.proposedAtIso);
    return [...base].sort((a, b) => {
      if (sort === "urgency") {
        const ua = isNeedsYou(a) ? 0 : 1;
        const ub = isNeedsYou(b) ? 0 : 1;
        if (ua !== ub) return ua - ub;
        return -byDate(a, b); // newest first within each tier
      }
      return sort === "oldest" ? byDate(a, b) : -byDate(a, b);
    });
  }, [rows, activeFilter, sort]);

  const needsYou = useMemo(() => filtered.filter(isNeedsYou), [filtered]);
  const queue = useMemo(() => filtered.filter((r) => !isNeedsYou(r)), [filtered]);

  const chipCounts = useMemo(() => {
    const m = new Map<FilterValue, number>();
    m.set(ALL, rows.length);
    for (const d of disciplines) {
      m.set(d.id, rows.filter((r) => r.discipline === d.id).length);
    }
    return m;
  }, [rows, disciplines]);

  // Visible, batch-eligible ids (needs-you items are never batch-eligible).
  const eligibleVisibleIds = useMemo(
    () =>
      filtered
        .filter((r) => isBatchEligible(r.kind, r.rendered))
        .map((r) => r.id),
    [filtered],
  );
  const selectedEligible = useMemo(
    () => eligibleVisibleIds.filter((id) => selected.has(id)),
    [eligibleVisibleIds, selected],
  );

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function selectAllEligible() {
    setSelected(new Set(eligibleVisibleIds));
  }
  function clearSelection() {
    setSelected(new Set());
  }
  function exitBatch() {
    setBatchMode(false);
    clearSelection();
  }

  function openDetail(id: string) {
    setDetailId(id);
    setDetailMode("view");
  }
  function closeDetail() {
    setDetailId(null);
    setDetailMode("view");
  }

  function approveNow(row: ApprovalRow) {
    const fd = new FormData();
    fd.set("workspaceId", workspaceId);
    fd.set("itemId", row.id);
    fd.set("decision", "APPROVED");
    startTransition(async () => {
      await decideApprovalAction(fd);
      if (detailId === row.id) closeDetail();
    });
  }

  function confirmReject() {
    if (!rejecting) return;
    const fd = new FormData();
    fd.set("workspaceId", workspaceId);
    fd.set("itemId", rejecting.id);
    fd.set("decision", "REJECTED");
    startTransition(async () => {
      await decideApprovalAction(fd);
      setRejectingId(null);
      if (detailId === rejecting.id) closeDetail();
    });
  }

  function rowProps(row: ApprovalRow) {
    return {
      row,
      onOpen: () => openDetail(row.id),
      onApprove: () => approveNow(row),
      onReject: () => setRejectingId(row.id),
      batchMode,
      selectable: isBatchEligible(row.kind, row.rendered),
      selected: selected.has(row.id),
      onToggleSelect: () => toggleSelect(row.id),
    };
  }

  return (
    <>
      {/* ── Sticky control header ─────────────────────────────────────── */}
      <div className="sticky top-0 z-20 -mx-1 bg-paper/95 px-1 pb-3 pt-4 backdrop-blur supports-[backdrop-filter]:bg-paper/80">
        <div className="flex items-center justify-between gap-3">
          <p className="font-mono text-[11px] tracking-eyebrow uppercase text-mute">
            {rows.length} {rows.length === 1 ? "decision" : "decisions"} waiting
          </p>
          <button
            type="button"
            onClick={() => (batchMode ? exitBatch() : setBatchMode(true))}
            aria-pressed={batchMode}
            className="min-h-[36px] rounded-none border border-rule px-3 py-1 font-mono text-[11px] tracking-eyebrow uppercase text-ink transition hover:border-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-clay"
          >
            {batchMode ? "done" : "select"}
          </button>
        </div>

        <div className="mt-3 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <FilterChip
            label="all"
            count={chipCounts.get(ALL) ?? 0}
            active={activeFilter === ALL}
            onClick={() => setActiveFilter(ALL)}
          />
          {disciplines.map((d) => (
            <FilterChip
              key={d.id}
              label={d.name.toLowerCase()}
              count={chipCounts.get(d.id) ?? 0}
              active={activeFilter === d.id}
              onClick={() => setActiveFilter(d.id)}
              disabled={(chipCounts.get(d.id) ?? 0) === 0}
            />
          ))}
        </div>

        <div className="mt-2 flex items-center gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <span className="font-mono text-[11px] tracking-eyebrow uppercase text-mute">
            sort
          </span>
          <SortChip label="most urgent" active={sort === "urgency"} onClick={() => setSort("urgency")} />
          <SortChip label="oldest" active={sort === "oldest"} onClick={() => setSort("oldest")} />
          <SortChip label="newest" active={sort === "newest"} onClick={() => setSort("newest")} />
        </div>

        {/* Batch action bar — only in batch mode. */}
        {batchMode ? (
          <div className="mt-3 flex flex-wrap items-center gap-3 border border-rule bg-paper-deep px-3 py-3">
            <span className="font-mono text-[11px] tracking-eyebrow uppercase text-ink">
              {selectedEligible.length} selected
            </span>
            <button
              type="button"
              onClick={selectAllEligible}
              disabled={eligibleVisibleIds.length === 0}
              className="font-mono text-[11px] tracking-eyebrow uppercase text-clay underline-offset-4 hover:underline disabled:opacity-40"
            >
              select all clearable ({eligibleVisibleIds.length})
            </button>
            {selectedEligible.length > 0 ? (
              <button
                type="button"
                onClick={clearSelection}
                className="font-mono text-[11px] tracking-eyebrow uppercase text-mute underline-offset-4 hover:underline"
              >
                clear
              </button>
            ) : null}
            <form action={batchApproveAction} className="ml-auto">
              <input type="hidden" name="workspaceId" value={workspaceId} />
              {selectedEligible.map((id) => (
                <input key={id} type="hidden" name="itemId" value={id} />
              ))}
              <ApHeritageButton
                variant="primary"
                type="submit"
                disabled={selectedEligible.length === 0}
              >
                approve {selectedEligible.length || ""}
              </ApHeritageButton>
            </form>
          </div>
        ) : null}
      </div>

      {batchMode ? (
        <p className="mt-2 text-[12px] leading-relaxed text-mute">
          Batch approve is for routine, low-stakes work Plaino is confident
          about. Anything with stakes — money, listings, compliance, or
          anything it&rsquo;s unsure of — has no checkbox and still wants your
          individual look.
        </p>
      ) : null}

      {/* ── Needs-you pinned section ──────────────────────────────────── */}
      {needsYou.length > 0 ? (
        <section className="mt-6" aria-label="Needs you specifically">
          <div className="flex items-center gap-2">
            <PlainoStatus state="alert" size={18} />
            <h2 className="font-display text-xl text-ink">Needs you first</h2>
          </div>
          <p className="mt-1 text-[13px] leading-relaxed text-mute">
            Plaino flagged these as high-urgency — a quick decision keeps things
            moving.
          </p>
          <ul className="mt-4 space-y-3">
            {needsYou.map((row) => (
              <li key={row.id}>
                <ApprovalRowItem {...rowProps(row)} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* ── Main queue ────────────────────────────────────────────────── */}
      <section className="mt-8" aria-label="Queue">
        {needsYou.length > 0 ? (
          <h2 className="font-display text-xl text-ink">The rest of the queue</h2>
        ) : null}
        {queue.length === 0 ? (
          <p className="mt-4 border-l-2 border-rule pl-4 text-[13px] leading-relaxed text-mute">
            {activeFilter === ALL
              ? "Nothing else waiting — Plaino has herded everything urgent to the top."
              : "Nothing in this discipline right now. Try another filter, or check back after the next sweep."}
          </p>
        ) : (
          <ul className={needsYou.length > 0 ? "mt-4 space-y-3" : "space-y-3"}>
            {queue.map((row) => (
              <li key={row.id}>
                <ApprovalRowItem {...rowProps(row)} />
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ── Detail bottom-sheet ───────────────────────────────────────── */}
      <ApPaperSheet
        open={detail !== null}
        onClose={closeDetail}
        anchor="bottom-mobile"
        eyebrow={detailMode === "edit" ? "edit draft" : "review"}
        title={
          detail?.rendered.title ??
          detail?.rendered.recipientLine ??
          detail?.rendered.kindLabel ??
          "Draft"
        }
        footer={
          detail && detailMode === "view" ? (
            <DetailActions
              workspaceId={workspaceId}
              row={detail}
              onEdit={() => setDetailMode("edit")}
              onReject={() => setRejectingId(detail.id)}
              onFeedback={() => {
                setFeedbackId(detail.id);
                closeDetail();
              }}
            />
          ) : null
        }
      >
        {detail && detailMode === "view" ? (
          <ApprovalCard row={detail} embedded />
        ) : null}
        {detail && detailMode === "edit" ? (
          <form
            action={async (form: FormData) => {
              await editApprovalDraftAction(form);
              setDetailMode("view");
            }}
          >
            <input type="hidden" name="workspaceId" value={workspaceId} />
            <input type="hidden" name="itemId" value={detail.id} />
            <label className="block">
              <span className="mb-2 block font-mono text-[11px] tracking-eyebrow uppercase text-mute">
                draft body
              </span>
              <textarea
                name="body"
                defaultValue={detail.rendered.editableBody ?? ""}
                rows={14}
                className="block w-full rounded-none border border-rule bg-paper p-3 font-sans text-[15px] leading-relaxed text-ink focus:border-ink focus:outline-none"
              />
            </label>
            <p className="mt-2 text-[13px] leading-relaxed text-mute">
              Saving rewrites the drafted body. Tone, recipient, and threshold
              stay as Plaino proposed them.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-rule pt-5">
              <ApHeritageButton variant="primary" type="submit">
                save draft
              </ApHeritageButton>
              <button
                type="button"
                onClick={() => setDetailMode("view")}
                className="inline-flex min-h-[44px] items-center justify-center rounded-none px-3 py-2 font-sans text-sm text-ink underline-offset-4 hover:underline"
              >
                cancel
              </button>
            </div>
          </form>
        ) : null}
      </ApPaperSheet>

      {/* ── "Doesn't sound like us" feedback sheet ────────────────────── */}
      <ApPaperSheet
        open={givingFeedback !== null}
        onClose={() => setFeedbackId(null)}
        eyebrow="shape the next draft"
        title="Doesn&rsquo;t sound like us"
      >
        {givingFeedback ? (
          <form
            action={async (form: FormData) => {
              await submitDraftFeedbackAction(form);
              setFeedbackId(null);
            }}
          >
            <input type="hidden" name="workspaceId" value={workspaceId} />
            <input type="hidden" name="itemId" value={givingFeedback.id} />
            <input
              type="hidden"
              name="targetSkillSlug"
              value={givingFeedback.agentSlug}
            />
            <p className="text-[14px] leading-relaxed text-ink-soft">
              Tell Plaino what was off. We log it against{" "}
              <span className="font-mono text-[13px] text-ink">
                {givingFeedback.agentSlug}
              </span>
              , fold it into the next draft, and review it in our weekly sweep.
              The draft stays in your queue — this is feedback, not a decision.
            </p>

            <label className="mt-6 block">
              <span className="mb-2 block font-mono text-[11px] tracking-eyebrow uppercase text-mute">
                what was off
              </span>
              <select
                name="category"
                defaultValue="tone"
                className="block w-full rounded-none border border-rule bg-paper p-3 font-sans text-[15px] text-ink focus:border-ink focus:outline-none"
              >
                {FEEDBACK_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {CATEGORY_DESCRIPTION[c]}
                  </option>
                ))}
              </select>
            </label>

            <label className="mt-4 block">
              <span className="mb-2 block font-mono text-[11px] tracking-eyebrow uppercase text-mute">
                what should change
              </span>
              <textarea
                name="reason"
                required
                rows={6}
                maxLength={2000}
                placeholder="e.g. Too formal — we'd open with the first name and drop the 'Dear'."
                className="block w-full rounded-none border border-rule bg-paper p-3 font-sans text-[15px] leading-relaxed text-ink focus:border-ink focus:outline-none"
              />
            </label>

            <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-rule pt-5">
              <ApHeritageButton variant="primary" type="submit">
                send feedback
              </ApHeritageButton>
              <button
                type="button"
                onClick={() => setFeedbackId(null)}
                className="inline-flex min-h-[44px] items-center justify-center rounded-none px-3 py-2 font-sans text-sm text-ink underline-offset-4 hover:underline"
              >
                cancel
              </button>
            </div>
          </form>
        ) : null}
      </ApPaperSheet>

      {/* ── Reject confirm ────────────────────────────────────────────── */}
      <ApHeritageConfirm
        open={rejecting !== null}
        onClose={() => (isPending ? undefined : setRejectingId(null))}
        eyebrow="reject draft"
        title="Reject this draft?"
        confirmLabel={isPending ? "rejecting…" : "reject draft"}
        cancelLabel="keep it"
        variant="destructive"
        onConfirm={confirmReject}
      >
        <p>
          The draft is discarded and leaves your queue. Nothing is sent — Plaino
          simply stops here.
        </p>
        <p>
          If you want a different version instead, go back and choose edit. You
          can also re-ask Plaino for a fresh draft anytime.
        </p>
      </ApHeritageConfirm>
    </>
  );
}

// ── Detail sheet sticky footer actions ───────────────────────────────────

interface DetailActionsProps {
  workspaceId: string;
  row: ApprovalRow;
  onEdit: () => void;
  onReject: () => void;
  onFeedback: () => void;
}

function DetailActions({
  workspaceId,
  row,
  onEdit,
  onReject,
  onFeedback,
}: DetailActionsProps) {
  const canEdit = Boolean(row.rendered.editableBody);
  return (
    <div className="space-y-3">
      {/* Big, prominent approve — the primary daily action. */}
      <form action={decideApprovalAction}>
        <input type="hidden" name="workspaceId" value={workspaceId} />
        <input type="hidden" name="itemId" value={row.id} />
        <input type="hidden" name="decision" value="APPROVED" />
        <ApHeritageButton variant="primary" type="submit" className="w-full py-4 text-base">
          approve
        </ApHeritageButton>
      </form>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {canEdit ? (
          <button
            type="button"
            onClick={onEdit}
            className="inline-flex min-h-[44px] items-center font-sans text-sm font-medium text-ink underline-offset-4 hover:underline"
          >
            edit
          </button>
        ) : null}
        <button
          type="button"
          onClick={onFeedback}
          className="inline-flex min-h-[44px] items-center font-sans text-sm font-medium text-ink underline-offset-4 hover:underline"
        >
          doesn&rsquo;t sound like us
        </button>
        <button
          type="button"
          onClick={onReject}
          className="ml-auto inline-flex min-h-[44px] items-center font-sans text-sm font-medium text-flag underline-offset-4 hover:underline"
        >
          reject
        </button>
      </div>
    </div>
  );
}

interface FilterChipProps {
  label: string;
  count: number;
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
}

function FilterChip({ label, count, active, disabled, onClick }: FilterChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      className={[
        "inline-flex min-h-[36px] shrink-0 items-center gap-2 whitespace-nowrap border px-3 py-1 font-mono text-[11px] tracking-eyebrow uppercase transition",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-clay focus-visible:ring-offset-2 focus-visible:ring-offset-paper",
        active
          ? "border-ink bg-ink text-paper"
          : disabled
            ? "cursor-not-allowed border-rule text-mute/60"
            : "border-rule bg-paper text-ink hover:border-ink",
      ].join(" ")}
    >
      {label}
      <span className="opacity-70">{count}</span>
    </button>
  );
}

interface SortChipProps {
  label: string;
  active: boolean;
  onClick: () => void;
}

function SortChip({ label, active, onClick }: SortChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={[
        "inline-flex min-h-[36px] shrink-0 items-center whitespace-nowrap border px-3 py-1 font-mono text-[11px] tracking-eyebrow uppercase transition",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-clay focus-visible:ring-offset-2 focus-visible:ring-offset-paper",
        active
          ? "border-ink bg-ink text-paper"
          : "border-rule bg-paper text-ink hover:border-ink",
      ].join(" ")}
    >
      {label}
    </button>
  );
}
