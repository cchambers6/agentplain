/**
 * lib/inngest/functions/fleet-health-check.test.ts
 *
 * The cron orchestration: readers → snapshot → persist → digest decision.
 *   - breach on any day → pages a human + persists.
 *   - all-green weekday → no email.
 *   - all-green Monday → weekly confirmation digest.
 *   - unset FLEET_TRUSTED_HUMAN_EMAIL → pageHuman falls back to the operator
 *     allowlist (drives the operator banner condition).
 *   - stale heartbeat (>48h since last success) → the digest says so.
 *   - last-success flag advances on a successful run (self-monitoring).
 *
 * No DB: an in-memory FleetHealthReaders + InMemoryOpsFlagStore + a fake pager.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  runFleetHealthCheck,
  FLEET_HEALTH_LAST_SUCCESS_FLAG,
  FLEET_HEALTH_LATEST_FLAG,
  type FleetHealthReaders,
} from "./fleet-health-check";
import { InMemoryOpsFlagStore } from "@/lib/ops/flag-store";
import { resolveRecipients, type PageHumanInput } from "@/lib/ops/page-human";

// A Wednesday and a Monday (UTC) so the weekly-cadence branch is exercised.
const WEDNESDAY = new Date("2026-06-10T10:00:00Z"); // getUTCDay() === 3
const MONDAY = new Date("2026-06-08T10:00:00Z"); // getUTCDay() === 1

/** Scriptable in-memory readers — green by default; tests override fields. */
function makeReaders(overrides: Partial<ScriptedValues> = {}): {
  readers: FleetHealthReaders;
  values: ScriptedValues;
} {
  const values: ScriptedValues = {
    spendUsd: 50,
    capUsd: 1000,
    sentinelPaused: false,
    invalidGlobalCredentials: [],
    brokenWorkspaceIntegrations: 0,
    oldestSupportBacklogHours: 1,
    unsupportedVerticalSignups24h: 0,
    pastDueAgedWorkspaces: 0,
    pagesLast24h: 0,
    hoursSinceLastSuccess: 22,
    ...overrides,
  };
  const readers: FleetHealthReaders = {
    async llmSpend() {
      return { spendUsd: values.spendUsd, capUsd: values.capUsd };
    },
    async sentinelPaused() {
      return values.sentinelPaused;
    },
    async invalidGlobalCredentials() {
      return values.invalidGlobalCredentials;
    },
    async brokenWorkspaceIntegrations() {
      return values.brokenWorkspaceIntegrations;
    },
    async oldestSupportBacklogHours() {
      return values.oldestSupportBacklogHours;
    },
    async unsupportedVerticalSignups24h() {
      return values.unsupportedVerticalSignups24h;
    },
    async pastDueAgedWorkspaces() {
      return values.pastDueAgedWorkspaces;
    },
    async pagesLast24h() {
      return values.pagesLast24h;
    },
    async hoursSinceLastSuccess() {
      return values.hoursSinceLastSuccess;
    },
  };
  return { readers, values };
}

interface ScriptedValues {
  spendUsd: number;
  capUsd: number;
  sentinelPaused: boolean;
  invalidGlobalCredentials: string[];
  brokenWorkspaceIntegrations: number;
  oldestSupportBacklogHours: number;
  unsupportedVerticalSignups24h: number;
  pastDueAgedWorkspaces: number;
  pagesLast24h: number;
  hoursSinceLastSuccess: number | null;
}

function fakePager(opts: { deliver?: boolean } = {}) {
  const pages: PageHumanInput[] = [];
  const fn = async (input: PageHumanInput) => {
    pages.push(input);
    return {
      delivered: opts.deliver ?? true,
      recipients: ["ops@agentplain.com"],
      usedFallbackRecipient: false,
      persisted: true,
      auditLogId: "audit_1",
    };
  };
  return { pages, fn };
}

/** A throwing system-context so persistence is a no-op the test tolerates;
 *  the report still reflects digest decisions. For persistence-specific tests
 *  we pass the InMemoryOpsFlagStore + a capturing systemContext. */
const noopSystemContext = (async (fn: any) => {
  // Minimal fake tx that the persist path only calls .auditLog.create on.
  return fn({ auditLog: { create: async () => ({ id: "audit_x" }) } });
}) as any;

describe("runFleetHealthCheck — all green, weekday", () => {
  it("sends NO digest and advances the last-success flag", async () => {
    const { readers } = makeReaders();
    const flagStore = new InMemoryOpsFlagStore();
    const pager = fakePager();

    const report = await runFleetHealthCheck({
      readers,
      flagStore,
      page: pager.fn as any,
      systemContext: noopSystemContext,
      env: { FLEET_TRUSTED_HUMAN_EMAIL: "fleet@agentplain.com" } as unknown as NodeJS.ProcessEnv,
      now: WEDNESDAY,
    });

    assert.equal(report.snapshot.anyBreached, false);
    assert.equal(report.digestSent, false);
    assert.equal(report.digestKind, null);
    assert.equal(pager.pages.length, 0, "no page on an all-green weekday");
    // Self-monitoring: last-success advanced + latest snapshot mirrored.
    assert.equal(
      flagStore.peek(FLEET_HEALTH_LAST_SUCCESS_FLAG)?.value,
      WEDNESDAY.toISOString(),
    );
    assert.ok(flagStore.peek(FLEET_HEALTH_LATEST_FLAG)?.value, "latest snapshot mirrored");
    assert.equal(report.persisted, true);
  });
});

describe("runFleetHealthCheck — all green, Monday", () => {
  it("sends the weekly all-green confirmation digest", async () => {
    const { readers } = makeReaders();
    const flagStore = new InMemoryOpsFlagStore();
    const pager = fakePager();

    const report = await runFleetHealthCheck({
      readers,
      flagStore,
      page: pager.fn as any,
      systemContext: noopSystemContext,
      env: { FLEET_TRUSTED_HUMAN_EMAIL: "fleet@agentplain.com" } as unknown as NodeJS.ProcessEnv,
      now: MONDAY,
    });

    assert.equal(report.digestSent, true);
    assert.equal(report.digestKind, "weekly");
    assert.equal(pager.pages.length, 1);
    assert.equal(pager.pages[0].severity, "info");
    assert.match(pager.pages[0].summary, /all green/i);
  });
});

describe("runFleetHealthCheck — breach pages a human with recommended actions", () => {
  it("pages critical with a 24h deadline when a fleet-global key is dead", async () => {
    const { readers } = makeReaders({ invalidGlobalCredentials: ["STRIPE"] });
    const flagStore = new InMemoryOpsFlagStore();
    const pager = fakePager();

    const report = await runFleetHealthCheck({
      readers,
      flagStore,
      page: pager.fn as any,
      systemContext: noopSystemContext,
      env: { FLEET_TRUSTED_HUMAN_EMAIL: "fleet@agentplain.com" } as unknown as NodeJS.ProcessEnv,
      now: WEDNESDAY, // even on a weekday a breach pages
    });

    assert.equal(report.digestSent, true);
    assert.equal(report.digestKind, "breach");
    assert.equal(report.pageDelivered, true);
    const page = pager.pages[0];
    assert.equal(page.severity, "critical");
    assert.match(page.details, /ACTION:/);
    assert.match(page.details, /Vercel/);
    assert.equal(page.source, "fleet-health-check");
    assert.ok(page.deadline, "carries a deadline");
    assert.equal(page.deadline!.getTime() - WEDNESDAY.getTime(), 24 * 60 * 60 * 1000);
  });
});

describe("runFleetHealthCheck — unset trusted human → fallback + banner condition", () => {
  it("the page falls back to the operator allowlist (drives the banner)", async () => {
    const { readers } = makeReaders({ pastDueAgedWorkspaces: 3 });
    const flagStore = new InMemoryOpsFlagStore();
    // Use the REAL resolveRecipients + a pager that reports the resolution so
    // the fallback path (the banner condition) is exercised end-to-end.
    const env = {
      OPERATOR_EMAIL_ALLOWLIST: "conner@agentplain.com",
      // FLEET_TRUSTED_HUMAN_EMAIL intentionally unset
    } as unknown as NodeJS.ProcessEnv;

    const pages: PageHumanInput[] = [];
    const page = async (input: PageHumanInput) => {
      pages.push(input);
      const res = resolveRecipients(env);
      return {
        delivered: res.recipients.length > 0,
        recipients: res.recipients,
        usedFallbackRecipient: res.usedFallback,
        persisted: true,
        auditLogId: "audit_2",
      };
    };

    const report = await runFleetHealthCheck({
      readers,
      flagStore,
      page: page as any,
      systemContext: noopSystemContext,
      env,
      now: WEDNESDAY,
    });

    assert.equal(report.digestSent, true);
    assert.equal(report.pageDelivered, true);
    // The banner condition: no FLEET_TRUSTED_HUMAN_EMAIL → fell back to the
    // first operator allowlist entry.
    const res = resolveRecipients(env);
    assert.equal(res.usedFallback, true);
    assert.deepEqual(res.recipients, ["conner@agentplain.com"]);
  });
});

describe("runFleetHealthCheck — stale heartbeat notice", () => {
  it("a >48h gap since last success surfaces the stale banner in the digest", async () => {
    const { readers } = makeReaders({ hoursSinceLastSuccess: 72 });
    const flagStore = new InMemoryOpsFlagStore();
    const pager = fakePager();

    const report = await runFleetHealthCheck({
      readers,
      flagStore,
      page: pager.fn as any,
      systemContext: noopSystemContext,
      env: { FLEET_TRUSTED_HUMAN_EMAIL: "fleet@agentplain.com" } as unknown as NodeJS.ProcessEnv,
      now: WEDNESDAY,
    });

    assert.equal(report.snapshot.heartbeatWasStale, true);
    assert.equal(report.digestKind, "breach");
    assert.match(pager.pages[0].details, /HEARTBEAT ITSELF HAD STOPPED/);
  });
});

describe("runFleetHealthCheck — a single reader failing degrades only its metric", () => {
  it("does not crash the heartbeat when one reader throws", async () => {
    const { readers } = makeReaders();
    // Make one reader throw; the orchestrator should degrade it to the safe
    // default and still produce a snapshot.
    readers.pastDueAgedWorkspaces = async () => {
      throw new Error("db blip");
    };
    const flagStore = new InMemoryOpsFlagStore();
    const pager = fakePager();

    const report = await runFleetHealthCheck({
      readers,
      flagStore,
      page: pager.fn as any,
      systemContext: noopSystemContext,
      env: { FLEET_TRUSTED_HUMAN_EMAIL: "fleet@agentplain.com" } as unknown as NodeJS.ProcessEnv,
      now: WEDNESDAY,
    });

    // Snapshot still computed; the degraded metric defaulted to 0 (green).
    assert.ok(report.snapshot);
    const pastDue = report.snapshot.metrics.find((m) => m.id === "past_due_aged");
    assert.equal(pastDue?.value, 0);
    assert.equal(report.snapshot.anyBreached, false);
  });
});
