import type { ComplianceRule } from "../../types";

/**
 * ABA Model Rule 1.1 — Competence.
 *
 * Most-cited rule on AI-generated legal work: Comment [8] adopted in 2012
 * extends competence to "the benefits and risks associated with relevant
 * technology." Sentinel uses Rule 1.1 to flag drafts that delegate
 * substantive legal judgment to the agent without lawyer oversight.
 */
export const rule: ComplianceRule = {
  ruleId: "mrpc-1-1-competence",
  title: "ABA Model Rule 1.1 — Competence",
  summary:
    "A lawyer shall provide competent representation, requiring the legal knowledge, skill, thoroughness, and preparation reasonably necessary for the representation; competence includes keeping abreast of changes in the law and its practice, including the benefits and risks of relevant technology.",
  jurisdiction: "model-rule",
  scope: { kind: "professional-body", body: "ABA" },
  citation: {
    source: "ABA Model Rules of Professional Conduct, Rule 1.1; Comment [8] (technology competence)",
    url: "https://www.americanbar.org/groups/professional_responsibility/publications/model_rules_of_professional_conduct/rule_1_1_competence/",
    accessedAt: "2026-05-12",
  },
  literalText: `Rule 1.1: Competence
A lawyer shall provide competent representation to a client. Competent representation requires the legal knowledge, skill, thoroughness and preparation reasonably necessary for the representation.

Comment [8] (Maintaining Competence):
To maintain the requisite knowledge and skill, a lawyer should keep abreast of changes in the law and its practice, including the benefits and risks associated with relevant technology, engage in continuing study and education and comply with all continuing legal education requirements to which the lawyer is subject.`,
  drafterNotes:
    "Comment [8] is the explicit 'technology competence' obligation adopted by most state bars. Sentinel uses this as the anchor when flagging law-vertical drafts that rely on agent output without indicia of lawyer review.",
};
