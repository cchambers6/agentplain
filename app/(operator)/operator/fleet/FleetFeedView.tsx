"use client";

// Presentational layer for the /operator/fleet inspector (Stream D.1).
//
// These components are PURE: props in, markup out. No router hooks, no server
// actions, no prisma — which is exactly what lets the render test exercise them
// with renderToStaticMarkup (same pattern as LeadershipBoardView). The stateful
// orchestration (URL state, pagination, drawer fetch, save action) lives in
// FleetInspector.tsx, which composes these.

// `import React` is required because tsconfig uses `jsx: preserve`: Next
// compiles JSX with the automatic runtime, but the tsx loader used by
// `node --test` emits classic-runtime `React.createElement` calls. Importing
// React keeps this file renderable in the test pipeline (same note as
// LeadershipBoardView).
import React from "react";
import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import {
  FLEET_STATUS_LABEL,
  FLEET_TIME_RANGES,
  FLEET_TIME_RANGE_LABEL,
  countActiveFilters,
  type FleetActivityDetail,
  type FleetActivityRow,
  type FleetFilterOptions,
  type FleetFilters,
  type FleetStatus,
  type FleetTimeRange,
} from "@/lib/operator/fleet-activity-filters";

// ---------------------------------------------------------------------------
// Drift-sweep banner
// ---------------------------------------------------------------------------

export function DriftBanner({ count }: { count: number }) {
  return (
    <Link
      href="/operator/leadership-board"
      className="flex items-center justify-between gap-4 border border-clay bg-clay/10 px-5 py-4 transition hover:bg-clay/20"
      data-testid="drift-banner"
    >
      <span className="text-[14px] leading-relaxed text-ink">
        <span className="font-display text-lg text-ink">{count}</span> pending
        capability proposal{count === 1 ? "" : "s"} — review the BizMgr drift
        sweep.
      </span>
      <span className="shrink-0 font-mono text-[11px] tracking-eyebrow uppercase text-clay-deep">
        leadership board →
      </span>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Sticky search bar
// ---------------------------------------------------------------------------

export function SearchBar({
  filters,
  options,
  onApply,
}: {
  filters: FleetFilters;
  options: FleetFilterOptions;
  onApply: (next: FleetFilters) => void;
}) {
  const [text, setText] = useState(filters.q);
  useEffect(() => setText(filters.q), [filters.q]);

  // Debounce free-text → URL so typing doesn't navigate on every keystroke.
  useEffect(() => {
    if (text === filters.q) return;
    const t = setTimeout(() => onApply({ ...filters, q: text }), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  const toggle = (key: keyof FleetFilters, value: string) => {
    const current = filters[key] as string[];
    const nextList = current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value];
    onApply({ ...filters, [key]: nextList });
  };

  const setTime = (time: FleetTimeRange) =>
    onApply({ ...filters, time, customFrom: null, customTo: null });

  const setCustom = (which: "customFrom" | "customTo", iso: string | null) =>
    onApply({ ...filters, time: "custom", [which]: iso });

  const active = countActiveFilters(filters);

  return (
    <div className="sticky top-0 z-30 -mx-4 border-b border-rule bg-paper/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-paper/80">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <input
            type="search"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Search skill, agent, discipline, error…"
            aria-label="Search fleet activity"
            className="w-full border border-rule bg-paper px-3 py-2 text-[14px] text-ink placeholder:text-mute focus:border-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-clay focus-visible:ring-inset"
          />
        </div>

        <MultiSelect
          label="workspace"
          selected={filters.workspaceIds}
          options={options.workspaces.map((w) => ({
            value: w.id,
            label: w.name,
            hint: w.verticalSlug,
          }))}
          onToggle={(v) => toggle("workspaceIds", v)}
        />
        <MultiSelect
          label="skill"
          selected={filters.skillSlugs}
          options={options.skillSlugs.map((s) => ({
            value: s.slug,
            label: s.name,
            hint: s.slug,
          }))}
          onToggle={(v) => toggle("skillSlugs", v)}
        />
        <MultiSelect
          label="agent"
          selected={filters.agentSlugs}
          options={options.agentSlugs.map((a) => ({ value: a, label: a }))}
          onToggle={(v) => toggle("agentSlugs", v)}
        />
        <MultiSelect
          label="discipline"
          selected={filters.disciplines}
          options={options.disciplines.map((d) => ({ value: d, label: d }))}
          onToggle={(v) => toggle("disciplines", v)}
        />
        <MultiSelect
          label="status"
          selected={filters.statuses}
          options={options.statuses.map((s) => ({
            value: s,
            label: FLEET_STATUS_LABEL[s],
          }))}
          onToggle={(v) => toggle("statuses", v as FleetStatus)}
        />

        <select
          value={filters.time}
          onChange={(e) => setTime(e.target.value as FleetTimeRange)}
          aria-label="Time range"
          className="border border-rule bg-paper px-2 py-2 font-mono text-[11px] tracking-eyebrow uppercase text-ink focus:border-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-clay focus-visible:ring-inset"
        >
          {FLEET_TIME_RANGES.map((r) => (
            <option key={r} value={r}>
              {FLEET_TIME_RANGE_LABEL[r]}
            </option>
          ))}
        </select>

        {active > 0 ? (
          <button
            type="button"
            onClick={() =>
              onApply({
                q: "",
                workspaceIds: [],
                skillSlugs: [],
                agentSlugs: [],
                disciplines: [],
                statuses: [],
                time: "all",
                customFrom: null,
                customTo: null,
              })
            }
            className="font-mono text-[11px] tracking-eyebrow uppercase text-mute underline-offset-2 hover:text-ink hover:underline"
          >
            clear ({active})
          </button>
        ) : null}
      </div>

      {filters.time === "custom" ? (
        <div className="mt-2 flex flex-wrap items-center gap-2 font-mono text-[11px] text-mute">
          <label className="flex items-center gap-1">
            from
            <input
              type="datetime-local"
              defaultValue={toLocalInput(filters.customFrom)}
              onChange={(e) =>
                setCustom("customFrom", fromLocalInput(e.target.value))
              }
              className="border border-rule bg-paper px-2 py-1 text-ink focus:border-ink focus:outline-none"
            />
          </label>
          <label className="flex items-center gap-1">
            to
            <input
              type="datetime-local"
              defaultValue={toLocalInput(filters.customTo)}
              onChange={(e) =>
                setCustom("customTo", fromLocalInput(e.target.value))
              }
              className="border border-rule bg-paper px-2 py-1 text-ink focus:border-ink focus:outline-none"
            />
          </label>
        </div>
      ) : null}
    </div>
  );
}

interface SelectOption {
  value: string;
  label: string;
  hint?: string;
}

function MultiSelect({
  label,
  selected,
  options,
  onToggle,
}: {
  label: string;
  selected: string[];
  options: SelectOption[];
  onToggle: (value: string) => void;
}) {
  const count = selected.length;
  return (
    <details className="group relative">
      <summary className="flex cursor-pointer list-none items-center gap-1.5 border border-rule bg-paper px-3 py-2 font-mono text-[11px] tracking-eyebrow uppercase text-ink transition hover:border-ink [&::-webkit-details-marker]:hidden">
        {label}
        {count > 0 ? (
          <span className="bg-ink px-1 text-paper">{count}</span>
        ) : null}
        <span aria-hidden className="text-mute">
          ▾
        </span>
      </summary>
      <div className="absolute left-0 z-40 mt-1 max-h-72 w-64 overflow-y-auto border border-rule bg-paper p-1 shadow-sm">
        {options.length === 0 ? (
          <p className="px-2 py-2 text-[12px] text-mute">none yet</p>
        ) : (
          options.map((o) => {
            const on = selected.includes(o.value);
            return (
              <label
                key={o.value}
                className="flex cursor-pointer items-center gap-2 px-2 py-1.5 text-[13px] text-ink hover:bg-paper-deep"
              >
                <input
                  type="checkbox"
                  checked={on}
                  onChange={() => onToggle(o.value)}
                  className="accent-clay"
                />
                <span className="min-w-0 flex-1 truncate">{o.label}</span>
                {o.hint ? (
                  <span className="shrink-0 font-mono text-[10px] text-mute">
                    {o.hint}
                  </span>
                ) : null}
              </label>
            );
          })
        )}
      </div>
    </details>
  );
}

// ---------------------------------------------------------------------------
// Feed
// ---------------------------------------------------------------------------

export function FeedList({
  rows,
  filtersActive,
  onOpen,
}: {
  rows: FleetActivityRow[];
  filtersActive: boolean;
  onOpen: (id: string) => void;
}) {
  if (rows.length === 0) {
    return (
      <div className="border border-dashed border-rule bg-paper p-8 text-[13px] leading-relaxed text-mute">
        {filtersActive
          ? "No runs match these filters. Widen the time range or clear a filter."
          : "No agent activity yet. The first run lands here as soon as a fleet fires."}
      </div>
    );
  }
  return (
    <ul
      aria-label="fleet activity feed"
      className="divide-y divide-rule border border-rule bg-paper"
    >
      {rows.map((r) => (
        <li key={r.id}>
          <FeedRow row={r} onOpen={onOpen} />
        </li>
      ))}
    </ul>
  );
}

function FeedRow({
  row,
  onOpen,
}: {
  row: FleetActivityRow;
  onOpen: (id: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onOpen(row.id)}
      className="flex w-full flex-col gap-1 px-4 py-3 text-left transition hover:bg-paper-deep focus:outline-none focus-visible:bg-paper-deep focus-visible:ring-2 focus-visible:ring-clay focus-visible:ring-inset"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <p className="font-mono text-[10px] tracking-eyebrow uppercase text-mute">
          {row.verticalSlug ? `${row.verticalSlug} · ` : ""}
          {row.workspaceName}
        </p>
        <p className="font-mono text-[11px] text-mute">
          {relativeTime(row.firedAt)}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <StatusPill status={row.status} />
        <span className="font-mono text-[13px] text-ink">
          {row.agentSlug ?? "—"}
        </span>
        <span className="text-mute">·</span>
        <span className="text-[13px] text-ink-soft">{row.skillName}</span>
      </div>
      <p className="text-[13px] leading-relaxed text-ink-soft">
        {row.outcomeLine}
      </p>
    </button>
  );
}

const STATUS_PILL: Record<FleetStatus, string> = {
  running: "border-mute/50 text-mute",
  "awaiting-approval": "border-clay/60 text-clay-deep",
  succeeded: "border-moss/60 text-moss",
  skipped: "border-rule text-mute",
  failed: "border-flag/60 text-flag",
};

export function StatusPill({ status }: { status: FleetStatus }) {
  return (
    <span
      data-status={status}
      className={`border px-1.5 py-0.5 font-mono text-[10px] tracking-eyebrow uppercase ${STATUS_PILL[status]}`}
    >
      {FLEET_STATUS_LABEL[status]}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Drawer body (presentational — fetched detail rendered here)
// ---------------------------------------------------------------------------

export function DrawerBody({
  detail,
  saveState,
  onSave,
}: {
  detail: FleetActivityDetail;
  saveState: "idle" | "saving" | "saved";
  onSave: () => void;
}) {
  const { run } = detail;
  return (
    <>
      <section className="space-y-2">
        <Field label="workspace">
          {run.verticalSlug ? `${run.verticalSlug} · ` : ""}
          {run.workspaceName}
        </Field>
        <Field label="agent">{run.agentSlug ?? "—"}</Field>
        <Field label="skill">
          {run.skillName}{" "}
          <span className="font-mono text-[11px] text-mute">{run.skillSlug}</span>
        </Field>
        <Field label="discipline">{run.discipline ?? "—"}</Field>
        <Field label="status">{run.status}</Field>
        <Field label="fired">{new Date(run.firedAt).toLocaleString()}</Field>
        <Field label="completed">
          {run.completedAt ? new Date(run.completedAt).toLocaleString() : "—"}
        </Field>
        <Field label="duration">
          {run.durationMs != null ? `${run.durationMs} ms` : "—"}
        </Field>
        {run.errorMessage ? (
          <Field label="error">
            <span className="text-flag">{run.errorMessage}</span>
          </Field>
        ) : null}
      </section>

      <DrawerSection title="skill chain">
        {detail.skillChain.length === 0 ? (
          <p className="text-[13px] text-mute">
            No handoffs logged for this subject.
          </p>
        ) : (
          <ol className="space-y-2">
            {detail.skillChain.map((h) => (
              <li key={h.id} className="border-l-2 border-rule pl-3">
                <p className="font-mono text-[12px] text-ink">
                  {h.fromAgent} <span className="text-mute">→</span> {h.toAgent}
                  <span className="ml-2 text-mute">· {h.handoffType}</span>
                </p>
                <p className="text-[13px] leading-relaxed text-ink-soft">
                  {h.summary}
                </p>
                <p className="font-mono text-[10px] text-mute">
                  {relativeTime(h.occurredAt)}
                </p>
              </li>
            ))}
          </ol>
        )}
      </DrawerSection>

      <DrawerSection title="output">
        {detail.output ? (
          <div className="space-y-2">
            <p className="font-mono text-[11px] text-mute">
              {detail.output.kind.toLowerCase()} ·{" "}
              {detail.output.approvalStatus.toLowerCase()}
            </p>
            <CodeBlock content={detail.output.redactedPayload} />
            {detail.approvalsHref ? (
              <Link
                href={detail.approvalsHref}
                className="inline-block font-mono text-[11px] tracking-eyebrow uppercase text-ink underline-offset-2 hover:underline"
              >
                open approval queue item →
              </Link>
            ) : null}
          </div>
        ) : (
          <p className="text-[13px] text-mute">
            This run produced no queued artifact.
          </p>
        )}
      </DrawerSection>

      <DrawerSection title="inbound (time-correlated)">
        {detail.inboundEvents.length === 0 ? (
          <p className="text-[13px] text-mute">
            No webhook events received in the 15 minutes before this fire.
          </p>
        ) : (
          <ul className="space-y-2">
            {detail.inboundEvents.map((e) => (
              <li key={e.id} className="space-y-1">
                <p className="font-mono text-[11px] text-mute">
                  {relativeTime(e.receivedAt)} ·{" "}
                  {e.processed ? "processed" : "unprocessed"}
                </p>
                <CodeBlock content={e.redactedPayload} />
              </li>
            ))}
          </ul>
        )}
      </DrawerSection>

      <section className="flex flex-wrap items-center gap-3 border-t border-rule pt-5">
        <Link
          href={detail.workspaceActivityHref}
          className="border border-ink bg-ink px-3 py-2 font-mono text-[11px] tracking-eyebrow uppercase text-paper transition hover:bg-ink/90"
        >
          view in workspace →
        </Link>
        <button
          type="button"
          onClick={onSave}
          disabled={saveState !== "idle"}
          className="border border-rule bg-paper px-3 py-2 font-mono text-[11px] tracking-eyebrow uppercase text-ink transition hover:border-ink disabled:opacity-60"
        >
          {saveState === "saved"
            ? "saved ✓"
            : saveState === "saving"
              ? "saving…"
              : "save to memory"}
        </button>
      </section>
    </>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex gap-3 text-[13px]">
      <span className="w-24 shrink-0 font-mono text-[11px] tracking-eyebrow uppercase text-mute">
        {label}
      </span>
      <span className="min-w-0 flex-1 text-ink">{children}</span>
    </div>
  );
}

function DrawerSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-2 border-t border-rule pt-5">
      {/* `.eyebrow` is the utility ApEyebrow wraps; used directly here so this
          presentational module has no shared-component dependency and stays
          renderable in the node:test pipeline. */}
      <p className="eyebrow">{title}</p>
      {children}
    </section>
  );
}

function CodeBlock({ content }: { content: string }) {
  return (
    <pre className="max-h-64 overflow-auto border border-rule bg-paper-deep p-3 font-mono text-[11px] leading-relaxed text-ink-soft">
      {content}
    </pre>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return iso;
  const diffMs = Date.now() - then;
  const min = Math.round(diffMs / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h}h ago`;
  const day = Math.round(h / 24);
  if (day < 30) return `${day}d ago`;
  return iso.slice(0, 10);
}

/** ISO → value for <input type="datetime-local"> (local wall time). */
export function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function fromLocalInput(value: string): string | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}
