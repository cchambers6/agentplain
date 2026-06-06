import type { ComplianceRule } from "../../types";

/**
 * NAIC Producer Licensing Model Act — ethics overlay.
 *
 * NAIC publishes the model act states adopt for producer licensing. Many
 * states (including GA) reflect the model's grounds for license revocation
 * for "demonstrating untrustworthiness or financial irresponsibility." The
 * NAIC model text itself is published behind NAIC's site — drafter has not
 * pulled the exact wording for this draft.
 */
export const rule: ComplianceRule = {
  ruleId: "producer-ethics-naic-model",
  title: "NAIC Producer Licensing Model Act — grounds for discipline",
  summary:
    "States adopting the NAIC Producer Licensing Model Act may revoke or refuse to renew a producer's license for fraudulent, coercive, or dishonest practices, including using fraudulent or coercive practices in conducting business and demonstrating untrustworthiness or financial irresponsibility.",
  jurisdiction: "model-rule",
  scope: { kind: "professional-body", body: "NAIC" },
  citation: {
    source: "NAIC Producer Licensing Model Act (Model #218), Section 12 (Grounds for Discipline)",
    url: "https://content.naic.org/sites/default/files/model-laws.pdf",
    accessedAt: "2026-05-12",
  },
  literalText: `[UNVERIFIED — needs counsel] Substance: NAIC Producer Licensing Model Act Section 12 enumerates grounds on which the insurance regulator may place on probation, suspend, revoke, or refuse to issue or renew a producer license, or levy a civil penalty. Listed grounds include: providing incorrect, misleading, incomplete, or materially untrue information in the license application; violating insurance laws or regulations of any other state; obtaining or attempting to obtain a license through misrepresentation or fraud; improperly withholding, misappropriating, or converting any moneys received in the course of doing insurance business; intentionally misrepresenting the terms of an actual or proposed insurance contract or application for insurance; having been convicted of a felony; having admitted or been found to have committed any insurance unfair trade practice or fraud; using fraudulent, coercive, or dishonest practices, or demonstrating incompetence, untrustworthiness, or financial irresponsibility.`,
  purpose: "counsel-reference",
  severity: "info",
  counselReviewStatus: "draft",
  unverified: true,
  safeRewrite:
    "No draft rewrite — this is a producer-conduct/discipline reference, not a content rule. Use it as context when a draft suggests misrepresentation, coercion, or mishandling of client funds, which independently implicate the misrepresentation and unfair-claims rules.",
  drafterNotes:
    "Counsel: please pull the NAIC Model #218 Section 12 text directly and replace placeholder. GA's adoption sits in O.C.G.A. § 33-23-21 — recommend adding a state-specific companion rule citing the GA section.",
};
