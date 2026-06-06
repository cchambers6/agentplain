/**
 * lib/agents/sentinel/scanner.ts
 *
 * Deterministic literal-match scanner for the Sentinel compliance corpus.
 *
 * Per the project memo (vertical-depth wave, 2026-05-22):
 *   LITERAL MATCH ONLY. Anything requiring generative judgment is
 *   `purpose: 'counsel-reference'` and is excluded from this scanner —
 *   it stays in the counsel-handoff packet and never auto-flags.
 *
 * Mirrors the design of flatsbo's `findHudLiteralMatches` (the original
 * housing-vertical implementation), but generalized so any corpus rule
 * can ship a `triggers` list. Sentinel becomes LIVE for a vertical as
 * soon as that vertical's corpus has at least one rule with non-empty
 * triggers — there is no LLM call on this path.
 *
 * Algorithm:
 *   - For each rule with purpose === 'literal-match':
 *     - For each phrase in triggers:
 *       - Find every whole-word, case-insensitive occurrence in text.
 *       - Emit a ComplianceFlag with offsets so the operator can pinpoint
 *         the matched span without re-scanning.
 *
 * Audit defensibility: the matched phrase IS the rule. No interpretation,
 * no paraphrase. Counsel can read the flag, trace it back to the citation,
 * and verify in seconds.
 */

import type { ComplianceRule, CorpusBundle, RuleCitation } from "./types";

/**
 * One literal-match hit produced by the scanner. Carries enough context
 * for the UI to highlight the match span and for the audit log to link
 * back to the rule citation.
 */
export interface ComplianceFlag {
  /** Stable id derived from rule + offset — used for dedupe + audit. */
  flagId: string;
  /** Slug of the corpus rule that fired this flag. */
  ruleId: string;
  /** Human-readable rule title — what the operator sees on /approvals. */
  ruleTitle: string;
  /** Free-text category from the rule (e.g. "familial-status"). */
  category: string | null;
  /** The literal phrase from the rule's triggers list that matched. */
  matchedPhrase: string;
  /** The matched text as it appears in the source (preserves case). */
  matchedText: string;
  /** Zero-based UTF-16 offset into the scanned text. */
  start: number;
  /** Exclusive end offset. */
  end: number;
  /** Optional surrounding excerpt for context in the UI (≤ 200 chars). */
  excerpt: string;
  /** Source field this match came from — subject vs body. */
  source: "subject" | "body";
  /** Citation snapshot copied from the rule for audit log convenience. */
  citation: RuleCitation;
}

export interface ScanInput {
  /** Subject line of the draft being checked. Scanned independently of body. */
  subject: string;
  /** Body text of the draft being checked. */
  body: string;
  /** Corpus to scan against. Pulled from `loadCorpusFor(verticalSlug)`. */
  corpus: CorpusBundle;
}

export interface ScanResult {
  /** All literal-match hits, sorted by (source, start). */
  flags: ComplianceFlag[];
  /** Rule ids of every rule with purpose='literal-match' the scanner ran. */
  rulesScanned: string[];
  /** Number of phrases checked across all rules. */
  phrasesChecked: number;
}

/**
 * Run the literal-match scanner over a draft's subject + body using a
 * vertical's compliance corpus. Returns an empty `flags` array when no
 * trigger matches — the chain still emits the `compliance-check` step so
 * the Sentinel roster card accrues activity.
 *
 * Counsel-reference rules are silently skipped (they're not a scanner
 * concern). The `rulesScanned` field reflects what actually ran.
 */
export function scanCorpus(input: ScanInput): ScanResult {
  const flags: ComplianceFlag[] = [];
  const rulesScanned: string[] = [];
  let phrasesChecked = 0;

  for (const rule of input.corpus.rules) {
    if (!isLiteralMatchRule(rule)) continue;
    rulesScanned.push(rule.ruleId);
    for (const phrase of rule.triggers ?? []) {
      const normalized = phrase.toLowerCase();
      if (!normalized) continue;
      phrasesChecked += 1;
      flags.push(...findMatches({
        rule,
        phrase: normalized,
        source: "subject",
        text: input.subject,
      }));
      flags.push(...findMatches({
        rule,
        phrase: normalized,
        source: "body",
        text: input.body,
      }));
    }
  }

  flags.sort((a, b) => {
    if (a.source !== b.source) return a.source === "subject" ? -1 : 1;
    return a.start - b.start;
  });

  return { flags, rulesScanned, phrasesChecked };
}

function isLiteralMatchRule(rule: ComplianceRule): boolean {
  if (rule.purpose !== "literal-match") return false;
  if (rule.unverified) return false;
  // Belt-and-suspenders: a rule counsel explicitly struck must never fire,
  // even if `unverified` was left unset on it.
  if (rule.counselReviewStatus === "rejected") return false;
  return Array.isArray(rule.triggers) && rule.triggers.length > 0;
}

interface FindMatchesArgs {
  rule: ComplianceRule;
  phrase: string;
  source: "subject" | "body";
  text: string;
}

function findMatches(args: FindMatchesArgs): ComplianceFlag[] {
  const { rule, phrase, source, text } = args;
  if (!text) return [];
  const lower = text.toLowerCase();
  const out: ComplianceFlag[] = [];
  let cursor = 0;
  while (cursor < lower.length) {
    const idx = lower.indexOf(phrase, cursor);
    if (idx === -1) break;
    const before = idx === 0 ? "" : lower[idx - 1];
    const after = lower[idx + phrase.length] ?? "";
    const boundaryBefore = !before || isWordBoundaryChar(before);
    const boundaryAfter = !after || isWordBoundaryChar(after);
    if (boundaryBefore && boundaryAfter) {
      const start = idx;
      const end = idx + phrase.length;
      out.push({
        flagId: `${rule.ruleId}:${source}:${start}:${phrase}`,
        ruleId: rule.ruleId,
        ruleTitle: rule.title,
        category: rule.category ?? null,
        matchedPhrase: phrase,
        matchedText: text.slice(start, end),
        start,
        end,
        excerpt: excerptAround(text, start, end),
        source,
        citation: rule.citation,
      });
    }
    cursor = idx + phrase.length;
  }
  return out;
}

function isWordBoundaryChar(ch: string): boolean {
  // Treat anything that isn't a letter or digit as a word boundary. We
  // intentionally allow apostrophes and hyphens to function as separators
  // because HUD-style triggers ("no kids") shouldn't fire on "no kid's").
  return !/[a-z0-9]/.test(ch);
}

function excerptAround(text: string, start: number, end: number): string {
  const radius = 60;
  const lo = Math.max(0, start - radius);
  const hi = Math.min(text.length, end + radius);
  const head = lo > 0 ? "…" : "";
  const tail = hi < text.length ? "…" : "";
  return `${head}${text.slice(lo, hi)}${tail}`;
}
