/**
 * lib/skills/inbox-triage-general/skill.ts
 *
 * Cross-role inbox triage. Walks the inbox snapshot the fetcher
 * returns and emits one `TriageProposal` per message — classified into
 * a priority bucket plus, for customer-active and vendor-pending only,
 * a drafted acknowledgement with operator merge fields.
 *
 * Hard rules:
 *   - urgent / needs-decision NEVER carry an auto-drafted ack (those
 *     need the operator's eyes on the substance, not a placeholder).
 *   - ack drafts always include an `{{operator: ...}}` merge field for
 *     any substantive answer — the skill acknowledges receipt only.
 *   - confidence below `noiseConfidenceFloor` demotes to `noise`.
 *   - no Gmail / Outlook / vendor SDK calls live in this file.
 *
 * The classifier is regex / keyword based and deliberately conservative.
 * False positives at this layer create operator noise; the operator
 * always sees the message regardless, so a missed urgency just leaves
 * the message in `needs-decision` for owner review.
 */

import { randomUUID } from 'node:crypto';
import { skillError, skillOk, type SkillResult } from '../types';
import { maybeRefineTriage } from './llm-refine';
import {
  DEFAULT_NOISE_CONFIDENCE_FLOOR,
  TRIAGE_PRIORITY_ORDER,
  type TriageAckDraft,
  type TriageApprovalSink,
  type TriageFetcher,
  type TriageInput,
  type TriageMessage,
  type TriageOutput,
  type TriagePriority,
  type TriageProposal,
  type TriageSnapshot,
} from './types';

const NO_OUTBOUND_NOTE =
  'No replies sent, no inbox actions taken. Every proposal is PENDING ' +
  'and lands in the approval queue for the operator to review. Per ' +
  'project_no_outbound_architecture.md.';

const URGENT_CUES = [
  'urgent',
  'asap',
  'immediately',
  'today',
  'time sensitive',
  'time-sensitive',
  'cannot wait',
  "can't wait",
  'overdue',
  'past due',
  'eod',
  'end of day',
  'before close',
  'critical',
  'emergency',
];

const CUSTOMER_CUES = [
  'order',
  'receipt',
  'purchase',
  'quote',
  'estimate',
  'appointment',
  'service',
  'thanks for',
  'thank you for',
  'question about',
  'looking for',
];

const VENDOR_CUES = [
  // Multi-word + specific by design. Bare "shipment" / "tracking" /
  // "delivery" are too ambiguous (a customer asking about THEIR
  // shipment is customer-active, not vendor-pending).
  'invoice attached',
  'invoice #',
  'amount due',
  'payment due',
  'statement attached',
  'remittance',
  'po number',
  'purchase order',
  'subscription renewal',
  'subscription renews',
  'auto-renewal',
];

const DECISION_CUES = [
  'please decide',
  'your call',
  'thoughts?',
  'what do you think',
  'approve',
  'sign off',
  'sign-off',
  'go / no-go',
  'go/no-go',
  'okay to proceed',
  'ok to proceed',
];

const NOISE_CUES = [
  'unsubscribe',
  'newsletter',
  'marketing',
  'announcement',
  'no-reply',
  'noreply',
  'do not reply',
];

export async function runSkill(
  input: TriageInput,
): Promise<SkillResult<TriageOutput>> {
  const now = input.now ?? new Date();
  const noiseFloor = input.noiseConfidenceFloor ?? DEFAULT_NOISE_CONFIDENCE_FLOOR;
  const sinkThreshold = input.sinkThreshold ?? 0;
  // Wave-2 per-skill config: customer's extra urgency cues. Lower-case
  // + dedup at the seam so the classifier's `includes` check stays
  // case-insensitive (the haystack is already lower-cased).
  const extraUrgentCues = (input.extraUrgentCues ?? [])
    .map((c) => c.trim().toLowerCase())
    .filter((c) => c.length > 0);

  const snapshotRes = await fetchSnapshot(input.fetcher, {
    workspaceId: input.workspaceId,
    asOf: now,
  });
  if (!snapshotRes.ok) return snapshotRes;
  const snapshot = snapshotRes.value;

  let proposals = snapshot.inbox.map((msg) =>
    buildProposal({ msg, noiseFloor, now, extraUrgentCues }),
  );

  // Wave-4 — opt-in LLM refinement seam. When the caller passes both an
  // `llm` AND a non-empty `feedbackRulesBlock`, the LLM is asked to
  // revise priorities based on the workspace's FEEDBACK rules. Errors +
  // missing inputs fall through to the pure heuristic output — proven
  // by the wave-4 inbox-triage tests.
  let refineNote = '';
  if (input.llm && (input.feedbackRulesBlock ?? '').trim().length > 0) {
    const refined = await maybeRefineTriage({
      llm: input.llm,
      feedbackRulesBlock: input.feedbackRulesBlock ?? '',
      messages: snapshot.inbox,
      proposals,
      workspaceId: input.workspaceId,
    });
    proposals = refined.proposals;
    refineNote = refined.note;
  }

  // Sort by descending priority — same order operators read.
  proposals.sort((a, b) => priorityRank(a.priority) - priorityRank(b.priority));

  let sunk = 0;
  if (input.sink) {
    for (const proposal of proposals) {
      if (proposal.confidence < sinkThreshold) continue;
      const res = await input.sink.record({
        workspaceId: input.workspaceId,
        proposal,
      });
      if (res.ok) sunk += 1;
    }
  }

  return skillOk({
    asOf: now.toISOString(),
    inboxScanned: snapshot.inbox.length,
    proposals,
    sunk,
    noOutboundNote:
      refineNote.length > 0
        ? `${NO_OUTBOUND_NOTE} ${refineNote}`
        : NO_OUTBOUND_NOTE,
  });
}

async function fetchSnapshot(
  fetcher: TriageFetcher,
  args: { workspaceId: string; asOf: Date },
): Promise<SkillResult<TriageSnapshot>> {
  const res = await fetcher.fetchSnapshot(args);
  if (!res.ok) {
    return skillError(
      'UPSTREAM_GMAIL_ERROR',
      `inbox-triage fetcher (${fetcher.name}) failed: ${res.error.message}`,
      res.error.code,
    );
  }
  return res;
}

interface BuildArgs {
  msg: TriageMessage;
  noiseFloor: number;
  now: Date;
  extraUrgentCues: string[];
}

function buildProposal(args: BuildArgs): TriageProposal {
  const { msg, noiseFloor, extraUrgentCues } = args;
  const { priority, confidence, reasoning } = classify(msg, extraUrgentCues);
  const finalPriority: TriagePriority =
    confidence < noiseFloor ? 'noise' : priority;
  const ackDraft =
    finalPriority === 'customer-active' || finalPriority === 'vendor-pending'
      ? renderAckDraft({ msg, priority: finalPriority })
      : null;
  return {
    proposalId: randomUUID(),
    kind: 'inbox-triage',
    status: 'PENDING',
    sourceMessageId: msg.id,
    sourceThreadId: msg.threadId,
    priority: finalPriority,
    confidence,
    reasoning:
      confidence < noiseFloor
        ? `Confidence ${confidence.toFixed(2)} below floor ${noiseFloor.toFixed(2)}; demoted to noise. Original signal: ${reasoning}`
        : reasoning,
    ackDraft,
  };
}

function classify(
  msg: TriageMessage,
  extraUrgentCues: string[] = [],
): {
  priority: TriagePriority;
  confidence: number;
  reasoning: string;
} {
  const haystack = `${msg.subject}\n${msg.bodyText}`.toLowerCase();
  // Precedence: most-specific signal wins. Urgent is the strongest
  // signal regardless of counterparty class. Customer-specific
  // priority keywords (wave-2 per-skill config) ride alongside the
  // built-in URGENT_CUES so the customer's own vocabulary becomes
  // load-bearing — flagged with a distinct reasoning prefix so the
  // operator can tell which signal fired.
  const customerUrgentMatch = extraUrgentCues.find((c) => haystack.includes(c));
  if (customerUrgentMatch) {
    return {
      priority: 'urgent',
      confidence: 0.85,
      reasoning: `Customer priority keyword: "${customerUrgentMatch}".`,
    };
  }
  const urgentMatch = URGENT_CUES.find((c) => haystack.includes(c));
  if (urgentMatch) {
    return {
      priority: 'urgent',
      confidence: 0.78,
      reasoning: `Urgency cue: "${urgentMatch}".`,
    };
  }
  const noiseMatch = NOISE_CUES.find((c) => haystack.includes(c));
  if (noiseMatch) {
    return {
      priority: 'noise',
      confidence: 0.7,
      reasoning: `Newsletter / no-reply cue: "${noiseMatch}".`,
    };
  }
  const decisionMatch = DECISION_CUES.find((c) => haystack.includes(c));
  if (decisionMatch) {
    return {
      priority: 'needs-decision',
      confidence: 0.65,
      reasoning: `Decision-ask cue: "${decisionMatch}".`,
    };
  }
  const vendorMatch = VENDOR_CUES.find((c) => haystack.includes(c));
  if (vendorMatch) {
    return {
      priority: 'vendor-pending',
      confidence: 0.55,
      reasoning: `Vendor cue: "${vendorMatch}".`,
    };
  }
  const customerMatch = CUSTOMER_CUES.find((c) => haystack.includes(c));
  if (customerMatch) {
    return {
      priority: 'customer-active',
      confidence: 0.6,
      reasoning: `Customer cue: "${customerMatch}".`,
    };
  }
  // No signal — low-confidence noise. Lets the operator decide.
  return {
    priority: 'noise',
    confidence: 0.3,
    reasoning: 'No urgency, decision, customer, or vendor cue detected.',
  };
}

function renderAckDraft(args: {
  msg: TriageMessage;
  priority: TriagePriority;
}): TriageAckDraft {
  const { msg, priority } = args;
  const firstName = msg.fromName?.split(/\s+/)[0] || null;
  const greeting = firstName ? `Hi ${firstName},` : 'Hello,';
  const subject = msg.subject.toLowerCase().startsWith('re:')
    ? msg.subject
    : `Re: ${msg.subject}`;
  const ackLine =
    priority === 'customer-active'
      ? "Thanks for reaching out — I've got your note and will follow up shortly."
      : "Thanks for sending this over — I've received it and will circle back once I've had a chance to review.";
  const body = [
    greeting,
    '',
    ackLine,
    '',
    '{{operator: substantive response — confirm what was asked above, then add the actual answer}}',
    '',
    'Thanks,',
    '{{operator: signature}}',
  ].join('\n');
  return {
    toEmails: [msg.fromEmail],
    subject,
    body,
    tone: priority === 'customer-active' ? 'casual' : 'formal',
  };
}

function priorityRank(p: TriagePriority): number {
  return TRIAGE_PRIORITY_ORDER.indexOf(p);
}

export const __testing = {
  classify,
  renderAckDraft,
  priorityRank,
};
