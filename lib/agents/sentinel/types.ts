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
 * How sentinel uses a rule against customer-facing drafts.
 *
 * - `literal-match` — the rule ships a `triggers[]` list of literal
 *   phrases. Sentinel scans drafts deterministically (word-boundary,
 *   case-insensitive) and emits a flag on every match. Audit-defensible:
 *   the matched phrase IS the rule.
 * - `counsel-reference` — the rule is corpus content but requires
 *   generative judgment to evaluate (e.g. "the lawyer must act with
 *   reasonable diligence"). Sentinel does NOT auto-match these; they
 *   surface in the counsel-handoff packet and stay out of the live loop
 *   until a counsel-reviewed matching path is wired separately.
 *
 * Per the project memo: LITERAL MATCH ONLY ships live. Anything requiring
 * generative judgment is `counsel-reference` and never auto-flags.
 */
export type RuleMatchPurpose = "literal-match" | "counsel-reference";

/**
 * How sentinel weights a flag for the operator. This is advisory metadata
 * for the /approvals UI and the counsel-handoff packet — per
 * `project_no_outbound_architecture.md` sentinel NEVER blocks a send, so
 * `blocking` means "counsel-grade exposure, surface prominently," not
 * "stop the draft."
 *
 * - `blocking`  — phrase is a probable per-se violation (e.g. a Reg Z
 *   § 1026.24(i) prohibited representation, an FHA-protected-class
 *   limitation). Operator should remove or rewrite before sending.
 * - `advisory`  — phrase is lawful but conditions a duty (e.g. a Reg Z
 *   § 1026.24(d)(1) triggering term that requires additional disclosure,
 *   a claim-handling timeline reference). Operator should confirm the
 *   accompanying requirement is satisfied.
 * - `info`      — scope/routing rule with no draft-text match (e.g. a
 *   licensure or regulator-identity rule). Surfaces as context only.
 */
export type RuleSeverity = "blocking" | "advisory" | "info";

/**
 * Per-rule counsel review status. Distinct from corpus-level
 * `CorpusMetadata.status`: a corpus can be DRAFT overall while individual
 * rules move through review independently.
 *
 * - `draft`    — drafted by the fleet, not yet counsel-reviewed (default).
 * - `reviewed` — counsel has red-lined and approved this exact rule.
 * - `rejected` — counsel reviewed and struck this rule; the scanner MUST
 *   never fire it even if `unverified` was left unset.
 *
 * Relationship to `unverified`: `unverified` is the SCANNER GATE (a rule
 * never fires live while `unverified === true`); `counselReviewStatus` is
 * the HUMAN-FACING workflow state surfaced in the counsel-handoff packet
 * and the operator UI. For LITERAL-MATCH rules the two stay consistent:
 * `draft` ⟺ `unverified: true`, so a draft phrase never fires. A
 * COUNSEL-REFERENCE rule never fires regardless, so it may carry
 * `counselReviewStatus: 'draft'` with `unverified: false` when the drafter
 * pulled authentic published text but counsel has not yet approved its
 * use. The scanner additionally refuses to fire a `rejected` rule as a
 * belt-and-suspenders guard.
 */
export type CounselReviewStatus = "draft" | "reviewed" | "rejected";

/**
 * A deterministic regular-expression trigger. Used where a literal phrase
 * list cannot capture the pattern (e.g. "$0 down", "guaranteed … approval",
 * a dollar/percentage figure). Still audit-defensible: the pattern IS the
 * rule, and `example` shows exactly what it is meant to catch.
 *
 * Per the project memo (LITERAL MATCH ONLY ships live): regex triggers ride
 * the SAME `unverified` / env gate as literal triggers — they do not fire
 * live until counsel red-lines the rule AND the vertical's
 * `COMPLIANCE_CORPUS_COUNSEL_REVIEWED` flag is set. Until then they are
 * catalog content for the counsel-handoff packet only.
 */
export interface RuleRegexTrigger {
  /** Source string for `new RegExp(pattern, flags)`. Author in lowercase; the scanner lowercases input before matching. */
  pattern: string;
  /** Regex flags (default `"i"` applied by the matcher if omitted). */
  flags?: string;
  /** One-line description of what the pattern catches — shown to counsel. */
  description: string;
  /** A string the pattern MUST match (pins the intended behavior in tests). */
  example: string;
  /** A near-miss string the pattern MUST NOT match (guards over-matching). */
  counterExample: string;
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
   * Which sentinel path this rule runs through. `literal-match` rules
   * MUST populate `triggers`; `counsel-reference` rules MUST leave it
   * empty. Defaults to `counsel-reference` when omitted so a malformed
   * rule never accidentally lights up the live scanner.
   */
  purpose?: RuleMatchPurpose;
  /**
   * Literal phrases the sentinel scanner matches against (whole-phrase,
   * case-insensitive, word-boundary-aware). Required when
   * `purpose === "literal-match"`. Leave empty / omitted when the rule
   * requires generative judgment — those flow through the counsel-
   * handoff packet instead. Each phrase MUST be lowercase.
   */
  triggers?: string[];
  /**
   * Deterministic regex triggers — for patterns a literal phrase list
   * cannot express ("$0 down", "guaranteed … approval", a dollar figure).
   * Catalog content for the counsel-handoff packet; rides the same
   * `unverified` / env gate as literal `triggers` before it can fire live.
   */
  triggerRegexes?: RuleRegexTrigger[];
  /**
   * How prominently the operator UI surfaces a flag from this rule, and
   * how the counsel packet groups it. Advisory metadata only — sentinel
   * never blocks a send. Defaults to `advisory` when omitted.
   */
  severity?: RuleSeverity;
  /**
   * Drafter-suggested safe replacement / remediation guidance shown
   * alongside a flag and in the counsel-handoff packet. Guidance, not a
   * mechanical 1:1 substitution — one rule can fire on many phrases, so
   * this describes the fix rather than swapping a single token.
   */
  safeRewrite?: string;
  /**
   * Per-rule counsel workflow state. Defaults to `draft` when omitted.
   * Kept consistent with `unverified` in this corpus (`draft` ⟺
   * `unverified: true`); the scanner refuses to fire a `rejected` rule
   * regardless of `unverified`.
   */
  counselReviewStatus?: CounselReviewStatus;
  /**
   * Optional protected-class / category tag attached to flags produced
   * by this rule. For housing rules these mirror HUD's enumerated
   * protected classes (race, color, religion, sex, national-origin,
   * disability, familial-status). For other domains it's the rule
   * category (e.g. "anti-rebating", "unauthorized-practice").
   */
  category?: string;
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
