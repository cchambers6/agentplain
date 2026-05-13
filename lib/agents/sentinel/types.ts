/**
 * Sentinel compliance corpus — type definitions.
 *
 * The Sentinel agent advises agentplain's per-vertical skill chain on
 * regulatory exposure. Per `project_no_outbound_architecture.md`, sentinel
 * never blocks customer sends — it flags compliance risk in DRAFTS that
 * the customer's own system then accepts, edits, or discards before it
 * goes out the door.
 *
 * Per `feedback_no_guesses_no_estimates.md`: every rule entry carries a
 * concrete citation (statute / code section / pronouncement number) and
 * a date the source was read. When the citation cannot be verified, the
 * rule is marked `unverified: true` and the literal text is left as a
 * `[UNVERIFIED — needs counsel]` placeholder — sentinel never fabricates
 * regulatory text.
 *
 * Per `project_counsel_engaged.md`: every corpus ships with metadata
 * tracking status (DRAFT → COUNSEL_REVIEWED) so counsel can red-line
 * pre-launch. DRAFT corpus may still be loaded by the sentinel — the
 * status field surfaces uncertainty without blocking the build.
 *
 * Per `feedback_runner_portability.md`: the corpus is a typed interface,
 * not a JSON blob. A future per-customer override or CMS-backed corpus
 * implements the same shape behind `loadCorpusFor()`.
 */

/**
 * Tier of source authority. Lets sentinel weight a rule when multiple
 * sources cover the same conduct (e.g. federal RESPA + state escrow code).
 */
export type CorpusJurisdiction =
  | "federal-statute"
  | "federal-regulation"
  | "state-statute"
  | "state-regulation"
  | "state-board-rule"
  | "professional-pronouncement"
  | "industry-standard"
  | "model-rule";

/**
 * State / federal scope. Default `federal` for federally codified rules;
 * use a postal abbreviation for state-specific rules. The corpus loader
 * filters by `applicableStates` when a workspace is geographically scoped.
 *
 * Per `project_flatsbo_state_portability.md`: corpus is structured per-state
 * where applicable; default to federal + GA + leave hooks for future states.
 */
export type CorpusScope =
  | { kind: "federal" }
  | { kind: "state"; state: string }
  | { kind: "professional-body"; body: string };

/**
 * Single statutory / regulatory citation. Source is the formal reference
 * (e.g. "12 CFR § 1024.14"). URL points at an authoritative published copy
 * (eCFR, state legislature, IRS, ABA, etc.). `accessedAt` is the date the
 * drafter pulled the text; counsel uses it to gauge staleness.
 */
export interface RuleCitation {
  /** Formal statutory reference: "12 USC § 2607(a)", "O.C.G.A. § 44-7-31". */
  source: string;
  /** Authoritative URL where this excerpt was sourced. */
  url: string;
  /** ISO date string (YYYY-MM-DD) when source was last read. */
  accessedAt: string;
}

/**
 * One regulatory rule. Each ships as its own `*-literal.ts` file so a
 * sentinel update touches one rule, not the entire vertical bundle.
 */
export interface ComplianceRule {
  /** Stable slug — used in audit logs and sentinel flag IDs. */
  ruleId: string;
  /** Human-readable name (rendered in flagging UI). */
  title: string;
  /** What this rule governs in one sentence — sentinel routing hint. */
  summary: string;
  /** Authority tier — affects how sentinel weights the flag. */
  jurisdiction: CorpusJurisdiction;
  /** Geographic / professional scope. */
  scope: CorpusScope;
  /** Citation to the published source. */
  citation: RuleCitation;
  /**
   * Direct excerpt of the published rule text. Sentinel matches against
   * THIS, not a paraphrase. Excerpt should be long enough to stand on its
   * own when a flag is shown to the user, short enough that the file is
   * readable. Use `\n\n` between paragraphs.
   *
   * If the drafter could not verify the exact published text, set
   * `unverified: true` and put a `[UNVERIFIED — needs counsel]` placeholder
   * here. Sentinel will surface unverified rules with a counsel-review
   * badge instead of using them for matching.
   */
  literalText: string;
  /**
   * Set to `true` when the drafter could not independently verify the
   * exact published wording. Counsel red-lines these first.
   */
  unverified?: boolean;
  /**
   * Optional drafter notes — context that didn't fit in `summary` but
   * counsel will want when reviewing.
   */
  drafterNotes?: string;
}

/**
 * Corpus review status. New corpora ship as DRAFT — sentinel may use
 * them, but every customer-visible flag shows the DRAFT badge until
 * counsel red-lines. COUNSEL_REVIEWED flips the badge off.
 */
export type CorpusStatus = "DRAFT" | "COUNSEL_REVIEWED" | "DEPRECATED";

/**
 * Per-corpus review metadata. One per vertical directory.
 *
 * Per `project_counsel_engaged.md`: counsel red-lines DRAFT corpus, then
 * we flip `status` to COUNSEL_REVIEWED and fill `counselReviewer`.
 */
export interface CorpusMetadata {
  /** Vertical slug this corpus binds to (matches `lib/verticals/<slug>/`). */
  verticalSlug: string;
  /** ISO date — last time the drafter or counsel reviewed any rule. */
  lastReviewedAt: string;
  /** Name + bar# of the attorney who signed off; null until counsel review. */
  counselReviewer: string | null;
  /** Review state — gates customer-facing badges in the sentinel UI. */
  status: CorpusStatus;
  /** Optional free-text — what counsel still needs to look at. */
  openQuestions?: string[];
}

/**
 * Bundle returned by `loadCorpusFor(verticalSlug)`. The skills layer
 * consumes this to score drafts against compliance risk.
 */
export interface CorpusBundle {
  verticalSlug: string;
  metadata: CorpusMetadata;
  rules: ComplianceRule[];
}
