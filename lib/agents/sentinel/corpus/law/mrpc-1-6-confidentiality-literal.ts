import type { ComplianceRule } from "../../types";

/**
 * ABA Model Rule 1.6 — Confidentiality of Information.
 *
 * Load-bearing for any agent that processes client communications.
 * Rule 1.6(c) (safeguarding obligation) is the technology-handling
 * anchor sentinel uses on cross-border data flow and vendor-disclosure
 * flags.
 */
export const rule: ComplianceRule = {
  ruleId: "mrpc-1-6-confidentiality",
  title: "ABA Model Rule 1.6 — Confidentiality of Information",
  summary:
    "A lawyer shall not reveal information relating to the representation of a client unless the client gives informed consent, the disclosure is impliedly authorized to carry out the representation, or a narrow exception in 1.6(b) applies; the lawyer shall also make reasonable efforts to prevent inadvertent or unauthorized disclosure (1.6(c)).",
  jurisdiction: "model-rule",
  scope: { kind: "professional-body", body: "ABA" },
  citation: {
    source: "ABA Model Rules of Professional Conduct, Rule 1.6",
    url: "https://www.americanbar.org/groups/professional_responsibility/publications/model_rules_of_professional_conduct/rule_1_6_confidentiality_of_information/",
    accessedAt: "2026-06-06",
  },
  literalText: `Rule 1.6: Confidentiality of Information

(a) A lawyer shall not reveal information relating to the representation of a client unless the client gives informed consent, the disclosure is impliedly authorized in order to carry out the representation or the disclosure is permitted by paragraph (b).

(b) A lawyer may reveal information relating to the representation of a client to the extent the lawyer reasonably believes necessary:
  (1) to prevent reasonably certain death or substantial bodily harm;
  (2) to prevent the client from committing a crime or fraud that is reasonably certain to result in substantial injury to the financial interests or property of another and in furtherance of which the client has used or is using the lawyer's services;
  (3) to prevent, mitigate or rectify substantial injury to the financial interests or property of another that is reasonably certain to result or has resulted from the client's commission of a crime or fraud in furtherance of which the client has used the lawyer's services;
  (4) to secure legal advice about the lawyer's compliance with these Rules;
  (5) to establish a claim or defense on behalf of the lawyer in a controversy between the lawyer and the client, to establish a defense to a criminal charge or civil claim against the lawyer based upon conduct in which the client was involved, or to respond to allegations in any proceeding concerning the lawyer's representation of the client;
  (6) to comply with other law or a court order; or
  (7) to detect and resolve conflicts of interest arising from the lawyer's change of employment or from changes in the composition or ownership of a firm, but only if the revealed information would not compromise the attorney-client privilege or otherwise prejudice the client.

(c) A lawyer shall make reasonable efforts to prevent the inadvertent or unauthorized disclosure of, or unauthorized access to, information relating to the representation of a client.`,
  purpose: "counsel-reference",
  severity: "blocking",
  counselReviewStatus: "draft",
  category: "confidentiality",
  safeRewrite:
    "Do not reveal information relating to a representation without the client's informed consent, implied authorization to carry out the representation, or a narrow 1.6(b) exception. Strike any draft that discloses client identity, matter facts, or strategy to a third party, CC's an outside recipient on privileged content, or routes client data to a vendor without the 1.6(c) reasonable-safeguards basis. When in doubt, redact identifying detail and route to a lawyer.",
  drafterNotes:
    "Counsel-reference: whether a given disclosure is 'impliedly authorized' or covered by a 1.6(b) exception is a legal judgment, so this never auto-flags. Rule 1.6(c) (safeguarding) is the technology-handling anchor sentinel uses on cross-border data-flow and vendor-disclosure flags. ABA Model Rule text re-verified 2026-06-06 against americanbar.org.",
};
