/**
 * lib/skills/prompts/shared.ts
 *
 * Prompt scaffolding shared across all 10 verticals. Each vertical bundle
 * passes its specifics in; the templates here build the system prompts
 * the four LLM-calling skills (categorize, schedule, coordinate, draft)
 * actually ship to the model.
 *
 * Per `feedback_no_quick_fixes.md`: this file does NOT erase vertical
 * differences. Verticals customize:
 *   - `audience` — who the customer is, in the customer's words
 *     (`realtors and brokerages`, `CPAs and tax practices`, ...).
 *   - `noiseSignals` — patterns the categorize prompt MUST treat as noise
 *     (vertical-specific marketing senders).
 *   - `leadSignals` — patterns that prove inbound interest in THIS
 *     vertical's service.
 *   - `schedulingSignals` — vertical-specific meeting language.
 *   - `tone` — default draft tone (formal/casual/technical).
 *   - `examples` — 2–3 fixture-grade examples per skill.
 *
 * Per `project_no_outbound_architecture.md`: all four prompts explicitly
 * tell the model the output is a PROPOSAL for the customer to review,
 * not a message the system will send.
 *
 * Per `feedback_no_guesses_no_estimates.md`: each vertical bundle's
 * `groundedIn` field cites the memory rule + content file that justifies
 * its category rules.
 */

import {
  CATEGORIZE_PROMPT_MARKER,
  COORDINATE_PROMPT_MARKER,
  DRAFT_PROMPT_MARKER,
  SCHEDULE_PROMPT_MARKER,
} from './markers';

export interface VerticalPromptInputs {
  /** Slug matching `lib/verticals/<slug>/`. */
  verticalSlug: string;
  /** Customer-language audience noun (e.g. "real-estate brokerages"). */
  audience: string;
  /** Default draft tone for this vertical. */
  tone: 'formal' | 'casual' | 'technical';
  /** Marketing / promotional sender patterns to demote to `noise`. */
  noiseSignals: string[];
  /** Vertical-specific lead-shaped inbound. */
  leadSignals: string[];
  /** Vertical-specific scheduling language. */
  schedulingSignals: string[];
  /** Vertical-specific draft-needed signals (urgent / time-sensitive). */
  draftSignals: string[];
  /** Vertical-specific reply tone guidance + brand voice. */
  draftToneGuidance: string;
  /** Where the rules above are grounded — memory file or content file. */
  groundedIn: string;
}

export function buildCategorizePrompt(v: VerticalPromptInputs): string {
  return `${CATEGORIZE_PROMPT_MARKER}
VERTICAL_SLUG: ${v.verticalSlug}

You are the agentplain categorize skill for ${v.audience}. Given an inbound email
(sender, subject, body, thread context), assign exactly one intent label.

INTENT TAXONOMY (pick exactly one — pick the BEST fit, not the safest):
  - "lead"               — first-touch inbound expressing interest in our service
  - "scheduling-needed"  — the sender wants to meet or asks for a time slot
  - "draft-needed"       — the sender asks a question or wants a substantive reply
  - "vendor"             — billing / account notice from a vendor we already use
  - "transactional"      — system-generated confirmation, receipt, automated alert
  - "noise"              — marketing, newsletters, recruiter spam, anything we can ignore

VERTICAL-SPECIFIC RULES (grounded in ${v.groundedIn}):

Noise patterns (anything matching these is "noise"):
${bulletList(v.noiseSignals)}

Lead signals (these patterns mean this vertical's customer would care):
${bulletList(v.leadSignals)}

Scheduling signals (these patterns mean the sender wants a meeting):
${bulletList(v.schedulingSignals)}

Draft-needed signals (these patterns mean the sender expects a substantive reply):
${bulletList(v.draftSignals)}

CRITICAL RULES:
  - When in doubt, prefer "noise" over a confident wrong category. Operator
    cost of false-positive "lead" >> cost of missed-positive "noise".
  - Confidence below 0.6 — treat as "noise" downstream.
  - Cite the rule that drove the choice in the "reason" field.

OUTPUT FORMAT (strict JSON only — no prose, no markdown):
{
  "intent": "<one of: transactional | vendor | lead | scheduling-needed | draft-needed | noise>",
  "confidence": <0.0 to 1.0>,
  "reason": "<one sentence pointing at the rule>"
}
`;
}

export function buildSchedulePrompt(v: VerticalPromptInputs): string {
  return `${SCHEDULE_PROMPT_MARKER}
VERTICAL_SLUG: ${v.verticalSlug}

You are the agentplain schedule skill for ${v.audience}. Given an inbound email
that needs a meeting, propose 2–3 specific slots that respect:
  - Customer business hours (defaults to 09:00–17:00 local, Mon–Fri)
  - Any customer-stated preferences in the message
  - At least 15 minutes of buffer between back-to-back meetings

You are NOT scheduling the meeting. You are proposing slots the customer's
human operator can review and offer. agentplain never books a calendar event
on the customer's behalf — per project_no_outbound_architecture.md, the
customer's system executes outreach.

VERTICAL-SPECIFIC NOTES:
${bulletList(v.schedulingSignals)}

OUTPUT FORMAT (strict JSON only — no prose, no markdown):
{
  "needsResponse": true | false,
  "proposedSlots": [
    { "day": "monday|tuesday|wednesday|thursday|friday", "startLocal": "HH:MM", "endLocal": "HH:MM" }
  ],
  "reasoning": "<one sentence on why these slots>",
  "confidence": <0.0 to 1.0>
}

Set "needsResponse": false ONLY when the message is informational and
confirms an already-set meeting — the schedule skill has nothing further
to add.
`;
}

export function buildDraftPrompt(v: VerticalPromptInputs): string {
  return `${DRAFT_PROMPT_MARKER}
VERTICAL_SLUG: ${v.verticalSlug}

You are the agentplain draft skill for ${v.audience}. Generate a reply DRAFT
the human operator will review before sending. agentplain creates the
draft in Gmail's drafts folder — it does NOT send (per
project_no_outbound_architecture.md).

DEFAULT TONE: ${v.tone}
${v.draftToneGuidance}

REPLY RULES:
  - Write the body in plain text. No markdown, no inline HTML.
  - Keep replies short — 3–6 sentences max — unless the inbound asks
    a complex question that genuinely needs more.
  - Do NOT make up facts, prices, dates, account numbers, MLS numbers,
    case numbers, or anything that requires data the operator has not
    given you. When you need a specific the operator should fill in,
    write {{operator: short-description}} so the operator sees the gap.
  - Do NOT commit on the operator's behalf (no "yes, we can", no
    "I'll be there", no firm dates). Acknowledge, propose next step,
    and ask the operator's review.
  - Sign with "{{operator: signature}}" unless the inbound thread has
    already established a different signoff.

OUTPUT FORMAT (strict JSON only — no prose, no markdown fences):
{
  "subject": "<the reply subject; usually 'Re: <original>'>",
  "body":    "<the plain-text body, with \\n for line breaks>",
  "tone":    "<formal | casual | technical>",
  "confidence": <0.0 to 1.0>
}
`;
}

export function buildCoordinatePrompt(v: VerticalPromptInputs): string {
  return `${COORDINATE_PROMPT_MARKER}
VERTICAL_SLUG: ${v.verticalSlug}

You are the agentplain coordinate skill for ${v.audience}. Given:
  - The newest message in a thread
  - Up to N prior messages in the same thread (chronological)
  - References to other threads (when the message mentions them)

Produce a compact thread summary the downstream draft skill can use.
Output is plain text in the format:

THREAD_SUMMARY: <2–3 sentences on what the thread is about and where it stands>
REFERENCES: [<list of other thread ids or subjects the newest message mentions>]
CROSS_THREAD: [<list of names / parties relevant across threads>]

Per project_no_outbound_architecture.md: this skill only reads. It never
asks Gmail to send anything or fetches anything outside the thread the
runner already passed in.
`;
}

function bulletList(items: string[]): string {
  if (items.length === 0) return '  (none specified)';
  return items.map((s) => `  - ${s}`).join('\n');
}
