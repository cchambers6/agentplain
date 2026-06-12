/**
 * lib/ops/page-human.test.ts
 *
 * The single "page a human" seam. Bar: if Conner died tomorrow, this still
 * routes the alert to a designated human (or loudly says one isn't
 * configured) AND leaves a durable record even when the email channel is dead.
 */

import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import {
  pageHuman,
  resolveRecipients,
  NO_FALLBACK_HUMAN_NOTICE,
  HARDCODED_FALLBACK_NOTICE,
  FALLBACK_ACTIVITY_NOTICE,
  PAGE_HUMAN_AUDIT_ACTION,
} from "./page-human";
import { HARDCODED_ADMIN_FALLBACK_EMAIL } from "./admin-fallback";
import { TestEmailProvider } from "../email";

/** An in-memory `withSystemContext` stub that records the AuditLog rows the
 *  seam writes. Mirrors the tx surface page-human.ts actually touches. */
function recordingContext(): {
  run: <T>(fn: (tx: any) => Promise<T> | T) => Promise<T>;
  rows: any[];
} {
  const rows: any[] = [];
  let nextId = 1;
  const tx = {
    auditLog: {
      create: async ({ data, select }: { data: any; select?: any }) => {
        const row = { id: `audit_${nextId++}`, ...data };
        rows.push(row);
        return select ? { id: row.id } : row;
      },
    },
  };
  return {
    run: async (fn) => fn(tx),
    rows,
  };
}

/** A `withSystemContext` stub whose write always throws — exercises the
 *  persist-failure branch (email channel up, DB down). */
const throwingContext = async () => {
  throw new Error("DB unreachable");
};

const ENV_KEYS = [
  "FLEET_TRUSTED_HUMAN_EMAIL",
  "OPERATOR_EMAIL_ALLOWLIST",
  "ADMIN_FALLBACK_EMAIL",
];

describe("resolveRecipients", () => {
  it("uses FLEET_TRUSTED_HUMAN_EMAIL when set (no fallback)", () => {
    const r = resolveRecipients({
      FLEET_TRUSTED_HUMAN_EMAIL: "ops@agentplain.com, oncall@agentplain.com",
      OPERATOR_EMAIL_ALLOWLIST: "conner@example.com",
    } as unknown as NodeJS.ProcessEnv);
    assert.deepEqual(r.recipients, ["ops@agentplain.com", "oncall@agentplain.com"]);
    assert.equal(r.usedFallback, false);
  });

  it("falls back to the FIRST operator allowlist entry when trusted unset", () => {
    const r = resolveRecipients({
      OPERATOR_EMAIL_ALLOWLIST: "conner@example.com, second@example.com",
    } as unknown as NodeJS.ProcessEnv);
    assert.deepEqual(r.recipients, ["conner@example.com"]);
    assert.equal(r.usedFallback, true);
    assert.equal(r.usedHardcodedFallback, false);
    assert.equal(r.tier, "operator-fallback");
  });

  it("falls back to the baked-in last resort when BOTH are empty (never empty)", () => {
    const r = resolveRecipients({} as NodeJS.ProcessEnv);
    // FAIL_LOUD mode #1: a page must never resolve to nobody.
    assert.deepEqual(r.recipients, [HARDCODED_ADMIN_FALLBACK_EMAIL]);
    assert.equal(r.usedFallback, true);
    assert.equal(r.usedHardcodedFallback, true);
    assert.equal(r.tier, "hardcoded-fallback");
  });

  it("uses ADMIN_FALLBACK_EMAIL over the baked-in default when set", () => {
    const r = resolveRecipients({
      ADMIN_FALLBACK_EMAIL: "lastresort@agentplain.com",
    } as unknown as NodeJS.ProcessEnv);
    assert.deepEqual(r.recipients, ["lastresort@agentplain.com"]);
    assert.equal(r.usedHardcodedFallback, true);
    assert.equal(r.tier, "hardcoded-fallback");
  });
});

describe("pageHuman", () => {
  const saved: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const k of ENV_KEYS) {
      saved[k] = process.env[k];
      delete process.env[k];
    }
  });

  afterEach(() => {
    for (const k of ENV_KEYS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  });

  it("sends to the designated trusted human and persists the page", async () => {
    process.env.FLEET_TRUSTED_HUMAN_EMAIL = "ops@agentplain.com";
    const email = new TestEmailProvider();
    const ctx = recordingContext();

    const result = await pageHuman(
      {
        severity: "critical",
        summary: "Anthropic primary key dead",
        details: "Primary 401; secondary missing.",
        deadline: new Date("2026-06-11T00:00:00Z"),
        source: "llm-key-rotation",
      },
      { email, systemContext: ctx.run as any },
    );

    assert.equal(result.delivered, true);
    assert.deepEqual(result.recipients, ["ops@agentplain.com"]);
    assert.equal(result.usedFallbackRecipient, false);
    assert.equal(result.persisted, true);
    assert.equal(result.auditLogId, "audit_1");

    assert.equal(email.sent.length, 1);
    assert.equal(email.sent[0].to, "ops@agentplain.com");
    assert.match(email.sent[0].subject, /CRITICAL/);
    assert.match(email.sent[0].subject, /Anthropic primary key dead/);
    // Deadline must surface in the body (24h restore bar).
    assert.match(email.sent[0].text, /2026-06-11T00:00:00.000Z/);
    // No fallback nudge when a trusted human IS configured.
    assert.equal(email.sent[0].text.includes(NO_FALLBACK_HUMAN_NOTICE), false);

    assert.equal(ctx.rows.length, 1);
    assert.equal(ctx.rows[0].action, PAGE_HUMAN_AUDIT_ACTION);
    assert.equal(ctx.rows[0].payload.severity, "critical");
    assert.equal(ctx.rows[0].payload.emailDelivered, true);
  });

  it("falls back to the operator and includes the loud nudge when no trusted human", async () => {
    process.env.OPERATOR_EMAIL_ALLOWLIST = "conner@example.com";
    const email = new TestEmailProvider();
    const ctx = recordingContext();

    const result = await pageHuman(
      {
        severity: "critical",
        summary: "Stripe key invalid",
        details: "Stripe returned 401 on balance read.",
        source: "credential-test-cron",
      },
      { email, systemContext: ctx.run as any },
    );

    assert.equal(result.delivered, true);
    assert.deepEqual(result.recipients, ["conner@example.com"]);
    assert.equal(result.usedFallbackRecipient, true);
    // The loud nudge appears in the email body, not silently dropped.
    assert.ok(email.sent[0].text.includes(NO_FALLBACK_HUMAN_NOTICE));
    assert.equal(ctx.rows[0].payload.usedFallbackRecipient, true);
  });

  it("routes to the baked-in last resort + shouts when NO operator routing is configured", async () => {
    // Both vars empty — before remediation this paged NOBODY. Now it must
    // reach the baked-in last-resort inbox AND shout that routing is missing.
    const email = new TestEmailProvider();
    const ctx = recordingContext();

    const result = await pageHuman(
      {
        severity: "critical",
        summary: "Resend key dead",
        details: "Resend invalid_api_key.",
        source: "credential-test-cron",
      },
      { email, systemContext: ctx.run as any },
    );

    // FAIL_LOUD mode #1: the page reached a real inbox, not the void.
    assert.equal(result.delivered, true);
    assert.deepEqual(result.recipients, [HARDCODED_ADMIN_FALLBACK_EMAIL]);
    assert.equal(result.usedHardcodedFallback, true);
    assert.equal(result.recipientTier, "hardcoded-fallback");
    assert.equal(email.sent.length, 1);
    assert.equal(email.sent[0].to, HARDCODED_ADMIN_FALLBACK_EMAIL);
    // The loudest fallback notice (not the gentler operator nudge) is in the body.
    assert.ok(email.sent[0].text.includes(HARDCODED_FALLBACK_NOTICE));
    assert.equal(email.sent[0].text.includes(NO_FALLBACK_HUMAN_NOTICE), false);
    // The page is recorded with the honest fleet-activity status line.
    assert.equal(result.persisted, true);
    assert.equal(ctx.rows.length, 1);
    assert.equal(ctx.rows[0].action, PAGE_HUMAN_AUDIT_ACTION);
    assert.equal(ctx.rows[0].payload.emailDelivered, true);
    assert.equal(ctx.rows[0].payload.usedHardcodedFallback, true);
    assert.equal(ctx.rows[0].payload.recipientTier, "hardcoded-fallback");
    assert.equal(ctx.rows[0].payload.activityNotice, FALLBACK_ACTIVITY_NOTICE);
  });

  it("ADMIN_FALLBACK_EMAIL overrides the baked-in default for the last resort", async () => {
    process.env.ADMIN_FALLBACK_EMAIL = "lastresort@agentplain.com";
    const email = new TestEmailProvider();
    const ctx = recordingContext();

    const result = await pageHuman(
      { severity: "critical", summary: "key dead", details: "d", source: "s" },
      { email, systemContext: ctx.run as any },
    );

    assert.equal(result.delivered, true);
    assert.deepEqual(result.recipients, ["lastresort@agentplain.com"]);
    assert.equal(result.usedHardcodedFallback, true);
  });

  it("never throws when the email send fails — records the page + the error", async () => {
    process.env.FLEET_TRUSTED_HUMAN_EMAIL = "ops@agentplain.com";
    const throwingEmail = {
      providerName: "test-throwing",
      send: async () => {
        throw new Error("Resend 500");
      },
    };
    const ctx = recordingContext();

    const result = await pageHuman(
      {
        severity: "warn",
        summary: "Buildium degraded",
        details: "transient",
        source: "credential-test-cron",
      },
      { email: throwingEmail as any, systemContext: ctx.run as any },
    );

    assert.equal(result.delivered, false);
    assert.match(result.emailError ?? "", /Resend 500/);
    // Email failed but the page row still lands.
    assert.equal(result.persisted, true);
  });

  it("never throws when the DB persist fails — still reports the send outcome", async () => {
    process.env.FLEET_TRUSTED_HUMAN_EMAIL = "ops@agentplain.com";
    const email = new TestEmailProvider();

    const result = await pageHuman(
      {
        severity: "critical",
        summary: "key dead",
        details: "details",
        source: "llm-key-rotation",
      },
      { email, systemContext: throwingContext as any },
    );

    // Email went out even though the DB write failed.
    assert.equal(result.delivered, true);
    assert.equal(result.persisted, false);
    assert.match(result.persistError ?? "", /DB unreachable/);
  });
});
