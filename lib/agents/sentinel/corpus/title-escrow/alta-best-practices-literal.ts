import type { ComplianceRule } from "../../types";

/**
 * ALTA Title Insurance and Settlement Company Best Practices —
 * the seven-pillar framework (current version 4.2, effective 2025-08-19).
 *
 * Industry standard, not a statute. Lenders condition title/settlement
 * relationships on Best Practices compliance, so a draft that contradicts
 * a pillar (e.g. implies commingled escrow funds, missed three-way
 * reconciliation, sharing of NPI, or no consumer-complaint process) is a
 * counsel-grade exposure even though it is not a per-se legal violation.
 *
 * counsel-reference, severity "advisory": the pillars condition operational
 * duties; sentinel surfaces them in the counsel-handoff packet rather than
 * firing a literal match, because compliance is a process question, not a
 * fixed phrase.
 *
 * Pillar names verified live against alta.org on 2026-06-06 (Best Practices
 * 4.2 framework). The substance summaries are drafter paraphrase pending
 * counsel pull of the canonical framework PDF — see drafterNotes.
 */
export const rule: ComplianceRule = {
  ruleId: "alta-best-practices-seven-pillars",
  title: "ALTA Best Practices — seven-pillar framework (4.2)",
  summary:
    "ALTA's Title Insurance and Settlement Company Best Practices framework enumerates seven pillars (licensing; escrow trust accounting; protecting NPI; settlement processes; policy production; insurance & fidelity coverage; consumer complaints). Drafts that contradict a pillar — implying commingled escrow, missed three-way reconciliation, NPI disclosure, or no complaint process — are counsel-grade exposures even though the framework is an industry standard, not a statute.",
  jurisdiction: "industry-standard",
  scope: { kind: "professional-body", body: "ALTA" },
  citation: {
    source:
      "ALTA Title Insurance and Settlement Company Best Practices, Framework 4.2 (effective 2025-08-19), Pillars 1–7",
    url: "https://www.alta.org/best-practices/",
    accessedAt: "2026-06-06",
  },
  literalText: `ALTA Best Practices 4.2 — the seven pillars (pillar names per alta.org, accessed 2026-06-06; substance summaries below are drafter paraphrase pending counsel pull of the canonical framework PDF):

Pillar 1 — Licensing: Establish and maintain current license(s) as required to conduct the business of title insurance and settlement services.

Pillar 2 — Escrow Trust Accounting: Adopt and maintain appropriate written procedures and controls for escrow trust accounts allowing for electronic verification of reconciliation — including segregated trust accounts, monthly three-way reconciliation (bank balance, book balance, trial balance of open files), and restricted, authorized-only access.

Pillar 3 — Protecting NPI (Non-Public Personal Information): Adopt and maintain a written privacy and information security plan to protect Non-Public Personal Information as required by local, state and federal law.

Pillar 4 — Settlement Processes: Adopt standard real estate settlement procedures and policies that help ensure compliance with Federal and State Consumer Financial Laws as applicable to the settlement process.

Pillar 5 — Policy Production: Adopt and maintain written procedures related to title policy production, delivery, reporting and premium remittance.

Pillar 6 — Insurance & Fidelity Coverage: Maintain appropriate professional liability (errors & omissions) insurance and fidelity coverage.

Pillar 7 — Consumer Complaints: Adopt and maintain written procedures for receiving and resolving consumer complaints.`,
  purpose: "counsel-reference",
  severity: "advisory",
  counselReviewStatus: "draft",
  safeRewrite:
    "Confirm the draft does not contradict any pillar before it goes out: never imply escrow funds are commingled with operating funds or that reconciliation is skipped (Pillar 2); never transmit a consumer's NPI by unsecured channel (Pillar 3); route any consumer complaint through the documented complaint process (Pillar 7). When in doubt, attach the operational control that satisfies the pillar rather than describing a shortcut.",
  drafterNotes:
    "Pillar set verified live against alta.org on 2026-06-06: the current framework is version 4.2, effective 2025-08-19, with seven pillars (Licensing; Escrow Trust Accounting; Protecting NPI; Settlement Processes; Policy Production; Insurance & Fidelity Coverage; Consumer Complaints). Pillar NAMES are authentic published headings; the substance summaries under each are drafter paraphrase — counsel should pull the canonical ALTA Best Practices 4.2 PDF and confirm each summary, especially the Pillar 2 three-way-reconciliation cadence and the Pillar 3 NPI safeguards which intersect the wire-fraud rule (`wire-fraud-instructions`).",
};
