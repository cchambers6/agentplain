/**
 * lib/integrations/data-flow.ts
 *
 * Per-connector data-flow disclosure — the "when you connect X, here's what
 * flows where" one-pager surfaced on every integration detail page (and as a
 * compact line on the marketplace tile). Keyed by the connector's category so
 * one truthful disclosure covers every connector of a kind, with a `note` for
 * the one category (Documents) where the fleet keeps a copy on purpose.
 *
 * TRUTH-WAVE: grounded in the actual scopes + behavior declared in
 * `marketplace.ts` and the no-outbound architecture. The universal line every
 * connector shows — "we store just your encrypted token, the drafts in your
 * queue, and the audit log" — is the floor; `stores` / `doesNotStore` add the
 * category-specific detail. Documents is the honest exception: connected files
 * ARE ingested (encrypted, workspace-scoped) so the fleet can cite them.
 *
 * Vendor-neutral: "Plaino" / "the fleet" is the actor; no model vendor named.
 */

import type { MarketplaceEntry } from "./marketplace";

export interface ConnectorDataFlow {
  /** The four-stop journey: source → Plaino (in-flight) → output → destination. */
  flow: string[];
  /** What we keep when you connect this kind of tool, and (implicitly) why. */
  stores: string[];
  /** What we deliberately do NOT keep. */
  doesNotStore: string[];
  /** Optional caveat for the one category where we keep a copy on purpose. */
  note?: string;
}

/** Shown on every connector, regardless of category — the storage floor. */
export const UNIVERSAL_STORED_LINE =
  "Across every connector we store the same three things: a sealed, encrypted copy of your connection token, the drafts the fleet writes for your review, and the audit log of what it did.";

const BY_CATEGORY: Record<MarketplaceEntry["category"], ConnectorDataFlow> = {
  Email: {
    flow: [
      "Your mailbox",
      "Plaino reads the threads a task needs",
      "Plaino drafts a reply",
      "Your approvals queue — you send from your own account",
    ],
    stores: [
      "A sealed, encrypted copy of your connection token",
      "The drafts Plaino writes for your review",
      "The audit log of what it read and drafted",
    ],
    doesNotStore: [
      "A copy or mirror of your mailbox — existing mail is never imported",
      "Send access — we never request a send-on-your-behalf scope",
    ],
  },
  Calendar: {
    flow: [
      "Your calendar",
      "Plaino checks your stated hours and what's already booked",
      "Plaino proposes times",
      "Your approvals queue — you confirm from your own calendar",
    ],
    stores: [
      "A sealed, encrypted copy of your connection token",
      "The time proposals Plaino drafts",
      "The audit log",
    ],
    doesNotStore: [
      "A mirror of your calendar — Plaino reads your availability on demand",
    ],
  },
  CRM: {
    flow: [
      "Your CRM",
      "Plaino reads the contacts and deals a task touches",
      "Plaino drafts the update and writes a triage note back",
      "Your approvals queue — you send from your own email",
    ],
    stores: [
      "A sealed, encrypted copy of your connection token",
      "The drafts and triage notes Plaino writes",
      "The audit log",
    ],
    doesNotStore: [
      "A standing copy of your CRM database — Plaino reads per task, not in bulk",
    ],
  },
  Accounting: {
    flow: [
      "Your accounting tool",
      "Plaino reads the records a task needs (read-only)",
      "Plaino drafts the reconciliation, chase, or report",
      "Your approvals queue — you send or post from your own system",
    ],
    stores: [
      "A sealed, encrypted copy of your connection token",
      "The drafts and flags Plaino produces",
      "The audit log",
    ],
    doesNotStore: [
      "A copy of your ledger or rent roll — Plaino reads what a task needs",
      "Any write access to your money — we never initiate a journal entry or transfer",
    ],
  },
  Documents: {
    flow: [
      "The folders or files you point us at",
      "Plaino ingests them into your private, encrypted knowledge base",
      "Plaino drafts work that cites your own documents",
      "Your approvals queue — new files land back where you keep them",
    ],
    stores: [
      "A sealed, encrypted copy of your connection token",
      "An encrypted, workspace-private copy of the documents you connect as a knowledge source",
      "The drafts Plaino writes",
      "The audit log",
    ],
    doesNotStore: [
      "Anything you didn't point us at — files outside the folders you connect are never ingested",
      "Sharing access — Plaino files new versions where you keep them; sharing waits for you",
    ],
    note: "Documents are the one place the fleet keeps a copy on purpose: the files you choose to connect are ingested so drafts sound like you and cite your own playbooks. That copy is encrypted at rest and scoped to your workspace alone — and it disappears when you disconnect or close the workspace.",
  },
  Messaging: {
    flow: [
      "The channels you point us at",
      "Plaino reads them and surfaces what needs you",
      "Plaino drafts any reply",
      "Your approvals queue — anything posted waits for your say-so",
    ],
    stores: [
      "A sealed, encrypted copy of your connection token",
      "The drafts Plaino writes",
      "The audit log",
    ],
    doesNotStore: [
      "A mirror of your message history — Plaino reads the channels you choose, on demand",
    ],
  },
  Payments: {
    flow: [
      "Your payments tool",
      "Plaino reads the transactions and disputes a task needs",
      "Plaino surfaces them alongside your books and inbox",
      "Your approvals queue",
    ],
    stores: [
      "A sealed, encrypted copy of your connection token",
      "The summaries and drafts Plaino produces",
      "The audit log",
    ],
    doesNotStore: [
      "A copy of your transaction history — Plaino reads what a task needs",
      "Card numbers — your payment processor holds the payment method",
    ],
  },
  Creative: {
    flow: [
      "Your brand kit",
      "Plaino drafts collateral in your templates",
      "Plaino hands you the draft",
      "You review and publish",
    ],
    stores: [
      "A sealed, encrypted copy of your connection token",
      "The drafts Plaino produces",
      "The audit log",
    ],
    doesNotStore: [
      "A copy of your full asset library — Plaino works from the templates you connect",
    ],
  },
  Spreadsheets: {
    flow: [
      "The workbooks you connect",
      "Plaino reads the rows a task needs",
      "Plaino appends new rows when the work is done",
      "Your workbook — never overwriting cells you keep by hand",
    ],
    stores: [
      "A sealed, encrypted copy of your connection token",
      "The drafts and computed rows Plaino produces",
      "The audit log",
    ],
    doesNotStore: [
      "A copy of your workbooks — Plaino reads what a task needs and only appends, never overwrites",
    ],
  },
};

/**
 * Resolve the data-flow disclosure for a marketplace entry. Category-driven so
 * the catalog stays the single source of truth and a new connector inherits a
 * truthful disclosure the moment it lands in `marketplace.ts`.
 */
export function dataFlowForEntry(entry: MarketplaceEntry): ConnectorDataFlow {
  return BY_CATEGORY[entry.category];
}
