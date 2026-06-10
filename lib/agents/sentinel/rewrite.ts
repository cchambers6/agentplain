/**
 * lib/agents/sentinel/rewrite.ts
 *
 * Rewrite-and-stage (pride-audit theme #9).
 *
 * The compliance scanner flags a violating phrase. A flag alone is a
 * liability ALERT — it tells the operator "this is a problem" and stops.
 * Rewrite-and-stage turns the alert into a ONE-TAP FIX: for every flag,
 * it drafts the COMPLIANT REPLACEMENT SENTENCE in place — grounded in the
 * exact corpus rule that fired, carrying that rule's citation — so the
 * operator can swap the offending span for compliant copy with one tap on
 * /approvals. No SMB compliance tool does this.
 *
 * THREE SUGGESTION SOURCES (in priority order):
 *   1. `learned`   — counsel red-lined this exact (rule, clause) pattern
 *                    >= LEARNED_LANGUAGE_THRESHOLD times and converged on
 *                    preferred language. We use it VERBATIM, no LLM call.
 *                    This is the counsel-feedback redline loop closing on
 *                    the rewrite side.
 *   2. `llm`       — the LlmProvider drafts a compliant replacement grounded
 *                    in the rule's literalText + category + any drafter
 *                    safeRewrite guidance.
 *   3. `fallback`  — deterministic, no-LLM. Used when no LLM is provided OR
 *                    the LLM call fails. Degrades safely to a category-aware
 *                    neutral rewrite (or, worst case, flag-only with a
 *                    redaction marker) so the signal is never lost.
 *
 * GO-LIVE GATE (pfd-5): rewrite-and-stage only drafts replacement legal text
 * for a vertical the COUNSEL GATE clears — env kill-switch
 * (COMPLIANCE_CORPUS_COUNSEL_REVIEWED) AND a durable per-vertical
 * `ComplianceCounselSignoff` row, FAIL-CLOSED. No vertical is exempt
 * (real-estate's old baseline exemption was removed). For gated verticals we
 * DO NOT flip the gate — we surface the counsel handoff instead
 * (`gated: true`), so the operator sees "this needs counsel sign-off before
 * Plaino can suggest a rewrite." We never invent legal language for a vertical
 * counsel hasn't cleared, and ANY ambiguity (unsigned/revoked/store-error/
 * unknown vertical) resolves to gated.
 *
 * Per `feedback_cold_start_safe_agents.md`: the redline store is re-read
 * on every call; nothing is cached in process.
 * Per `project_no_outbound_architecture.md`: this drafts/stages only. The
 * customer's own system applies the swap when the operator approves.
 */

import type { ComplianceFlag } from "./scanner";
import type { ComplianceRule, CorpusBundle, RuleCitation } from "./types";
import { defaultCounselGate } from "./index";
import type { CounselGateResolver } from "./counsel-signoff";
import {
  normalizeClausePattern,
  type LearnedClauseLanguage,
  type RedlineStore,
} from "./redline-store";
import type { LlmProvider } from "../../llm/types";
import { MODEL_OPUS } from "../../llm/model-tiers";

/** Where a suggested replacement came from. Surfaced to the operator so
 *  they know whether to trust it verbatim (`learned`) or read it (`llm`). */
export type RewriteSource = "learned" | "llm" | "fallback" | "gated";

/**
 * One flag, upgraded into a stageable one-tap fix. Carries the original
 * flag span (so the UI can highlight + replace it), the compliant
 * replacement sentence, and the rule citation that grounds it.
 */
export interface StagedRewrite {
  /** The originating scan flag — span offsets, matched text, rule id. */
  flag: ComplianceFlag;
  /**
   * The compliant replacement copy the operator can swap in with one tap.
   * Empty string only when source === "gated" (no suggestion produced
   * because the vertical isn't counsel-cleared).
   */
  suggestedReplacement: string;
  /** Where the suggestion came from. */
  source: RewriteSource;
  /** The rule citation, copied for audit convenience on the approval row. */
  ruleCitation: RuleCitation;
  /** Human-readable rule title (mirrors the flag — handy for the UI). */
  ruleTitle: string;
  /**
   * True when the vertical is NOT counsel-cleared for rewrite-and-stage.
   * The flag still surfaces; the suggestion is withheld pending counsel
   * sign-off (the CONNER ACTION). UI shows the counsel-handoff note.
   */
  gated: boolean;
  /** Counsel-handoff note when `gated` — names what needs sign-off. */
  gateNote?: string;
}

export interface StageRewritesInput {
  /** Vertical slug — drives the go-live gate. */
  verticalSlug: string;
  /** Flags the scanner produced for the draft. */
  flags: ComplianceFlag[];
  /** Corpus the flags came from (rule lookup for grounding). */
  corpus: CorpusBundle;
  /** Workspace id — scopes the redline store reads. */
  workspaceId: string;
  /** LlmProvider for grounded generation. Omit for the deterministic path. */
  llm?: LlmProvider;
  /** Durable counsel-redline store. Omit to skip the learned-language path. */
  redlineStore?: RedlineStore;
  /**
   * The counsel gate: "may this vertical's rewrites fire live?" Combines the
   * env kill-switch with the durable per-vertical sign-off, FAIL-CLOSED.
   * Defaults to `defaultCounselGate` (Prisma-backed). Tests inject an
   * in-memory-store-backed resolver via `makeCounselGate`. The gate is awaited
   * once per call; its `false` answer means rewrites are withheld and the
   * counsel-handoff note surfaces instead (NEVER replacement legal text).
   */
  counselGate?: CounselGateResolver;
}

const GATE_NOTE = (verticalSlug: string) =>
  `Rewrite-and-stage is counsel-gated for the "${verticalSlug}" vertical. ` +
  `Plaino has flagged the phrase but will not draft replacement legal ` +
  `language until BOTH (a) an operator records the counsel sign-off for ` +
  `"${verticalSlug}" after uploading the signed artifact (durable ` +
  `ComplianceCounselSignoff row) AND (b) the slug is in ` +
  `COMPLIANCE_CORPUS_COUNSEL_REVIEWED. Until then this is a flag-only alert ` +
  `— route the corpus through the counsel-handoff packet for sign-off.`;

const SYSTEM_PROMPT = [
  "You are Plaino, a compliance copy-editor for a local business.",
  "A deterministic compliance scanner flagged a specific phrase in a draft",
  "as a likely violation of a named rule. Your job: rewrite ONLY the flagged",
  "phrase into compliant, neutral copy that keeps the draft's intent where",
  "lawful and removes the violating preference/limitation entirely.",
  "",
  "Hard rules:",
  "- Output ONLY the replacement copy for the flagged span — no preamble, no",
  "  quotes, no explanation, no markdown.",
  "- Ground the rewrite in the RULE TEXT provided. Do not invent legal",
  "  language. If the lawful move is to DELETE the phrase (it expresses an",
  "  unlawful preference with no compliant equivalent), return a neutral",
  "  factual substitute about the property/service, never the protected-class",
  "  reference.",
  "- Keep it short — a phrase or one sentence, matching the flagged span's",
  "  scale. Never longer than two sentences.",
  "- Plain, calm, professional. No emoji. No marketing fluff.",
].join("\n");

/**
 * Upgrade scan flags into stageable one-tap fixes. Returns one
 * `StagedRewrite` per flag, in the same order. Cold-start-safe: reads the
 * redline store fresh; degrades to the deterministic fallback when no LLM
 * is wired or the call fails.
 */
export async function stageRewrites(
  input: StageRewritesInput,
): Promise<StagedRewrite[]> {
  // FAIL-CLOSED: resolve the counsel gate once. Any ambiguity (unsigned,
  // revoked, env-off, store error, unknown vertical) returns false → rewrites
  // are withheld and we surface the counsel-handoff note instead. We never
  // draft replacement legal text for a vertical the gate hasn't cleared.
  const gate = input.counselGate ?? defaultCounselGate;
  let live: boolean;
  try {
    live = await gate(input.verticalSlug);
  } catch {
    live = false; // belt-and-suspenders: a throwing gate is treated as gated.
  }
  const ruleById = new Map<string, ComplianceRule>();
  for (const rule of input.corpus.rules) ruleById.set(rule.ruleId, rule);

  // Cold-start-safe read of learned counsel language, grouped by rule.
  // One read per distinct rule that fired — re-read every call, never cached.
  const learnedByRule = new Map<string, LearnedClauseLanguage[]>();
  if (live && input.redlineStore) {
    const firedRuleIds = new Set(input.flags.map((f) => f.ruleId));
    for (const ruleId of firedRuleIds) {
      try {
        const learned = await input.redlineStore.learnedLanguageForRule({
          workspaceId: input.workspaceId,
          verticalSlug: input.verticalSlug,
          ruleId,
        });
        learnedByRule.set(ruleId, learned);
      } catch {
        // Best-effort — a store failure must not lose the flag. Falls back.
        learnedByRule.set(ruleId, []);
      }
    }
  }

  const out: StagedRewrite[] = [];
  for (const flag of input.flags) {
    const rule = ruleById.get(flag.ruleId);
    const citation = rule?.citation ?? flag.citation;

    if (!live) {
      out.push({
        flag,
        suggestedReplacement: "",
        source: "gated",
        ruleCitation: citation,
        ruleTitle: flag.ruleTitle,
        gated: true,
        gateNote: GATE_NOTE(input.verticalSlug),
      });
      continue;
    }

    // 1. Learned counsel language wins — verbatim, no LLM.
    const learned = findLearnedFor(learnedByRule.get(flag.ruleId) ?? [], flag);
    if (learned) {
      out.push({
        flag,
        suggestedReplacement: learned.language,
        source: "learned",
        ruleCitation: citation,
        ruleTitle: flag.ruleTitle,
        gated: false,
      });
      continue;
    }

    // 2. LLM-grounded generation.
    if (input.llm) {
      const generated = await generateReplacement({
        llm: input.llm,
        flag,
        rule,
        verticalSlug: input.verticalSlug,
        workspaceId: input.workspaceId,
      });
      if (generated) {
        out.push({
          flag,
          suggestedReplacement: generated,
          source: "llm",
          ruleCitation: citation,
          ruleTitle: flag.ruleTitle,
          gated: false,
        });
        continue;
      }
    }

    // 3. Deterministic, no-LLM fallback.
    out.push({
      flag,
      suggestedReplacement: deterministicFallback(flag, rule),
      source: "fallback",
      ruleCitation: citation,
      ruleTitle: flag.ruleTitle,
      gated: false,
    });
  }

  return out;
}

/**
 * Match a flag to learned language. Learned buckets are keyed by the
 * normalized clause pattern; the flag's matched phrase is the lookup key.
 */
function findLearnedFor(
  learned: LearnedClauseLanguage[],
  flag: ComplianceFlag,
): LearnedClauseLanguage | null {
  const key = normalizeClausePattern(flag.matchedPhrase);
  for (const l of learned) {
    if (l.clausePattern === key) return l;
  }
  return null;
}

async function generateReplacement(args: {
  llm: LlmProvider;
  flag: ComplianceFlag;
  rule: ComplianceRule | undefined;
  verticalSlug: string;
  workspaceId: string;
}): Promise<string | null> {
  const { llm, flag, rule } = args;
  const ruleText = rule?.literalText ?? flag.ruleTitle;
  const safeGuidance = rule?.safeRewrite
    ? `\nDrafter remediation guidance: ${rule.safeRewrite}`
    : "";
  const userPrompt = [
    `RULE: ${flag.ruleTitle}`,
    `RULE CATEGORY: ${flag.category ?? "(uncategorized)"}`,
    `CITATION: ${flag.citation.source}`,
    "",
    "RULE TEXT (ground the rewrite in this):",
    ruleText,
    safeGuidance,
    "",
    `FLAGGED PHRASE (in the ${flag.source}): "${flag.matchedText}"`,
    `SURROUNDING EXCERPT: ${flag.excerpt}`,
    "",
    "Return ONLY the compliant replacement copy for the flagged phrase.",
  ].join("\n");

  let result;
  try {
    result = await llm.complete({
      system: SYSTEM_PROMPT,
      model: MODEL_OPUS,
      cacheSystem: true,
      messages: [{ role: "user", content: userPrompt }],
      maxTokens: 200,
      temperature: 0.2,
      responseFormat: "text",
      meta: {
        skill: "compliance-rewrite-stage",
        workspaceId: args.workspaceId,
        verticalSlug: args.verticalSlug,
        sourceSurface: "OTHER",
      },
    });
  } catch {
    return null;
  }
  if (!result.ok) return null;
  const text = sanitizeReplacement(result.value.text);
  return text.length > 0 ? text : null;
}

/** Strip stray quoting / fencing / preamble the model might add. */
function sanitizeReplacement(raw: string): string {
  let t = raw.trim();
  t = t.replace(/^```[a-z]*\s*/i, "").replace(/```\s*$/i, "").trim();
  // Drop a single layer of wrapping quotes.
  if (
    (t.startsWith('"') && t.endsWith('"')) ||
    (t.startsWith("'") && t.endsWith("'"))
  ) {
    t = t.slice(1, -1).trim();
  }
  // Drop an obvious "Replacement:" / "Rewrite:" lead-in if the model added one.
  t = t.replace(/^(replacement|rewrite|suggested(?:\s+replacement)?)\s*:\s*/i, "").trim();
  return t;
}

/**
 * Deterministic, no-LLM compliant replacement. Used when no provider is
 * wired or the LLM fails. Never fabricates legal language — it produces a
 * category-aware NEUTRAL substitute (for protected-class housing phrases,
 * the lawful move is to remove the preference and describe the
 * property/service factually) or, when no safe substitute is known, a
 * redaction marker so the flag is never silently lost.
 *
 * Drafter `safeRewrite` guidance, when the rule carries it, is preferred —
 * it's the human-authored remediation for that exact rule.
 */
export function deterministicFallback(
  flag: ComplianceFlag,
  rule: ComplianceRule | undefined,
): string {
  if (rule?.safeRewrite && rule.safeRewrite.trim().length > 0) {
    return rule.safeRewrite.trim();
  }
  const category = (flag.category ?? rule?.category ?? "").toLowerCase();
  switch (category) {
    case "fair-housing":
    case "familial-status":
      return "[removed — describe the property and amenities factually; do not reference any protected class]";
    default:
      return `[redacted pending compliant rewrite — "${flag.matchedText}" flagged under ${flag.ruleTitle}]`;
  }
}

export const __testing = { sanitizeReplacement, findLearnedFor };
