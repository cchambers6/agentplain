/**
 * lib/agents/sentinel/redline-store.ts
 *
 * Counsel-feedback redline loop — durable store + the learned-language
 * reader that feeds rewrite-and-stage.
 *
 * THE LOOP (pride-audit theme #14):
 *   1. Counsel red-lines a sentinel rewrite suggestion (or a flag) — the
 *      operator/counsel records the rule that fired, the offending phrase,
 *      and the language counsel ACTUALLY wants used in its place.
 *   2. Each red-line is one durable `CounselRedline` row, scoped to a
 *      (workspace, vertical, rule, clause-pattern) bucket.
 *   3. Once a bucket accumulates `LEARNED_LANGUAGE_THRESHOLD` (5) red-lines
 *      whose preferred language AGREES, that agreed clause language is
 *      surfaced to the rewrite engine and embedded in FUTURE suggestions
 *      for the same rule + clause pattern.
 *
 * Per `feedback_cold_start_safe_agents.md`: the rewrite engine re-reads
 * this store on EVERY fire — there is no in-process cache. Provider session
 * memory is performance, never correctness; the learned language is durable
 * state read fresh each time.
 *
 * Per `feedback_runner_portability.md` + the two-implementation rule:
 * `RedlineStore` is the port. `InMemoryRedlineStore` (tests + cold-start
 * default) and `PrismaRedlineStore` (prod, in prisma-redline-store.ts)
 * implement the same shape. Nothing here imports Prisma.
 *
 * Per `project_no_outbound_architecture.md`: this is internal advisory
 * state. Nothing here sends, blocks, or escalates — it only shapes the
 * compliant-replacement text the operator sees on /approvals.
 */

/**
 * Minimum number of agreeing red-lines for a (rule, clausePattern) bucket
 * before its preferred language is treated as "learned" and embedded in
 * future rewrite suggestions. Below this the bucket is still accumulating
 * and the rewrite engine ignores it — five independent counsel corrections
 * is the bar for "this is the house style now," not one attorney's one-off.
 */
export const LEARNED_LANGUAGE_THRESHOLD = 5;

/**
 * One durable counsel red-line. Recorded when counsel (via the operator)
 * corrects a sentinel suggestion or rewrites a flagged phrase by hand.
 */
export interface CounselRedline {
  id: string;
  /** Workspace the red-line was recorded in. */
  workspaceId: string;
  /** Vertical slug (`real-estate`, `mortgage`, …). Buckets are per-vertical. */
  verticalSlug: string;
  /** Corpus rule that fired the original flag (e.g. `fha-hud-literal-triggers`). */
  ruleId: string;
  /**
   * Normalized clause pattern the red-line applies to. Today this is the
   * lowercased trigger phrase / matched span — the same key the rewrite
   * engine looks up by. Normalization lives in `normalizeClausePattern`.
   */
  clausePattern: string;
  /**
   * The language counsel ACTUALLY wants used in place of the offending
   * phrase. This is the payload the learned-language reader returns once
   * the bucket clears the threshold. Plain text; no PII (counsel records
   * generic clause language, not a specific customer's draft).
   */
  preferredLanguage: string;
  /** Optional free-text counsel rationale — surfaced to the operator. */
  rationale: string | null;
  /** Who recorded it — counsel name / bar # or operator id. Audit only. */
  recordedBy: string | null;
  createdAt: Date;
}

/** A red-line proposed for recording, before it has an id / timestamp. */
export interface ProposedCounselRedline {
  workspaceId: string;
  verticalSlug: string;
  ruleId: string;
  clausePattern: string;
  preferredLanguage: string;
  rationale?: string | null;
  recordedBy?: string | null;
}

/**
 * Learned clause language for one (rule, clausePattern) bucket that has
 * cleared the threshold. This is what the rewrite engine embeds.
 */
export interface LearnedClauseLanguage {
  ruleId: string;
  clausePattern: string;
  /** The agreed preferred language (the most-recorded variant in the bucket). */
  language: string;
  /** How many red-lines back this language (>= LEARNED_LANGUAGE_THRESHOLD). */
  supportingRedlineCount: number;
}

/**
 * Workspace-scoped counsel-redline port. All implementations enforce
 * workspace isolation at the seam and read durable state fresh on every
 * call (cold-start-safe).
 */
export interface RedlineStore {
  readonly name: string;

  /** Record one counsel red-line. Returns the persisted row. */
  record(redline: ProposedCounselRedline): Promise<CounselRedline>;

  /**
   * List every red-line for a (workspace, vertical, rule) — used by the
   * learned-language reducer and by the counsel-review UI. Newest first.
   */
  listForRule(args: {
    workspaceId: string;
    verticalSlug: string;
    ruleId: string;
  }): Promise<CounselRedline[]>;

  /**
   * Return learned clause language for a (workspace, vertical, rule) — only
   * the buckets that have cleared `LEARNED_LANGUAGE_THRESHOLD` agreeing
   * red-lines. The rewrite engine calls this on every fire and embeds the
   * result. Buckets still accumulating return nothing.
   */
  learnedLanguageForRule(args: {
    workspaceId: string;
    verticalSlug: string;
    ruleId: string;
  }): Promise<LearnedClauseLanguage[]>;
}

/**
 * Normalize a clause pattern key so red-lines recorded against slightly
 * different surface forms ("Adults Only", "adults only", " adults  only ")
 * land in the same bucket. Lowercase, collapse internal whitespace, trim.
 *
 * Exported because both the recorder and the rewrite engine MUST key the
 * same way — a mismatch silently splits a bucket and the threshold never
 * fires.
 */
export function normalizeClausePattern(raw: string): string {
  return raw.toLowerCase().replace(/\s+/g, " ").trim();
}

/**
 * Pure reducer: given all red-lines for a rule, return the learned clause
 * language per bucket that has cleared the threshold. Shared by every
 * store impl so the threshold semantics live in ONE place.
 *
 * Agreement model: within a (ruleId, clausePattern) bucket we group by the
 * exact preferred language and pick the variant with the most supporting
 * red-lines. The bucket is "learned" only when the TOTAL red-lines in the
 * bucket >= threshold AND the winning variant is itself backed by at least
 * the threshold (so five red-lines that all disagree do NOT produce a
 * spurious "learned" answer — counsel hasn't actually converged).
 */
export function reduceLearnedLanguage(
  redlines: CounselRedline[],
): LearnedClauseLanguage[] {
  // bucket key -> preferred language -> count
  const buckets = new Map<string, Map<string, number>>();
  const ruleByBucket = new Map<string, { ruleId: string; clausePattern: string }>();

  for (const r of redlines) {
    const pattern = normalizeClausePattern(r.clausePattern);
    const key = `${r.ruleId}::${pattern}`;
    if (!ruleByBucket.has(key)) {
      ruleByBucket.set(key, { ruleId: r.ruleId, clausePattern: pattern });
    }
    let variants = buckets.get(key);
    if (!variants) {
      variants = new Map<string, number>();
      buckets.set(key, variants);
    }
    const lang = r.preferredLanguage.trim();
    if (!lang) continue;
    variants.set(lang, (variants.get(lang) ?? 0) + 1);
  }

  const out: LearnedClauseLanguage[] = [];
  for (const [key, variants] of buckets) {
    let winner: string | null = null;
    let winnerCount = 0;
    for (const [lang, count] of variants) {
      if (count > winnerCount) {
        winner = lang;
        winnerCount = count;
      }
    }
    if (winner !== null && winnerCount >= LEARNED_LANGUAGE_THRESHOLD) {
      const meta = ruleByBucket.get(key)!;
      out.push({
        ruleId: meta.ruleId,
        clausePattern: meta.clausePattern,
        language: winner,
        supportingRedlineCount: winnerCount,
      });
    }
  }
  return out;
}

/**
 * Cold-start default + test implementation. Holds red-lines in process.
 * Per the two-implementation rule this is the contract-pinning peer of
 * `PrismaRedlineStore`. Production constructs the Prisma impl; tests and
 * any caller that hasn't wired durable storage use this so the rewrite
 * engine degrades to "no learned language" rather than throwing.
 */
export class InMemoryRedlineStore implements RedlineStore {
  readonly name = "in-memory" as const;
  private readonly rows: CounselRedline[] = [];
  private seq = 0;

  constructor(seed: CounselRedline[] = []) {
    this.rows.push(...seed);
  }

  async record(redline: ProposedCounselRedline): Promise<CounselRedline> {
    const row: CounselRedline = {
      id: `redline-${++this.seq}`,
      workspaceId: redline.workspaceId,
      verticalSlug: redline.verticalSlug,
      ruleId: redline.ruleId,
      clausePattern: normalizeClausePattern(redline.clausePattern),
      preferredLanguage: redline.preferredLanguage.trim(),
      rationale: redline.rationale ?? null,
      recordedBy: redline.recordedBy ?? null,
      createdAt: new Date(),
    };
    this.rows.push(row);
    return row;
  }

  async listForRule(args: {
    workspaceId: string;
    verticalSlug: string;
    ruleId: string;
  }): Promise<CounselRedline[]> {
    return this.rows
      .filter(
        (r) =>
          r.workspaceId === args.workspaceId &&
          r.verticalSlug === args.verticalSlug &&
          r.ruleId === args.ruleId,
      )
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async learnedLanguageForRule(args: {
    workspaceId: string;
    verticalSlug: string;
    ruleId: string;
  }): Promise<LearnedClauseLanguage[]> {
    const rows = await this.listForRule(args);
    return reduceLearnedLanguage(rows);
  }
}
