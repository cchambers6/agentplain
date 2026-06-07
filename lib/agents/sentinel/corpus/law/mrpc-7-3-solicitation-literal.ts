import type { ComplianceRule } from "../../types";

/**
 * ABA Model Rule 7.3 — Solicitation of Clients.
 *
 * Sentinel anchor for outreach / lead-response drafts. Rule 7.3(b) bars
 * solicitation of professional employment by LIVE PERSON-TO-PERSON CONTACT
 * (in-person, face-to-face, live phone, or other real-time visual/auditory
 * contact) when a significant motive is the lawyer's pecuniary gain, outside
 * the enumerated exceptions; 7.3(c) bars solicitation that targets someone
 * who has said they do not want to be solicited, or that involves coercion,
 * duress, or harassment.
 *
 * Sentinel use: COUNSEL-REFERENCE. Whether a draft constitutes prohibited
 * live solicitation depends on the channel (a written email/letter is NOT
 * "live person-to-person contact"), the motive, and the recipient
 * relationship — all generative judgments. agentplain drafts text; it does
 * not place live calls (see project_no_outbound_architecture.md), so the
 * live-contact bar is mostly a routing/advisory concern. This stays
 * counsel-reference and never auto-flags.
 */
export const rule: ComplianceRule = {
  ruleId: "mrpc-7-3-solicitation",
  title: "ABA Model Rule 7.3 — Solicitation of Clients",
  summary:
    "A lawyer shall not solicit professional employment by live person-to-person contact (in-person, face-to-face, live telephone, or other real-time visual/auditory contact) when a significant motive is the lawyer's pecuniary gain, unless the contact is with another lawyer, someone with a family / close personal / prior business or professional relationship, or someone who routinely uses the type of legal services offered; and shall not solicit at all where the target has said they do not want to be solicited or where the solicitation involves coercion, duress, or harassment.",
  jurisdiction: "model-rule",
  scope: { kind: "professional-body", body: "ABA" },
  citation: {
    source: "ABA Model Rules of Professional Conduct, Rule 7.3",
    url: "https://www.americanbar.org/groups/professional_responsibility/publications/model_rules_of_professional_conduct/rule_7_3_solicitation_of_clients/",
    accessedAt: "2026-06-06",
  },
  literalText: `Rule 7.3: Solicitation of Clients

(a) "Solicitation" or "solicit" denotes a communication initiated by or on behalf of a lawyer or law firm that is directed to a specific person the lawyer knows or reasonably should know needs legal services in a particular matter and that offers to provide, or reasonably can be understood as offering to provide, legal services for that matter.

(b) A lawyer shall not solicit professional employment by live person-to-person contact when a significant motive for the lawyer's doing so is the lawyer's or law firm's pecuniary gain, unless the contact is with a:
  (1) lawyer;
  (2) person who has a family, close personal, or prior business or professional relationship with the lawyer or law firm; or
  (3) person who routinely uses for business purposes the type of legal services offered by the lawyer.

(c) A lawyer shall not solicit professional employment even when not otherwise prohibited by paragraph (b), if:
  (1) the target of the solicitation has made known to the lawyer a desire not to be solicited by the lawyer; or
  (2) the solicitation involves coercion, duress or harassment.

(d) This Rule does not prohibit a lawyer from contacting persons who are known to routinely use, for business purposes, the type of legal services offered by the lawyer or from participating with a prepaid or group legal service plan operated by an organization not owned or directed by the lawyer that uses live person-to-person contact to enroll members or sell subscriptions for the plan from persons who are not known to need legal services in a particular matter covered by the plan.`,
  purpose: "counsel-reference",
  severity: "advisory",
  counselReviewStatus: "draft",
  category: "solicitation",
  safeRewrite:
    "If the draft is a written communication (email or letter) to a person known to need legal services in a specific matter, confirm it is permitted written solicitation and carries any state-required 'Advertising Material' / disclosure label — written contact is not the 'live person-to-person contact' Rule 7.3(b) bars, but it remains a regulated solicitation. Never script live, real-time outreach (a call or in-person pitch) to a non-exempt prospect known to need legal services with pecuniary motive. Honor any prior 'do not solicit me' request and strike any coercive, high-pressure, or deadline-laden language.",
  drafterNotes:
    "Counsel-reference, severity advisory: whether a specific draft is prohibited solicitation turns on channel, motive, and recipient relationship — generative judgments, so no auto-flag. Because agentplain drafts text and never places live calls (project_no_outbound_architecture.md), the 7.3(b) live-contact bar is largely a routing concern; the residual live surface is the operator copy-pasting an agent-drafted phone script. ABA Model Rule text pulled 2026-06-06 from americanbar.org (corroborated via state mirrors). NOTE: many states overlay a written-solicitation 'Advertising Material' labeling requirement (former Model Rule 7.3(c)); counsel to add the firm's state-specific labeling literal. Conservatively kept counsel-reference rather than literal-match: a small candidate list (e.g. 'act now before the statute of limitations runs', 'sign today') risks high false-positive rate without per-state tuning.",
};
