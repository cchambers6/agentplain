import type { ComplianceRule } from "../../types";

/**
 * ABA Model Rule 5.5 — Unauthorized Practice of Law / Multijurisdictional
 * Practice.
 *
 * Sentinel use: flag drafts that imply legal services in a state where
 * the lawyer is not admitted, or that suggest a non-lawyer (or AI agent
 * standing alone) is providing legal advice.
 */
export const rule: ComplianceRule = {
  ruleId: "mrpc-5-5-unauthorized-practice",
  title: "ABA Model Rule 5.5 — Unauthorized Practice of Law / Multijurisdictional Practice",
  summary:
    "A lawyer shall not practice law in a jurisdiction in violation of the regulation of the legal profession in that jurisdiction or assist another in doing so; multijurisdictional temporary practice is permitted only under narrow conditions specified in 5.5(c).",
  jurisdiction: "model-rule",
  scope: { kind: "professional-body", body: "ABA" },
  citation: {
    source: "ABA Model Rules of Professional Conduct, Rule 5.5",
    url: "https://www.americanbar.org/groups/professional_responsibility/publications/model_rules_of_professional_conduct/rule_5_5_unauthorized_practice_of_law_multijurisdictional_practice_of_law/",
    accessedAt: "2026-06-06",
  },
  literalText: `Rule 5.5: Unauthorized Practice of Law; Multijurisdictional Practice of Law

(a) A lawyer shall not practice law in a jurisdiction in violation of the regulation of the legal profession in that jurisdiction, or assist another in doing so.

(b) A lawyer who is not admitted to practice in this jurisdiction shall not:
  (1) except as authorized by these Rules or other law, establish an office or other systematic and continuous presence in this jurisdiction for the practice of law; or
  (2) hold out to the public or otherwise represent that the lawyer is admitted to practice law in this jurisdiction.

(c) A lawyer admitted in another United States jurisdiction, and not disbarred or suspended from practice in any jurisdiction, may provide legal services on a temporary basis in this jurisdiction that:
  (1) are undertaken in association with a lawyer who is admitted to practice in this jurisdiction and who actively participates in the matter;
  (2) are in or reasonably related to a pending or potential proceeding before a tribunal in this or another jurisdiction, if the lawyer, or a person the lawyer is assisting, is authorized by law or order to appear in such proceeding or reasonably expects to be so authorized;
  (3) are in or reasonably related to a pending or potential arbitration, mediation, or other alternative dispute resolution proceeding in this or another jurisdiction, if the services arise out of or are reasonably related to the lawyer's practice in a jurisdiction in which the lawyer is admitted to practice and are not services for which the forum requires pro hac vice admission; or
  (4) are not within paragraphs (c)(2) or (c)(3) and arise out of or are reasonably related to the lawyer's practice in a jurisdiction in which the lawyer is admitted to practice.`,
  purpose: "counsel-reference",
  severity: "blocking",
  counselReviewStatus: "draft",
  category: "unauthorized-practice",
  safeRewrite:
    "Do not offer, imply, or confirm legal services in a state where the responsible lawyer is not admitted, and do not hold the firm out as admitted to practice in a jurisdiction where it is not. For an out-of-state inquiry, draft a referral or a clear statement of the admitted jurisdictions rather than substantive advice on that state's law. Never let agent output stand as legal advice without an admitted, supervising lawyer — an AI agent giving legal advice standing alone is itself a UPL exposure. Confirm temporary multijurisdictional practice fits a narrow 5.5(c) basis before drafting cross-state work.",
  drafterNotes:
    "Counsel-reference: whether conduct is unauthorized cross-state practice or fits a 5.5(c) carve-out is a fact/law judgment, so this never auto-flags. This is the cross-state surface flagged as MOST AMBIGUOUS in metadata — a multi-state firm's admitted-jurisdiction map and each target state's UPL definition must be overlaid before any literal-match path. ABA Model Rule text re-verified 2026-06-06 against americanbar.org. GA deviates on 5.5 multijurisdictional carve-outs (see ga-rules-of-professional-conduct).",
};
