import type { ComplianceRule } from "../../types";

/**
 * AICPA Code of Professional Conduct — confidential client information.
 *
 * Independent of statute (IRC § 7216) — the AICPA Code is the standards
 * baseline for AICPA members. Sentinel uses both to evaluate drafts that
 * disclose client information.
 */
export const rule: ComplianceRule = {
  ruleId: "aicpa-confidential-client-information",
  title: "AICPA Code — Confidential Client Information Rule",
  summary:
    "An AICPA member in public practice may not disclose any confidential client information without the specific consent of the client, subject to limited exceptions for compulsory legal process, ethics investigations, peer review, and similar circumstances.",
  jurisdiction: "professional-pronouncement",
  scope: { kind: "professional-body", body: "AICPA" },
  citation: {
    source: "AICPA Code of Professional Conduct § 1.700.001 (Confidential Client Information Rule)",
    url: "https://us.aicpa.org/research/standards/codeofconduct",
    accessedAt: "2026-05-12",
  },
  literalText: `[UNVERIFIED — needs counsel] Substance of AICPA Code § 1.700.001:

A member in public practice shall not disclose any confidential client information without the specific consent of the client. This rule shall not be construed (1) to relieve a member of his or her professional obligations of the Compliance With Standards Rule [1.310.001] or the Accounting Principles Rule [1.320.001], (2) to affect in any way the member's obligation to comply with a validly issued and enforceable subpoena or summons, or to prohibit a member's compliance with applicable laws and government regulations, (3) to prohibit review of a member's professional practice under AICPA or state CPA society or Board of Accountancy authorization, or (4) to preclude a member from initiating a complaint with, or responding to any inquiry made by, the professional ethics division or trial board of the Institute or a duly constituted investigative or disciplinary body of a state CPA society or Board of Accountancy.

Members of any of the bodies identified in (4) above and members involved with professional practice reviews identified in (3) above shall not use to their own advantage or disclose any member's confidential client information that comes to their attention in carrying out those activities. This prohibition shall not restrict members' exchange of information in connection with the investigative or disciplinary proceedings described in (4) above or the professional practice reviews described in (3) above.`,
  unverified: true,
  drafterNotes:
    "Counsel: confirm 2014-restructured AICPA Code numbering (1.700.001) is still the current locator.",
};
