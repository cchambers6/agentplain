// Wave-2 briefings generator — shared types.
//
// The generator pulls a per-workspace activity snapshot for the last 24h
// (approvals queue churn, fresh chat threads, scheduler proposals, new
// learned-from-corrections notes, instruction queue items) and asks the
// LLM to compose a brief Plaino-voice morning briefing. The result lives
// in the `WorkspaceBriefing` table.
//
// Shapes are deliberately narrow — the generator does not surface
// arbitrary DB rows to the prompt; it pulls a curated, redacted snapshot
// shape so the LLM call stays small + cacheable.

export interface BriefingSummary {
  /** Total WorkApprovalQueueItem rows in the briefing window (any status). */
  approvalsInWindow: number;
  /** Of those, the count that are still PENDING at briefing time. */
  pendingApprovals: number;
  /** Approvals decided in the window (APPROVED, REJECTED, AUTO_APPROVED). */
  decidedInWindow: number;
  /** Count of new Plaino chat threads opened in the window. */
  newChatThreads: number;
  /** Count of PLAINO_INSTRUCTION items queued in the window. */
  newInstructions: number;
  /** Count of new learned-from-corrections notes appended in the window. */
  newLearnedNotes: number;
  /** Top approval-kind buckets with counts — for the preview line. */
  topApprovalKinds: Array<{ kind: string; count: number }>;
  /** Wave-5 (theme #7 / ratif #9): the top pending approval pre-staged for
   *  a one-tap decision on the briefing card. Persisted on the summary JSON
   *  so the page renders the action without re-querying. Null / absent when
   *  nothing is pending at generation time. (The page re-validates the item
   *  is still PENDING before acting — a stale action degrades gracefully.) */
  topPendingAction?: TopPendingAction | null;
}

/**
 * The narrow, redacted snapshot the generator hands to the LLM. The
 * shape is intentionally small: a few counts, the top 5 approval kinds,
 * and the open thread titles (no body content). The LLM composes the
 * briefing prose from this. We never feed the LLM raw draft text — that
 * would echo customer-facing content into a different surface and bloat
 * the prompt.
 */
export interface BriefingActivitySnapshot {
  workspaceId: string;
  workspaceName: string;
  /** ISO datetime; the window covers [from, to]. */
  windowFrom: string;
  windowTo: string;
  summary: BriefingSummary;
  /** Up to 5 pending approval titles (decoupled from body). The
   *  generator chooses which to spotlight; nothing customer-facing
   *  beyond the title is given to the LLM. */
  pendingHighlights: Array<{ kind: string; title: string }>;
  /** Wave-5 (theme #7 / ratif #9): the single top pending approval,
   *  pre-staged so the briefing card can offer a ONE-TAP decision instead
   *  of being a backward-looking read. Null when nothing is pending. The
   *  `itemId` drives the shared `lib/approvals/decisions` core — this is a
   *  decision, NOT a send. Only the title is surfaced (never the draft
   *  body) so the briefing stays redacted. */
  topPendingAction: TopPendingAction | null;
}

export interface TopPendingAction {
  /** WorkApprovalQueueItem.id — the decision target. */
  itemId: string;
  kind: string;
  title: string;
  /** Skill that produced it, for the feedback-signal path. */
  agentSlug: string | null;
}

export interface GenerateBriefingResult {
  /** ISO Y-M-D (UTC) the briefing covers. */
  forDate: string;
  /** The composed body — plaintext at this layer. The persister
   *  encrypts before write. */
  body: string;
  summary: BriefingSummary;
  /** EMPTY when the window had nothing meaningful to surface — caller
   *  still writes the row so the page can render "nothing yesterday;
   *  here's the next loop" instead of looking broken. */
  status: 'READY' | 'EMPTY';
}
