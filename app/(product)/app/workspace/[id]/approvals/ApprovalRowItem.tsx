"use client";

import { useRef, useState } from "react";
import { PlainoStatus, type PlainoStatusState } from "@/components/ui/ap";
import { getDiscipline } from "@/lib/disciplines";
import {
  estimateTimeToApprove,
  friendlyTitle,
  resolveConfidence,
  swipeOutcome,
} from "@/lib/approvals/presentation";
import { ConfidenceChip, formatRelativeTime } from "./ApprovalCard";
import type { ApprovalRow } from "./ApprovalCard";

// One scannable row in the queue list. Mobile-first:
//   - tap the body → open the detail sheet
//   - swipe right → approve, swipe left → reject (touch only; buttons in the
//     detail sheet are the always-present non-touch path)
//   - optional checkbox in batch mode (only on batch-eligible rows)
// Touch targets are ≥44px. Everything is read off the row + the pure
// presentation helpers — no network, no per-row effects, so a 50-item list
// renders in one cheap pass.

interface ApprovalRowItemProps {
  row: ApprovalRow;
  onOpen: () => void;
  onApprove: () => void;
  onReject: () => void;
  batchMode: boolean;
  selectable: boolean;
  selected: boolean;
  onToggleSelect: () => void;
}

const SWIPE_REVEAL_CAP = 96;

export function ApprovalRowItem({
  row,
  onOpen,
  onApprove,
  onReject,
  batchMode,
  selectable,
  selected,
  onToggleSelect,
}: ApprovalRowItemProps) {
  const { rendered } = row;
  const title = friendlyTitle(rendered);
  const confidence = resolveConfidence(rendered);
  const estimate = estimateTimeToApprove(row.kind, rendered);
  const discipline = row.discipline ? getDiscipline(row.discipline) : null;
  const critical = rendered.admin?.priority === "critical";
  const plainoState: PlainoStatusState = critical ? "alert" : "fetch";

  // ── Swipe state ──────────────────────────────────────────────────────
  const rowRef = useRef<HTMLDivElement>(null);
  const startX = useRef<number | null>(null);
  const startY = useRef<number | null>(null);
  const horizontal = useRef(false);
  const [dragX, setDragX] = useState(0);

  function onTouchStart(e: React.TouchEvent) {
    const t = e.touches[0];
    startX.current = t.clientX;
    startY.current = t.clientY;
    horizontal.current = false;
  }

  function onTouchMove(e: React.TouchEvent) {
    if (startX.current === null || startY.current === null) return;
    const t = e.touches[0];
    const dx = t.clientX - startX.current;
    const dy = t.clientY - startY.current;
    // Only treat as a horizontal swipe once it clearly beats vertical scroll.
    if (!horizontal.current && Math.abs(dx) > Math.abs(dy) + 6) {
      horizontal.current = true;
    }
    if (!horizontal.current) return;
    const capped = Math.max(-SWIPE_REVEAL_CAP, Math.min(SWIPE_REVEAL_CAP, dx));
    setDragX(capped);
  }

  function onTouchEnd() {
    if (startX.current !== null && horizontal.current) {
      const width = rowRef.current?.offsetWidth ?? 320;
      const outcome = swipeOutcome(dragX, width);
      if (outcome === "approve") onApprove();
      else if (outcome === "reject") onReject();
    }
    startX.current = null;
    startY.current = null;
    horizontal.current = false;
    setDragX(0);
  }

  // Backing layer hint: green (approve) revealed on a rightward drag, flag
  // (reject) on a leftward drag.
  const revealApprove = dragX > 8;
  const revealReject = dragX < -8;

  return (
    <div className="relative overflow-hidden border border-rule bg-paper">
      {/* Swipe backing — sits under the row, revealed as it slides. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 flex items-center justify-between px-5 font-mono text-[11px] tracking-eyebrow uppercase"
      >
        <span
          className={`flex items-center gap-2 text-moss transition-opacity ${revealApprove ? "opacity-100" : "opacity-0"}`}
        >
          <PlainoStatus state="sit" size={16} /> approve
        </span>
        <span
          className={`text-flag transition-opacity ${revealReject ? "opacity-100" : "opacity-0"}`}
        >
          reject
        </span>
      </div>

      <div
        ref={rowRef}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        style={{
          transform: `translateX(${dragX}px)`,
          transition: dragX === 0 ? "transform 160ms ease-out" : "none",
        }}
        className={`relative flex items-stretch gap-1 bg-paper ${
          critical ? "border-l-2 border-l-flag" : ""
        }`}
      >
        {batchMode ? (
          <label
            className={`flex min-w-[44px] items-center justify-center self-stretch border-r border-rule px-3 ${
              selectable ? "cursor-pointer" : "cursor-not-allowed opacity-40"
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            <span className="sr-only">
              {selectable
                ? `Select "${title}" for batch approve`
                : "Not eligible for batch approve"}
            </span>
            <input
              type="checkbox"
              checked={selected}
              disabled={!selectable}
              onChange={onToggleSelect}
              className="h-4 w-4 accent-clay"
            />
          </label>
        ) : null}

        <button
          type="button"
          onClick={onOpen}
          className="flex min-h-[60px] flex-1 items-center gap-3 px-4 py-3 text-left transition hover:bg-paper-deep/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-clay"
        >
          <PlainoStatus state={plainoState} size={22} className="shrink-0" />
          <span className="min-w-0 flex-1">
            <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
              {discipline ? (
                <span className="font-mono text-[10px] tracking-eyebrow uppercase text-mute">
                  {discipline.name}
                </span>
              ) : null}
              {confidence ? <ConfidenceChip view={confidence} /> : null}
            </span>
            <span className="mt-1 block truncate font-display text-[15px] leading-snug text-ink">
              {title}
            </span>
            <span className="mt-0.5 block font-mono text-[11px] tracking-eyebrow uppercase text-mute">
              {formatRelativeTime(row.proposedAtIso)}
              <span className="mx-1.5" aria-hidden>
                ·
              </span>
              {estimate} to approve
            </span>
          </span>
          <span aria-hidden className="shrink-0 self-center text-mute">
            →
          </span>
        </button>
      </div>
    </div>
  );
}
