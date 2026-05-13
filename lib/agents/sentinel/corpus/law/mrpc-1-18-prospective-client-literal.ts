import type { ComplianceRule } from "../../types";

/**
 * ABA Model Rule 1.18 — Duties to Prospective Client.
 *
 * Sentinel anchor for intake-form processing: even a brief consultation
 * that doesn't ripen into representation triggers limited confidentiality
 * and conflict obligations.
 */
export const rule: ComplianceRule = {
  ruleId: "mrpc-1-18-prospective-client",
  title: "ABA Model Rule 1.18 — Duties to Prospective Client",
  summary:
    "Even when no client-lawyer relationship ensues, a lawyer who has had discussions with a prospective client owes that person a duty of confidentiality and may not undertake representation adverse to the prospective client in the same or a substantially related matter if information learned could be significantly harmful, subject to written consent or specified screening conditions.",
  jurisdiction: "model-rule",
  scope: { kind: "professional-body", body: "ABA" },
  citation: {
    source: "ABA Model Rules of Professional Conduct, Rule 1.18",
    url: "https://www.americanbar.org/groups/professional_responsibility/publications/model_rules_of_professional_conduct/rule_1_18_duties_of_prospective_client/",
    accessedAt: "2026-05-12",
  },
  literalText: `Rule 1.18: Duties to Prospective Client

(a) A person who consults with a lawyer about the possibility of forming a client-lawyer relationship with respect to a matter is a prospective client.

(b) Even when no client-lawyer relationship ensues, a lawyer who has learned information from a prospective client shall not use or reveal that information, except as Rule 1.9 would permit with respect to information of a former client.

(c) A lawyer subject to paragraph (b) shall not represent a client with interests materially adverse to those of a prospective client in the same or a substantially related matter if the lawyer received information from the prospective client that could be significantly harmful to that person in the matter, except as provided in paragraph (d). If a lawyer is disqualified from representation under this paragraph, no lawyer in a firm with which that lawyer is associated may knowingly undertake or continue representation in such a matter, except as provided in paragraph (d).

(d) When the lawyer has received disqualifying information as defined in paragraph (c), representation is permissible if:
  (1) both the affected client and the prospective client have given informed consent, confirmed in writing, or:
  (2) the lawyer who received the information took reasonable measures to avoid exposure to more disqualifying information than was reasonably necessary to determine whether to represent the prospective client; and
    (i) the disqualified lawyer is timely screened from any participation in the matter and is apportioned no part of the fee therefrom; and
    (ii) written notice is promptly given to the prospective client.`,
};
