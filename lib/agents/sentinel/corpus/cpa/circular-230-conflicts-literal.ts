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
    url: "https://www.law.cornell.edu/cfr/text/31/10.29",
    accessedAt: "2026-06-06",
  },
  literalText: `31 CFR § 10.29 — Conflicting interests.

(a) Except as provided by paragraph (b) of this section, a practitioner shall not represent a client before the Internal Revenue Service if the representation involves a conflict of interest. A conflict of interest exists if—
  (1) The representation of one client will be directly adverse to another client; or
  (2) There is a significant risk that the representation of one or more clients will be materially limited by the practitioner's responsibilities to another client, a former client or a third person, or by a personal interest of the practitioner.
(b) Notwithstanding the existence of a conflict of interest under paragraph (a) of this section, the practitioner may represent a client if—
  (1) The practitioner reasonably believes that the practitioner will be able to provide competent and diligent representation to each affected client;
  (2) The representation is not prohibited by law; and
  (3) Each affected client waives the conflict of interest and gives informed consent, confirmed in writing by each affected client, at the time the existence of the conflict of interest is known by the practitioner. The confirmation may be made within a reasonable period after the informed consent, but in no event later than 30 days.
(c) Copies of the written consents must be retained by the practitioner for at least 36 months from the date of the conclusion of the representation of the affected clients, and the written consents must be provided to any officer or employee of the Internal Revenue Service on request.`,
  purpose: "counsel-reference",
  severity: "advisory",
  counselReviewStatus: "draft",
  safeRewrite:
    "When a draft proposes representing two parties with adverse or potentially competing interests (e.g. both spouses in a contested matter, a business and a departing partner, buyer and seller), do not imply the engagement can proceed without the § 10.29(b)(3) informed written consent of each affected client. Strike language promising to act for 'both sides' or to keep one client's information from another. Confirm written consents are obtained and retained 36 months before the engagement proceeds.",
  drafterNotes:
    "Verified 2026-06-06 against Cornell LII mirror of 31 CFR § 10.29 — the (a)/(b)/(c) wording, the 30-day confirmation window in (b)(3), and the 36-month retention in (c) all match the published text. Counsel-reference: conflict detection requires judgment about the parties' interests, so sentinel does not auto-match it.",
};
