import type { ComplianceRule } from "../../types";

/**
 * Circular 230 § 10.29 — conflicts of interest.
 *
 * Direct rule for tax practitioners: cannot represent a client with a
 * directly adverse interest, or with a significant risk of materially
 * limited representation, unless three written-consent conditions are met.
 */
export const rule: ComplianceRule = {
  ruleId: "circular-230-conflicts-10-29",
  title: "Circular 230 § 10.29 — conflicting interests",
  summary:
    "A practitioner may not represent a client before the IRS if the representation involves a concurrent conflict of interest, unless the practitioner reasonably believes adequate representation can be provided, the representation is not prohibited by law, and each affected client gives informed written consent.",
  jurisdiction: "federal-regulation",
  scope: { kind: "federal" },
  citation: {
    source: "31 CFR § 10.29",
    url: "https://www.ecfr.gov/current/title-31/subtitle-A/part-10/subpart-B/section-10.29",
    accessedAt: "2026-05-12",
  },
  literalText: `[UNVERIFIED — needs counsel] Substance of 31 CFR § 10.29:

(a) Except as provided by paragraph (b) of this section, a practitioner shall not represent a client before the Internal Revenue Service if the representation involves a conflict of interest. A conflict of interest exists if—
  (1) The representation of one client will be directly adverse to another client; or
  (2) There is a significant risk that the representation of one or more clients will be materially limited by the practitioner's responsibilities to another client, a former client or a third person, or by a personal interest of the practitioner.
(b) Notwithstanding the existence of a conflict of interest under paragraph (a) of this section, the practitioner may represent a client if—
  (1) The practitioner reasonably believes that the practitioner will be able to provide competent and diligent representation to each affected client;
  (2) The representation is not prohibited by law; and
  (3) Each affected client waives the conflict of interest and gives informed consent, confirmed in writing by each affected client, at the time the existence of the conflict of interest is known by the practitioner. The confirmation may be made within a reasonable period after the informed consent, but in no event later than 30 days.
(c) Copies of the written consents must be retained by the practitioner for at least 36 months from the date of the conclusion of the representation of the affected clients, and the written consents must be provided to any officer or employee of the Internal Revenue Service on request.`,
  unverified: true,
  drafterNotes:
    "Counsel: please verify the 36-month retention requirement and 30-day confirmation window — these are the operationally load-bearing details sentinel would flag against.",
};
