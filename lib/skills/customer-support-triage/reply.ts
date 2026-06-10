/**
 * lib/skills/customer-support-triage/reply.ts
 *
 * Reply construction + the load-bearing signature rule. EVERY customer-
 * facing reply the triage layer emits is signed by the named service
 * partner and NEVER claims to be a human. The signature is appended here,
 * in one place, so it can't be forgotten on a new reply path.
 *
 * Voice: calm heritage tone (project_plaino_named_agent.md). No
 * exclamation points, no "I just sent", no pilot/airplane framing.
 */

import type { SupportMessageSnapshot, TriageReply } from './types';

/** The exact signature appended to every triage reply. Tested verbatim so
 *  the "never claims to be human" + attribution rule can't silently
 *  regress. The partner name is interpolated; the role line is fixed. */
export function triageSignature(partnerName: string): string {
  return `— ${partnerName}\n  agentplain support`;
}

/** Append the partner signature to a reply body, idempotently (won't
 *  double-sign a body that already ends with the signature). */
export function signReply(body: string, partnerName: string): string {
  const sig = triageSignature(partnerName);
  const trimmed = body.replace(/\s+$/, '');
  if (trimmed.endsWith(sig)) return trimmed;
  return `${trimmed}\n\n${sig}`;
}

function greeting(message: SupportMessageSnapshot): string {
  const first = (message.fromName ?? '').split(/\s+/)[0]?.trim() ?? '';
  return first.length > 0 ? `Hi ${first},` : 'Hello,';
}

function replySubject(original: string): string {
  const trimmed = original.trim();
  if (/^re:/i.test(trimmed)) return trimmed;
  return `Re: ${trimmed}`;
}

/**
 * Build the honest escalation acknowledgement. The customer is told a
 * HUMAN teammate has the message and will reply within one business day —
 * never a fake answer, never silence. Signed by the partner.
 */
export function buildEscalationReply(
  message: SupportMessageSnapshot,
): TriageReply {
  const body = signReply(
    [
      greeting(message),
      '',
      "Thanks for reaching out. I've routed this to a human teammate on our " +
        "side — this is the kind of question that deserves a person, not an " +
        "automated reply. You'll hear back from them within one business day.",
      '',
      "Nothing else is needed from you right now; if anything changes, just " +
        'reply to this thread and it stays with the same teammate.',
    ].join('\n'),
    message.partnerName,
  );
  return { subject: replySubject(message.subject), body };
}

/**
 * Build a grounded auto-answer reply from the LLM's drafted answer body.
 * Wraps it with a greeting + the partner signature. The answer text itself
 * comes from the KB-grounded LLM call (kb-judge.ts).
 */
export function buildAutoAnswerReply(
  message: SupportMessageSnapshot,
  answerBody: string,
): TriageReply {
  const body = signReply(
    [greeting(message), '', answerBody.trim()].join('\n'),
    message.partnerName,
  );
  return { subject: replySubject(message.subject), body };
}

export const __testing = { greeting, replySubject };
