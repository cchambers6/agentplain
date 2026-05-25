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
    accessedAt: "2026-05-25",
  },
  literalText:
    "[DRAFT — needs counsel] Rule 7.1: A lawyer shall not make a false or misleading communication about the lawyer or the lawyer's services. A communication is false or misleading if it contains a material misrepresentation of fact or law, or omits a fact necessary to make the statement considered as a whole not materially misleading.\n\nRule 7.2(c): A lawyer shall not state or imply that a lawyer is certified as a specialist in a particular field of law, unless the lawyer has been certified by an organization approved by an appropriate state authority or accredited by the ABA, and the name of the certifying organization is clearly identified in the communication.\n\nCandidate trigger phrases below are nominated from these prohibitions but have NOT been counsel-verified for the firm's jurisdiction(s).",
  purpose: "literal-match",
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
  drafterNotes:
    "Drafted 2026-05-25. 'Specialist' and 'expert' phrases are direct Rule 7.2(c) targets; most state bars treat them as per-se misleading unless the lawyer's certification is named in the same communication. Superlatives ('best', '#1', 'top') and guarantees are core Rule 7.1 'unjustified expectation' targets. Borderline omissions held back for counsel: 'no recovery, no fee' / 'no fee unless we win' (legitimate in most states with disclaimer — recommend counsel-reference + state-specific disclaimer rule), 'aggressive', 'experienced' (too generic to literal-match without false-positive risk).",
};
