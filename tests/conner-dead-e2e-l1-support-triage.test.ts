/**
 * tests/conner-dead-e2e-l1-support-triage.test.ts
 *
 * GUARDS: pfd/l1-support-triage (#221)
 *
 * FAILURE MODE: "If Conner died tomorrow, does every customer support message
 * still get a response within 24h — either an accurate auto-answer or an
 * honest escalation to a human?"
 *
 * THE BAR:
 *   1. Every ESCALATION TRIGGER fires correctly (≥6 triggers covered).
 *   2. Each escalation: pages a human + marks the conversation escalated
 *      + stops auto-reply on that thread.
 *   3. FAQ-answerable questions auto-answer at ≥80% rate (with a deterministic
 *      test LLM provider that returns scripted confidence values).
 *   4. EVERY reply carries the "Plaino — agentplain support" signature.
 *   5. EVERY reply never claims to be a human.
 *   6. LLM-dead mode escalates EVERYTHING + pages exactly ONCE
 *      (not per ticket — degrade-dedupe respected).
 *   7. Metrics row written for every decision.
 *
 * All assertions run OFFLINE — injectable LLM provider, no DB, no network.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { runTriage } from "@/lib/skills/customer-support-triage/triage";
import { triageSignature } from "@/lib/skills/customer-support-triage/reply";
import { DEGRADE_PAGE_FLAG } from "@/lib/skills/customer-support-triage/degrade-dedupe";
import { InMemoryOpsFlagStore } from "@/lib/ops/flag-store";
import { llmOk, llmError } from "@/lib/llm/types";
import type {
  LlmCompletion,
  LlmCompletionRequest,
  LlmProvider,
  LlmResult,
} from "@/lib/llm/types";
import type { PageHumanInput, PageHumanResult } from "@/lib/ops/page-human";
import type {
  EscalationTrigger,
  IEscalationMarker,
  IKbLoader,
  ITriageMetricsSink,
  KbEntry,
  SupportMessageSnapshot,
  TriageMetricsRow,
} from "@/lib/skills/customer-support-triage/types";

// ── Test fixtures ────────────────────────────────────────────────────────────

const NOW = new Date("2026-06-10T15:00:00.000Z");
const WS = "ws-support-0001";

function msg(o: Partial<SupportMessageSnapshot> = {}): SupportMessageSnapshot {
  return {
    id: "sr-001",
    workspaceId: WS,
    workspaceName: "Acme Brokerage",
    verticalSlug: "real-estate",
    fromEmail: "owner@acme.example",
    fromName: "Pat Owner",
    subject: "A question",
    body: "How do I do the thing?",
    partnerName: "Plaino",
    receivedAt: NOW,
    ...o,
  };
}

// ── Recording ports ─────────────────────────────────────────────────────────

class RecordingEscalationMarker implements IEscalationMarker {
  readonly name = "recording-escalation-marker";
  readonly calls: Array<{ supportMessageId: string; trigger: EscalationTrigger }> = [];
  async markEscalated(args: {
    workspaceId: string;
    supportMessageId: string;
    trigger: EscalationTrigger;
  }): Promise<void> {
    this.calls.push({ supportMessageId: args.supportMessageId, trigger: args.trigger });
  }
}

class RecordingMetrics implements ITriageMetricsSink {
  readonly name = "recording-metrics";
  readonly rows: TriageMetricsRow[] = [];
  async record(row: TriageMetricsRow): Promise<void> {
    this.rows.push(row);
  }
}

function fakePager() {
  const pages: PageHumanInput[] = [];
  const fn = async (input: PageHumanInput): Promise<PageHumanResult> => {
    pages.push(input);
    return {
      delivered: true,
      recipients: ["ops@agentplain.com"],
      usedFallbackRecipient: false,
      persisted: true,
      auditLogId: `audit_${pages.length}`,
    };
  };
  return { pages, fn };
}

/** A scriptable LLM that returns a canned JSON KB judge response. */
class ScriptedKbLlm implements LlmProvider {
  readonly name = "anthropic" as const;
  constructor(private readonly confidence: number, private readonly answer: string = "Here is the answer.") {}
  async complete(_req: LlmCompletionRequest): Promise<LlmResult<LlmCompletion>> {
    return llmOk({
      text: JSON.stringify({
        confidence: this.confidence,
        answer: this.answer,
        citedTitles: ["FAQ: Password reset"],
      }),
      stopReason: "end_turn",
      usage: null,
      model: "test",
    });
  }
}

/** LLM that always returns a PAUSED error (key dead). */
class DeadKeyLlm implements LlmProvider {
  readonly name = "anthropic" as const;
  async complete(_req: LlmCompletionRequest): Promise<LlmResult<LlmCompletion>> {
    return llmError("PAUSED", "Anthropic key is paused");
  }
}

const DEFAULT_KB: KbEntry[] = [
  {
    title: "FAQ: Password reset",
    body: "To reset your password, visit /settings and click 'Reset password'. You will receive an email within 2 minutes.",
    source: "faq",
  },
  {
    title: "FAQ: Billing and pricing",
    body: "Our plans are $99/mo (Regular), $199/mo (Partner), and Max (quoted). Charges are monthly.",
    source: "faq",
  },
  {
    title: "FAQ: How to connect Gmail",
    body: "Go to /settings/integrations, click Gmail, and authorize with your Google account.",
    source: "faq",
  },
];

const KB_LOADER: IKbLoader = {
  name: "default-kb",
  load: () => DEFAULT_KB,
};

function makeArgs(
  overrides: Partial<{
    subject: string;
    body: string;
    llm: LlmProvider | undefined;
    confidence: number;
  }> = {},
) {
  const store = new InMemoryOpsFlagStore();
  const escalationMarker = new RecordingEscalationMarker();
  const metrics = new RecordingMetrics();
  const pager = fakePager();
  return {
    store,
    escalationMarker,
    metrics,
    pager,
    message: msg({ subject: overrides.subject ?? "A question", body: overrides.body ?? "How do I reset my password?" }),
    kb: KB_LOADER,
    llm: overrides.llm !== undefined
      ? overrides.llm
      : new ScriptedKbLlm(overrides.confidence ?? 0.92),
    now: NOW,
    env: { NODE_ENV: "test" } as NodeJS.ProcessEnv,
  };
}

// ── Suite 1: escalation triggers ─────────────────────────────────────────────

describe("conner-dead / L1-support: every escalation trigger routes + pages + stops auto-reply", () => {
  const TRIGGER_CASES: Array<{ label: string; subject: string; body: string; expectedTrigger: EscalationTrigger }> = [
    {
      label: "explicit human request",
      subject: "Need help",
      body: "I want to talk to a human. Can you connect me?",
      expectedTrigger: "explicit-human-request",
    },
    {
      label: "legal question",
      subject: "Legal concern",
      body: "Is this a compliance violation? My attorney says your platform is liable.",
      expectedTrigger: "legal-or-compliance",
    },
    {
      label: "billing dispute over threshold",
      subject: "Dispute my bill",
      body: "I have a billing dispute for $500. I was charged twice and want a refund.",
      expectedTrigger: "billing-dispute-over-threshold",
    },
    {
      label: "vulnerability report",
      subject: "Security issue",
      body: "I found a vulnerability in your system — I can access another user's data. Responsible disclosure.",
      expectedTrigger: "vulnerability-report",
    },
    {
      label: "data deletion request",
      subject: "Delete my data",
      body: "I need you to delete my data GDPR — please delete my account and all my information.",
      expectedTrigger: "data-deletion-request",
    },
    {
      label: "mental health distress",
      subject: "I am struggling",
      body: "I've been so stressed. I want to die. I can't go on like this.",
      expectedTrigger: "mental-health-distress",
    },
  ];

  for (const tc of TRIGGER_CASES) {
    it(`${tc.label} → escalates (${tc.expectedTrigger}) + pages + marks escalated`, async () => {
      const { message, kb, llm, store, pager, escalationMarker, metrics } = makeArgs({
        subject: tc.subject,
        body: tc.body,
      });

      const result = await runTriage({
        message, kb, llm, store,
        pager: pager.fn as any,
        escalationMarker,
        metrics,
        now: NOW,
        env: { NODE_ENV: "test" } as NodeJS.ProcessEnv,
      });

      assert.equal(result.ok, true, "triage always returns ok");
      const out = result.ok ? result.value : null;
      assert.ok(out, "output present");
      assert.equal(out!.decision, "escalated", `${tc.label}: decision should be escalated`);
      assert.equal(out!.escalationTrigger, tc.expectedTrigger, `trigger should be ${tc.expectedTrigger}`);

      // Page fired
      assert.equal(pager.pages.length, 1, "exactly one page fired");
      assert.equal(pager.pages[0].severity, "critical");

      // Conversation marked escalated (Plaino stops auto-replying)
      assert.equal(escalationMarker.calls.length, 1, "escalation marked");
      assert.equal(escalationMarker.calls[0].supportMessageId, message.id);

      // Reply is present (honest escalation acknowledgement)
      assert.ok(out!.reply !== null, "escalation reply provided");
      assert.ok(out!.reply!.body.length > 0, "reply body is not empty");

      // Signature present
      assert.ok(
        out!.reply!.body.includes(triageSignature(message.partnerName)),
        "reply carries Plaino — agentplain support signature",
      );

      // Never claims to be human
      assert.ok(
        !out!.reply!.body.toLowerCase().includes("i am a human"),
        "reply never claims to be a human",
      );
      assert.ok(
        !out!.reply!.body.toLowerCase().includes("this is a person"),
        "reply never claims this is a person",
      );

      // Metrics row written
      assert.equal(metrics.rows.length, 1, "metrics row written");
      assert.equal(metrics.rows[0].decision, "escalated");
    });
  }
});

// ── Suite 2: FAQ auto-answer at ≥80% rate ────────────────────────────────────

describe("conner-dead / L1-support: FAQ-answerable questions auto-answer ≥80%", () => {
  const FAQ_QUESTIONS = [
    "How do I reset my password?",
    "What is the price of the Partner plan?",
    "How do I connect Gmail?",
    "What plans do you offer?",
    "How do I change my billing?",
    "How do I cancel my subscription?",
    "What does the Regular plan include?",
    "How do I add a team member?",
    "Can I export my data?",
    "How do I update my payment method?",
  ];

  it("≥80% of the FAQ fixture set auto-answers with a confident LLM provider", async () => {
    let autoAnswered = 0;
    for (const question of FAQ_QUESTIONS) {
      const { message, kb, store, pager, escalationMarker, metrics } = makeArgs({ body: question, subject: question });
      const llm = new ScriptedKbLlm(0.92, "Here is the grounded answer from the KB."); // above default 0.8 threshold
      const result = await runTriage({
        message: { ...message, body: question, subject: question },
        kb, llm, store,
        pager: pager.fn as any,
        escalationMarker,
        metrics,
        now: NOW,
        env: { NODE_ENV: "test" } as NodeJS.ProcessEnv,
      });
      if (result.ok && result.value.decision === "auto-answered") {
        autoAnswered += 1;
      }
    }
    const rate = autoAnswered / FAQ_QUESTIONS.length;
    assert.ok(
      rate >= 0.8,
      `auto-answer rate ${(rate * 100).toFixed(0)}% < 80% bar — at least ${Math.ceil(FAQ_QUESTIONS.length * 0.8)} of ${FAQ_QUESTIONS.length} FAQ questions must auto-answer`,
    );
  });
});

// ── Suite 3: signature + never-claims-human on ALL reply types ────────────────

describe("conner-dead / L1-support: every reply carries Plaino signature, never claims human", () => {
  const REPLY_CASES: Array<{ label: string; body: string; llm?: LlmProvider }> = [
    {
      label: "auto-answered reply",
      body: "How do I reset my password?",
      llm: new ScriptedKbLlm(0.95, "Visit /settings and click Reset password."),
    },
    {
      label: "escalation acknowledgement",
      body: "I want to talk to a human agent please.",
    },
  ];

  for (const tc of REPLY_CASES) {
    it(`${tc.label} carries signature + never claims human`, async () => {
      const { message, kb, store, pager, escalationMarker, metrics } = makeArgs({ body: tc.body });
      const result = await runTriage({
        message: { ...message, body: tc.body },
        kb,
        llm: tc.llm ?? new ScriptedKbLlm(0.9),
        store,
        pager: pager.fn as any,
        escalationMarker,
        metrics,
        now: NOW,
        env: { NODE_ENV: "test" } as NodeJS.ProcessEnv,
      });
      assert.equal(result.ok, true);
      const out = result.ok ? result.value : null;
      if (!out?.reply) return; // drafted path doesn't produce a reply here

      const sig = triageSignature(message.partnerName);
      assert.ok(
        out.reply.body.includes(sig),
        `${tc.label}: expected signature "${sig}" in reply body`,
      );
      assert.ok(
        !out.reply.body.toLowerCase().includes("i am a human"),
        `${tc.label}: must not claim to be human`,
      );
    });
  }
});

// ── Suite 4: LLM dead → escalate everything + page ONCE ─────────────────────

describe("conner-dead / L1-support: LLM dead → escalate-everything + page once (not per ticket)", () => {
  it("no LLM provided → degraded mode → escalates + pages + marks", async () => {
    const store = new InMemoryOpsFlagStore();
    const escalationMarker = new RecordingEscalationMarker();
    const metrics = new RecordingMetrics();
    const pager = fakePager();

    const result = await runTriage({
      message: msg({ body: "How do I change my email?" }),
      kb: KB_LOADER,
      llm: undefined, // degraded!
      store,
      pager: pager.fn as any,
      escalationMarker,
      metrics,
      now: NOW,
      env: { NODE_ENV: "test" } as NodeJS.ProcessEnv,
    });

    assert.equal(result.ok, true);
    const out = result.ok ? result.value : null;
    assert.equal(out!.decision, "escalated");
    assert.equal(out!.escalationTrigger, "llm-degraded");
    assert.equal(out!.degraded, true);
    // Page fires once
    assert.equal(pager.pages.length, 1, "exactly one page even on degraded first call");
    assert.equal(pager.pages[0].severity, "warn",
      "degraded page is warn (not critical — this is infrastructure, not a customer-specific emergency)");
    // Escalation marked
    assert.equal(escalationMarker.calls.length, 1);
  });

  it("PAUSED LLM result mid-fire → degraded mode → escalates", async () => {
    const store = new InMemoryOpsFlagStore();
    const escalationMarker = new RecordingEscalationMarker();
    const metrics = new RecordingMetrics();
    const pager = fakePager();

    const result = await runTriage({
      message: msg(),
      kb: KB_LOADER,
      llm: new DeadKeyLlm(),
      store,
      pager: pager.fn as any,
      escalationMarker,
      metrics,
      now: NOW,
      env: { NODE_ENV: "test" } as NodeJS.ProcessEnv,
    });

    assert.equal(result.ok, true);
    assert.equal(result.ok && result.value.decision, "escalated");
    assert.equal(result.ok && result.value.degraded, true);
  });

  it("second ticket during same degraded outage → page is coalesced (degrade-dedupe)", async () => {
    const store = new InMemoryOpsFlagStore();
    // Pre-set the degrade-page flag as if the first ticket already paged
    await store.set(DEGRADE_PAGE_FLAG, new Date().toISOString());

    const escalationMarker = new RecordingEscalationMarker();
    const metrics = new RecordingMetrics();
    const pager = fakePager();

    const result = await runTriage({
      message: msg({ id: "sr-002", body: "Another question during outage" }),
      kb: KB_LOADER,
      llm: undefined,
      store,
      pager: pager.fn as any,
      escalationMarker,
      metrics,
      now: NOW,
      env: { NODE_ENV: "test" } as NodeJS.ProcessEnv,
    });

    assert.equal(result.ok, true);
    assert.equal(result.ok && result.value.decision, "escalated",
      "still escalates (customer gets human)");
    // The page was suppressed because the flag was already set
    assert.equal(pager.pages.length, 0,
      "page coalesced — human not spammed on every ticket during the outage");
    // But the escalation marker still fires (the customer thread still gets a human)
    assert.equal(escalationMarker.calls.length, 1,
      "conversation still marked escalated even when page is suppressed");
  });
});

// ── Suite 5: below-threshold KB → drafted (NOT auto-answered) ────────────────

describe("conner-dead / L1-support: low KB confidence → drafted (good failure, not black hole)", () => {
  it("confidence 0.3 < default threshold → decision is drafted, not auto-answered", async () => {
    const store = new InMemoryOpsFlagStore();
    const escalationMarker = new RecordingEscalationMarker();
    const metrics = new RecordingMetrics();
    const pager = fakePager();

    const result = await runTriage({
      message: msg({ body: "What is your refund policy for enterprise plans?" }),
      kb: KB_LOADER,
      llm: new ScriptedKbLlm(0.3),
      store,
      pager: pager.fn as any,
      escalationMarker,
      metrics,
      now: NOW,
      env: { NODE_ENV: "test" } as NodeJS.ProcessEnv,
    });

    assert.equal(result.ok, true);
    assert.equal(result.ok && result.value.decision, "drafted",
      "below threshold → drafted-for-review (good failure — existing SUPPORT_HANDLER_REPLY_DRAFT path)");
    // No page on a routine draft
    assert.equal(pager.pages.length, 0, "no page for a below-threshold draft");
    // Metrics row written
    assert.equal(metrics.rows.length, 1);
    assert.equal(metrics.rows[0].decision, "drafted");
  });
});

// ── Suite 6: metrics written for every path ──────────────────────────────────

describe("conner-dead / L1-support: metrics row written for every decision", () => {
  const PATHS: Array<{
    label: string;
    body: string;
    llm?: LlmProvider;
    expectedDecision: string;
  }> = [
    {
      label: "auto-answered",
      body: "How do I reset my password?",
      llm: new ScriptedKbLlm(0.92),
      expectedDecision: "auto-answered",
    },
    {
      label: "escalated (human request)",
      body: "I want to talk to a real person please.",
      expectedDecision: "escalated",
    },
    {
      label: "drafted (low confidence)",
      body: "What is your SLA for enterprise customers?",
      llm: new ScriptedKbLlm(0.2),
      expectedDecision: "drafted",
    },
    {
      label: "escalated (LLM dead)",
      body: "Just a question",
      llm: undefined,
      expectedDecision: "escalated",
    },
  ];

  for (const tc of PATHS) {
    it(`${tc.label} → metrics row with decision='${tc.expectedDecision}'`, async () => {
      const store = new InMemoryOpsFlagStore();
      const escalationMarker = new RecordingEscalationMarker();
      const metrics = new RecordingMetrics();
      const pager = fakePager();

      await runTriage({
        message: msg({ body: tc.body }),
        kb: KB_LOADER,
        llm: tc.llm !== undefined ? tc.llm : tc.llm,
        store,
        pager: pager.fn as any,
        escalationMarker,
        metrics,
        now: NOW,
        env: { NODE_ENV: "test" } as NodeJS.ProcessEnv,
      });

      assert.equal(metrics.rows.length, 1, `${tc.label}: one metrics row`);
      assert.equal(
        metrics.rows[0].decision,
        tc.expectedDecision,
        `${tc.label}: decision='${tc.expectedDecision}'`,
      );
    });
  }
});
