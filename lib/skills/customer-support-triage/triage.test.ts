/**
 * lib/skills/customer-support-triage/triage.test.ts
 *
 * Pins the Pillar-3 acceptance bar: if Conner died tomorrow, no support
 * message hits a black hole. Each test asserts one leg of that promise:
 *   - each escalation trigger routes + pages + stops auto-reply (marks)
 *   - sub-threshold KB confidence → draft (NOT auto-answered)
 *   - above-threshold KB confidence → auto-answer, signed by Plaino
 *   - bounded action respects autonomy-off (→ draft)
 *   - bounded action auto-resolves when autonomy on
 *   - LLM-dead → degrade pages ONCE (not per ticket) + escalates
 *   - signature present + never claims human on every reply
 *   - metrics row written for every decision
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { runTriage } from './triage';
import { triageSignature } from './reply';
import { DEGRADE_PAGE_FLAG } from './degrade-dedupe';
import {
  autoExecEnabledFlagName,
  autoExecCeilingFlagName,
  BOUNDED_AUTO_EXECUTE_MASTER_ENV,
} from '../bounded-execute';
import { BOUNDED_ACTION_KIND } from './types';
import { InMemoryOpsFlagStore } from '../../ops/flag-store';
import { llmOk, llmError } from '../../llm/types';
import type {
  LlmCompletion,
  LlmCompletionRequest,
  LlmProvider,
  LlmResult,
} from '../../llm/types';
import type { PageHumanInput, PageHumanResult } from '../../ops/page-human';
import type {
  EscalationTrigger,
  IEscalationMarker,
  IKbLoader,
  ITriageMetricsSink,
  KbEntry,
  SupportMessageSnapshot,
  TriageMetricsRow,
} from './types';

const NOW = new Date('2026-06-10T15:00:00.000Z');
const WS = 'ws-triage-0001';

/** Build a typed env snapshot for the tunable constants without dragging
 *  the full ambient ProcessEnv (NODE_ENV etc.) into every literal. */
function testEnv(vars: Record<string, string> = {}): NodeJS.ProcessEnv {
  return { NODE_ENV: 'test', ...vars } as NodeJS.ProcessEnv;
}

function makeMessage(
  o: Partial<SupportMessageSnapshot> = {},
): SupportMessageSnapshot {
  return {
    id: 'sr-1',
    workspaceId: WS,
    workspaceName: 'Acme Brokerage',
    verticalSlug: 'real-estate',
    fromEmail: 'owner@acme.example',
    fromName: 'Jamie Owner',
    subject: 'A question',
    body: 'How do I do the thing?',
    partnerName: 'Plaino',
    receivedAt: NOW,
    ...o,
  };
}

// ── Recording ports ─────────────────────────────────────────────────────

class RecordingKb implements IKbLoader {
  readonly name = 'recording-kb';
  constructor(private readonly entries: KbEntry[] = DEFAULT_KB) {}
  load(): KbEntry[] {
    return this.entries;
  }
}

const DEFAULT_KB: KbEntry[] = [
  { title: 'How do I connect a tool?', body: 'Use /integrations.', source: 'faq' },
  { title: 'How does pricing work?', body: 'Three tiers, month to month.', source: 'faq-pricing' },
];

class RecordingMetrics implements ITriageMetricsSink {
  readonly name = 'recording-metrics';
  rows: TriageMetricsRow[] = [];
  async record(row: TriageMetricsRow): Promise<void> {
    this.rows.push(row);
  }
}

class RecordingMarker implements IEscalationMarker {
  readonly name = 'recording-marker';
  calls: Array<{ id: string; trigger: EscalationTrigger }> = [];
  async markEscalated(a: {
    workspaceId: string;
    supportMessageId: string;
    trigger: EscalationTrigger;
  }): Promise<void> {
    this.calls.push({ id: a.supportMessageId, trigger: a.trigger });
  }
}

function recordingPager() {
  const pages: PageHumanInput[] = [];
  const pager = async (input: PageHumanInput): Promise<PageHumanResult> => {
    pages.push(input);
    return {
      delivered: true,
      recipients: ['ops@agentplain.example'],
      usedFallbackRecipient: false,
      persisted: true,
      auditLogId: 'audit-1',
    };
  };
  return { pager, pages };
}

/** LLM that returns a fixed KB-judge JSON. */
function judgeLlm(confidence: number, answer = 'Use the /integrations page.'): LlmProvider {
  return {
    name: 'test',
    async complete(_req: LlmCompletionRequest): Promise<LlmResult<LlmCompletion>> {
      return llmOk({
        text: JSON.stringify({
          confidence,
          answer,
          citedTitles: ['How do I connect a tool?'],
        }),
        stopReason: 'end_turn',
        usage: null,
        model: 'test',
      });
    },
  };
}

/** LLM that returns a PAUSED error (the dead-key / paused sentinel). */
function pausedLlm(): LlmProvider {
  return {
    name: 'paused',
    async complete(): Promise<LlmResult<LlmCompletion>> {
      return llmError('PAUSED', 'key is the paused sentinel');
    },
  };
}

function baseDeps(overrides: {
  kb?: IKbLoader;
  llm?: LlmProvider | undefined;
  store?: InMemoryOpsFlagStore;
  env?: NodeJS.ProcessEnv;
} = {}) {
  const metrics = new RecordingMetrics();
  const marker = new RecordingMarker();
  const { pager, pages } = recordingPager();
  return {
    metrics,
    marker,
    pager,
    pages,
    kb: overrides.kb ?? new RecordingKb(),
    store: overrides.store ?? new InMemoryOpsFlagStore(),
    llm: 'llm' in overrides ? overrides.llm : judgeLlm(0.95),
    env: overrides.env ?? testEnv(),
  };
}

// ── Escalation triggers ─────────────────────────────────────────────────

const ESCALATION_CASES: Array<{
  name: string;
  body: string;
  trigger: EscalationTrigger;
  subject?: string;
}> = [
  {
    name: 'explicit human request',
    body: 'Please let me talk to a human about my account.',
    trigger: 'explicit-human-request',
  },
  {
    name: 'legal / compliance',
    body: 'Is this a fair housing violation? My lawyer wants to know.',
    trigger: 'legal-or-compliance',
  },
  {
    name: 'billing dispute over $200',
    body: 'You overcharged me $450 last month and I want it refunded.',
    trigger: 'billing-dispute-over-threshold',
  },
  {
    name: 'vulnerability report',
    body: 'I think I found a security vulnerability — I can see another workspace.',
    trigger: 'vulnerability-report',
  },
  {
    name: 'mental-health distress',
    body: 'I feel like I want to die and nothing is working.',
    trigger: 'mental-health-distress',
  },
  {
    name: 'data-deletion request',
    body: 'Please delete my account and erase my data under GDPR.',
    trigger: 'data-deletion-request',
  },
];

describe('runTriage — escalate-first', () => {
  for (const c of ESCALATION_CASES) {
    it(`escalates + pages + marks for: ${c.name}`, async () => {
      const d = baseDeps();
      const res = await runTriage({
        message: makeMessage({ subject: c.subject ?? 'help', body: c.body }),
        kb: d.kb,
        llm: d.llm,
        store: d.store,
        pager: d.pager,
        escalationMarker: d.marker,
        metrics: d.metrics,
        env: d.env,
        now: NOW,
      });
      assert.ok(res.ok);
      assert.equal(res.value.decision, 'escalated');
      assert.equal(res.value.escalationTrigger, c.trigger);
      // paged a human with a deadline
      assert.equal(d.pages.length, 1);
      assert.ok(d.pages[0].deadline instanceof Date);
      assert.equal(d.pages[0].severity, 'critical');
      // marked escalated so Plaino stops auto-replying
      assert.equal(d.marker.calls.length, 1);
      assert.equal(d.marker.calls[0].trigger, c.trigger);
      // honest customer reply, signed, never claims human
      assert.ok(res.value.reply);
      assert.match(res.value.reply!.body, /human teammate/);
      assert.ok(res.value.reply!.body.includes(triageSignature('Plaino')));
      // metrics row
      assert.equal(d.metrics.rows.length, 1);
      assert.equal(d.metrics.rows[0].decision, 'escalated');
    });
  }

  it('escalate-first runs BEFORE auto-answer (even with a confident KB)', async () => {
    // High KB confidence, but the body is a legal question → must escalate.
    const d = baseDeps({ llm: judgeLlm(0.99) });
    const res = await runTriage({
      message: makeMessage({
        body: 'Is this legal? I want to talk to your founder.',
      }),
      kb: d.kb,
      llm: d.llm,
      store: d.store,
      pager: d.pager,
      escalationMarker: d.marker,
      metrics: d.metrics,
      now: NOW,
    });
    assert.ok(res.ok);
    assert.equal(res.value.decision, 'escalated');
    assert.equal(d.pages.length, 1);
  });

  it('a small billing question does NOT escalate (sub-threshold)', async () => {
    const d = baseDeps({ llm: judgeLlm(0.2) });
    const res = await runTriage({
      message: makeMessage({ body: 'Can I get a $20 refund on my last invoice?' }),
      kb: d.kb,
      llm: d.llm,
      store: d.store,
      pager: d.pager,
      escalationMarker: d.marker,
      metrics: d.metrics,
      now: NOW,
    });
    assert.ok(res.ok);
    assert.notEqual(res.value.decision, 'escalated');
    assert.equal(d.pages.length, 0);
  });
});

// ── KB confidence routing ───────────────────────────────────────────────

describe('runTriage — KB auto-answer threshold', () => {
  it('above threshold → auto-answered + signed reply', async () => {
    const d = baseDeps({ llm: judgeLlm(0.95) });
    const res = await runTriage({
      message: makeMessage({ body: 'How do I connect Gmail?' }),
      kb: d.kb,
      llm: d.llm,
      store: d.store,
      pager: d.pager,
      escalationMarker: d.marker,
      metrics: d.metrics,
      now: NOW,
    });
    assert.ok(res.ok);
    assert.equal(res.value.decision, 'auto-answered');
    assert.ok(res.value.reply);
    assert.ok(res.value.reply!.body.includes(triageSignature('Plaino')));
    // never claims to be human / to have taken an action
    assert.doesNotMatch(res.value.reply!.body, /I am a human|I just (sent|reset|did)/i);
    assert.equal(d.pages.length, 0);
    assert.equal(d.metrics.rows[0].decision, 'auto-answered');
    assert.ok((d.metrics.rows[0].confidence ?? 0) >= 0.8);
  });

  it('below threshold → drafted (NOT auto-answered, NOT a fabricated send)', async () => {
    const d = baseDeps({ llm: judgeLlm(0.4) });
    const res = await runTriage({
      message: makeMessage({ body: 'Some very niche question.' }),
      kb: d.kb,
      llm: d.llm,
      store: d.store,
      pager: d.pager,
      escalationMarker: d.marker,
      metrics: d.metrics,
      now: NOW,
    });
    assert.ok(res.ok);
    assert.equal(res.value.decision, 'drafted');
    assert.equal(res.value.reply, null); // the draft path owns the reply
    assert.equal(d.metrics.rows[0].decision, 'drafted');
  });

  it('threshold is env-tunable (raise it → a 0.85 answer drafts instead)', async () => {
    const d = baseDeps({
      llm: judgeLlm(0.85),
      env: testEnv({ SUPPORT_TRIAGE_KB_CONFIDENCE_THRESHOLD: '0.9' }),
    });
    const res = await runTriage({
      message: makeMessage({ body: 'How do I connect a tool?' }),
      kb: d.kb,
      llm: d.llm,
      store: d.store,
      pager: d.pager,
      escalationMarker: d.marker,
      metrics: d.metrics,
      env: d.env,
      now: NOW,
    });
    assert.ok(res.ok);
    assert.equal(res.value.decision, 'drafted');
  });
});

// ── Bounded auto-resolve + autonomy ─────────────────────────────────────

describe('runTriage — bounded auto-resolve respects autonomy', () => {
  const RECONNECT_BODY =
    'My Gmail integration disconnected — can you reconnect the integration?';

  it('autonomy OFF (no flags) → drafted, even with the master on', async () => {
    const store = new InMemoryOpsFlagStore();
    const d = baseDeps({ store, llm: judgeLlm(0.2), env: testEnv({ SUPPORT_TRIAGE_AUTO_RESOLVE_MASTER: 'on', [BOUNDED_AUTO_EXECUTE_MASTER_ENV]: 'on' }) });
    const res = await runTriage({
      message: makeMessage({ body: RECONNECT_BODY }),
      kb: d.kb,
      llm: d.llm,
      store,
      pager: d.pager,
      escalationMarker: d.marker,
      metrics: d.metrics,
      env: d.env,
      gates: { fireGatePassed: true, billingActive: true },
      now: NOW,
    });
    assert.ok(res.ok);
    // bounded-execute denies (class not enabled) → falls through to draft
    assert.equal(res.value.decision, 'drafted');
  });

  it('autonomy ON for the class → auto-resolved', async () => {
    const kind = BOUNDED_ACTION_KIND['reconnect-integration-prompt'];
    const store = new InMemoryOpsFlagStore({
      [autoExecEnabledFlagName(kind, WS)]: 'true',
      [autoExecCeilingFlagName(kind, WS)]: '5',
    });
    const d = baseDeps({
      store,
      llm: judgeLlm(0.2),
      env: testEnv({ SUPPORT_TRIAGE_AUTO_RESOLVE_MASTER: 'on', [BOUNDED_AUTO_EXECUTE_MASTER_ENV]: 'on' }),
    });
    const res = await runTriage({
      message: makeMessage({ body: RECONNECT_BODY }),
      kb: d.kb,
      llm: d.llm,
      store,
      pager: d.pager,
      escalationMarker: d.marker,
      metrics: d.metrics,
      env: d.env,
      gates: { fireGatePassed: true, billingActive: true },
      now: NOW,
    });
    assert.ok(res.ok);
    assert.equal(res.value.decision, 'auto-resolved');
    assert.equal(res.value.boundedAction, 'reconnect-integration-prompt');
    assert.equal(d.metrics.rows[0].decision, 'auto-resolved');
  });

  it('auto-resolve master OFF → drafted even with the class enabled', async () => {
    const kind = BOUNDED_ACTION_KIND['reconnect-integration-prompt'];
    const store = new InMemoryOpsFlagStore({
      [autoExecEnabledFlagName(kind, WS)]: 'true',
      [autoExecCeilingFlagName(kind, WS)]: '5',
    });
    const d = baseDeps({ store, llm: judgeLlm(0.2), env: testEnv({ [BOUNDED_AUTO_EXECUTE_MASTER_ENV]: 'on' }) });
    const res = await runTriage({
      message: makeMessage({ body: RECONNECT_BODY }),
      kb: d.kb,
      llm: d.llm,
      store,
      pager: d.pager,
      escalationMarker: d.marker,
      metrics: d.metrics,
      env: d.env,
      gates: { fireGatePassed: true, billingActive: true },
      now: NOW,
    });
    assert.ok(res.ok);
    assert.equal(res.value.decision, 'drafted'); // triage master gate
  });
});

// ── LLM-dead degrade ────────────────────────────────────────────────────

describe('runTriage — LLM degraded', () => {
  it('LLM undefined → escalate-everything + page once', async () => {
    const d = baseDeps({ llm: undefined });
    const res = await runTriage({
      message: makeMessage({ body: 'How do I connect a tool?' }),
      kb: d.kb,
      llm: undefined,
      store: d.store,
      pager: d.pager,
      escalationMarker: d.marker,
      metrics: d.metrics,
      now: NOW,
    });
    assert.ok(res.ok);
    assert.equal(res.value.decision, 'escalated');
    assert.equal(res.value.degraded, true);
    assert.equal(res.value.escalationTrigger, 'llm-degraded');
    assert.equal(d.pages.length, 1);
    assert.equal(d.pages[0].severity, 'warn');
    assert.equal(d.metrics.rows[0].degraded, true);
  });

  it('LLM returns PAUSED → degrades the same way', async () => {
    const d = baseDeps({ llm: pausedLlm() });
    const res = await runTriage({
      message: makeMessage({ body: 'How do I connect a tool?' }),
      kb: d.kb,
      llm: d.llm,
      store: d.store,
      pager: d.pager,
      escalationMarker: d.marker,
      metrics: d.metrics,
      now: NOW,
    });
    assert.ok(res.ok);
    assert.equal(res.value.decision, 'escalated');
    assert.equal(res.value.degraded, true);
    assert.equal(d.pages.length, 1);
  });

  it('degraded pages ONCE across multiple tickets (per-outage cooldown)', async () => {
    // Shared store carries the dedupe flag across the two stateless fires.
    const store = new InMemoryOpsFlagStore();
    const { pager, pages } = recordingPager();
    const common = {
      kb: new RecordingKb(),
      llm: undefined,
      store,
      pager,
      escalationMarker: new RecordingMarker(),
      metrics: new RecordingMetrics(),
    };
    const r1 = await runTriage({ message: makeMessage({ id: 'sr-a' }), ...common, now: NOW });
    const r2 = await runTriage({
      message: makeMessage({ id: 'sr-b' }),
      ...common,
      now: new Date(NOW.getTime() + 60 * 1000), // one minute later, still degraded
    });
    assert.ok(r1.ok && r2.ok);
    // both escalated the customer...
    assert.equal(r1.value.decision, 'escalated');
    assert.equal(r2.value.decision, 'escalated');
    // ...but the operator was paged only once.
    assert.equal(pages.length, 1);
    // dedupe flag was stamped
    assert.ok(store.peek(DEGRADE_PAGE_FLAG));
    // the second ticket's reply is still present + honest
    assert.ok(r2.value.reply);
    assert.match(r2.value.reply!.body, /human teammate/);
  });
});

// ── Signature invariant on every reply ──────────────────────────────────

describe('runTriage — signature invariant', () => {
  it('every customer-facing reply is signed and never claims human', async () => {
    const cases: Array<{ body: string; llm: LlmProvider | undefined }> = [
      { body: 'How do I connect a tool?', llm: judgeLlm(0.95) }, // auto-answer
      { body: 'Please talk to a human.', llm: judgeLlm(0.95) }, // escalate
      { body: 'help', llm: undefined }, // degraded escalate
    ];
    for (const c of cases) {
      const d = baseDeps({ llm: c.llm });
      const res = await runTriage({
        message: makeMessage({ body: c.body }),
        kb: d.kb,
        llm: c.llm,
        store: d.store,
        pager: d.pager,
        escalationMarker: d.marker,
        metrics: d.metrics,
        now: NOW,
      });
      assert.ok(res.ok);
      if (res.value.reply) {
        assert.ok(
          res.value.reply.body.includes('agentplain support'),
          `reply missing signature for body="${c.body}"`,
        );
        assert.doesNotMatch(res.value.reply.body, /\bI am (a|an) human\b/i);
      }
    }
  });
});
