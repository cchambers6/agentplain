import type { ComplianceRule } from "../../types";

/**
 * PCAOB AS 1015 — Due Professional Care in the Performance of Work
 * (professional skepticism).
 *
 * Applies to engagements where a CPA firm audits an issuer / SEC-registrant.
 * Scope/standard-of-care rule (severity 'info') — it conditions HOW audit
 * work is performed, not a per-se draft-text violation. Counsel-reference:
 * whether skepticism was adequately exercised is judgment, never a literal
 * match. Sentinel surfaces it so audit-engagement drafts that imply a
 * pre-judged or rubber-stamped opinion get a duty-of-care flag.
 */
export const rule: ComplianceRule = {
  ruleId: "pcaob-as-1015-due-professional-care",
  title: "PCAOB AS 1015 — Due Professional Care / professional skepticism",
  summary:
    "In an audit of an issuer, the auditor must exercise due professional care in planning and performing the audit and preparing the report, which requires professional skepticism — an attitude that includes a questioning mind and a critical assessment of audit evidence, neither assuming management dishonesty nor unquestioned honesty.",
  jurisdiction: "professional-pronouncement",
  scope: { kind: "professional-body", body: "PCAOB" },
  citation: {
    source: "PCAOB AS 1015 — Due Professional Care in the Performance of Work (¶¶ .07–.09, professional skepticism)",
    url: "https://pcaobus.org/oversight/standards/auditing-standards/details/AS1015",
    accessedAt: "2026-06-06",
  },
  literalText: `[UNVERIFIED — needs counsel] Substance of PCAOB AS 1015 (Due Professional Care in the Performance of Work):

.01 Due professional care is to be exercised in the planning and performance of the audit and the preparation of the report.

.07 Due professional care requires the auditor to exercise professional skepticism. Professional skepticism is an attitude that includes a questioning mind and a critical assessment of audit evidence.

.08 Gathering and objectively evaluating audit evidence requires the auditor to consider the competency and sufficiency of the evidence. In exercising professional skepticism, the auditor should not be satisfied with less than persuasive evidence because of a belief that management is honest.

.09 In exercising professional skepticism, the auditor should neither assume that management is dishonest nor assume unquestioned honesty. In developing an opinion, the auditor neither assumes that management is dishonest nor assumes that management is of unquestioned honesty.`,
  purpose: "counsel-reference",
  severity: "info",
  counselReviewStatus: "draft",
  unverified: true,
  safeRewrite:
    "When an audit-engagement draft implies the opinion is pre-decided, that management's representations will be accepted at face value, or that the audit is a formality ('we'll sign off quickly', 'no need to test, we trust the numbers'), surface AS 1015's professional-skepticism duty: due professional care requires a questioning mind and a critical assessment of evidence, neither presuming dishonesty nor unquestioned honesty. Rewrite to preserve the testing/evidence step.",
  drafterNotes:
    "Left unverified 2026-06-06: the authoritative pcaobus.org AS 1015 page is a JS-rendered SPA that returned 404 to automated fetch, so the EXACT paragraph wording (¶¶ .07–.09) could not be machine-verified. The literalText above is reconstructed from corroborating secondary sources (Global Relay rule mirror grip.globalrelay.com; PCAOB skepticism Spotlight PDF) and carries the [UNVERIFIED] placeholder per corpus convention. Counsel: confirm the verbatim ¶ .07/.08/.09 text and whether AS 1015 has been superseded/amended under the 2024 AS 1000 rulemaking (PCAOB-2024-01) before flipping unverified. Severity 'info' — duty-of-care/scope rule, only fires for issuer-audit workspaces.",
};
