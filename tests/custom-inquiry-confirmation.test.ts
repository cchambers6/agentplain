// Verifies the customer-confirmation email leg added to submitCustomInquiry:
//   * On a successful submit, a confirmation goes to the submitter's address
//     with the right subject + tags + type-aware SLA copy.
//   * If the confirmation send fails, the submit STILL returns ok and the
//     operator-notification + persist legs are unaffected.
//   * The failure audit + log breadcrumbs carry NO PII — only address hash,
//     address length, error name, and the inquiry id.
//
// The unit takes injected deps (systemContext, email, logger) so it runs
// without Postgres or Resend.

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  submitCustomInquiry,
  type SystemContextRunner,
} from "@/lib/custom-inquiry";
import type { EmailProvider, SendEmailRequest, SendEmailResult } from "@/lib/email";
import type { Logger, LogContext } from "@/lib/observability/logger";

// ── Fakes ────────────────────────────────────────────────────────────────

interface FakeInquiryRow {
  id: string;
  emailMessageId: string | null;
}
interface FakeAuditRow {
  action: string;
  targetTable: string | null;
  targetId: string | null;
  payload: Record<string, unknown>;
}

interface FakeState {
  nextInquiryId: number;
  inquiries: FakeInquiryRow[];
  audits: FakeAuditRow[];
}

function freshState(): FakeState {
  return { nextInquiryId: 1, inquiries: [], audits: [] };
}

function buildFakeTx(state: FakeState) {
  return {
    inquiry: {
      create: async ({ select: _select }: { select?: unknown }) => {
        const id = `inq_${state.nextInquiryId++}`;
        state.inquiries.push({ id, emailMessageId: null });
        return { id };
      },
      update: async ({
        where,
        data,
      }: {
        where: { id: string };
        data: { emailMessageId?: string | null };
      }) => {
        const row = state.inquiries.find((r) => r.id === where.id);
        if (row && data.emailMessageId !== undefined) {
          row.emailMessageId = data.emailMessageId;
        }
      },
    },
    auditLog: {
      create: async ({ data }: { data: FakeAuditRow }) => {
        state.audits.push(data);
      },
    },
  };
}

function makeSystemContext(state: FakeState): SystemContextRunner {
  return async (fn) =>
    fn(buildFakeTx(state) as unknown as Parameters<typeof fn>[0]);
}

// Email provider that lets each call decide whether to succeed or throw.
// Default behavior: succeed. The behavior array shifts per call.
class ScriptedEmailProvider implements EmailProvider {
  readonly providerName = "scripted";
  readonly sent: SendEmailRequest[] = [];
  private callIndex = 0;
  // Each entry: a function returning a result or throwing.
  constructor(
    private readonly behaviors: ReadonlyArray<
      (req: SendEmailRequest) => Promise<SendEmailResult>
    > = [],
  ) {}

  async send(req: SendEmailRequest): Promise<SendEmailResult> {
    this.sent.push(req);
    const behavior = this.behaviors[this.callIndex];
    this.callIndex += 1;
    if (behavior) return behavior(req);
    return { messageId: `email_default_${this.callIndex}` };
  }
}

interface LoggedRecord {
  level: "debug" | "info" | "warn" | "error";
  msg: string;
  ctx?: LogContext;
}

function makeRecordingLogger(records: LoggedRecord[]): Logger {
  const push = (
    level: LoggedRecord["level"],
    msg: string,
    ctx?: LogContext,
  ) => {
    records.push({ level, msg, ctx });
  };
  const self: Logger = {
    debug: (msg, ctx) => push("debug", msg, ctx),
    info: (msg, ctx) => push("info", msg, ctx),
    warn: (msg, ctx) => push("warn", msg, ctx),
    error: (msg, errOrCtx, ctx) => {
      const merged: LogContext = {};
      if (errOrCtx instanceof Error) {
        merged.error_name = errOrCtx.name;
        merged.error_message = errOrCtx.message;
      } else if (typeof errOrCtx === "object" && errOrCtx) {
        Object.assign(merged, errOrCtx as LogContext);
      }
      if (ctx) Object.assign(merged, ctx);
      push("error", msg, merged);
    },
    child: () => self,
  };
  return self;
}

// ── Fixtures ─────────────────────────────────────────────────────────────

const baseInput = {
  name: "Pat Operator",
  business: "Pat & Sons Plumbing",
  vertical: "home-services" as const,
  seats: "3",
  needs:
    "We need help with our intake workflow — calls come in fast and tickets get lost between dispatch and the techs.",
  email: "pat@example.test",
  inquiryType: "custom_skill_build" as const,
};

const maxInput = {
  ...baseInput,
  inquiryType: "max_service_engagement" as const,
  serviceIntensityNotes:
    "Multi-state plumbing across GA + AL + TN with white-label requirement for our franchise partners.",
};

// ── Tests ────────────────────────────────────────────────────────────────

describe("submitCustomInquiry · confirmation email", () => {
  let state: FakeState;
  let logs: LoggedRecord[];

  beforeEach(() => {
    state = freshState();
    logs = [];
  });

  it("sends a confirmation to the submitter on success with type-aware copy", async () => {
    const email = new ScriptedEmailProvider();
    const result = await submitCustomInquiry(baseInput, {
      systemContext: makeSystemContext(state),
      email,
      logger: makeRecordingLogger(logs),
    });

    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.inquiryId, "inq_1");

    // Two sends: [0] operator notification, [1] customer confirmation.
    assert.equal(email.sent.length, 2);
    const confirmation = email.sent[1];
    assert.equal(confirmation.to, baseInput.email);
    assert.ok(
      confirmation.subject.includes("agentplain"),
      `subject was: ${confirmation.subject}`,
    );
    assert.equal(
      confirmation.tags?.surface,
      "custom-inquiry-confirmation",
    );
    assert.equal(confirmation.tags?.inquiry_type, "custom_skill_build");
    // Type-aware SLA copy: Custom/Not-sure path → two business days.
    assert.ok(
      confirmation.text.includes("two business days"),
      "expected two-business-day SLA in custom-path confirmation",
    );
    // Service-partnership framing — agent + plains, Plaino, no DIY.
    assert.ok(confirmation.text.includes("Plaino"));
    assert.ok(!/\bDIY\b/.test(confirmation.text));
    // Banned framings: airplane wordplay, self-serve.
    assert.ok(!/takeoff|runway|liftoff|altitude/i.test(confirmation.text));
    assert.ok(!/self[- ]serve/i.test(confirmation.text));
    // No internal language.
    assert.ok(!/\bV0\b|\bpilot\b/.test(confirmation.text));
  });

  it("uses the one-business-day SLA copy for Max-tier inquiries", async () => {
    const email = new ScriptedEmailProvider();
    const result = await submitCustomInquiry(maxInput, {
      systemContext: makeSystemContext(state),
      email,
      logger: makeRecordingLogger(logs),
    });
    assert.equal(result.ok, true);
    const confirmation = email.sent[1];
    assert.equal(confirmation.tags?.inquiry_type, "max_service_engagement");
    assert.ok(
      confirmation.text.includes("one business day"),
      "expected one-business-day SLA in max-path confirmation",
    );
  });

  it("confirmation failure does NOT break the submit (returns ok, persists, operator notification still recorded)", async () => {
    // First send (operator) succeeds; second send (confirmation) throws.
    const email = new ScriptedEmailProvider([
      async () => ({ messageId: "re_operator" }),
      async () => {
        const err = new Error("Resend send failed: simulated 503");
        err.name = "ResendError";
        throw err;
      },
    ]);
    const result = await submitCustomInquiry(baseInput, {
      systemContext: makeSystemContext(state),
      email,
      logger: makeRecordingLogger(logs),
    });

    assert.equal(result.ok, true, "submit must succeed despite confirm fail");
    if (!result.ok) return;
    assert.equal(result.inquiryId, "inq_1");
    // Operator notification id propagated unchanged.
    assert.equal(result.messageId, "re_operator");
    // Both sends were attempted.
    assert.equal(email.sent.length, 2);
    assert.equal(email.sent[1].to, baseInput.email);

    // Audit row written for the confirmation failure — PII-scrubbed.
    const audit = state.audits.find(
      (a) => a.action === "inquiry.confirmation_email_send_failed",
    );
    assert.ok(audit, "expected confirmation-failure audit entry");
    const payload = audit!.payload;
    assert.equal(payload.error_name, "ResendError");
    assert.equal(typeof payload.address_hash, "string");
    assert.ok((payload.address_hash as string).length > 0);
    // PII safety: no submitter address, no error message text, no needs body.
    assert.ok(!JSON.stringify(payload).includes(baseInput.email));
    assert.ok(!JSON.stringify(payload).includes("simulated 503"));
    assert.ok(!JSON.stringify(payload).includes(baseInput.needs));
    assert.equal(payload.address_length, baseInput.email.length);

    // Log breadcrumb is the same shape — no PII.
    const warning = logs.find(
      (l) =>
        l.level === "warn" && l.msg.includes("confirmation send failed"),
    );
    assert.ok(warning, "expected warn log for confirmation failure");
    const ctxString = JSON.stringify(warning!.ctx ?? {});
    assert.ok(!ctxString.includes(baseInput.email));
    assert.ok(!ctxString.includes("simulated 503"));
    assert.equal(warning!.ctx?.inquiry_id, "inq_1");
    assert.equal(warning!.ctx?.error_name, "ResendError");
  });

  it("operator-notification failure does not stop the confirmation send", async () => {
    // First send (operator) throws; second (confirmation) succeeds.
    const email = new ScriptedEmailProvider([
      async () => {
        throw new Error("Resend send failed: operator leg down");
      },
      async () => ({ messageId: "re_confirm" }),
    ]);
    const result = await submitCustomInquiry(baseInput, {
      systemContext: makeSystemContext(state),
      email,
      logger: makeRecordingLogger(logs),
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    // The operator notification leg failed; its message id is null.
    assert.equal(result.messageId, null);
    assert.equal(email.sent.length, 2);
    // Confirmation still went to the submitter.
    assert.equal(email.sent[1].to, baseInput.email);
    // Both audit rows present.
    const actions = state.audits.map((a) => a.action).sort();
    assert.deepEqual(actions, ["inquiry.email_send_failed"]);
  });
});
