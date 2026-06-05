/**
 * Server-side query logic for the /operator/fleet activity inspector.
 *
 * The feed query path is built from pure, independently-testable pieces (this
 * is what keeps it fast + correct under load):
 *
 *   buildFeedWhere   — composes the Prisma WHERE from the filter set.
 *   mapRunToRow      — maps a raw SkillRun(+queueItem) row to a feed row,
 *                      deriving status + agent attribution + outcome line.
 *   paginateRuns     — slices an over-fetched (limit+1) result into a page
 *                      and the opaque next-cursor.
 *   encode/decode    — the cursor round-trip.
 *
 * "Under load" here means: the mapping + pagination are exercised against a
 * 5,000-row synthetic dataset to assert correctness and linear behavior at
 * volume without needing a live DB (node:test, no Postgres). The DB read
 * itself is index-backed by 20260603000000_operator_fleet_activity_indexes.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  EMPTY_FLEET_FILTERS,
  buildFeedWhere,
  decodeFleetCursor,
  deriveFleetStatus,
  encodeFleetCursor,
  fleetFiltersToSearchParams,
  mapRunToRow,
  paginateRuns,
  parseFleetFilters,
  redactPii,
  redactPiiString,
  summarizeOutcome,
  type FleetActivityRow,
  type FleetFilters,
  type RawFleetRun,
  type WorkspaceMeta,
} from "@/lib/operator/fleet-activity-filters";

const NOW = new Date("2026-06-03T12:00:00Z");
const HOUR = 60 * 60 * 1000;

// ---------------------------------------------------------------------------
// deriveFleetStatus — the full matrix
// ---------------------------------------------------------------------------

describe("deriveFleetStatus", () => {
  const done = NOW;

  it("returns running whenever completedAt is null (outcome ignored)", () => {
    assert.equal(deriveFleetStatus("DRAFTED", null, "PENDING"), "running");
    assert.equal(deriveFleetStatus("FAILED", null, null), "running");
  });

  it("returns failed for FAILED with a completion", () => {
    assert.equal(deriveFleetStatus("FAILED", done, null), "failed");
  });

  it("maps every SKIPPED_* outcome to skipped", () => {
    for (const o of [
      "SKIPPED_PAUSED",
      "SKIPPED_UNINSTALLED",
      "SKIPPED_WINDOW",
      "SKIPPED_DISCIPLINE_DISABLED",
      "SKIPPED_DRY_RUN",
    ]) {
      assert.equal(deriveFleetStatus(o, done, null), "skipped");
    }
  });

  it("splits DRAFTED on queue status: PENDING → awaiting-approval, else succeeded", () => {
    assert.equal(
      deriveFleetStatus("DRAFTED", done, "PENDING"),
      "awaiting-approval",
    );
    assert.equal(deriveFleetStatus("DRAFTED", done, "APPROVED"), "succeeded");
    assert.equal(deriveFleetStatus("DRAFTED", done, "REJECTED"), "succeeded");
    assert.equal(deriveFleetStatus("DRAFTED", done, null), "succeeded");
  });

  it("treats SUCCEEDED_NO_DRAFT as succeeded", () => {
    assert.equal(deriveFleetStatus("SUCCEEDED_NO_DRAFT", done, null), "succeeded");
  });
});

// ---------------------------------------------------------------------------
// summarizeOutcome
// ---------------------------------------------------------------------------

function run(overrides: Partial<RawFleetRun> = {}): RawFleetRun {
  return {
    id: overrides.id ?? "run-1",
    workspaceId: overrides.workspaceId ?? "ws-1",
    skillSlug: overrides.skillSlug ?? "buyer-inquiry-router",
    discipline: overrides.discipline ?? "client-service",
    firedAt: overrides.firedAt ?? NOW,
    // Respect an explicit `completedAt: null` (running). A `?? NOW` here would
    // silently coerce null → NOW and erase the running case.
    completedAt: "completedAt" in overrides ? (overrides.completedAt ?? null) : NOW,
    outcome: overrides.outcome ?? "DRAFTED",
    durationMs: overrides.durationMs ?? 1200,
    errorMessage: overrides.errorMessage ?? null,
    queueItem:
      overrides.queueItem !== undefined
        ? overrides.queueItem
        : {
            id: "q-1",
            status: "PENDING",
            kind: "DRAFT_REPLY",
            agentSlug: "buyer-inquiry-router",
            refTable: "Inquiry",
            refId: "inq-1",
            payload: null,
          },
  };
}

describe("summarizeOutcome", () => {
  it("uses the error message for failed runs", () => {
    const r = run({ outcome: "FAILED", errorMessage: "anthropic 503" });
    assert.equal(
      summarizeOutcome(r, "failed", null),
      "anthropic 503",
    );
  });

  it("explains the skip reason", () => {
    const r = run({ outcome: "SKIPPED_PAUSED", queueItem: null });
    assert.equal(
      summarizeOutcome(r, "skipped", null),
      "skipped — workspace paused",
    );
  });

  it("reports no-draft success honestly", () => {
    const r = run({ outcome: "SUCCEEDED_NO_DRAFT", queueItem: null });
    assert.equal(
      summarizeOutcome(r, "succeeded", null),
      "completed — no draft warranted",
    );
  });

  it("describes a DRAFTED artifact from the decrypted payload", () => {
    const r = run();
    const line = summarizeOutcome(r, "awaiting-approval", {
      subject: "Re: showing at 142 Peachtree",
      recipient: "buyer@homes.com",
    });
    assert.match(line, /drafted reply/);
    assert.match(line, /142 Peachtree/);
    assert.match(line, /buyer@homes\.com/);
  });

  it("falls back to the kind verb when payload has no usable fields", () => {
    const r = run();
    assert.equal(summarizeOutcome(r, "awaiting-approval", {}), "drafted reply");
  });
});

// ---------------------------------------------------------------------------
// buildFeedWhere — filters compose (ANDed); multi-select within an axis is `in`
// ---------------------------------------------------------------------------

describe("buildFeedWhere", () => {
  it("returns an empty object for the empty filter set", () => {
    assert.deepEqual(buildFeedWhere(EMPTY_FLEET_FILTERS, NOW), {});
  });

  it("ANDs each active axis", () => {
    const filters: FleetFilters = {
      ...EMPTY_FLEET_FILTERS,
      workspaceIds: ["ws-1", "ws-2"],
      skillSlugs: ["buyer-inquiry-router"],
      disciplines: ["client-service"],
      time: "24h",
      q: "peachtree",
    };
    const where = buildFeedWhere(filters, NOW);
    assert.ok(Array.isArray(where.AND));
    const and = where.AND as Record<string, unknown>[];
    // workspace IN
    assert.ok(
      and.some(
        (c) =>
          c.workspaceId &&
          JSON.stringify(c.workspaceId) === JSON.stringify({ in: ["ws-1", "ws-2"] }),
      ),
    );
    // time bound is gte NOW-24h
    const timeClause = and.find((c) => c.firedAt) as
      | { firedAt: { gte?: Date } }
      | undefined;
    assert.ok(timeClause?.firedAt.gte instanceof Date);
    assert.equal(
      (timeClause as { firedAt: { gte: Date } }).firedAt.gte.getTime(),
      NOW.getTime() - 24 * HOUR,
    );
    // free text OR fans across skill/discipline/error/agent
    const qClause = and.find((c) => Array.isArray(c.OR)) as
      | { OR: unknown[] }
      | undefined;
    assert.ok(qClause);
    assert.equal(qClause.OR.length, 4);
  });

  it("awaiting-approval status filters on a PENDING queue item", () => {
    const where = buildFeedWhere(
      { ...EMPTY_FLEET_FILTERS, statuses: ["awaiting-approval"] },
      NOW,
    );
    const and = where.AND as Record<string, unknown>[];
    const statusClause = and.find((c) => Array.isArray(c.OR)) as {
      OR: Record<string, unknown>[];
    };
    assert.deepEqual(statusClause.OR[0], {
      outcome: "DRAFTED",
      queueItem: { is: { status: "PENDING" } },
    });
  });

  it("succeeded status covers no-draft + decided-draft + draft-without-queue", () => {
    const where = buildFeedWhere(
      { ...EMPTY_FLEET_FILTERS, statuses: ["succeeded"] },
      NOW,
    );
    const and = where.AND as Record<string, unknown>[];
    const statusClause = and.find((c) => Array.isArray(c.OR)) as {
      OR: Record<string, unknown>[];
    };
    // statuses array → OR of one element, which itself ORs the three shapes.
    const inner = statusClause.OR[0] as { OR: unknown[] };
    assert.equal(inner.OR.length, 3);
  });

  it("custom time range honors from/to bounds", () => {
    const where = buildFeedWhere(
      {
        ...EMPTY_FLEET_FILTERS,
        time: "custom",
        customFrom: "2026-06-01T00:00:00.000Z",
        customTo: "2026-06-02T00:00:00.000Z",
      },
      NOW,
    );
    const and = where.AND as Record<string, unknown>[];
    const clause = and.find((c) => c.firedAt) as {
      firedAt: { gte: Date; lte: Date };
    };
    assert.equal(clause.firedAt.gte.toISOString(), "2026-06-01T00:00:00.000Z");
    assert.equal(clause.firedAt.lte.toISOString(), "2026-06-02T00:00:00.000Z");
  });
});

// ---------------------------------------------------------------------------
// Filter URL round-trip
// ---------------------------------------------------------------------------

describe("parseFleetFilters / fleetFiltersToSearchParams round-trip", () => {
  it("round-trips a fully-populated filter set", () => {
    const filters: FleetFilters = {
      q: "fair housing",
      workspaceIds: ["ws-1", "ws-2"],
      skillSlugs: ["compliance-sentinel"],
      agentSlugs: ["compliance-sentinel"],
      disciplines: ["compliance"],
      statuses: ["failed", "awaiting-approval"],
      time: "7d",
      customFrom: null,
      customTo: null,
    };
    const sp = fleetFiltersToSearchParams(filters);
    const reparsed = parseFleetFilters(Object.fromEntries(sp));
    assert.deepEqual(reparsed, filters);
  });

  it("drops unknown statuses and bad time ranges instead of throwing", () => {
    const parsed = parseFleetFilters({
      status: "failed,not-a-status",
      time: "garbage",
    });
    assert.deepEqual(parsed.statuses, ["failed"]);
    assert.equal(parsed.time, "all");
  });

  it("ignores custom from/to unless time is custom", () => {
    const parsed = parseFleetFilters({
      time: "24h",
      from: "2026-06-01T00:00:00Z",
    });
    assert.equal(parsed.customFrom, null);
  });
});

// ---------------------------------------------------------------------------
// Cursor round-trip
// ---------------------------------------------------------------------------

describe("fleet cursor", () => {
  it("round-trips firedAt + id", () => {
    const c = { firedAt: "2026-06-03T11:59:00.000Z", id: "abc-123" };
    assert.deepEqual(decodeFleetCursor(encodeFleetCursor(c)), c);
  });

  it("returns null for malformed cursors", () => {
    assert.equal(decodeFleetCursor(null), null);
    assert.equal(decodeFleetCursor(""), null);
    assert.equal(decodeFleetCursor("@@@not-base64@@@!"), null);
  });

  it("round-trips 1,000 distinct cursors", () => {
    for (let i = 0; i < 1000; i++) {
      const c = {
        firedAt: new Date(NOW.getTime() - i * 1000).toISOString(),
        id: `run-${i}`,
      };
      assert.deepEqual(decodeFleetCursor(encodeFleetCursor(c)), c);
    }
  });
});

// ---------------------------------------------------------------------------
// Mapping + pagination under load (5,000 rows)
// ---------------------------------------------------------------------------

describe("mapRunToRow + paginateRuns under load", () => {
  const workspaceById = new Map<string, WorkspaceMeta>([
    ["ws-1", { name: "Peachtree Realty", verticalSlug: "realty" }],
    ["ws-2", { name: "Cobb CPA", verticalSlug: "accounting" }],
  ]);

  function buildDataset(n: number): RawFleetRun[] {
    const outcomes = [
      "DRAFTED",
      "SUCCEEDED_NO_DRAFT",
      "FAILED",
      "SKIPPED_PAUSED",
    ];
    const rows: RawFleetRun[] = [];
    for (let i = 0; i < n; i++) {
      const outcome = outcomes[i % outcomes.length];
      rows.push(
        run({
          id: `run-${String(i).padStart(5, "0")}`,
          workspaceId: i % 2 === 0 ? "ws-1" : "ws-2",
          firedAt: new Date(NOW.getTime() - i * 1000),
          completedAt: i % 7 === 0 ? null : new Date(NOW.getTime() - i * 1000),
          outcome,
          errorMessage: outcome === "FAILED" ? `boom ${i}` : null,
          queueItem:
            outcome === "DRAFTED"
              ? {
                  id: `q-${i}`,
                  status: i % 3 === 0 ? "PENDING" : "APPROVED",
                  kind: "DRAFT_REPLY",
                  agentSlug: "buyer-inquiry-router",
                  refTable: "Inquiry",
                  refId: `inq-${i}`,
                  payload: null,
                }
              : null,
        }),
      );
    }
    return rows;
  }

  it("maps 5,000 rows with correct status + workspace attribution", () => {
    const raw = buildDataset(5000);
    const mapped = raw.map((r) => mapRunToRow(r, workspaceById, null));
    assert.equal(mapped.length, 5000);
    // Spot-check attribution + that no row crashed into an unknown status.
    const valid = new Set([
      "running",
      "awaiting-approval",
      "succeeded",
      "skipped",
      "failed",
    ]);
    for (const m of mapped) assert.ok(valid.has(m.status));
    const ws1 = mapped.find((m) => m.workspaceId === "ws-1");
    assert.equal(ws1?.workspaceName, "Peachtree Realty");
    assert.equal(ws1?.verticalSlug, "realty");
    // running wins over outcome whenever completedAt is null (every 7th row).
    assert.ok(mapped.some((m) => m.status === "running"));
  });

  it("paginates an over-fetched page (limit+1) and emits a usable cursor", () => {
    const raw = buildDataset(51);
    const mapped = raw.map((r) => mapRunToRow(r, workspaceById, null));
    const page = paginateRuns(mapped, 50);
    assert.equal(page.rows.length, 50);
    assert.equal(page.hasMore, true);
    assert.ok(page.nextCursor);
    const decoded = decodeFleetCursor(page.nextCursor);
    assert.equal(decoded?.id, mapped[49].id);
  });

  it("reports end-of-feed when the result fits in one page", () => {
    const raw = buildDataset(40);
    const mapped = raw.map((r) => mapRunToRow(r, workspaceById, null));
    const page = paginateRuns(mapped, 50);
    assert.equal(page.rows.length, 40);
    assert.equal(page.hasMore, false);
    assert.equal(page.nextCursor, null);
  });

  it("walks the entire 5,000-row set in 50-row cursor pages without gaps or dupes", () => {
    const raw = buildDataset(5000);
    const mapped = raw.map((r) => mapRunToRow(r, workspaceById, null));
    // Simulate the server taking limit+1 slices off the cursor-ordered list.
    const seen = new Set<string>();
    let offset = 0;
    let pages = 0;
    while (offset < mapped.length) {
      const slice = mapped.slice(offset, offset + 51);
      const page = paginateRuns(slice, 50);
      for (const r of page.rows) {
        assert.ok(!seen.has(r.id), `duplicate row ${r.id}`);
        seen.add(r.id);
      }
      pages += 1;
      if (!page.hasMore) break;
      offset += 50;
    }
    assert.equal(seen.size, 5000);
    assert.equal(pages, 100);
  });
});

// ---------------------------------------------------------------------------
// PII redaction
// ---------------------------------------------------------------------------

describe("redactPii", () => {
  it("masks emails but keeps the domain for context", () => {
    assert.equal(
      redactPiiString("contact sarah.jones@example.com today"),
      "contact s•••@example.com today",
    );
  });

  it("masks phone numbers to the last two digits", () => {
    const out = redactPiiString("call +1 (404) 555-0142 now");
    assert.match(out, /•••••42/);
    assert.doesNotMatch(out, /555-0142/);
  });

  it("recurses through nested objects and arrays, preserving structure", () => {
    const input = {
      to: "buyer@homes.com",
      notes: ["reach at 404-555-0199", { agent: "no-pii-here" }],
      count: 3,
    };
    const out = redactPii(input) as typeof input;
    assert.match(out.to, /@homes\.com$/);
    assert.doesNotMatch(out.to, /^buyer/);
    assert.match((out.notes[0] as string), /•••••99/);
    assert.deepEqual((out.notes[1] as { agent: string }).agent, "no-pii-here");
    assert.equal(out.count, 3);
  });
});

// Keep the FleetActivityRow type referenced so the import is load-bearing.
const _typecheck: FleetActivityRow | null = null;
void _typecheck;
