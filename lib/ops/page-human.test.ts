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
  PAGE_HUMAN_AUDIT_ACTION,
} from "./page-human";
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

const ENV_KEYS = ["FLEET_TRUSTED_HUMAN_EMAIL", "OPERATOR_EMAIL_ALLOWLIST"];

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
  });

  it("resolves nothing when both are empty", () => {
    const r = resolveRecipients({} as NodeJS.ProcessEnv);
    assert.deepEqual(r.recipients, []);
    assert.equal(r.usedFallback, false);
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

  it("persists the page even when NO recipient resolves (loud-fail artifact)", async () => {
    // Both vars empty — the email cannot be addressed at all.
    const email = new TestEmailProvider();
    const ctx = recordingContext();

    const result = await pageHuman(
      {
        severity: "critical",
        summary: "Resend key dead",
        details: "Resend invalid_api_key — paging by email is impossible.",
        source: "credential-test-cron",
      },
      { email, systemContext: ctx.run as any },
    );

    assert.equal(result.delivered, false);
    assert.deepEqual(result.recipients, []);
    // The page is STILL recorded — the only artifact when email is dead.
    assert.equal(result.persisted, true);
    assert.equal(ctx.rows.length, 1);
    assert.equal(ctx.rows[0].action, PAGE_HUMAN_AUDIT_ACTION);
    assert.equal(ctx.rows[0].payload.emailDelivered, false);
    assert.equal(email.sent.length, 0);
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
