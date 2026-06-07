import type { ComplianceRule } from "../../types";

/**
 * ABA Model Rule 1.7 — Conflict of Interest: Current Clients.
 *
 * Load-bearing for any intake / matter-opening / co-representation draft.
 * A concurrent conflict (direct adversity, or a material-limitation risk
 * from another client / former client / third person / the lawyer's own
 * interest) is per-se prohibited unless every condition in 1.7(b) is met,
 * including informed consent confirmed in writing.
 *
 * Sentinel use: COUNSEL-REFERENCE. Whether a given matter creates a
 * concurrent conflict is a generative legal judgment (who are the parties,
 * are interests adverse, is the conflict consentable), so this never
 * auto-flags — it surfaces in the counsel-handoff packet so a human checks
 * the conflict screen before the draft goes out.
 */
export const rule: ComplianceRule = {
  ruleId: "mrpc-1-7-conflict-current-clients",
  title: "ABA Model Rule 1.7 — Conflict of Interest: Current Clients",
  summary:
    "A lawyer shall not represent a client if the representation involves a concurrent conflict of interest — direct adversity to another client, or a significant risk that the representation will be materially limited by responsibilities to another client, a former client, a third person, or the lawyer's own interest — unless every condition in 1.7(b) is satisfied, including each affected client's informed consent confirmed in writing.",
  jurisdiction: "model-rule",
  scope: { kind: "professional-body", body: "ABA" },
  citation: {
    source: "ABA Model Rules of Professional Conduct, Rule 1.7",
    url: "https://www.americanbar.org/groups/professional_responsibility/publications/model_rules_of_professional_conduct/rule_1_7_conflict_of_interest_current_clients/",
    accessedAt: "2026-06-06",
  },
  literalText: `Rule 1.7: Conflict of Interest: Current Clients

(a) Except as provided in paragraph (b), a lawyer shall not represent a client if the representation involves a concurrent conflict of interest. A concurrent conflict of interest exists if:
  (1) the representation of one client will be directly adverse to another client; or
  (2) there is a significant risk that the representation of one or more clients will be materially limited by the lawyer's responsibilities to another client, a former client or a third person or by a personal interest of the lawyer.

(b) Notwithstanding the existence of a concurrent conflict of interest under paragraph (a), a lawyer may represent a client if:
  (1) the lawyer reasonably believes that the lawyer will be able to provide competent and diligent representation to each affected client;
  (2) the representation is not prohibited by law;
  (3) the representation does not involve the assertion of a claim by one client against another client represented by the lawyer in the same litigation or other proceeding before a tribunal; and
  (4) each affected client gives informed consent, confirmed in writing.`,
  purpose: "counsel-reference",
  severity: "blocking",
  counselReviewStatus: "draft",
  category: "conflict",
  safeRewrite:
    "Do not open or commit to a matter before the conflict check clears. If the draft offers, accepts, or confirms representation, route it to a human to run the conflict screen against current and former clients first. Where a conflict exists but is consentable under 1.7(b), the engagement must obtain each affected client's informed consent confirmed in writing — do not paper over a non-consentable conflict (claim by one client against another in the same proceeding, or a representation prohibited by law).",
  drafterNotes:
    "Counsel-reference: determining whether interests are 'directly adverse' or 'materially limited' requires case-specific legal judgment, so this never auto-flags. It is the anchor for the counsel-handoff packet when an intake / matter-open / co-representation draft is produced. ABA Model Rule text pulled 2026-06-06 from americanbar.org (corroborated across state mirrors that adopt the Model Rule verbatim). Companion duty: Rule 1.9 (former clients) and Rule 1.10 (imputation) — counsel may want those as follow-on counsel-reference rules.",
};
