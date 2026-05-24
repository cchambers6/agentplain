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
  literalTriggers: PacketLiteralTrigger[];
  counselReferences: PacketCounselReference[];
  openQuestions: string[];
}

export function buildCounselHandoffPacket(corpus: CorpusBundle): CounselHandoffPacket {
  const literalTriggers: PacketLiteralTrigger[] = [];
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
    // Everything else — counsel-reference, unverified, or rules without a
    // declared purpose — lands in the counsel-reference bucket so the
    // attorney sees the full literal text.
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
    counselReferences,
    openQuestions: corpus.metadata.openQuestions ?? [],
  };
}

function isLiteralMatchRule(rule: ComplianceRule): boolean {
  if (rule.purpose !== "literal-match") return false;
  if (rule.unverified) return false;
  return Array.isArray(rule.triggers) && rule.triggers.length > 0;
}
