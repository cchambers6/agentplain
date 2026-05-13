import type { ComplianceRule } from "../../types";

/**
 * Circular 230 § 10.27 — contingent-fee restrictions.
 */
export const rule: ComplianceRule = {
  ruleId: "circular-230-fees-10-27",
  title: "Circular 230 § 10.27 — fees (contingent-fee restriction)",
  summary:
    "A practitioner may not charge an unconscionable fee, and may not charge a contingent fee for services rendered in connection with any matter before the IRS except in three narrow situations (representation in connection with an examination of an original return, claims for refund filed solely in connection with the determination of statutory interest or penalties, or judicial proceedings under the Internal Revenue Code).",
  jurisdiction: "federal-regulation",
  scope: { kind: "federal" },
  citation: {
    source: "31 CFR § 10.27",
    url: "https://www.ecfr.gov/current/title-31/subtitle-A/part-10/subpart-B/section-10.27",
    accessedAt: "2026-05-12",
  },
  literalText: `[UNVERIFIED — needs counsel] Substance of 31 CFR § 10.27:

(a) In general. A practitioner may not charge an unconscionable fee in connection with any matter before the Internal Revenue Service.
(b) Contingent fees—
  (1) Except as provided in paragraphs (b)(2), (3), and (4) of this section, a practitioner may not charge a contingent fee for services rendered in connection with any matter before the Internal Revenue Service.
  (2) A practitioner may charge a contingent fee for services rendered in connection with the Service's examination of, or challenge to—
    (i) An original tax return; or
    (ii) An amended return or claim for refund or credit where the amended return or claim for refund or credit was filed within 120 days of the taxpayer receiving a written notice of the examination of, or a written challenge to, the original tax return.
  (3) A practitioner may charge a contingent fee for services rendered in connection with a claim for credit or refund filed solely in connection with the determination of statutory interest or penalties assessed by the Internal Revenue Service.
  (4) A practitioner may charge a contingent fee for services rendered in connection with any judicial proceeding arising under the Internal Revenue Code.

(c) Definitions. For purposes of this section—
  (1) Contingent fee is any fee that is based, in whole or in part, on whether or not a position taken on a tax return or other filing avoids challenge by the Internal Revenue Service or is sustained either by the Internal Revenue Service or in litigation. A contingent fee includes a fee that is based on a percentage of the refund reported on a return, that is based on a percentage of the taxes saved, or that otherwise depends on the specific result attained.`,
  unverified: true,
  drafterNotes:
    "Counsel: please verify the 120-day window in (b)(2)(ii) and the contingent-fee definition in (c)(1) — these are the load-bearing details for sentinel pattern matching on fee-arrangement drafts.",
};
