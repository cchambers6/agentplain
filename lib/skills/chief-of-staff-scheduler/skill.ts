/**
 * lib/skills/chief-of-staff-scheduler/skill.ts
 *
 * Per-workspace chief-of-staff skill. Walks the (calendar + inbox + to-do)
 * snapshot the fetcher returns and emits three classes of proposal —
 * meetings to book, replies to draft, to-dos to add — each one PENDING
 * for human approval. Nothing in this file books a calendar slot, sends
 * an email, calls Twilio / SendGrid, or writes into a third-party task
 * system. See `types.ts` for the contract rationale.
 *
 * Hard rules:
 *   - meeting candidate slots are computed by walking the calendar
 *     window and finding gaps in the operator's business hours; we never
 *     "overbook" by proposing a slot that overlaps an existing busy event.
 *   - reply drafts always include an `{{operator: ...}}` merge field for
 *     anything the skill cannot ground in the inbound text itself, so the
 *     operator catches drift before the message goes out from their own
 *     account.
 *   - to-do proposals dedupe against existing open to-dos by normalized
 *     title — if the operator already has a similar item, we skip.
 *   - every proposal records `noOutbound: never auto-executed` in its
 *     reasoning so the audit log shows the no-outbound stance explicitly.
 */

import { randomUUID } from 'node:crypto';
import { skillError, skillOk, type SkillResult } from '../types';
import {
  DEFAULT_BUSINESS_HOURS,
  DEFAULT_LOOKAHEAD_DAYS,
  DEFAULT_MAX_PROPOSALS_PER_CLASS,
  DEFAULT_MEETING_MINUTES,
  DEFAULT_WORK_DAYS,
  type ApprovalSink,
  type CalendarEvent,
  type ChiefOfStaffFetcher,
  type ChiefOfStaffInput,
  type ChiefOfStaffOutput,
  type ChiefOfStaffProposal,
  type ChiefOfStaffSnapshot,
  type InboxMessage,
  type MeetingProposal,
  type ProposedSlot,
  type ReplyDraftProposal,
  type TodoItem,
  type TodoProposal,
  type WorkDay,
} from './types';

const MS_PER_MIN = 60_000;

const NO_OUTBOUND_NOTE =
  'No meetings booked, no emails sent, no to-dos written to third-party ' +
  'systems. Every proposal is PENDING and lands in the approval queue for ' +
  "the operator's review. Per project_no_outbound_architecture.md.";

export async function runSkill(
  input: ChiefOfStaffInput,
): Promise<SkillResult<ChiefOfStaffOutput>> {
  const now = input.now ?? new Date();
  const lookaheadDays = input.lookaheadDays ?? DEFAULT_LOOKAHEAD_DAYS;
  const maxPerClass = input.maxProposalsPerClass ?? DEFAULT_MAX_PROPOSALS_PER_CLASS;
  const sinkThreshold = input.sinkThreshold ?? 0;
  const businessHours = input.businessHours ?? DEFAULT_BUSINESS_HOURS;
  const workDays = input.workDays ?? DEFAULT_WORK_DAYS;
  const meetingMinutes = input.defaultMeetingMinutes ?? DEFAULT_MEETING_MINUTES;

  const snapshotRes = await fetchSnapshot(input.fetcher, {
    workspaceId: input.workspaceId,
    asOf: now,
    lookaheadDays,
  });
  if (!snapshotRes.ok) return snapshotRes;
  const snapshot = snapshotRes.value;

  const meetingProposals = buildMeetingProposals({
    snapshot,
    now,
    lookaheadDays,
    maxPerClass,
    businessHours,
    workDays,
    meetingMinutes,
  });
  const replyDraftProposals = buildReplyDraftProposals({
    snapshot,
    now,
    maxPerClass,
  });
  const todoProposals = buildTodoProposals({
    snapshot,
    now,
    maxPerClass,
  });

  let sunk = 0;
  if (input.sink) {
    const all: ChiefOfStaffProposal[] = [
      ...meetingProposals,
      ...replyDraftProposals,
      ...todoProposals,
    ];
    for (const proposal of all) {
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
    eventsScanned: snapshot.events.length,
    todosScanned: snapshot.todos.length,
    meetingProposals,
    replyDraftProposals,
    todoProposals,
    sunk,
    noOutboundNote: NO_OUTBOUND_NOTE,
  });
}

async function fetchSnapshot(
  fetcher: ChiefOfStaffFetcher,
  args: { workspaceId: string; asOf: Date; lookaheadDays: number },
): Promise<SkillResult<ChiefOfStaffSnapshot>> {
  const res = await fetcher.fetchSnapshot(args);
  if (!res.ok) {
    return skillError(
      'UPSTREAM_GMAIL_ERROR',
      `chief-of-staff fetcher (${fetcher.name}) failed: ${res.error.message}`,
      res.error.code,
    );
  }
  return res;
}

// ── Meeting proposals ───────────────────────────────────────────────────

interface BuildMeetingArgs {
  snapshot: ChiefOfStaffSnapshot;
  now: Date;
  lookaheadDays: number;
  maxPerClass: number;
  businessHours: { startLocalHour: number; endLocalHour: number };
  workDays: WorkDay[];
  meetingMinutes: number;
}

function buildMeetingProposals(args: BuildMeetingArgs): MeetingProposal[] {
  const { snapshot, now, lookaheadDays, maxPerClass, businessHours, workDays, meetingMinutes } = args;
  const out: MeetingProposal[] = [];
  const workDaySet = new Set(workDays);
  // Pre-compute open slots once; each meeting candidate picks the
  // earliest 3 slots that have not yet been "claimed" by an earlier
  // proposal in this run (so we never propose the same slot twice).
  const openSlots = findOpenSlots({
    events: snapshot.events,
    now,
    lookaheadDays,
    businessHours,
    workDaySet,
    meetingMinutes,
  });
  const usedSlotKeys = new Set<string>();

  for (const msg of snapshot.inbox) {
    if (out.length >= maxPerClass) break;
    const wantsMeeting = msg.needsMeeting === true || mentionsScheduling(msg);
    if (!wantsMeeting) continue;
    const candidate = pickSlotsForMeeting({ openSlots, used: usedSlotKeys, count: 3 });
    if (candidate.length === 0) continue;
    for (const c of candidate) usedSlotKeys.add(c.startLocal + c.endLocal);
    const subject = renderMeetingSubject(msg);
    const inviteBody = renderInviteBody({ msg, slots: candidate });
    out.push({
      proposalId: randomUUID(),
      kind: 'meeting',
      status: 'PENDING',
      sourceMessageId: msg.id,
      sourceThreadId: msg.threadId,
      attendees: [{ name: msg.fromName, email: msg.fromEmail }],
      subject,
      candidateSlots: candidate,
      inviteBody,
      confidence: msg.needsMeeting === true ? 0.72 : 0.58,
      reasoning:
        'Inbound thread surfaces a scheduling need; candidate slots picked from ' +
        'the next open windows in business hours. noOutbound: never auto-booked.',
    });
  }
  return out;
}

function mentionsScheduling(msg: InboxMessage): boolean {
  const haystack = `${msg.subject}\n${msg.bodyText}`.toLowerCase();
  // Conservative lexicon — keeps false positives low. Production callers
  // pass `needsMeeting: true` via the upstream categorizer; this is the
  // fallback for fetchers that have not been wired through it yet.
  const cues = [
    'find a time',
    'schedule a call',
    'set up a meeting',
    'book a meeting',
    'block on your calendar',
    'when works for you',
    'can we meet',
    'jump on a call',
  ];
  return cues.some((c) => haystack.includes(c));
}

interface FindSlotsArgs {
  events: CalendarEvent[];
  now: Date;
  lookaheadDays: number;
  businessHours: { startLocalHour: number; endLocalHour: number };
  workDaySet: Set<WorkDay>;
  meetingMinutes: number;
}

/**
 * Walk every business-hour window in the lookahead range and return all
 * slots of `meetingMinutes` length that don't overlap a busy event.
 * Uses local UTC interpretation deliberately — production wiring will
 * pass timezone-aligned events; here we treat the calendar's `startUtc`
 * as the operator's local clock (the snapshot's `localTimezone` is
 * documentation for now — proper tz conversion lands when the calendar
 * adapter does).
 */
function findOpenSlots(args: FindSlotsArgs): ProposedSlot[] {
  const { events, now, lookaheadDays, businessHours, workDaySet, meetingMinutes } = args;
  const slots: ProposedSlot[] = [];
  // Sort busy events ascending — efficient overlap check.
  const busy = events
    .filter((e) => e.isBusy)
    .map((e) => ({ start: e.startUtc.getTime(), end: e.endUtc.getTime() }))
    .sort((a, b) => a.start - b.start);

  const slotMs = meetingMinutes * MS_PER_MIN;
  // Round `now` up to the next quarter hour so first slot doesn't start
  // "in the past" relative to wall-clock seconds.
  const cursorMs = ceilToQuarterHour(now.getTime());
  const endRangeMs = cursorMs + lookaheadDays * 24 * 60 * MS_PER_MIN;
  let cursor = cursorMs;
  while (cursor + slotMs <= endRangeMs) {
    const d = new Date(cursor);
    const dayOfWeek = isoDayOfWeek(d);
    const hour = d.getUTCHours();
    const inBusinessHours =
      hour >= businessHours.startLocalHour && hour < businessHours.endLocalHour;
    const onWorkDay = workDaySet.has(dayOfWeek);
    if (!inBusinessHours || !onWorkDay) {
      // Skip to next quarter hour.
      cursor += 15 * MS_PER_MIN;
      continue;
    }
    const slotStart = cursor;
    const slotEnd = cursor + slotMs;
    const overlaps = busy.some(
      (b) => !(slotEnd <= b.start || slotStart >= b.end),
    );
    if (!overlaps) {
      slots.push({
        startLocal: formatLocal(new Date(slotStart)),
        endLocal: formatLocal(new Date(slotEnd)),
        dayOfWeek,
        rationale: 'First open window in business hours that does not overlap a busy event.',
      });
      // Advance past this slot to avoid emitting back-to-back identical
      // candidates — the operator wants distinct options, not minute-by-
      // minute neighbours.
      cursor += slotMs;
      continue;
    }
    cursor += 15 * MS_PER_MIN;
  }
  return slots;
}

function pickSlotsForMeeting(args: {
  openSlots: ProposedSlot[];
  used: Set<string>;
  count: number;
}): ProposedSlot[] {
  const out: ProposedSlot[] = [];
  for (const s of args.openSlots) {
    if (out.length >= args.count) break;
    if (args.used.has(s.startLocal + s.endLocal)) continue;
    out.push(s);
  }
  return out;
}

function renderMeetingSubject(msg: InboxMessage): string {
  const cleaned = msg.subject.replace(/^(re:|fwd:)\s*/i, '').trim();
  if (cleaned.length === 0) return 'Proposed meeting time';
  return `Proposed time: ${cleaned}`;
}

function renderInviteBody(args: { msg: InboxMessage; slots: ProposedSlot[] }): string {
  const greeting = args.msg.fromName ? `Hi ${args.msg.fromName.split(/\s+/)[0]},` : 'Hello,';
  const slotLines = args.slots.map(
    (s) => `  - ${s.dayOfWeek}, ${s.startLocal} – ${s.endLocal}`,
  );
  return [
    greeting,
    '',
    'Following up on your note — happy to find time. Any of these work?',
    '',
    ...slotLines,
    '',
    'If a different window suits better, let me know and I can offer alternatives.',
    '',
    '{{operator: confirm slot before sending; the chief-of-staff has NOT booked any of the above}}',
    '',
    'Thanks,',
    '{{operator: signature}}',
  ].join('\n');
}

// ── Reply-draft proposals ───────────────────────────────────────────────

interface BuildReplyArgs {
  snapshot: ChiefOfStaffSnapshot;
  now: Date;
  maxPerClass: number;
}

function buildReplyDraftProposals(args: BuildReplyArgs): ReplyDraftProposal[] {
  const { snapshot, now, maxPerClass } = args;
  const out: ReplyDraftProposal[] = [];
  for (const msg of snapshot.inbox) {
    if (out.length >= maxPerClass) break;
    if (msg.hasOpenReplyDraft) continue;
    // Skip messages that already triggered a meeting proposal — the
    // meeting invite IS the reply for that thread.
    if (msg.needsMeeting === true || mentionsScheduling(msg)) continue;
    const ageMs = now.getTime() - msg.receivedAt.getTime();
    const ageHours = ageMs / (60 * MS_PER_MIN);
    // Reply-drafting kicks in for inbound > 4 hours old (gives the
    // operator a chance to handle live conversation) OR for explicit
    // scheduling-not-needed inbound that's still fresh.
    if (ageHours < 4) continue;
    const draft = renderReplyDraft({ msg, ageHours });
    out.push(draft);
  }
  return out;
}

function renderReplyDraft(args: { msg: InboxMessage; ageHours: number }): ReplyDraftProposal {
  const { msg, ageHours } = args;
  const firstName = msg.fromName?.split(/\s+/)[0] || null;
  const greeting = firstName ? `Hi ${firstName},` : 'Hello,';
  const subject = msg.subject.toLowerCase().startsWith('re:') ? msg.subject : `Re: ${msg.subject}`;
  // The body NEVER fabricates content — it acknowledges receipt, summarises
  // what was asked using a snippet of the inbound, and defers any
  // substantive answer to an {{operator: ...}} merge field.
  const snippet = msg.bodyText.slice(0, 240).replace(/\s+/g, ' ').trim();
  const body = [
    greeting,
    '',
    'Thanks for reaching out — apologies for the delay getting back to you.',
    '',
    `Quick read of your note: "${snippet}${msg.bodyText.length > 240 ? '…' : ''}"`,
    '',
    '{{operator: substantive response — confirm or correct the read above, then add the actual answer}}',
    '',
    'Let me know if I missed anything; happy to circle back.',
    '',
    'Thanks,',
    '{{operator: signature}}',
  ].join('\n');
  // Confidence drops the older the thread is — long-stale threads usually
  // need more operator context than a fresh acknowledgement.
  const confidence = ageHours > 72 ? 0.45 : ageHours > 24 ? 0.6 : 0.7;
  return {
    proposalId: randomUUID(),
    kind: 'reply-draft',
    status: 'PENDING',
    sourceMessageId: msg.id,
    sourceThreadId: msg.threadId,
    toEmails: [msg.fromEmail],
    subject,
    body,
    tone: 'casual',
    confidence,
    reasoning:
      `Inbound has been waiting ${Math.round(ageHours)}h; drafted an acknowledgement ` +
      'with the substantive content deferred to an operator merge field. ' +
      'noOutbound: never auto-sent.',
  };
}

// ── To-do proposals ─────────────────────────────────────────────────────

interface BuildTodoArgs {
  snapshot: ChiefOfStaffSnapshot;
  now: Date;
  maxPerClass: number;
}

function buildTodoProposals(args: BuildTodoArgs): TodoProposal[] {
  const { snapshot, now, maxPerClass } = args;
  // Dedupe key strips the "Follow up:" prefix + lowercases + collapses
  // whitespace so an existing operator-created "Follow up: Send the deck"
  // matches a fresh inbox-derived "Follow up: Please send the deck" via
  // substring overlap rather than literal equality.
  const existingKeys = snapshot.todos
    .filter((t) => t.status !== 'done')
    .map((t) => dedupeKey(t.title));
  const out: TodoProposal[] = [];
  const runKeys: string[] = [];
  for (const msg of snapshot.inbox) {
    if (out.length >= maxPerClass) break;
    const candidate = todoCandidateForMessage(msg);
    if (!candidate) continue;
    const key = dedupeKey(candidate.title);
    const dup = [...existingKeys, ...runKeys].some(
      (existing) => existing.length > 0 && (existing.includes(key) || key.includes(existing)),
    );
    if (dup) continue;
    runKeys.push(key);
    out.push({
      proposalId: randomUUID(),
      kind: 'todo',
      status: 'PENDING',
      sourceMessageId: msg.id,
      sourceThreadId: msg.threadId,
      title: candidate.title,
      contextText: candidate.context,
      suggestedDueLocal: candidate.suggestedDueLocal ?? suggestDueDate(now),
      confidence: candidate.confidence,
      reasoning:
        'Inbound mentions a discrete action item; surfacing as a to-do for the ' +
        "operator's board. noOutbound: never written to a third-party task system.",
    });
  }
  return out;
}

function dedupeKey(title: string): string {
  return title
    .toLowerCase()
    .replace(/^follow[- ]?up:\s*/i, '')
    .replace(/[.,!?]+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

interface TodoCandidate {
  title: string;
  context: string;
  suggestedDueLocal: string | null;
  confidence: number;
}

function todoCandidateForMessage(msg: InboxMessage): TodoCandidate | null {
  const text = `${msg.subject}\n${msg.bodyText}`;
  const lower = text.toLowerCase();
  // Look for explicit ask cues. Conservative on purpose — to-do items are
  // higher-cost noise than a draft, so the bar to surface one is higher.
  const askCues = [
    'can you send',
    'please send',
    'could you share',
    'please share',
    'follow up on',
    'follow-up on',
    'remind me to',
    'action required',
    'next step',
    'todo:',
    'to-do:',
  ];
  const matched = askCues.find((c) => lower.includes(c));
  if (!matched) return null;
  // Use the first sentence containing the cue as the to-do context.
  const sentences = text.split(/(?<=[.!?])\s+/);
  const contextSentence =
    sentences.find((s) => s.toLowerCase().includes(matched)) ?? sentences[0] ?? text;
  const titleBase = contextSentence
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
  const title = `Follow up: ${titleBase}`;
  return {
    title,
    context: contextSentence.slice(0, 400).trim(),
    suggestedDueLocal: null,
    confidence: 0.62,
  };
}

function normalizeTitle(t: string): string {
  return t.toLowerCase().replace(/\s+/g, ' ').trim();
}

function suggestDueDate(now: Date): string {
  // Default suggested due: 3 business days out. Operator can edit.
  let d = new Date(now);
  let added = 0;
  while (added < 3) {
    d = new Date(d.getTime() + 24 * 60 * MS_PER_MIN);
    const dow = isoDayOfWeek(d);
    if (dow !== 'saturday' && dow !== 'sunday') added += 1;
  }
  return formatLocalDateOnly(d);
}

// ── Date / time helpers ─────────────────────────────────────────────────

function ceilToQuarterHour(ms: number): number {
  const fifteenMin = 15 * MS_PER_MIN;
  return Math.ceil(ms / fifteenMin) * fifteenMin;
}

function isoDayOfWeek(d: Date): WorkDay {
  const dow = d.getUTCDay();
  const names: WorkDay[] = [
    'sunday',
    'monday',
    'tuesday',
    'wednesday',
    'thursday',
    'friday',
    'saturday',
  ];
  return names[dow];
}

function formatLocal(d: Date): string {
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const mi = String(d.getUTCMinutes()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
}

function formatLocalDateOnly(d: Date): string {
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

// ── Test helpers — exported for reuse in higher-level tests ─────────────

export const __testing = {
  ceilToQuarterHour,
  findOpenSlots,
  mentionsScheduling,
  todoCandidateForMessage,
  normalizeTitle,
};

// Re-export TodoItem (silences "unused" linter under noUnusedLocals when
// the file only references it transitively through helpers).
export type { TodoItem };
