/**
 * lib/skills/customer-support-triage/triage.ts
 *
 * The triage orchestrator — Pillar-3's decision core. ONE pass over a
 * customer support message decides exactly one outcome and never leaves
 * the message in a black hole:
 *
 *   degrade-check → ESCALATE-FIRST → AUTO-ANSWER → AUTO-RESOLVE → DRAFT
 *
 * The order is load-bearing:
 *   - Degraded (LLM dead) collapses to escalate-everything + page ONCE.
 *   - Escalate-first runs BEFORE any auto-answer attempt — the sensitive
 *     categories never get a machine answer.
 *   - Auto-answer fires only above the KB-confidence threshold.
 *   - Auto-resolve handles bounded zero-dollar account actions through the
 *     existing #204 rails (autonomy-gated).
 *   - Draft-for-review is the floor — the self-routing good failure. It is
 *     handled by the EXISTING SUPPORT_HANDLER_REPLY_DRAFT path; this layer
 *     just returns `decision: 'drafted'` and the caller hands off.
 *
 * Every customer-facing reply is signed by the partner and never claims to
 * be human (reply.ts). Every decision writes a metrics row (the Pillar-6
 * fleet-health cron reads deflection rate off these). Escalations page a
 * human via lib/ops/page-human and mark the conversation escalated so
 * Plaino stops auto-replying.
 */

import { skillError, skillOk } from '../types';
import { classifyEscalation } from './escalation';
import { judgeKb } from './kb-judge';
import { detectBoundedAction, decideBoundedResolve } from './bounded-resolve';
import { shouldPageForDegrade } from './degrade-dedupe';
import { resolveTriageConfig, TRIAGE_SOURCE } from './config';
import { buildAutoAnswerReply, buildEscalationReply } from './reply';
import type { ComposedGateOutcomes } from '../bounded-execute';
import type {
  EscalationTrigger,
  TriageInput,
  TriageOutput,
  TriageResult,
} from './types';

/** Standing-gate outcomes for THIS fire, threaded in by the caller. The
 *  triage layer composes them into the bounded-execute decision — it never
 *  re-queries (one source of truth per gate). */
export interface TriageGateContext extends ComposedGateOutcomes {}

export interface RunTriageArgs extends TriageInput {
  /** Standing gates (gateSkillFire + billing-pause) already evaluated for
   *  this fire. Default: all true (the caller is expected to thread the
   *  real outcomes; a test that doesn't care can omit). */
  gates?: TriageGateContext;
}

export async function runTriage(args: RunTriageArgs): Promise<TriageResult> {
  const cfg = resolveTriageConfig(args.env ?? process.env);
  const now = args.now ?? new Date();
  const msg = args.message;
  const gates: TriageGateContext = args.gates ?? {
    fireGatePassed: true,
    billingActive: true,
  };

  const deadline = new Date(
    now.getTime() + cfg.escalationDeadlineHours * 60 * 60 * 1000,
  );

  // ── 0. DEGRADE CHECK ────────────────────────────────────────────────
  // No usable LLM (caller passed undefined) → escalate-everything. We page
  // ONCE per fire (warn) so the operator knows the model is down, then
  // route the customer to a human honestly. This is the cold-start-safe
  // correctness posture: when we can't judge, we never auto-answer.
  if (!args.llm) {
    return finishEscalation({
      args,
      trigger: 'llm-degraded',
      evidence: 'no LLM provider available (model paused / not configured)',
      deadline,
      degraded: true,
      confidence: null,
    });
  }

  // ── 1. ESCALATE-FIRST ───────────────────────────────────────────────
  // Deterministic, LLM-free classifier. Runs before any auto-answer so a
  // legal / distress / vuln / deletion / human-ask / big-dispute message
  // never gets a machine answer.
  const escalation = classifyEscalation({
    message: msg,
    billingDisputeThresholdUsd: cfg.billingDisputeThresholdUsd,
  });
  if (escalation) {
    return finishEscalation({
      args,
      trigger: escalation.trigger,
      evidence: escalation.evidence,
      deadline,
      degraded: false,
      confidence: null,
    });
  }

  // ── 2. AUTO-ANSWER from the KB above the confidence threshold ───────
  const kb = args.kb.load();
  const judged = await judgeKb({ message: msg, kb, llm: args.llm });

  if (!judged.ok && judged.degraded) {
    // The LLM came back PAUSED / dead-key mid-fire → degrade exactly like
    // the LLM-undefined path: escalate-everything + page once.
    return finishEscalation({
      args,
      trigger: 'llm-degraded',
      evidence: judged.reason,
      deadline,
      degraded: true,
      confidence: null,
    });
  }

  if (judged.ok && judged.confidence >= cfg.kbConfidenceThreshold) {
    const reply = buildAutoAnswerReply(msg, judged.answer);
    await args.metrics.record({
      workspaceId: msg.workspaceId,
      supportMessageId: msg.id,
      decision: 'auto-answered',
      confidence: judged.confidence,
      escalationTrigger: null,
      boundedAction: null,
      degraded: false,
    });
    return skillOk({
      decision: 'auto-answered',
      reply,
      confidence: judged.confidence,
      escalationTrigger: null,
      boundedAction: null,
      degraded: false,
      page: null,
      detail: `auto-answered from KB (confidence ${judged.confidence.toFixed(2)} ≥ ${cfg.kbConfidenceThreshold.toFixed(2)}); cited ${judged.citedTitles.length} entr${judged.citedTitles.length === 1 ? 'y' : 'ies'}.`,
    });
  }

  // ── 3. AUTO-RESOLVE a bounded account action (autonomy-gated) ───────
  // Only attempt when the master toggle is on AND a clear bounded-action
  // intent is detected. The actual permission is the existing #204
  // per-workspace bounded-execute gate — autonomy off → draft-for-review.
  if (cfg.autoResolveMasterOn) {
    const action = detectBoundedAction(msg);
    if (action) {
      const decision = await decideBoundedResolve({
        action,
        workspaceId: msg.workspaceId,
        store: args.store,
        gates,
        env: args.env,
      });
      if (decision.autoResolve) {
        await args.metrics.record({
          workspaceId: msg.workspaceId,
          supportMessageId: msg.id,
          decision: 'auto-resolved',
          confidence: judged.ok ? judged.confidence : null,
          escalationTrigger: null,
          boundedAction: action,
          degraded: false,
        });
        return skillOk({
          decision: 'auto-resolved',
          reply: null,
          confidence: judged.ok ? judged.confidence : null,
          escalationTrigger: null,
          boundedAction: action,
          degraded: false,
          page: null,
          detail: `auto-resolved bounded action '${action}' — ${decision.detail}`,
        });
      }
      // Detected but the bounded-execute gate denied (autonomy off / over
      // ceiling / master off) → fall through to draft-for-review below.
    }
  }

  // ── 4. DRAFT-FOR-REVIEW (the self-routing floor) ────────────────────
  // Below the confidence threshold (or autonomy-off bounded action). This
  // is a GOOD failure: the existing SUPPORT_HANDLER_REPLY_DRAFT path owns
  // the reply; we just record the decision + hand off.
  await args.metrics.record({
    workspaceId: msg.workspaceId,
    supportMessageId: msg.id,
    decision: 'drafted',
    confidence: judged.ok ? judged.confidence : null,
    escalationTrigger: null,
    boundedAction: null,
    degraded: false,
  });
  return skillOk({
    decision: 'drafted',
    reply: null,
    confidence: judged.ok ? judged.confidence : null,
    escalationTrigger: null,
    boundedAction: null,
    degraded: false,
    page: null,
    detail: judged.ok
      ? `KB confidence ${judged.confidence.toFixed(2)} < ${cfg.kbConfidenceThreshold.toFixed(2)} — routed to draft-for-review (SUPPORT_HANDLER_REPLY_DRAFT).`
      : `KB judge failed (${judged.reason}) — routed to draft-for-review.`,
  });
}

// ── Escalation finisher ───────────────────────────────────────────────
// Shared by every escalation path (degraded + each trigger): page a human
// with full context + the 24h deadline, mark the conversation escalated so
// Plaino stops auto-replying, write the metrics row, return the honest
// customer acknowledgement. Best-effort on each side-effect — a page that
// can't deliver still returns its loud-fail artifact (pageHuman never
// throws), and a metrics/mark failure never swallows the escalation.

interface FinishEscalationArgs {
  args: RunTriageArgs;
  trigger: EscalationTrigger;
  evidence: string;
  deadline: Date;
  degraded: boolean;
  confidence: number | null;
}

async function finishEscalation(
  fe: FinishEscalationArgs,
): Promise<TriageResult> {
  const { args, trigger, evidence, deadline, degraded, confidence } = fe;
  const msg = args.message;
  const now = args.now ?? new Date();

  // Degraded mode pages ONCE per outage window (not per ticket). A
  // trigger-based escalation (legal / distress / etc.) ALWAYS pages — each
  // is a distinct customer needing a person.
  let page: TriageOutput['page'] = null;
  const doPage = degraded
    ? await shouldPageForDegrade({ store: args.store, now })
    : true;
  if (doPage) {
    page = await args.pager({
      severity: degraded ? 'warn' : 'critical',
      summary: `Support escalation (${trigger}) — ${msg.workspaceName}`,
      details: buildPageDetails({ trigger, evidence, msg, degraded }),
      deadline,
      source: TRIAGE_SOURCE,
      workspaceId: msg.workspaceId,
    });
  }

  // Mark the conversation escalated so Plaino stops auto-replying on it.
  // Best-effort: a mark failure must not turn an escalation into silence —
  // the page already fired.
  try {
    await args.escalationMarker.markEscalated({
      workspaceId: msg.workspaceId,
      supportMessageId: msg.id,
      trigger,
    });
  } catch {
    // non-fatal — the human was already paged.
  }

  try {
    await args.metrics.record({
      workspaceId: msg.workspaceId,
      supportMessageId: msg.id,
      decision: 'escalated',
      confidence,
      escalationTrigger: trigger,
      boundedAction: null,
      degraded,
    });
  } catch {
    // non-fatal.
  }

  const reply = buildEscalationReply(msg);
  return skillOk({
    decision: 'escalated',
    reply,
    confidence,
    escalationTrigger: trigger,
    boundedAction: null,
    degraded,
    page,
    detail: degraded
      ? `LLM degraded — escalated to a human (${page ? (page.delivered ? 'paged, delivered' : 'paged, NOT delivered') : 'page suppressed by per-outage cooldown'}; deadline ${deadline.toISOString()}).`
      : `escalated (${trigger}: ${evidence}); ${page ? (page.delivered ? 'paged, delivered' : 'paged, NOT delivered') : 'page suppressed'}, deadline ${deadline.toISOString()}.`,
  });
}

function buildPageDetails(p: {
  trigger: EscalationTrigger;
  evidence: string;
  msg: TriageInput['message'];
  degraded: boolean;
}): string {
  const lines = [
    `A customer support message was routed to a human by the triage layer.`,
    ``,
    `Trigger: ${p.trigger}`,
    `Signal:  ${p.evidence}`,
    ``,
    `Workspace: ${p.msg.workspaceName} (${p.msg.workspaceId})`,
    `From:      ${p.msg.fromName ?? 'unknown'} <${p.msg.fromEmail}>`,
    `Vertical:  ${p.msg.verticalSlug ?? 'none-specific'}`,
    ``,
    `Subject: ${p.msg.subject}`,
    ``,
    `Message:`,
    p.msg.body,
    ``,
    `The customer has been told (honestly) that a human teammate will reply`,
    `within one business day. Plaino will NOT auto-reply on this thread.`,
  ];
  if (p.degraded) {
    lines.push(
      ``,
      `NOTE: this escalation fired because the LLM is degraded (paused / dead`,
      `key / not configured). While the model is down, EVERY support message`,
      `escalates to a human. This page should fire ONCE per degraded fire,`,
      `not per ticket — restore the model credential to resume auto-triage.`,
    );
  }
  return lines.join('\n');
}

// ensure skillError is referenced for the module's error vocabulary even
// when every current path returns skillOk (future-proofing the contract).
void skillError;
