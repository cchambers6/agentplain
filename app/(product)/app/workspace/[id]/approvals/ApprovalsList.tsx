"use client";

import { useMemo, useState, useTransition } from "react";
import {
  ApHeritageButton,
  ApHeritageConfirm,
  ApPaperSheet,
} from "@/components/ui/ap";
import { listDisciplines, type DisciplineId } from "@/lib/disciplines";
import { bucketApprovals } from "@/lib/disciplines/grouping";
import {
  FEEDBACK_CATEGORIES,
  CATEGORY_DESCRIPTION,
} from "@/lib/feedback/types";
import {
  decideApprovalAction,
  editApprovalDraftAction,
  submitDraftFeedbackAction,
} from "./actions";
import { ApprovalCard, type ApprovalRow } from "./ApprovalCard";

export type { ApprovalRow } from "./ApprovalCard";

interface ApprovalsListProps {
  workspaceId: string;
  rows: ApprovalRow[];
  initialDiscipline: DisciplineId | null;
}

const ALL = "all" as const;
type FilterValue = typeof ALL | DisciplineId;
type SortValue = "oldest" | "newest";

/**
 * Items that get elevated into the "Needs you specifically" section.
 * Today the explicit-tag signal is `priority === 'critical'` on admin
 * cards (the existing `adminBorderClass` pattern); the same rule wins for
 * compliance-flagged drafts because they ride the same priority field.
 * The bar stays deliberately narrow — items in this bucket should be
 * things the broker MUST read, not just "items needing approval at all."
 */
function isNeedsYou(row: ApprovalRow): boolean {
  return row.rendered.admin?.priority === "critical";
}

export function ApprovalsList({
  workspaceId,
  rows,
  initialDiscipline,
}: ApprovalsListProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [feedbackId, setFeedbackId] = useState<string | null>(null);
  const [isRejectPending, startReject] = useTransition();
  const [activeFilter, setActiveFilter] = useState<FilterValue>(
    initialDiscipline ?? ALL,
  );
  // Oldest-first by default: a work queue should surface the
  // longest-waiting decision first so nothing languishes.
  const [sort, setSort] = useState<SortValue>("oldest");
  const editing = rows.find((r) => r.id === editingId) ?? null;
  const rejecting = rows.find((r) => r.id === rejectingId) ?? null;
  const givingFeedback = rows.find((r) => r.id === feedbackId) ?? null;
  const disciplines = listDisciplines();

  // Apply the discipline filter + sort once, up front. The pure-function
  // bucketing helper then carves the list into three buckets; its unit
  // tests are in `tests/disciplines-ux-wedge.test.ts`.
  const filtered = useMemo(() => {
    const base =
      activeFilter === ALL
        ? rows
        : rows.filter((r) => r.discipline === activeFilter);
    return [...base].sort((a, b) => {
      const cmp = a.proposedAtIso.localeCompare(b.proposedAtIso);
      return sort === "oldest" ? cmp : -cmp;
    });
  }, [rows, activeFilter, sort]);

  const buckets = useMemo(
    () =>
      bucketApprovals(filtered.map((r) => ({ ...r, isNeedsYou: isNeedsYou(r) }))),
    [filtered],
  );
  const needsYou = buckets.needsYou;
  const byDiscipline = buckets.byDiscipline;
  const allRecentFallback = buckets.fallback;

  // Per-chip counts (unfiltered universe so a chip never reads 0 just
  // because the user picked a different chip first).
  const chipCounts = useMemo(() => {
    const m = new Map<FilterValue, number>();
    m.set(ALL, rows.length);
    for (const d of disciplines) {
      m.set(d.id, rows.filter((r) => r.discipline === d.id).length);
    }
    return m;
  }, [rows, disciplines]);

  function rejectFooter(row: ApprovalRow) {
    const canEdit = Boolean(row.rendered.editableBody);
    return (
      <>
        <form action={decideApprovalAction}>
          <input type="hidden" name="workspaceId" value={workspaceId} />
          <input type="hidden" name="itemId" value={row.id} />
          <input type="hidden" name="decision" value="APPROVED" />
          <ApHeritageButton variant="primary" type="submit">
            approve
          </ApHeritageButton>
        </form>
        {canEdit ? (
          <ApHeritageButton
            variant="secondary"
            type="button"
            onClick={() => setEditingId(row.id)}
          >
            edit
          </ApHeritageButton>
        ) : null}
        <ApHeritageButton
          variant="secondary"
          type="button"
          onClick={() => setFeedbackId(row.id)}
        >
          doesn&rsquo;t sound like us
        </ApHeritageButton>
        <button
          type="button"
          onClick={() => setRejectingId(row.id)}
          className="inline-flex items-center justify-center gap-2 rounded-none px-3 py-2 font-sans text-sm font-medium text-flag underline-offset-4 transition hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-flag focus-visible:ring-offset-2 focus-visible:ring-offset-paper"
        >
          reject
        </button>
      </>
    );
  }

  function confirmReject() {
    if (!rejecting) return;
    const fd = new FormData();
    fd.set("workspaceId", workspaceId);
    fd.set("itemId", rejecting.id);
    fd.set("decision", "REJECTED");
    startReject(async () => {
      await decideApprovalAction(fd);
      setRejectingId(null);
    });
  }

  return (
    <>
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <div
          className="flex flex-wrap items-center gap-2"
          role="group"
          aria-label="Filter approvals by discipline"
        >
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
        <div
          className="flex items-center gap-2"
          role="group"
          aria-label="Sort approvals by age"
        >
          <span className="font-mono text-[11px] tracking-eyebrow uppercase text-mute">
            sort
          </span>
          <SortChip
            label="oldest first"
            active={sort === "oldest"}
            onClick={() => setSort("oldest")}
          />
          <SortChip
            label="newest first"
            active={sort === "newest"}
            onClick={() => setSort("newest")}
          />
        </div>
      </div>

      <Section
        title="Needs you specifically"
        subtitle="Items your fleet flagged as high-urgency — review these first."
        items={needsYou}
        empty="Nothing urgent right now."
        footerFor={rejectFooter}
      />

      <h2 className="mt-12 font-display text-2xl text-ink">By discipline</h2>
      <p className="mt-2 text-[13px] leading-relaxed text-mute">
        Grouped by the discipline that produced each draft.
      </p>
      {byDiscipline.size === 0 ? (
        <p className="mt-6 border-l-2 border-rule pl-4 text-[13px] leading-relaxed text-mute">
          Nothing to group right now. Items appear here as your fleet produces
          tagged drafts.
        </p>
      ) : (
        <div className="mt-6 space-y-10">
          {disciplines
            .filter((d) => (byDiscipline.get(d.id)?.length ?? 0) > 0)
            .map((d) => {
              const items = byDiscipline.get(d.id) ?? [];
              return (
                <DisciplineSection
                  key={d.id}
                  name={d.name}
                  count={items.length}
                  items={items}
                  footerFor={rejectFooter}
                />
              );
            })}
        </div>
      )}

      <h2 className="mt-12 font-display text-2xl text-ink">All recent</h2>
      <p className="mt-2 text-[13px] leading-relaxed text-mute">
        Anything not yet tagged with a discipline lands here so nothing slips
        through.
      </p>
      <Section
        title=""
        items={allRecentFallback}
        empty="Every recent item already grouped above."
        footerFor={rejectFooter}
        hideTitle
      />

      <ApPaperSheet
        open={editing !== null}
        onClose={() => setEditingId(null)}
        eyebrow="edit draft"
        title={
          editing?.rendered.title ??
          editing?.rendered.recipientLine ??
          editing?.rendered.kindLabel ??
          "Draft"
        }
      >
        {editing ? (
          <form
            action={async (form: FormData) => {
              await editApprovalDraftAction(form);
              setEditingId(null);
            }}
          >
            <input type="hidden" name="workspaceId" value={workspaceId} />
            <input type="hidden" name="itemId" value={editing.id} />
            <label className="block">
              <span className="mb-2 block font-mono text-[11px] tracking-eyebrow uppercase text-mute">
                draft body
              </span>
              <textarea
                name="body"
                defaultValue={editing.rendered.editableBody ?? ""}
                rows={14}
                className="block w-full rounded-none border border-rule bg-paper p-3 font-sans text-[15px] leading-relaxed text-ink focus:border-ink focus:outline-none"
              />
            </label>
            <p className="mt-2 text-[13px] leading-relaxed text-mute">
              Saving rewrites the drafted body. Tone, recipient, and threshold
              stay as your fleet proposed them.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-rule pt-5">
              <ApHeritageButton variant="primary" type="submit">
                save draft
              </ApHeritageButton>
              <button
                type="button"
                onClick={() => setEditingId(null)}
                className="inline-flex items-center justify-center rounded-none px-3 py-2 font-sans text-sm text-ink underline-offset-4 hover:underline"
              >
                cancel
              </button>
            </div>
          </form>
        ) : null}
      </ApPaperSheet>

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
              , fold it into the next draft, and review it in our weekly
              sweep. The draft stays in your queue — this is feedback, not a
              decision.
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
                className="inline-flex items-center justify-center rounded-none px-3 py-2 font-sans text-sm text-ink underline-offset-4 hover:underline"
              >
                cancel
              </button>
            </div>
          </form>
        ) : null}
      </ApPaperSheet>

      <ApHeritageConfirm
        open={rejecting !== null}
        onClose={() => (isRejectPending ? undefined : setRejectingId(null))}
        eyebrow="reject draft"
        title="Reject this draft?"
        confirmLabel={isRejectPending ? "rejecting…" : "reject draft"}
        cancelLabel="keep it"
        variant="destructive"
        onConfirm={confirmReject}
      >
        <p>
          The draft is discarded and leaves your queue. Nothing is sent — your
          fleet simply stops here.
        </p>
        <p>
          If you want a different version instead, go back and choose edit. You
          can also re-ask Plaino for a fresh draft anytime.
        </p>
      </ApHeritageConfirm>
    </>
  );
}

interface SectionProps {
  title: string;
  subtitle?: string;
  items: ApprovalRow[];
  empty: string;
  footerFor: (row: ApprovalRow) => React.ReactNode;
  hideTitle?: boolean;
}

function Section({
  title,
  subtitle,
  items,
  empty,
  footerFor,
  hideTitle,
}: SectionProps) {
  return (
    <section className={hideTitle ? "mt-6" : "mt-12"}>
      {hideTitle ? null : (
        <>
          <h2 className="font-display text-2xl text-ink">{title}</h2>
          {subtitle ? (
            <p className="mt-2 text-[13px] leading-relaxed text-mute">
              {subtitle}
            </p>
          ) : null}
        </>
      )}
      {items.length === 0 ? (
        <p className="mt-4 border-l-2 border-rule pl-4 text-[13px] leading-relaxed text-mute">
          {empty}
        </p>
      ) : (
        <ul className="mt-6 space-y-4">
          {items.map((row) => (
            <li key={row.id}>
              <ApprovalCard row={row} footer={footerFor(row)} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

interface DisciplineSectionProps {
  name: string;
  count: number;
  items: ApprovalRow[];
  footerFor: (row: ApprovalRow) => React.ReactNode;
}

function DisciplineSection({
  name,
  count,
  items,
  footerFor,
}: DisciplineSectionProps) {
  return (
    <section aria-label={`${name} approvals`}>
      <header className="flex flex-wrap items-baseline gap-3">
        <h3 className="font-display text-xl text-ink">{name}</h3>
        <span className="font-mono text-[11px] tracking-eyebrow uppercase text-mute">
          {count} {count === 1 ? "item" : "items"}
        </span>
      </header>
      <ul className="mt-4 space-y-4">
        {items.map((row) => (
          <li key={row.id}>
            <ApprovalCard row={row} footer={footerFor(row)} />
          </li>
        ))}
      </ul>
    </section>
  );
}

interface FilterChipProps {
  label: string;
  count: number;
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
}

function FilterChip({
  label,
  count,
  active,
  disabled,
  onClick,
}: FilterChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      className={[
        "inline-flex items-center gap-2 border px-3 py-1 font-mono text-[11px] tracking-eyebrow uppercase transition",
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
        "inline-flex items-center border px-3 py-1 font-mono text-[11px] tracking-eyebrow uppercase transition",
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
