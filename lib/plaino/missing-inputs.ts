/**
 * lib/plaino/missing-inputs.ts
 *
 * The pre-generation requirements check — "know when you don't know".
 *
 * Pattern origin: every generating surface in this repo composes a prompt
 * from a handful of grounding inputs (case facts, workspace setup, saved
 * know-how, thread history, preferences) and then calls the model whether
 * or not those inputs actually resolved. When they didn't, the model still
 * answers — fluently, confidently, and on nothing. That failure is worse
 * than no answer, because it is indistinguishable from a good one.
 *
 * So: BEFORE generating, compute what the output needs, check each input,
 * and when the required ones are absent, refuse with a STRUCTURED REPORT
 * that names what is missing. The refusal path makes NO model call — it is
 * pure, deterministic, and free. The in-repo precedent is the
 * `placeholder` tier in `lib/skills/support-handler/skill.ts`: substrate
 * below the confidence floor produces a templated hold, never a fabricated
 * answer (`feedback_no_guesses_no_estimates`).
 *
 * A report carries two audiences:
 *
 *   - `customerNotice` — what the person on the surface reads. Plaino's
 *     voice: calm, lowercase-leaning, no exclamation points, no emoji, no
 *     apology boilerplate, and never a word from the machine layer. Which
 *     inputs get named depends on WHO is reading: a business owner is told
 *     what Plaino can't see (they can fix it); an end-client of that
 *     business is told only that their message landed and a person will
 *     follow up (the gaps are their vendor's business, not theirs).
 *
 *   - `operatorNote` — terse, internal, names the machine keys. Safe for
 *     logs and for the operator-facing hold note on a held draft.
 *
 * Hard rule, pinned by `missing-inputs.test.ts` (mirroring
 * `tests/plaino-degraded-copy.test.ts`): no customer-facing string here
 * may contain engineering-internal phrasing.
 */

// ── Types ───────────────────────────────────────────────────────────────

/** Which generating surface refused. Determines the notice's audience. */
export type MissingInputSurface = 'PORTAL_CHAT' | 'SUPPORT_CHAT' | 'REPLY_DRAFT';

export interface MissingInput {
  /** Stable machine key. Logs, tests, and operator tooling join on this. */
  key: string;
  /** Customer vocabulary — what the business owner calls the thing. */
  label: string;
}

export interface MissingInputReport {
  kind: 'MISSING_INPUTS';
  surface: MissingInputSurface;
  /** Non-empty. A report with nothing missing is a contradiction. */
  missing: MissingInput[];
  /** Voice-compliant copy for whoever reads this surface. */
  customerNotice: string;
  /** Terse internal line. May use internal vocab; names the keys. */
  operatorNote: string;
}

export interface BuildMissingInputsOptions {
  /**
   * The business's own brand name, when the surface speaks AS that
   * business (the client portal). Omitted or blank falls back to a
   * brand-neutral phrasing rather than printing a placeholder.
   */
  brandName?: string | null;
}

// ── The known gaps, per surface ─────────────────────────────────────────
// Labels are the customer's words, not ours. They are joined into the
// notice verbatim, so they read as a sentence fragment ("Plaino can't see
// <label> just now"), never as a field name.

/** Portal: the thread is scoped to a case, but the case has no title. */
export const MISSING_CASE_TITLE: MissingInput = {
  key: 'case_title',
  label: 'the matter this conversation is about',
};

/** Portal: the case has no status, so there is nothing to report back. */
export const MISSING_CASE_STATUS: MissingInput = {
  key: 'case_status',
  label: 'where things stand on it',
};

/** Support: the workspace row itself didn't load. Nothing is grounded. */
export const MISSING_WORKSPACE: MissingInput = {
  key: 'workspace',
  label: 'this workspace’s details',
};

/** Support: the capability snapshot (connections + their state) failed. */
export const MISSING_CAPABILITY_SNAPSHOT: MissingInput = {
  key: 'capability_snapshot',
  label: 'what’s connected',
};

/** Support: the knowledge search failed (distinct from "no matches"). */
export const MISSING_KNOWLEDGE: MissingInput = {
  key: 'knowledge',
  label: 'the know-how you’ve saved',
};

/** Draft: zero customer-context snippets were inlined into the prompt. */
export const MISSING_CUSTOMER_CONTEXT: MissingInput = {
  key: 'customer_context',
  label: 'anything on file about this person',
};

/** Draft: the workspace has taught us nothing about how it writes. */
export const MISSING_DRAFT_PREFERENCES: MissingInput = {
  key: 'preferences',
  label: 'how you like replies written',
};

/** Draft: no thread summary — we don't know what was already said. */
export const MISSING_THREAD_SUMMARY: MissingInput = {
  key: 'thread_summary',
  label: 'what’s already been said here',
};

/** Draft: no proposed meeting slots to offer. */
export const MISSING_SCHEDULE: MissingInput = {
  key: 'schedule',
  label: 'times to offer',
};

// ── Builder ─────────────────────────────────────────────────────────────

/**
 * Assemble the report. Pure — no I/O, no clock, no model call. Callers
 * decide the refusal condition; this owns the copy so the three surfaces
 * can't drift.
 *
 * `missing` must be non-empty. That is a programmer invariant (every call
 * site returns this from inside an `if` whose condition IS the gap), not a
 * runtime condition, so it asserts rather than returning a result union.
 */
export function buildMissingInputsReport(
  surface: MissingInputSurface,
  missing: MissingInput[],
  options: BuildMissingInputsOptions = {},
): MissingInputReport {
  if (missing.length === 0) {
    throw new TypeError(
      'buildMissingInputsReport: `missing` must be non-empty — a refusal has to name what it refused on',
    );
  }
  return {
    kind: 'MISSING_INPUTS',
    surface,
    missing,
    customerNotice: customerNoticeFor(surface, missing, options),
    operatorNote: operatorNoteFor(surface, missing),
  };
}

/** The machine keys, in order. For structured logs and test assertions. */
export function missingInputKeys(report: MissingInputReport): string[] {
  return report.missing.map((m) => m.key);
}

// ── Copy ────────────────────────────────────────────────────────────────

function customerNoticeFor(
  surface: MissingInputSurface,
  missing: MissingInput[],
  options: BuildMissingInputsOptions,
): string {
  switch (surface) {
    case 'PORTAL_CHAT':
      return portalNotice(options.brandName);
    case 'SUPPORT_CHAT':
      return supportNotice(missing);
    case 'REPLY_DRAFT':
      return replyDraftNotice(missing);
  }
}

/**
 * The end-client of the business. They are not the one who can close the
 * gap, and the gap is their vendor's internal business — so this says
 * exactly what the DRAFT_FAILED path says: your message landed, a person
 * will come back to you. Same posture, same words, deliberately.
 */
function portalNotice(brandName?: string | null): string {
  const who = brandName && brandName.trim().length > 0 ? brandName.trim() : 'the team';
  return `Thanks — ${who} has your message and will follow up with you here shortly.`;
}

/**
 * The business owner, in their own workspace. They CAN close the gap, so
 * name it. Leads into the same hand-off as PLAINO_TRANSIENT_REPLY — a turn
 * Plaino can't take is a moment for a person to step in.
 */
function supportNotice(missing: MissingInput[]): string {
  return (
    `Plaino can’t see ${joinLabels(missing)} just now, so he won’t guess at an answer. ` +
    'give it a moment and try again, or leave your email below and a person will follow up.'
  );
}

/**
 * The broker reviewing their queue. This is a HOLD, not a reply — it never
 * goes to the person who wrote in. Names the gap and the way forward.
 */
function replyDraftNotice(missing: MissingInput[]): string {
  return (
    `Plaino held this one instead of writing a reply — he doesn’t have ${joinLabels(missing)} yet. ` +
    'fill in what’s missing and he’ll pick it up next time, or write this one yourself.'
  );
}

function operatorNoteFor(
  surface: MissingInputSurface,
  missing: MissingInput[],
): string {
  const keys = missing.map((m) => m.key).join(', ');
  return `missing_inputs[${surface.toLowerCase()}]: ${keys} — held before generating; nothing was composed.`;
}

/** "a" / "a and b" / "a, b, and c". */
function joinLabels(missing: MissingInput[]): string {
  const labels = missing.map((m) => m.label);
  if (labels.length === 1) return labels[0];
  if (labels.length === 2) return `${labels[0]} and ${labels[1]}`;
  return `${labels.slice(0, -1).join(', ')}, and ${labels[labels.length - 1]}`;
}

// ── Snapshot surface for the no-jargon test ─────────────────────────────

/**
 * Every customer-facing string this module can emit, across the surfaces
 * and across the arities of `joinLabels`. The co-located test walks this
 * with the same banned-word list `tests/plaino-degraded-copy.test.ts`
 * uses, so a future copy edit can't quietly leak the machine layer.
 */
export const MISSING_INPUTS_CUSTOMER_STRINGS: readonly string[] = [
  // Portal — branded and brand-neutral.
  portalNotice('Peachtree Realty'),
  portalNotice(null),
  // Support — one gap, and the both-grounding-loads-failed pair.
  supportNotice([MISSING_WORKSPACE]),
  supportNotice([MISSING_CAPABILITY_SNAPSHOT, MISSING_KNOWLEDGE]),
  supportNotice([MISSING_WORKSPACE, MISSING_CAPABILITY_SNAPSHOT, MISSING_KNOWLEDGE]),
  // Reply draft — the full zero-grounding set.
  replyDraftNotice([MISSING_CUSTOMER_CONTEXT, MISSING_DRAFT_PREFERENCES]),
  replyDraftNotice([
    MISSING_CUSTOMER_CONTEXT,
    MISSING_DRAFT_PREFERENCES,
    MISSING_THREAD_SUMMARY,
    MISSING_SCHEDULE,
  ]),
  // Every label, standalone — they are read verbatim by the customer.
  ...[
    MISSING_CASE_TITLE,
    MISSING_CASE_STATUS,
    MISSING_WORKSPACE,
    MISSING_CAPABILITY_SNAPSHOT,
    MISSING_KNOWLEDGE,
    MISSING_CUSTOMER_CONTEXT,
    MISSING_DRAFT_PREFERENCES,
    MISSING_THREAD_SUMMARY,
    MISSING_SCHEDULE,
  ].map((m) => m.label),
] as const;
