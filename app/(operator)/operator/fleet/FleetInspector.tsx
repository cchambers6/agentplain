"use client";

// Orchestration shell for the /operator/fleet activity inspector (Stream D.1).
//
// Holds the stateful, environment-bound bits: URL filter state (router),
// cursor pagination via server action + infinite scroll, and the drill-down
// drawer whose detail is fetched FRESH from the server on open (no cached
// snapshot that can drift from the DB). All presentation lives in
// FleetFeedView.tsx — pure props-in/markup-out so the render test can exercise
// it without a router or prisma.

import { usePathname, useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { ApEyebrow, ApPaperSheet, ApRootedLoader } from "@/components/ui/ap";
import {
  fleetFiltersAreEmpty,
  fleetFiltersToSearchParams,
  type FleetActivityDetail,
  type FleetActivityPage,
  type FleetActivityRow,
  type FleetFilterOptions,
  type FleetFilters,
} from "@/lib/operator/fleet-activity-filters";
import {
  DriftBanner,
  DrawerBody,
  FeedList,
  SearchBar,
} from "./FleetFeedView";
import {
  loadFleetActivityDetailAction,
  loadMoreFleetActivityAction,
  saveFleetEntryToMemoryAction,
} from "./actions";

interface FleetInspectorProps {
  initialPage: FleetActivityPage;
  filters: FleetFilters;
  filterQuery: string;
  options: FleetFilterOptions;
  pendingCapabilityProposals: number;
}

export default function FleetInspector({
  initialPage,
  filters,
  filterQuery,
  options,
  pendingCapabilityProposals,
}: FleetInspectorProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [, startTransition] = useTransition();

  // Appended rows live in state; the first 50 + reset key come from the server
  // on every navigation (force-dynamic), so we re-seed when filterQuery flips.
  const [rows, setRows] = useState<FleetActivityRow[]>(initialPage.rows);
  const [cursor, setCursor] = useState<string | null>(initialPage.nextCursor);
  const [hasMore, setHasMore] = useState(initialPage.hasMore);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    setRows(initialPage.rows);
    setCursor(initialPage.nextCursor);
    setHasMore(initialPage.hasMore);
  }, [filterQuery, initialPage]);

  const applyFilters = useCallback(
    (next: FleetFilters) => {
      const qs = fleetFiltersToSearchParams(next).toString();
      startTransition(() => {
        router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
      });
    },
    [pathname, router],
  );

  const loadMore = useCallback(async () => {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const next = await loadMoreFleetActivityAction(filterQuery, cursor);
      setRows((prev) => [...prev, ...next.rows]);
      setCursor(next.nextCursor);
      setHasMore(next.hasMore);
    } finally {
      setLoadingMore(false);
    }
  }, [cursor, loadingMore, filterQuery]);

  // Infinite scroll — observe a sentinel at the foot of the feed.
  const sentinelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasMore) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) void loadMore();
      },
      { rootMargin: "400px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, loadMore]);

  const [openId, setOpenId] = useState<string | null>(null);
  const openRow = useMemo(
    () => rows.find((r) => r.id === openId) ?? null,
    [rows, openId],
  );

  return (
    <div className="container-wide space-y-8 py-10">
      <header className="border-b border-rule pb-6">
        <ApEyebrow>operator · fleet activity</ApEyebrow>
        <h1 className="mt-2 font-display text-3xl leading-tight text-ink md:text-4xl">
          See what every agent has done.
        </h1>
        <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-ink-soft">
          The newest actions across every workspace and vertical — searchable,
          filterable, drillable. Each row is a real run from the audit log;
          click any row for the full handoff chain, inputs, and outputs.
        </p>
      </header>

      {pendingCapabilityProposals > 0 ? (
        <DriftBanner count={pendingCapabilityProposals} />
      ) : null}

      <SearchBar filters={filters} options={options} onApply={applyFilters} />

      <FeedList
        rows={rows}
        filtersActive={!fleetFiltersAreEmpty(filters)}
        onOpen={setOpenId}
      />

      {hasMore ? (
        <div ref={sentinelRef} className="flex justify-center py-6">
          <button
            type="button"
            onClick={() => void loadMore()}
            disabled={loadingMore}
            className="border border-rule bg-paper px-4 py-2 font-mono text-[11px] tracking-eyebrow uppercase text-ink transition hover:border-ink disabled:opacity-50"
          >
            {loadingMore ? "loading…" : "load more"}
          </button>
        </div>
      ) : rows.length > 0 ? (
        <p className="py-6 text-center font-mono text-[11px] tracking-eyebrow uppercase text-mute">
          end of feed
        </p>
      ) : null}

      <DetailDrawer
        openId={openId}
        fallbackRow={openRow}
        onClose={() => setOpenId(null)}
      />
    </div>
  );
}

function DetailDrawer({
  openId,
  fallbackRow,
  onClose,
}: {
  openId: string | null;
  fallbackRow: FleetActivityRow | null;
  onClose: () => void;
}) {
  const [detail, setDetail] = useState<FleetActivityDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");

  useEffect(() => {
    if (!openId) {
      setDetail(null);
      setError(null);
      setSaveState("idle");
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    setSaveState("idle");
    loadFleetActivityDetailAction(openId)
      .then((d) => {
        if (cancelled) return;
        if (!d) setError("This run could not be found.");
        setDetail(d);
      })
      .catch(() => {
        if (!cancelled) setError("Failed to load run detail.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [openId]);

  const save = async () => {
    if (!openId) return;
    setSaveState("saving");
    try {
      await saveFleetEntryToMemoryAction(openId, "");
      setSaveState("saved");
    } catch {
      setSaveState("idle");
    }
  };

  const title =
    detail?.run.outcomeLine ?? fallbackRow?.outcomeLine ?? "Run detail";
  const eyebrow = detail
    ? `${detail.run.skillName} · ${detail.run.status}`
    : fallbackRow
      ? `${fallbackRow.skillName} · ${fallbackRow.status}`
      : "run";

  return (
    <ApPaperSheet
      open={openId != null}
      onClose={onClose}
      eyebrow={eyebrow}
      title={title}
      widthPx={560}
    >
      {loading ? (
        <ApRootedLoader kind="default" />
      ) : error ? (
        <p className="text-[14px] text-flag">{error}</p>
      ) : detail ? (
        <DrawerBody detail={detail} saveState={saveState} onSave={save} />
      ) : null}
    </ApPaperSheet>
  );
}
