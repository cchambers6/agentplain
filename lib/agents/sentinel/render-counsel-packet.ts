/**
 * lib/agents/sentinel/render-counsel-packet.ts
 *
 * Renders a `CounselHandoffPacket` to Markdown — the human-readable
 * deliverable an attorney reads when red-lining a DRAFT corpus. The
 * structured packet (from `buildCounselHandoffPacket`) is the source of
 * truth; this renderer is a pure projection of it so the document never
 * drifts from the corpus.
 *
 * Per `feedback_no_guesses_no_estimates.md`: every entry renders its
 * citation source + URL + accessedAt so counsel can audit staleness.
 *
 * Per the counsel-handoff design: the packet groups phrases sentinel
 * WOULD fire on today (live literal triggers — empty while DRAFT), the
 * candidate literal + regex triggers counsel red-lines phrase-by-phrase,
 * the counsel-reference rules (substantive law sentinel never auto-flags),
 * and a "Questions for counsel" section that surfaces the corpus open
 * questions plus the per-rule drafter notes ranked so the most ambiguous
 * rules are obvious.
 */

import type {
  CounselHandoffPacket,
  PacketCandidateLiteralTrigger,
  PacketCandidateRegexTrigger,
  PacketCounselReference,
  PacketLiteralTrigger,
} from "./counsel-packet";

export interface RenderOptions {
  /** Human-readable vertical name for the title (e.g. "Mortgage"). */
  verticalLabel?: string;
  /** ISO date the packet was generated — stamped in the header. */
  generatedAt?: string;
}

const SEVERITY_LABEL: Record<string, string> = {
  blocking: "🔴 blocking",
  advisory: "🟡 advisory",
  info: "⚪ info",
};

function severityLabel(s: string): string {
  return SEVERITY_LABEL[s] ?? s;
}

/** Group a flat list of items by their `ruleId`, preserving first-seen order. */
function groupByRule<T extends { ruleId: string; ruleTitle: string }>(
  items: T[],
): Array<{ ruleId: string; ruleTitle: string; items: T[] }> {
  const order: string[] = [];
  const byId = new Map<string, { ruleId: string; ruleTitle: string; items: T[] }>();
  for (const item of items) {
    let group = byId.get(item.ruleId);
    if (!group) {
      group = { ruleId: item.ruleId, ruleTitle: item.ruleTitle, items: [] };
      byId.set(item.ruleId, group);
      order.push(item.ruleId);
    }
    group.items.push(item);
  }
  return order.map((id) => byId.get(id)!);
}

function renderCitation(c: { source: string; url: string; accessedAt: string }): string {
  return `${c.source}\n  — ${c.url} (read ${c.accessedAt})`;
}

function renderLiveTriggers(triggers: PacketLiteralTrigger[]): string {
  if (triggers.length === 0) {
    return (
      "_None. This corpus is DRAFT — no rule is counsel-verified, so the " +
      "scanner fires on nothing yet. Phrases below are candidates for review._\n"
    );
  }
  const lines: string[] = [];
  for (const group of groupByRule(triggers)) {
    lines.push(`#### ${group.ruleTitle} (\`${group.ruleId}\`)`);
    const first = group.items[0];
    lines.push(`- **Severity:** ${severityLabel(first.severity)}`);
    lines.push(`- **Citation:** ${renderCitation(first.citation)}`);
    if (first.safeRewrite) lines.push(`- **Safe rewrite:** ${first.safeRewrite}`);
    lines.push(`- **Phrases (${group.items.length}):**`);
    for (const t of group.items) lines.push(`  - \`${t.phrase}\``);
    lines.push("");
  }
  return lines.join("\n");
}

function renderCandidateLiterals(triggers: PacketCandidateLiteralTrigger[]): string {
  if (triggers.length === 0) return "_None._\n";
  const lines: string[] = [];
  for (const group of groupByRule(triggers)) {
    const first = group.items[0];
    lines.push(`#### ${group.ruleTitle} (\`${group.ruleId}\`)`);
    lines.push(`- **Severity:** ${severityLabel(first.severity)}`);
    if (first.category) lines.push(`- **Category:** ${first.category}`);
    lines.push(`- **Citation:** ${renderCitation(first.citation)}`);
    if (first.safeRewrite) lines.push(`- **Safe rewrite:** ${first.safeRewrite}`);
    if (first.drafterNotes) lines.push(`- **Drafter notes:** ${first.drafterNotes}`);
    lines.push(`- **Candidate phrases to red-line (${group.items.length}):**`);
    for (const t of group.items) {
      lines.push(`  - [ ] \`${t.phrase}\``);
    }
    lines.push("");
  }
  return lines.join("\n");
}

function renderCandidateRegexes(triggers: PacketCandidateRegexTrigger[]): string {
  if (triggers.length === 0) return "_None._\n";
  const lines: string[] = [];
  for (const group of groupByRule(triggers)) {
    lines.push(`#### ${group.ruleTitle} (\`${group.ruleId}\`)`);
    for (const rx of group.items) {
      lines.push(`- [ ] **Pattern:** \`/${rx.pattern}/${rx.flags}\` — ${severityLabel(rx.severity)}`);
      lines.push(`  - ${rx.description}`);
      lines.push(`  - **Matches (intended):** "${rx.example}"`);
      lines.push(`  - **Does NOT match (guard):** "${rx.counterExample}"`);
    }
    lines.push("");
  }
  return lines.join("\n");
}

function renderCounselReferences(refs: PacketCounselReference[]): string {
  if (refs.length === 0) return "_None._\n";
  const lines: string[] = [];
  for (const ref of refs) {
    lines.push(`#### ${ref.ruleTitle} (\`${ref.ruleId}\`)`);
    lines.push(`- **Severity:** ${severityLabel(ref.severity)} · **Status:** ${ref.counselReviewStatus}`);
    lines.push(`- **Citation:** ${renderCitation(ref.citation)}`);
    lines.push(`- **Summary:** ${ref.summary}`);
    if (ref.safeRewrite) lines.push(`- **Safe rewrite / guidance:** ${ref.safeRewrite}`);
    if (ref.drafterNotes) lines.push(`- **Drafter notes:** ${ref.drafterNotes}`);
    lines.push("");
    lines.push("> " + ref.literalText.replace(/\n/g, "\n> "));
    lines.push("");
  }
  return lines.join("\n");
}

/**
 * Heuristic ambiguity rank: a rule the drafter flagged as the "MOST
 * AMBIGUOUS" or repeatedly deferred to counsel surfaces first. We key off
 * the drafter notes / open questions that already mark uncertainty rather
 * than inventing a score — honest signal, not a fabricated metric.
 */
function renderQuestionsForCounsel(packet: CounselHandoffPacket): string {
  const lines: string[] = [];

  // 1. The curated corpus open questions — verbatim. The drafter has
  //    already marked the most ambiguous items inline ("MOST AMBIGUOUS").
  if (packet.openQuestions.length > 0) {
    lines.push("**Corpus open questions (drafter → counsel):**");
    lines.push("");
    for (const q of packet.openQuestions) lines.push(`- [ ] ${q}`);
    lines.push("");
  }

  // 2. Per-rule drafter notes, with the rules the drafter flagged as most
  //    ambiguous lifted to the top.
  const noted: Array<{ ruleId: string; ruleTitle: string; notes: string }> = [];
  const seen = new Set<string>();
  for (const t of packet.candidateLiteralTriggers) {
    if (t.drafterNotes && !seen.has(t.ruleId)) {
      seen.add(t.ruleId);
      noted.push({ ruleId: t.ruleId, ruleTitle: t.ruleTitle, notes: t.drafterNotes });
    }
  }
  for (const ref of packet.counselReferences) {
    if (ref.drafterNotes && !seen.has(ref.ruleId)) {
      seen.add(ref.ruleId);
      noted.push({ ruleId: ref.ruleId, ruleTitle: ref.ruleTitle, notes: ref.drafterNotes });
    }
  }
  const ambiguityScore = (n: string): number => {
    let s = 0;
    if (/most ambiguous/i.test(n)) s += 100;
    if (/could not|not be machine-fetched|unverified|placeholder/i.test(n)) s += 10;
    s += (n.match(/counsel/gi) ?? []).length;
    return s;
  };
  noted.sort((a, b) => ambiguityScore(b.notes) - ambiguityScore(a.notes));

  if (noted.length > 0) {
    lines.push("**Per-rule drafter notes (most ambiguous first):**");
    lines.push("");
    for (const n of noted) {
      lines.push(`- **${n.ruleTitle}** (\`${n.ruleId}\`): ${n.notes}`);
    }
    lines.push("");
  }
  return lines.join("\n");
}

export function renderCounselPacketMarkdown(
  packet: CounselHandoffPacket,
  opts: RenderOptions = {},
): string {
  const label = opts.verticalLabel ?? packet.verticalSlug;
  const generatedAt = opts.generatedAt ?? "(unstamped)";
  const candidatePhraseCount = packet.candidateLiteralTriggers.length;
  const candidateRegexCount = packet.candidateRegexTriggers.length;

  const out: string[] = [];
  out.push(`# Counsel handoff packet — ${label} compliance corpus`);
  out.push("");
  out.push(
    "> **DRAFT — not legal advice.** This packet is a fleet-drafted compliance " +
      "corpus for attorney review. No rule fires on customer drafts until counsel " +
      "red-lines it AND the vertical is enabled via `COMPLIANCE_CORPUS_COUNSEL_REVIEWED`. " +
      "Sentinel ADVISES; it never blocks a send.",
  );
  out.push("");
  out.push("## Status");
  out.push("");
  out.push(`- **Vertical:** \`${packet.verticalSlug}\``);
  out.push(`- **Corpus status:** ${packet.status}`);
  out.push(`- **Last reviewed:** ${packet.lastReviewedAt}`);
  out.push(`- **Counsel reviewer:** ${packet.counselReviewer ?? "_none yet_"}`);
  out.push(`- **Packet generated:** ${generatedAt}`);
  out.push("");
  out.push("### Coverage at a glance");
  out.push("");
  out.push(`| Bucket | Count |`);
  out.push(`| --- | --- |`);
  out.push(`| Live literal triggers (firing today) | ${packet.literalTriggers.length} |`);
  out.push(`| Candidate literal triggers (to red-line) | ${candidatePhraseCount} |`);
  out.push(`| Candidate regex triggers (to red-line) | ${candidateRegexCount} |`);
  out.push(`| Counsel-reference rules | ${packet.counselReferences.length} |`);
  out.push(`| Open questions | ${packet.openQuestions.length} |`);
  out.push("");
  out.push("## 1. Live literal triggers (firing on drafts today)");
  out.push("");
  out.push(renderLiveTriggers(packet.literalTriggers));
  out.push("## 2. Candidate literal triggers — counsel red-line, phrase by phrase");
  out.push("");
  out.push(
    "_Sentinel does NOT fire on these. Check a box to approve a phrase as a " +
      "literal-match trigger; strike, reword, or demote to counsel-reference otherwise._",
  );
  out.push("");
  out.push(renderCandidateLiterals(packet.candidateLiteralTriggers));
  out.push("## 3. Candidate regex triggers — counsel red-line");
  out.push("");
  out.push(
    "_Deterministic patterns for cases a literal phrase list can't express. " +
      "Each shows the string it must match and a near-miss it must not._",
  );
  out.push("");
  out.push(renderCandidateRegexes(packet.candidateRegexTriggers));
  out.push("## 4. Counsel-reference rules — substantive law, never auto-flagged");
  out.push("");
  out.push(renderCounselReferences(packet.counselReferences));
  out.push("## 5. Questions for counsel");
  out.push("");
  out.push(renderQuestionsForCounsel(packet));
  return out.join("\n");
}
