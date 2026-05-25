/**
 * lib/agents/sentinel/counsel-packet.ts
 *
 * Builds a counsel-handoff packet from a compliance corpus — the
 * deliverable counsel reads when they red-line a DRAFT corpus before
 * it flips to COUNSEL_REVIEWED.
 *
 * Per the vertical-depth brief (2026-05-22), each packet aggregates:
 *   - literal-match rules with their trigger phrases + citations (the
 *     deterministic phrases sentinel will flag in customer drafts)
 *   - counsel-reference rules with their full literal text + citations
 *     (the substantive law sentinel does NOT auto-match — counsel
 *     judges these case-by-case in the LLM-classifier follow-up)
 *   - the open questions from corpus metadata
 *
 * Per `feedback_no_guesses_no_estimates.md`: every entry in the packet
 * carries a citation URL + accessedAt date so counsel can audit
 * staleness.
 *
 * Per `project_counsel_engaged.md`: this is the bridge between
 * sentinel's deterministic scanner and the human-attorney workflow.
 * No deliverable goes to counsel without this packet — it's the only
 * defensible way to gate corpus review.
 */

import type { ComplianceRule, CorpusBundle, RuleCitation } from "./types";

/**
 * One literal-match phrase ready for counsel review. The phrase is the
 * audit-defensible match string sentinel will fire on; the citation
 * grounds the phrase in a published rule.
 */
export interface PacketLiteralTrigger {
  ruleId: string;
  ruleTitle: string;
  phrase: string;
  category: string | null;
  citation: RuleCitation;
}

/**
 * One CANDIDATE literal-match phrase — drafted from a regulator's text but
 * not yet counsel-verified. Sentinel WILL NOT fire on these (the scanner
 * skips `unverified: true` rules); they live in the packet so counsel can
 * red-line phrase-by-phrase before the rule flips to verified literal-match.
 *
 * Counsel decides per phrase: approve as literal-match, reword, demote to
 * counsel-reference, or strike. The drafterNotes field on the underlying
 * rule captures why the phrase was nominated.
 */
export interface PacketCandidateLiteralTrigger extends PacketLiteralTrigger {
  drafterNotes: string | null;
}

/**
 * One counsel-reference rule — the substantive law sentinel will NOT
 * auto-flag. Counsel decides whether to (a) approve as reference
 * material only, (b) commission an LLM-classifier path, or (c) extract
 * additional literal triggers from the rule text.
 */
export interface PacketCounselReference {
  ruleId: string;
  ruleTitle: string;
  summary: string;
  literalText: string;
  citation: RuleCitation;
}

/**
 * The counsel-handoff packet. Send this to counsel verbatim — it has
 * every input they need to red-line the corpus.
 */
export interface CounselHandoffPacket {
  verticalSlug: string;
  status: CorpusBundle["metadata"]["status"];
  lastReviewedAt: string;
  counselReviewer: string | null;
  /**
   * Phrases sentinel WILL fire on today (rules already counsel-verified).
   * Empty for verticals whose corpus is still DRAFT.
   */
  literalTriggers: PacketLiteralTrigger[];
  /**
   * Phrases drafted from regulator text but NOT counsel-verified — sentinel
   * does not fire on these. This is the bucket counsel red-lines first to
   * move a vertical's sentinel from advisory to live.
   */
  candidateLiteralTriggers: PacketCandidateLiteralTrigger[];
  counselReferences: PacketCounselReference[];
  openQuestions: string[];
}

export function buildCounselHandoffPacket(corpus: CorpusBundle): CounselHandoffPacket {
  const literalTriggers: PacketLiteralTrigger[] = [];
  const candidateLiteralTriggers: PacketCandidateLiteralTrigger[] = [];
  const counselReferences: PacketCounselReference[] = [];

  for (const rule of corpus.rules) {
    if (isLiteralMatchRule(rule)) {
      for (const phrase of rule.triggers ?? []) {
        literalTriggers.push({
          ruleId: rule.ruleId,
          ruleTitle: rule.title,
          phrase,
          category: rule.category ?? null,
          citation: { ...rule.citation },
        });
      }
      continue;
    }
    if (isCandidateLiteralRule(rule)) {
      for (const phrase of rule.triggers ?? []) {
        candidateLiteralTriggers.push({
          ruleId: rule.ruleId,
          ruleTitle: rule.title,
          phrase,
          category: rule.category ?? null,
          citation: { ...rule.citation },
          drafterNotes: rule.drafterNotes ?? null,
        });
      }
      continue;
    }
    // Everything else — counsel-reference rules and unverified rules
    // without literal-match purpose — lands in the counsel-reference
    // bucket so the attorney sees the full literal text.
    counselReferences.push({
      ruleId: rule.ruleId,
      ruleTitle: rule.title,
      summary: rule.summary,
      literalText: rule.literalText,
      citation: { ...rule.citation },
    });
  }

  return {
    verticalSlug: corpus.verticalSlug,
    status: corpus.metadata.status,
    lastReviewedAt: corpus.metadata.lastReviewedAt,
    counselReviewer: corpus.metadata.counselReviewer,
    literalTriggers,
    candidateLiteralTriggers,
    counselReferences,
    openQuestions: corpus.metadata.openQuestions ?? [],
  };
}

function isLiteralMatchRule(rule: ComplianceRule): boolean {
  if (rule.purpose !== "literal-match") return false;
  if (rule.unverified) return false;
  return Array.isArray(rule.triggers) && rule.triggers.length > 0;
}

function isCandidateLiteralRule(rule: ComplianceRule): boolean {
  if (rule.purpose !== "literal-match") return false;
  if (!rule.unverified) return false;
  return Array.isArray(rule.triggers) && rule.triggers.length > 0;
}
