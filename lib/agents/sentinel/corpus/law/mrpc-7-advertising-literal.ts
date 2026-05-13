import type { ComplianceRule } from "../../types";

/**
 * ABA Model Rules 7.1, 7.2, 7.3 — communications about a lawyer's services
 * and solicitation.
 *
 * Sentinel anchor for marketing/outreach drafts: false or misleading
 * statements about results, comparative-claims, specialization claims, and
 * direct solicitation of prospective clients.
 */
export const rule: ComplianceRule = {
  ruleId: "mrpc-7-1-through-7-3-communications-solicitation",
  title: "ABA Model Rules 7.1–7.3 — Communications about services, advertising, solicitation",
  summary:
    "A lawyer shall not make a false or misleading communication about the lawyer or the lawyer's services (Rule 7.1); communications must include identifying information (Rule 7.2); a lawyer shall not solicit professional employment by live person-to-person contact when a significant motive is the lawyer's pecuniary gain, subject to exceptions for other lawyers, family, close personal or prior professional relationships, and persons who routinely use the type of legal services involved (Rule 7.3).",
  jurisdiction: "model-rule",
  scope: { kind: "professional-body", body: "ABA" },
  citation: {
    source: "ABA Model Rules of Professional Conduct, Rules 7.1, 7.2, 7.3",
    url: "https://www.americanbar.org/groups/professional_responsibility/publications/model_rules_of_professional_conduct/rule_7_1_communication_concerning_a_lawyer_s_services/",
    accessedAt: "2026-05-12",
  },
  literalText: `Rule 7.1: Communications Concerning a Lawyer's Services
A lawyer shall not make a false or misleading communication about the lawyer or the lawyer's services. A communication is false or misleading if it contains a material misrepresentation of fact or law, or omits a fact necessary to make the statement considered as a whole not materially misleading.

Rule 7.2: Communications Concerning a Lawyer's Services: Specific Rules
(a) A lawyer may communicate information regarding the lawyer's services through any media.
(b) A lawyer shall not compensate, give or promise anything of value to a person for recommending the lawyer's services except that a lawyer may:
  (1) pay the reasonable costs of advertisements or communications permitted by this Rule;
  (2) pay the usual charges of a legal service plan or a not-for-profit or qualifying lawyer referral service;
  (3) pay for a law practice in accordance with Rule 1.17;
  (4) refer clients to another lawyer or a nonlawyer professional pursuant to an agreement not otherwise prohibited under these Rules that provides for the other person to refer clients or customers to the lawyer, if:
    (i) the reciprocal referral agreement is not exclusive; and
    (ii) the client is informed of the existence and nature of the agreement; and
  (5) give nominal gifts as an expression of appreciation that are neither intended nor reasonably expected to be a form of compensation for recommending a lawyer's services.
(c) A lawyer shall not state or imply that a lawyer is certified as a specialist in a particular field of law, unless:
  (1) the lawyer has been certified as a specialist by an organization that has been approved by an appropriate state authority or that has been accredited by the American Bar Association; and
  (2) the name of the certifying organization is clearly identified in the communication.
(d) Any communication made under this Rule must include the name and contact information of at least one lawyer or law firm responsible for its content.

Rule 7.3: Solicitation of Clients
(a) "Solicitation" or "solicit" denotes a communication initiated by or on behalf of a lawyer or law firm that is directed to a specific person the lawyer knows or reasonably should know needs legal services in a particular matter and that offers to provide, or reasonably can be understood as offering to provide, legal services for that matter.
(b) A lawyer shall not solicit professional employment by live person-to-person contact when a significant motive for the lawyer's doing so is the lawyer's or law firm's pecuniary gain, unless the contact is with a:
  (1) lawyer;
  (2) person who has a family, close personal, or prior business or professional relationship with the lawyer or law firm; or
  (3) person who routinely uses for business purposes the type of legal services offered by the lawyer.
(c) A lawyer shall not solicit professional employment even when not otherwise prohibited by paragraph (b), if:
  (1) the target of the solicitation has made known to the lawyer a desire not to be solicited by the lawyer; or
  (2) the solicitation involves coercion, duress or harassment.`,
};
