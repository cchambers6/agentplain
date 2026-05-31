/**
 * lib/skills/chief-of-staff-scheduler/types.ts
 *
 * Provider-neutral types for the per-workspace chief-of-staff skill.
 * Given a snapshot of (calendar + inbox + to-do list) the skill PROPOSES
 * three classes of work item — meetings to book, replies to draft, and
 * to-dos to add — each one queued as a structured proposal awaiting
 * human approval.
 *
 * Per `project_no_outbound_architecture.md`: the skill NEVER auto-books
 * a calendar event, auto-sends an email, auto-creates a Twilio / SMS
 * call, or auto-writes a to-do in an external system. Every proposal
 * carries `status: 'PENDING'` and is recorded via the `ApprovalSink`
 * port — production binds that port to `WorkApprovalQueueItem`; tests
 * bind a `RecordingApprovalSink` so we can assert NO execution side
 * effect happened.
 *
 * Per `feedback_no_silent_vendor_lock.md`: Google / M365 / Outlook /
 * calendar / task-system SDKs are NOT imported in this skill. The skill
 * speaks the `ChiefOfStaffFetcher` + `ApprovalSink` ports below; provider
 * adapters live in `lib/integrations/<slug>/` (when they ship) behind
 * these ports.
 *
 * Per `feedback_cold_start_safe_agents.md`: the skill carries no
 * in-memory state across runs. Each call accepts the workspace + a
 * deterministic clock and reads everything it needs from the fetcher.
 */

import type { SkillResult } from '../types';

// ── Fetcher port: calendar + inbox + to-do snapshot ─────────────────────

/**
 * One existing event on the chief-of-staff's calendar.
 *
 * Provider-neutral: Gmail / Google Calendar event IDs, M365 Outlook event
 * IDs, and CalDAV events all flatten to this shape. Times are absolute
 * ISO instants — the skill carries no timezone math; the fetcher resolves
 * the calendar's local tz into the `localTimezone` field on the snapshot.
 */
export interface CalendarEvent {
  /** Stable provider event id (Google `Event.id`, M365 `event.id`). */
  id: string;
  /** Subject/title — used to label the slot in the proposal context. */
  title: string;
  /** UTC start instant. */
  startUtc: Date;
  /** UTC end instant. */
  endUtc: Date;
  /** Whether the calendar owner marked this event as busy / opaque. */
  isBusy: boolean;
}

/**
 * One inbound message the chief-of-staff has read but not yet drafted a
 * reply for. The skill scores these by age + signals to decide which get
 * a reply draft, which trigger a meeting proposal, and which become a
 * to-do.
 */
export interface InboxMessage {
  id: string;
  threadId: string;
  fromEmail: string;
  fromName: string | null;
  subject: string;
  /** Plain-text body — short snippet is fine, the skill reads the first ~800 chars. */
  bodyText: string;
  /** Inbound timestamp (UTC). */
  receivedAt: Date;
  /** Customer-supplied flag for "this thread needs a meeting" — when the
   *  upstream classifier (lib/skills/categorize.ts) tagged this thread as
   *  scheduling-needed. Drives meeting-proposal generation. */
  needsMeeting?: boolean;
  /** Has the customer (or another agent) already drafted a reply? When
   *  true, the chief-of-staff skips drafting another. */
  hasOpenReplyDraft?: boolean;
}

/**
 * One existing to-do on the workspace's to-do board. Used so the skill
 * does not propose a duplicate.
 */
export interface TodoItem {
  id: string;
  title: string;
  /** Free-form context the existing item carries — matched against new
   *  inbox-derived candidates for dedupe. */
  contextText: string;
  status: 'open' | 'in-progress' | 'done';
}

export interface ChiefOfStaffSnapshot {
  /** IANA timezone for the workspace's primary calendar. */
  localTimezone: string;
  /** All events on the operator's calendar in the lookahead window. */
  events: CalendarEvent[];
  /** Inbox messages awaiting a reply / decision. */
  inbox: InboxMessage[];
  /** Existing open to-dos — used for dedupe against new proposals. */
  todos: TodoItem[];
}

export interface ChiefOfStaffFetcher {
  readonly name: string;
  /** Fetch the full snapshot for the workspace at `asOf`. */
  fetchSnapshot(args: {
    workspaceId: string;
    asOf: Date;
    /** How far ahead the calendar window should reach. */
    lookaheadDays: number;
  }): Promise<SkillResult<ChiefOfStaffSnapshot>>;
}

// ── Output proposals — never executed ───────────────────────────────────

/** Status every proposal lands in. Mirrors `WorkApprovalStatus` so the
 *  production binding can persist directly without re-mapping. */
export type ProposalStatus = 'PENDING';

/**
 * A meeting proposal: one or more candidate slots, an attendee list, and
 * a drafted invite body. The skill NEVER calls `calendar.events.insert`
 * or its equivalent — the customer reviews the proposal in the approval
 * queue and (if approved) books the slot from their own calendar UI.
 */
export interface MeetingProposal {
  proposalId: string;
  kind: 'meeting';
  status: ProposalStatus;
  /** Trigger inbox message that surfaced the meeting need. NULL when the
   *  meeting came from a recurring-cadence rule rather than an inbound. */
  sourceMessageId: string | null;
  /** Stable thread id for dedupe within the run. */
  sourceThreadId: string | null;
  /** Counterparty(ies) the chief-of-staff proposes to invite. */
  attendees: { name: string | null; email: string }[];
  /** Subject line for the proposed invite. */
  subject: string;
  /** Candidate slots — earliest first; the operator picks one. */
  candidateSlots: ProposedSlot[];
  /** Plain-text invite body. Carries an "{{operator: confirm/decline}}"
   *  merge field so the operator's intent is captured before booking. */
  inviteBody: string;
  /** 0-1. Lower confidence means the operator should re-read before
   *  approving — same convention as the existing draft skills. */
  confidence: number;
  /** One-sentence reasoning the skill recorded — surfaces in /approvals. */
  reasoning: string;
}

export interface ProposedSlot {
  /** Local start, formatted "YYYY-MM-DDTHH:MM" in `localTimezone`. */
  startLocal: string;
  /** Local end. */
  endLocal: string;
  /** ISO day-of-week label ("monday", "tuesday", ...) for the UI. */
  dayOfWeek: string;
  /** Reason this slot was chosen — e.g. "first open 30m on weekday". */
  rationale: string;
}

/**
 * A reply-draft proposal: structured draft text awaiting the operator's
 * approval. The skill DOES NOT call `messages.send` / `drafts.create`
 * itself — production binds the existing `DraftPersister` port via
 * `lib/skills/draft.ts`, which writes to Gmail Drafts only.
 */
export interface ReplyDraftProposal {
  proposalId: string;
  kind: 'reply-draft';
  status: ProposalStatus;
  sourceMessageId: string;
  sourceThreadId: string;
  toEmails: string[];
  subject: string;
  body: string;
  tone: 'formal' | 'casual';
  confidence: number;
  reasoning: string;
}

/**
 * A to-do proposal: a workitem the chief-of-staff thinks belongs on the
 * to-do board. The skill DOES NOT write to Asana / Linear / Notion / any
 * other task system — the operator reviews + (if approved) the operator's
 * existing system creates the row.
 */
export interface TodoProposal {
  proposalId: string;
  kind: 'todo';
  status: ProposalStatus;
  /** Trigger inbox message that surfaced the todo. NULL for cadence-derived. */
  sourceMessageId: string | null;
  sourceThreadId: string | null;
  title: string;
  contextText: string;
  /** Suggested due date — local ISO date string. NULL when no clear due. */
  suggestedDueLocal: string | null;
  confidence: number;
  reasoning: string;
}

export type ChiefOfStaffProposal =
  | MeetingProposal
  | ReplyDraftProposal
  | TodoProposal;

// ── Sink port: where approved-pending proposals land ────────────────────

/**
 * Sink the skill writes each proposal into. Production binds an adapter
 * that writes `WorkApprovalQueueItem` rows; tests bind
 * `RecordingApprovalSink` to assert no execution side effects fired.
 *
 * The sink interface has NO `execute` / `book` / `send` method — that is
 * intentional. The contract is RECORD ONLY. Any future "execute approved"
 * step lives in a separate, human-gated path.
 */
export interface ApprovalSink {
  readonly name: string;
  record(args: {
    workspaceId: string;
    proposal: ChiefOfStaffProposal;
  }): Promise<SkillResult<{ sinkId: string }>>;
}

// ── Inputs + outputs ────────────────────────────────────────────────────

export interface ChiefOfStaffInput {
  workspaceId: string;
  fetcher: ChiefOfStaffFetcher;
  /** Optional approval sink — when omitted, the skill emits proposals in
   *  the return value only (the test pattern for inspecting the typed
   *  output without exercising the sink). */
  sink?: ApprovalSink | null;
  /** Clock injection for deterministic tests. Defaults to `new Date()`. */
  now?: Date;
  /** How many days ahead to look for available slots. Default 7. */
  lookaheadDays?: number;
  /** Hard cap on proposals per run — protects against runaway slot
   *  generation when the calendar window is mostly empty. Default 5
   *  per class (meetings / replies / todos). */
  maxProposalsPerClass?: number;
  /** Confidence floor for sinking a proposal. Defaults to 0 (sink
   *  everything). Set higher (e.g. 0.5) in production to keep the
   *  approval queue clean. */
  sinkThreshold?: number;
  /** Workspace business-hours window in `localTimezone`. Defaults to
   *  09:00–17:00 weekdays. Mirrors `SchedulingPreferences` in
   *  `lib/skills/types.ts` but stays scoped here so the skill is
   *  self-contained. */
  businessHours?: { startLocalHour: number; endLocalHour: number };
  /** Days of the week the operator accepts meetings on. */
  workDays?: WorkDay[];
  /** Default proposed meeting length in minutes. Defaults to 30. */
  defaultMeetingMinutes?: number;
  /** Wave-4 — opt-in LLM provider for FEEDBACK-rule refinement. When
   *  provided (alongside a non-empty `feedbackRulesBlock`), the skill
   *  invokes `maybeRefineCos` after the heuristic to let FEEDBACK rules
   *  DROP proposals or RE-WORD their `reasoning`. LLM errors degrade
   *  gracefully — the heuristic output passes through. */
  llm?: import('../../llm/types').LlmProvider;
  /** Wave-4 — rendered FEEDBACK rules block (already in plain text).
   *  Empty = no LLM refinement (heuristic-only). */
  feedbackRulesBlock?: string;
}

export type WorkDay =
  | 'monday'
  | 'tuesday'
  | 'wednesday'
  | 'thursday'
  | 'friday'
  | 'saturday'
  | 'sunday';

export interface ChiefOfStaffOutput {
  asOf: string;
  inboxScanned: number;
  eventsScanned: number;
  todosScanned: number;
  meetingProposals: MeetingProposal[];
  replyDraftProposals: ReplyDraftProposal[];
  todoProposals: TodoProposal[];
  /** Count of proposals the sink actually recorded. Equal to
   *  `meetingProposals.length + replyDraftProposals.length +
   *  todoProposals.length` when sink is bound and threshold = 0; smaller
   *  when proposals fell below the threshold. */
  sunk: number;
  /** Honest note about what side effects the skill DID NOT take. */
  noOutboundNote: string;
}

export const DEFAULT_LOOKAHEAD_DAYS = 7;
export const DEFAULT_MAX_PROPOSALS_PER_CLASS = 5;
export const DEFAULT_BUSINESS_HOURS = {
  startLocalHour: 9,
  endLocalHour: 17,
};
export const DEFAULT_WORK_DAYS: WorkDay[] = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
];
export const DEFAULT_MEETING_MINUTES = 30;
