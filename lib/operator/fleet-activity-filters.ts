/**
 * Fleet activity inspector — pure, client-safe core.
 *
 * This module has ZERO server dependencies (no prisma, no payload-crypto, no
 * Node Buffer). It holds the types, constants, and pure functions shared by
 * the server data layer (`fleet-activity.ts`), the client view
 * (`FleetInspector.tsx`), and the tests. Keeping it dependency-free is what
 * lets the `"use client"` view import filter/serialization helpers without
 * dragging Prisma into the browser bundle.
 *
 * The only import is a TYPE-only `Prisma` (erased at compile) so the WHERE
 * builder can be strongly typed without a runtime dependency.
 */

import type { Prisma } from "@prisma/client";
import { getSkillCatalogEntry } from "@/lib/skills/registry";

// ---------------------------------------------------------------------------
// Status taxonomy
// ---------------------------------------------------------------------------

export type FleetStatus =
  | "running"
  | "awaiting-approval"
  | "succeeded"
  | "skipped"
  | "failed";

export const FLEET_STATUSES: readonly FleetStatus[] = [
  "running",
  "awaiting-approval",
  "succeeded",
  "skipped",
  "failed",
] as const;

export const FLEET_STATUS_LABEL: Record<FleetStatus, string> = {
  running: "running",
  "awaiting-approval": "awaiting approval",
  succeeded: "succeeded",
  skipped: "skipped",
  failed: "failed",
};

/** Outcome enum values that mean "the fire never entered the skill body". */
export const SKIPPED_OUTCOMES = [
  "SKIPPED_PAUSED",
  "SKIPPED_UNINSTALLED",
  "SKIPPED_WINDOW",
  "SKIPPED_DISCIPLINE_DISABLED",
  "SKIPPED_DRY_RUN",
] as const;

/** WorkApprovalStatus values that mean "the operator/customer has decided". */
export const DECIDED_APPROVAL_STATUSES = [
  "APPROVED",
  "AUTO_APPROVED",
  "REJECTED",
  "EXPIRED",
] as const;

const SKIP_REASON: Record<string, string> = {
  SKIPPED_PAUSED: "workspace paused",
  SKIPPED_UNINSTALLED: "skill not installed",
  SKIPPED_WINDOW: "outside schedule window",
  SKIPPED_DISCIPLINE_DISABLED: "discipline disabled",
  SKIPPED_DRY_RUN: "dry run",
};

/**
 * Derive the human status for one run. `completedAt` null means the run row
 * was written but its outcome not yet stamped — that's the only "running"
 * signal the schema carries, so it wins over the (placeholder) outcome value.
 */
export function deriveFleetStatus(
  outcome: string,
  completedAt: Date | string | null,
  queueStatus: string | null,
): FleetStatus {
  if (!completedAt) return "running";
  if (outcome === "FAILED") return "failed";
  if ((SKIPPED_OUTCOMES as readonly string[]).includes(outcome)) return "skipped";
  if (outcome === "DRAFTED") {
    return queueStatus === "PENDING" ? "awaiting-approval" : "succeeded";
  }
  // SUCCEEDED_NO_DRAFT and any future success-shaped outcome.
  return "succeeded";
}

// ---------------------------------------------------------------------------
// Filters + URL state
// ---------------------------------------------------------------------------

export type FleetTimeRange = "1h" | "24h" | "7d" | "30d" | "all" | "custom";

export const FLEET_TIME_RANGES: readonly FleetTimeRange[] = [
  "1h",
  "24h",
  "7d",
  "30d",
  "all",
  "custom",
] as const;

export const FLEET_TIME_RANGE_LABEL: Record<FleetTimeRange, string> = {
  "1h": "last 1h",
  "24h": "last 24h",
  "7d": "last 7d",
  "30d": "last 30d",
  all: "all time",
  custom: "custom range",
};

export interface FleetFilters {
  q: string;
  workspaceIds: string[];
  skillSlugs: string[];
  agentSlugs: string[];
  disciplines: string[];
  statuses: FleetStatus[];
  time: FleetTimeRange;
  /** ISO timestamps; only honored when `time === "custom"`. */
  customFrom: string | null;
  customTo: string | null;
}

export const EMPTY_FLEET_FILTERS: FleetFilters = {
  q: "",
  workspaceIds: [],
  skillSlugs: [],
  agentSlugs: [],
  disciplines: [],
  statuses: [],
  time: "all",
  customFrom: null,
  customTo: null,
};

type RawSearchParams = Record<string, string | string[] | undefined>;

function asList(v: string | string[] | undefined): string[] {
  if (v == null) return [];
  const arr = Array.isArray(v) ? v : v.split(",");
  return arr
    .flatMap((s) => s.split(","))
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function asScalar(v: string | string[] | undefined): string {
  if (v == null) return "";
  return (Array.isArray(v) ? v[0] : v) ?? "";
}

/**
 * Parse Next.js `searchParams` into a typed, defaulted filter set. Unknown
 * values are dropped (never throw into the page). Round-trips with
 * `fleetFiltersToSearchParams`.
 */
export function parseFleetFilters(params: RawSearchParams): FleetFilters {
  const statuses = asList(params.status).filter((s): s is FleetStatus =>
    (FLEET_STATUSES as readonly string[]).includes(s),
  );
  const timeRaw = asScalar(params.time) as FleetTimeRange;
  const time = (FLEET_TIME_RANGES as readonly string[]).includes(timeRaw)
    ? timeRaw
    : "all";
  return {
    q: asScalar(params.q).slice(0, 200),
    workspaceIds: asList(params.ws),
    skillSlugs: asList(params.skill),
    agentSlugs: asList(params.agent),
    disciplines: asList(params.discipline),
    statuses,
    time,
    customFrom: time === "custom" ? isoOrNull(asScalar(params.from)) : null,
    customTo: time === "custom" ? isoOrNull(asScalar(params.to)) : null,
  };
}

function isoOrNull(raw: string): string | null {
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** Serialize filters back to a URLSearchParams for bookmarkable queries. */
export function fleetFiltersToSearchParams(
  filters: FleetFilters,
): URLSearchParams {
  const sp = new URLSearchParams();
  if (filters.q) sp.set("q", filters.q);
  if (filters.workspaceIds.length) sp.set("ws", filters.workspaceIds.join(","));
  if (filters.skillSlugs.length) sp.set("skill", filters.skillSlugs.join(","));
  if (filters.agentSlugs.length) sp.set("agent", filters.agentSlugs.join(","));
  if (filters.disciplines.length)
    sp.set("discipline", filters.disciplines.join(","));
  if (filters.statuses.length) sp.set("status", filters.statuses.join(","));
  if (filters.time !== "all") sp.set("time", filters.time);
  if (filters.time === "custom") {
    if (filters.customFrom) sp.set("from", filters.customFrom);
    if (filters.customTo) sp.set("to", filters.customTo);
  }
  return sp;
}

export function fleetFiltersAreEmpty(filters: FleetFilters): boolean {
  return (
    !filters.q &&
    filters.workspaceIds.length === 0 &&
    filters.skillSlugs.length === 0 &&
    filters.agentSlugs.length === 0 &&
    filters.disciplines.length === 0 &&
    filters.statuses.length === 0 &&
    filters.time === "all"
  );
}

export function countActiveFilters(filters: FleetFilters): number {
  return (
    (filters.q ? 1 : 0) +
    filters.workspaceIds.length +
    filters.skillSlugs.length +
    filters.agentSlugs.length +
    filters.disciplines.length +
    filters.statuses.length +
    (filters.time !== "all" ? 1 : 0)
  );
}

/** Resolve a time range to an absolute "since" instant, or null for no bound. */
export function timeRangeToSince(
  range: FleetTimeRange,
  now: Date,
): Date | null {
  const ms: Partial<Record<FleetTimeRange, number>> = {
    "1h": 60 * 60 * 1000,
    "24h": 24 * 60 * 60 * 1000,
    "7d": 7 * 24 * 60 * 60 * 1000,
    "30d": 30 * 24 * 60 * 60 * 1000,
  };
  const delta = ms[range];
  return delta ? new Date(now.getTime() - delta) : null;
}

// ---------------------------------------------------------------------------
// WHERE builder (type-only Prisma — no runtime dependency)
// ---------------------------------------------------------------------------

function statusWhere(status: FleetStatus): Prisma.SkillRunWhereInput {
  switch (status) {
    case "running":
      return { completedAt: null };
    case "failed":
      return { outcome: "FAILED" };
    case "skipped":
      return {
        outcome: { in: SKIPPED_OUTCOMES as unknown as Prisma.Enumerable<never> },
      };
    case "awaiting-approval":
      return { outcome: "DRAFTED", queueItem: { is: { status: "PENDING" } } };
    case "succeeded":
      return {
        OR: [
          { outcome: "SUCCEEDED_NO_DRAFT" },
          {
            outcome: "DRAFTED",
            queueItem: {
              is: {
                status: {
                  in: DECIDED_APPROVAL_STATUSES as unknown as Prisma.Enumerable<never>,
                },
              },
            },
          },
          { outcome: "DRAFTED", queueItem: { is: null } },
        ],
      };
  }
}

/**
 * Compose all active filters into a single Prisma `where`. Filters are ANDed;
 * multi-selects within one axis are ORed (an `in` list). Free text matches
 * (case-insensitive substring) skillSlug / discipline / errorMessage on the
 * run and agentSlug on the joined queue item — the trigram GIN indexes from
 * 20260603000000_operator_fleet_activity_indexes keep these index-backed.
 */
export function buildFeedWhere(
  filters: FleetFilters,
  now: Date,
): Prisma.SkillRunWhereInput {
  const and: Prisma.SkillRunWhereInput[] = [];

  if (filters.workspaceIds.length)
    and.push({ workspaceId: { in: filters.workspaceIds } });
  if (filters.skillSlugs.length)
    and.push({ skillSlug: { in: filters.skillSlugs } });
  if (filters.disciplines.length)
    and.push({ discipline: { in: filters.disciplines } });
  if (filters.agentSlugs.length)
    and.push({ queueItem: { is: { agentSlug: { in: filters.agentSlugs } } } });
  if (filters.statuses.length)
    and.push({ OR: filters.statuses.map(statusWhere) });

  if (filters.time === "custom") {
    const range: Prisma.DateTimeFilter = {};
    if (filters.customFrom) range.gte = new Date(filters.customFrom);
    if (filters.customTo) range.lte = new Date(filters.customTo);
    if (range.gte || range.lte) and.push({ firedAt: range });
  } else {
    const since = timeRangeToSince(filters.time, now);
    if (since) and.push({ firedAt: { gte: since } });
  }

  const q = filters.q.trim();
  if (q) {
    and.push({
      OR: [
        { skillSlug: { contains: q, mode: "insensitive" } },
        { discipline: { contains: q, mode: "insensitive" } },
        { errorMessage: { contains: q, mode: "insensitive" } },
        { queueItem: { is: { agentSlug: { contains: q, mode: "insensitive" } } } },
      ],
    });
  }

  return and.length ? { AND: and } : {};
}

// ---------------------------------------------------------------------------
// Cursor pagination (firedAt DESC, id DESC) — isomorphic base64 via btoa/atob
// ---------------------------------------------------------------------------

export interface FleetCursor {
  firedAt: string;
  id: string;
}

export function encodeFleetCursor(cursor: FleetCursor): string {
  return btoa(`${cursor.firedAt}|${cursor.id}`);
}

export function decodeFleetCursor(
  raw: string | null | undefined,
): FleetCursor | null {
  if (!raw) return null;
  try {
    const decoded = atob(raw);
    const idx = decoded.indexOf("|");
    if (idx < 0) return null;
    const firedAt = decoded.slice(0, idx);
    const id = decoded.slice(idx + 1);
    if (!firedAt || !id || Number.isNaN(new Date(firedAt).getTime())) return null;
    return { firedAt, id };
  } catch {
    return null;
  }
}

export function cursorToWhere(cursor: FleetCursor): Prisma.SkillRunWhereInput {
  const firedAt = new Date(cursor.firedAt);
  return {
    OR: [{ firedAt: { lt: firedAt } }, { firedAt, id: { lt: cursor.id } }],
  };
}

// ---------------------------------------------------------------------------
// Row shape (serializable — crosses the server→client boundary)
// ---------------------------------------------------------------------------

export interface FleetActivityRow {
  id: string;
  workspaceId: string;
  workspaceName: string;
  verticalSlug: string;
  skillSlug: string;
  skillName: string;
  discipline: string | null;
  /** Agent attribution: queue item's agentSlug, else discipline, else null. */
  agentSlug: string | null;
  status: FleetStatus;
  outcomeLine: string;
  firedAt: string;
  durationMs: number | null;
  hasQueueItem: boolean;
}

export interface FleetActivityPage {
  rows: FleetActivityRow[];
  nextCursor: string | null;
  hasMore: boolean;
}

export interface WorkspaceMeta {
  name: string;
  verticalSlug: string;
}

// The exact selection the feed query reads — exported so tests can build
// fixtures with the right shape.
export interface RawFleetRun {
  id: string;
  workspaceId: string;
  skillSlug: string;
  discipline: string | null;
  firedAt: Date;
  completedAt: Date | null;
  outcome: string;
  durationMs: number | null;
  errorMessage: string | null;
  queueItem: {
    id: string;
    status: string;
    kind: string;
    agentSlug: string;
    refTable: string;
    refId: string;
    payload: unknown;
  } | null;
}

const KIND_VERB: Record<string, string> = {
  DRAFT_REPLY: "drafted reply",
  DRAFT_EMAIL: "drafted email",
  SCHEDULE_EVENT: "proposed schedule",
  COMPLIANCE_FLAG: "compliance flag",
  CRM_UPDATE: "CRM update",
};

export function humanize(value: string): string {
  return value.replace(/_/g, " ").toLowerCase().trim();
}

function pickString(p: Record<string, unknown>, keys: string[]): string | undefined {
  for (const k of keys) {
    const v = p[k];
    if (typeof v === "string" && v.trim().length > 0) return v.trim();
  }
  return undefined;
}

/**
 * One-line, feed-friendly outcome. Pure: the caller passes the ALREADY
 * decrypted queue payload (decryption is a server concern; keeping it out of
 * here is what makes this module client-safe + unit-testable).
 */
export function summarizeOutcome(
  run: RawFleetRun,
  status: FleetStatus,
  decryptedQueuePayload: unknown,
): string {
  if (status === "running") return "running…";
  if (status === "failed") {
    return run.errorMessage?.trim() || "failed";
  }
  if (status === "skipped") {
    return `skipped — ${SKIP_REASON[run.outcome] ?? humanize(run.outcome)}`;
  }
  if (run.outcome === "SUCCEEDED_NO_DRAFT") {
    return "completed — no draft warranted";
  }
  const queue = run.queueItem;
  if (!queue) return "drafted";
  const verb = KIND_VERB[queue.kind] ?? humanize(queue.kind);
  const payload =
    decryptedQueuePayload && typeof decryptedQueuePayload === "object"
      ? (decryptedQueuePayload as Record<string, unknown>)
      : {};
  const subject = pickString(payload, ["subject", "title", "topic"]);
  const recipient = pickString(payload, ["recipient", "to", "email"]);
  const ref = pickString(payload, ["listingRef", "ref", "subjectLabel"]);
  if (subject && recipient) return `${verb} — ${subject} → ${recipient}`;
  if (subject) return `${verb} — ${subject}`;
  if (recipient) return `${verb} for ${recipient}`;
  if (ref) return `${verb} — ${ref}`;
  return verb;
}

export function mapRunToRow(
  run: RawFleetRun,
  workspaceById: Map<string, WorkspaceMeta>,
  decryptedQueuePayload: unknown,
): FleetActivityRow {
  const meta = workspaceById.get(run.workspaceId);
  const status = deriveFleetStatus(
    run.outcome,
    run.completedAt,
    run.queueItem?.status ?? null,
  );
  return {
    id: run.id,
    workspaceId: run.workspaceId,
    workspaceName: meta?.name ?? "(unknown workspace)",
    verticalSlug: meta?.verticalSlug ?? "",
    skillSlug: run.skillSlug,
    skillName: getSkillCatalogEntry(run.skillSlug)?.name ?? run.skillSlug,
    discipline: run.discipline,
    agentSlug: run.queueItem?.agentSlug ?? run.discipline ?? null,
    status,
    outcomeLine: summarizeOutcome(run, status, decryptedQueuePayload),
    firedAt: run.firedAt.toISOString(),
    durationMs: run.durationMs,
    hasQueueItem: run.queueItem != null,
  };
}

/**
 * Take `limit + 1` mapped rows and slice into a page + nextCursor. The caller
 * over-fetches by one so we can report `hasMore` without a second COUNT.
 */
export function paginateRuns(
  rows: FleetActivityRow[],
  limit: number,
): FleetActivityPage {
  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const last = page[page.length - 1];
  return {
    rows: page,
    hasMore,
    nextCursor:
      hasMore && last
        ? encodeFleetCursor({ firedAt: last.firedAt, id: last.id })
        : null,
  };
}

// ---------------------------------------------------------------------------
// PII redaction (drawer inputs/outputs)
// ---------------------------------------------------------------------------

const EMAIL_RE = /([A-Za-z0-9._%+-])[A-Za-z0-9._%+-]*(@[A-Za-z0-9.-]+\.[A-Za-z]{2,})/g;
const PHONE_RE = /(?<!\d)(\+?\d[\d\s().-]{7,}\d)(?!\d)/g;

/** Mask emails (keep first char + domain) and phone-like runs in a string. */
export function redactPiiString(value: string): string {
  return value
    .replace(EMAIL_RE, (_m, first: string, domain: string) => `${first}•••${domain}`)
    .replace(PHONE_RE, (m: string) => {
      const digits = m.replace(/\D/g, "");
      if (digits.length < 7) return m;
      return `•••••${digits.slice(-2)}`;
    });
}

/** Recursively redact PII in any JSON-ish value, preserving structure. */
export function redactPii(value: unknown): unknown {
  if (typeof value === "string") return redactPiiString(value);
  if (Array.isArray(value)) return value.map(redactPii);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = redactPii(v);
    }
    return out;
  }
  return value;
}

// ---------------------------------------------------------------------------
// Drawer detail DTOs (assembled server-side, rendered client-side)
// ---------------------------------------------------------------------------

export interface FleetHandoffStep {
  id: string;
  fromAgent: string;
  toAgent: string;
  handoffType: string;
  occurredAt: string;
  summary: string;
}

export interface FleetWebhookRef {
  id: string;
  receivedAt: string;
  processed: boolean;
  processedAt: string | null;
  dedupeKey: string | null;
  /** Redacted, pretty-printed inbound payload. */
  redactedPayload: string;
}

export interface FleetActivityDetail {
  run: {
    id: string;
    workspaceId: string;
    workspaceName: string;
    verticalSlug: string;
    skillSlug: string;
    skillName: string;
    discipline: string | null;
    agentSlug: string | null;
    status: FleetStatus;
    outcomeLine: string;
    firedAt: string;
    completedAt: string | null;
    durationMs: number | null;
    errorMessage: string | null;
  };
  output: {
    queueItemId: string;
    kind: string;
    approvalStatus: string;
    redactedPayload: string;
  } | null;
  skillChain: FleetHandoffStep[];
  inboundEvents: FleetWebhookRef[];
  workspaceActivityHref: string;
  approvalsHref: string | null;
}

export interface FleetWorkspaceOption {
  id: string;
  name: string;
  verticalSlug: string;
}

export interface FleetFilterOptions {
  workspaces: FleetWorkspaceOption[];
  skillSlugs: { slug: string; name: string }[];
  agentSlugs: string[];
  disciplines: string[];
  statuses: readonly FleetStatus[];
}
