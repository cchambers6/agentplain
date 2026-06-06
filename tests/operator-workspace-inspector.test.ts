/**
 * tests/operator-workspace-inspector.test.ts
 *
 * Pure shaping for the operator per-workspace deep-dive
 * (`lib/operator/workspace-inspector.ts`). No DB: the page is a thin loader,
 * so every behavior worth testing is exercised here against plain inputs —
 * approval-age bucketing, integration-health classification + worst-first
 * ordering, the activity timeline's shared status taxonomy, usage flattening,
 * and last-human-activity selection.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildActivityTimeline,
  buildApprovalQueueSummary,
  deriveIntegrationHealth,
  deriveLastUserActivity,
  formatAge,
  hasUnhealthyIntegration,
  mapUsageSurfaces,
  summarizeActivity,
  type IntegrationCredentialInput,
} from "@/lib/operator/workspace-inspector";

const NOW = new Date("2026-06-05T12:00:00Z");
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const ago = (ms: number) => new Date(NOW.getTime() - ms);

// ── Approval age histogram ──────────────────────────────────────────────────

describe("buildApprovalQueueSummary", () => {
  it("zero-fills all four buckets on an empty queue", () => {
    const s = buildApprovalQueueSummary([], NOW);
    assert.equal(s.total, 0);
    assert.equal(s.oldestAgeMs, null);
    assert.equal(s.oldestProposedAt, null);
    assert.deepEqual(s.buckets.map((b) => b.count), [0, 0, 0, 0]);
    assert.deepEqual(s.buckets.map((b) => b.key), ["lt1h", "lt24h", "lt7d", "gte7d"]);
  });

  it("buckets by age and reports the oldest", () => {
    const items = [
      { proposedAt: ago(30 * 60 * 1000) }, // 30m → lt1h
      { proposedAt: ago(5 * HOUR) }, // 5h → lt24h
      { proposedAt: ago(3 * DAY) }, // 3d → lt7d
      { proposedAt: ago(10 * DAY) }, // 10d → gte7d (oldest)
      { proposedAt: ago(2 * DAY) }, // 2d → lt7d
    ];
    const s = buildApprovalQueueSummary(items, NOW);
    assert.equal(s.total, 5);
    const counts = Object.fromEntries(s.buckets.map((b) => [b.key, b.count]));
    assert.deepEqual(counts, { lt1h: 1, lt24h: 1, lt7d: 2, gte7d: 1 });
    assert.equal(s.oldestProposedAt?.getTime(), ago(10 * DAY).getTime());
    assert.ok(s.oldestAgeMs && s.oldestAgeMs >= 10 * DAY);
  });

  it("treats a future-dated item as age zero (lt1h), never negative", () => {
    const s = buildApprovalQueueSummary([{ proposedAt: new Date(NOW.getTime() + HOUR) }], NOW);
    assert.equal(s.buckets[0].count, 1);
    assert.equal(s.oldestAgeMs, 0);
  });
});

// ── Integration health ──────────────────────────────────────────────────────

function cred(over: Partial<IntegrationCredentialInput> = {}): IntegrationCredentialInput {
  return {
    provider: over.provider ?? "GOOGLE",
    accountEmail: over.accountEmail ?? "ops@brokerage.com",
    status: over.status ?? "ACTIVE",
    scopes: over.scopes ?? ["read", "label"],
    expiresAt: over.expiresAt ?? ago(-30 * DAY), // 30d in the future
    lastRefreshedAt: over.lastRefreshedAt ?? ago(2 * DAY),
  };
}

describe("deriveIntegrationHealth", () => {
  const names = { GOOGLE: "Gmail", M365: "Outlook" };

  it("classifies active/expiring/expired/revoked/error", () => {
    const rows = deriveIntegrationHealth(
      [
        cred({ provider: "GOOGLE", expiresAt: ago(-30 * DAY) }), // healthy
        cred({ provider: "M365", expiresAt: ago(-3 * DAY) }), // expiring (3d out)
        cred({ provider: "DOCUSIGN", status: "ACTIVE", expiresAt: ago(DAY) }), // past → expired
        cred({ provider: "SLACK", status: "REVOKED" }),
        cred({ provider: "HUBSPOT", status: "ERROR" }),
      ],
      names,
      NOW,
    );
    const byProvider = Object.fromEntries(rows.map((r) => [r.provider, r.health]));
    assert.equal(byProvider.GOOGLE, "HEALTHY");
    assert.equal(byProvider.M365, "EXPIRING");
    assert.equal(byProvider.DOCUSIGN, "EXPIRED");
    assert.equal(byProvider.SLACK, "REVOKED");
    assert.equal(byProvider.HUBSPOT, "ERROR");
  });

  it("orders worst-first (revoked/error before healthy)", () => {
    const rows = deriveIntegrationHealth(
      [
        cred({ provider: "GOOGLE", expiresAt: ago(-30 * DAY) }), // healthy
        cred({ provider: "SLACK", status: "REVOKED" }),
        cred({ provider: "M365", status: "ERROR" }),
      ],
      names,
      NOW,
    );
    assert.deepEqual(rows.map((r) => r.health), ["REVOKED", "ERROR", "HEALTHY"]);
  });

  it("uses the catalog name and falls back to the raw provider key", () => {
    const rows = deriveIntegrationHealth([cred({ provider: "GOOGLE" }), cred({ provider: "MYSTERY" })], names, NOW);
    const byProvider = Object.fromEntries(rows.map((r) => [r.provider, r.name]));
    assert.equal(byProvider.GOOGLE, "Gmail");
    assert.equal(byProvider.MYSTERY, "MYSTERY");
  });

  it("computes signed expiry days and exposes scope count", () => {
    const [row] = deriveIntegrationHealth([cred({ expiresAt: ago(-10 * DAY), scopes: ["a", "b", "c"] })], names, NOW);
    assert.equal(row.expiresInDays, 10);
    assert.equal(row.scopesCount, 3);
  });

  it("hasUnhealthyIntegration is true iff any row is non-healthy", () => {
    const healthy = deriveIntegrationHealth([cred({ expiresAt: ago(-30 * DAY) })], names, NOW);
    const unhealthy = deriveIntegrationHealth([cred({ status: "REVOKED" })], names, NOW);
    assert.equal(hasUnhealthyIntegration(healthy), false);
    assert.equal(hasUnhealthyIntegration(unhealthy), true);
  });
});

// ── Activity timeline ───────────────────────────────────────────────────────

describe("buildActivityTimeline + summarizeActivity", () => {
  it("maps outcomes through the shared fleet status taxonomy", () => {
    const rows = buildActivityTimeline([
      { id: "r1", skillSlug: "buyer-inquiry-router", discipline: "client-service", firedAt: ago(HOUR), completedAt: null, outcome: "DRAFTED", durationMs: null, queueStatus: "PENDING" },
      { id: "r2", skillSlug: "compliance-sentinel", discipline: "compliance", firedAt: ago(2 * HOUR), completedAt: ago(2 * HOUR), outcome: "DRAFTED", durationMs: 900, queueStatus: "PENDING" },
      { id: "r3", skillSlug: "crm-hygiene", discipline: null, firedAt: ago(3 * HOUR), completedAt: ago(3 * HOUR), outcome: "FAILED", durationMs: 100, queueStatus: null },
      { id: "r4", skillSlug: "showing-scheduler", discipline: "ops", firedAt: ago(4 * HOUR), completedAt: ago(4 * HOUR), outcome: "SUCCEEDED_NO_DRAFT", durationMs: 50, queueStatus: null },
    ]);
    assert.deepEqual(rows.map((r) => r.status), ["running", "awaiting-approval", "failed", "succeeded"]);
    assert.equal(rows[0].skillLabel, "buyer inquiry router");
    const counts = summarizeActivity(rows);
    assert.equal(counts.running, 1);
    assert.equal(counts["awaiting-approval"], 1);
    assert.equal(counts.failed, 1);
    assert.equal(counts.succeeded, 1);
    assert.equal(counts.skipped, 0);
  });
});

// ── Usage surfaces ──────────────────────────────────────────────────────────

describe("mapUsageSurfaces", () => {
  it("flattens and totals tokens per surface, preserving order", () => {
    const rows = mapUsageSurfaces([
      {
        sourceSurface: "DRAFT",
        sums: { inputTokens: 100, outputTokens: 50, cacheCreationTokens: 10, cacheReadTokens: 5, costMicroCents: 1234n, callCount: 3 },
      },
      {
        sourceSurface: "SCHEDULE",
        sums: { inputTokens: 10, outputTokens: 5, cacheCreationTokens: 0, cacheReadTokens: 0, costMicroCents: 99n, callCount: 1 },
      },
    ]);
    assert.equal(rows[0].surface, "DRAFT");
    assert.equal(rows[0].tokens, 165);
    assert.equal(rows[0].costMicroCents, 1234n);
    assert.equal(rows[0].callCount, 3);
    assert.equal(rows[1].tokens, 15);
  });
});

// ── Last human activity ─────────────────────────────────────────────────────

describe("deriveLastUserActivity", () => {
  it("returns the newest non-null signal", () => {
    const latest = deriveLastUserActivity([ago(5 * DAY), null, ago(DAY), undefined, ago(10 * DAY)]);
    assert.equal(latest?.getTime(), ago(DAY).getTime());
  });
  it("returns null when there are no signals", () => {
    assert.equal(deriveLastUserActivity([null, undefined]), null);
  });
});

// ── Age formatting ──────────────────────────────────────────────────────────

describe("formatAge", () => {
  it("renders compact units and handles null", () => {
    assert.equal(formatAge(null), "—");
    assert.equal(formatAge(30 * 1000), "just now");
    assert.equal(formatAge(5 * 60 * 1000), "5m");
    assert.equal(formatAge(3 * HOUR), "3h");
    assert.equal(formatAge(2 * DAY), "2d");
  });
});
