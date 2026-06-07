import type { ComplianceRule } from "../../types";

/**
 * ABA Model Rules 7.1 / 7.2(c) — advertising candidate triggers.
 *
 * DRAFT, UNVERIFIED. Sentinel WILL NOT fire on these — the scanner skips
 * `unverified: true` rules. Candidate list for counsel red-line.
 *
 * Rule 7.1: A lawyer shall not make a false or misleading communication
 * about the lawyer or the lawyer's services. Comment [3] flags claims that
 * "lead a reasonable person to form an unjustified expectation that the
 * same results could be obtained for other clients."
 *
 * Rule 7.2(c): A lawyer shall not state or imply that a lawyer is certified
 * as a specialist in a particular field of law, unless (1) the lawyer has
 * been certified by an organization approved by the state authority or
 * accredited by the ABA, and (2) the certifying organization is clearly
 * identified.
 *
 * State bar rules diverge — many states adopt the model in spirit but with
 * specific disclaimer requirements (e.g. on contingent-fee language).
 * Candidate phrases here are nominated from the bare Model Rule text;
 * counsel will tighten per-jurisdiction.
 */
export const rule: ComplianceRule = {
  ruleId: "mrpc-7-1-advertising-candidates",
  title: "ABA Model Rule 7.1 / 7.2(c) — candidate advertising triggers (DRAFT)",
  summary:
    "Candidate literal phrases drafted from Model Rule 7.1's prohibition on false/misleading communications and Rule 7.2(c)'s restriction on specialist claims. Sentinel does NOT fire on these until counsel red-lines.",
  jurisdiction: "model-rule",
  scope: { kind: "professional-body", body: "ABA" },
  citation: {
    source: "ABA Model Rules of Professional Conduct, Rules 7.1 and 7.2(c)",
    url: "https://www.americanbar.org/groups/professional_responsibility/publications/model_rules_of_professional_conduct/rule_7_1_communication_concerning_a_lawyer_s_services/",
    accessedAt: "2026-06-06",
  },
  literalText:
    "[DRAFT — needs counsel] Rule 7.1: A lawyer shall not make a false or misleading communication about the lawyer or the lawyer's services. A communication is false or misleading if it contains a material misrepresentation of fact or law, or omits a fact necessary to make the statement considered as a whole not materially misleading.\n\nRule 7.2(c): A lawyer shall not state or imply that a lawyer is certified as a specialist in a particular field of law, unless the lawyer has been certified by an organization approved by an appropriate state authority or accredited by the ABA, and the name of the certifying organization is clearly identified in the communication.\n\nCandidate trigger phrases below are nominated from these prohibitions but have NOT been counsel-verified for the firm's jurisdiction(s).",
  purpose: "literal-match",
  severity: "blocking",
  counselReviewStatus: "draft",
  unverified: true,
  category: "advertising",
  triggers: [
    "guaranteed result",
    "guaranteed outcome",
    "guaranteed verdict",
    "guaranteed settlement",
    "we guarantee we will win",
    "we never lose",
    "100% win rate",
    "best lawyer in",
    "best attorney in",
    "top lawyer in",
    "#1 lawyer",
    "most successful lawyer",
    "specialist in",
    "specializing in",
    "certified specialist",
    "expert in",
    "legal expert",
  ],
  triggerRegexes: [
    {
      pattern:
        "\\bbest\\b[^.!?\\n]{0,40}\\b(lawyer|attorney|law firm|legal team)\\b[^.!?\\n]{0,20}\\bin\\b",
      flags: "i",
      description:
        "Catches superlative 'best … lawyer/attorney/law firm … in <place>' claims (a Rule 7.1 'unjustified expectation' / unverifiable-comparison target) beyond the fixed 'best lawyer in' / 'best attorney in' literals — e.g. 'the best personal injury attorney in Atlanta'.",
      example: "We are the best personal injury attorney in Atlanta.",
      counterExample: "We do our best to serve every client across Atlanta.",
    },
    {
      pattern: "\\bguarantee[ds]?\\b[^.!?\\n]{0,40}\\b(result|outcome|win|verdict|settlement|recovery)\\b",
      flags: "i",
      description:
        "Catches 'guaranteed … (result|outcome|win|verdict|settlement|recovery)' promises (a Rule 7.1 per-se misleading outcome guarantee) the fixed literal list misses, e.g. 'we guarantee a favorable outcome'.",
      example: "We guarantee a favorable outcome in your case.",
      counterExample: "Our retainer agreement guarantees a fixed monthly fee.",
    },
  ],
  safeRewrite:
    "Strike outcome guarantees and unverifiable superlatives. Replace 'guaranteed result/outcome/verdict/settlement' and 'we never lose' / '100% win rate' with truthful, non-promissory descriptions of experience or process. Do not call the lawyer a 'specialist'/'expert'/'certified specialist' in a field unless certified by a state-approved or ABA-accredited organization that is named in the same communication (Rule 7.2(c)); otherwise say 'experienced in' or 'practice focused on'. Remove '#1 / best / top … in <place>' comparative claims that cannot be factually substantiated.",
  drafterNotes:
    "Drafted 2026-05-25. 'Specialist' and 'expert' phrases are direct Rule 7.2(c) targets; most state bars treat them as per-se misleading unless the lawyer's certification is named in the same communication. Superlatives ('best', '#1', 'top') and guarantees are core Rule 7.1 'unjustified expectation' targets. Borderline omissions held back for counsel: 'no recovery, no fee' / 'no fee unless we win' (legitimate in most states with disclaimer — recommend counsel-reference + state-specific disclaimer rule), 'aggressive', 'experienced' (too generic to literal-match without false-positive risk).",
};
