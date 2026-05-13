import type { ComplianceRule } from "../../types";

/**
 * ALTA Best Practices Pillar 2 — escrow trust accounting.
 *
 * Industry standard, not a statute. Sentinel uses this to flag drafts that
 * imply commingling, missed three-way reconciliations, or unsegregated
 * trust accounts.
 *
 * NOTE: drafter did not pull the exact pillar wording; flagged unverified.
 */
export const rule: ComplianceRule = {
  ruleId: "alta-best-practices-pillar-2-escrow",
  title: "ALTA Best Practices — Pillar 2: escrow trust accounting",
  summary:
    "ALTA Best Practices framework requires segregated trust accounts, monthly three-way reconciliation, and positive pay (or comparable fraud-prevention controls) on escrow accounts handled by title and settlement agents.",
  jurisdiction: "industry-standard",
  scope: { kind: "professional-body", body: "ALTA" },
  citation: {
    source: "ALTA Title Insurance and Settlement Company Best Practices, Pillar 2 (Escrow Trust Accounting)",
    url: "https://www.alta.org/best-practices/",
    accessedAt: "2026-05-12",
  },
  literalText: `[UNVERIFIED — needs counsel] Substance of ALTA Best Practices Pillar 2: Title and settlement companies shall (a) maintain appropriate written controls for escrow trust accounts; (b) perform monthly three-way reconciliation of escrow trust accounts (bank statement balance, book balance, and trial balance of open files); (c) limit escrow trust account access to authorized employees; (d) ensure escrow trust accounts are appropriately named and segregated from operating funds; (e) require background checks for employees with access to escrow funds; and (f) maintain fraud-prevention controls such as positive pay, ACH blocking, and wire-fraud prevention training.`,
  unverified: true,
  drafterNotes:
    "Counsel: please pull the canonical ALTA Pillar 2 text (current version) and replace the substance summary. The full ALTA framework has seven pillars — counsel may want sentinel to also load Pillar 3 (consumer/lender info security) and Pillar 4 (settlement processes).",
};
