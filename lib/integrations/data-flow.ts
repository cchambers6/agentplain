/**
 * lib/integrations/data-flow.ts
 *
 * Per-connector data-flow disclosure — the "when you connect X, here's what
 * flows where" one-pager surfaced on every integration detail page (and as a
 * compact line on the marketplace tile). Keyed by the connector's category so
 * one truthful disclosure covers every connector of a kind.
 *
 * TWO-BUCKET MODEL (ratified by Conner 2026-06-18 — see
 * `lib/marketing/data-commitments.ts`):
 *   - WE STORE: a sealed, encrypted copy of your connection token; the drafts
 *     Plaino writes; and what Plaino LEARNS about how you work (patterns, voice,
 *     context — kept for the life of your account).
 *   - WE DON'T STORE: copies of the records Plaino fetches through the
 *     connection. He reads them in-flight while working and leaves them in your
 *     tool. (Exception, stated positively: documents you deliberately connect
 *     as a knowledge source ARE ingested into Plaino's private, encrypted
 *     memory so he can cite them.)
 *
 * BANNED: "pass-through, nothing kept" / "we don't store anything". Plaino's
 * memory is a feature, not a leak. Vendor-neutral: "Plaino" is the actor.
 */

import type { MarketplaceEntry } from "./marketplace";

export interface ConnectorDataFlow {
  /** The four-stop journey: source → Plaino (in-flight) → output → destination. */
  flow: string[];
  /** What we keep when you connect this kind of tool. */
  stores: string[];
  /** What we deliberately do NOT keep (the raw records Plaino reads). */
  doesNotStore: string[];
  /** Optional positive note (e.g. the knowledge-source exception). */
  note?: string;
}

/** Shown on every connector, regardless of category — the storage floor. */
export const UNIVERSAL_STORED_LINE =
  "Across every connector, what stays with us is your encrypted token, the drafts Plaino writes, and what he learns about how you work — kept for the life of your account, owned by you, and hard-deleted when you close it. The records he reads aren't copied; he reads them in-flight and leaves them in your tool.";

/** The "what Plaino learns" line is shared — his memory is the same feature
 *  regardless of which tool feeds it. */
const LEARNS_LINE =
  "What Plaino learns about how you work — your patterns, voice, and context (kept for the life of your account)";
const TOKEN_LINE = "A sealed, encrypted copy of your connection token";

const BY_CATEGORY: Record<MarketplaceEntry["category"], ConnectorDataFlow> = {
  Email: {
    flow: [
      "Your mailbox",
      "Plaino reads the threads a task needs, in-flight",
      "Plaino drafts a reply",
      "Your approvals queue — you send from your own account",
    ],
    stores: [TOKEN_LINE, "The drafts Plaino writes for your review", LEARNS_LINE],
    doesNotStore: [
      "Copies of your emails — Plaino reads the threads a task needs and leaves them in your mailbox",
      "Send access — we never request a send-on-your-behalf scope",
    ],
  },
  Calendar: {
    flow: [
      "Your calendar",
      "Plaino checks your hours and what's already booked, in-flight",
      "Plaino proposes times",
      "Your approvals queue — you confirm from your own calendar",
    ],
    stores: [TOKEN_LINE, "The time proposals Plaino drafts", LEARNS_LINE],
    doesNotStore: [
      "A copy of your calendar — Plaino checks your availability in the moment and leaves it where it lives",
    ],
  },
  CRM: {
    flow: [
      "Your CRM",
      "Plaino reads the contacts and deals a task touches, in-flight",
      "Plaino drafts the update and writes a triage note back",
      "Your approvals queue — you send from your own email",
    ],
    stores: [
      TOKEN_LINE,
      "The drafts and triage notes Plaino writes",
      LEARNS_LINE,
    ],
    doesNotStore: [
      "Copies of your contacts, deals, or records — Plaino reads what a task needs and leaves them in your CRM",
    ],
  },
  Accounting: {
    flow: [
      "Your accounting tool",
      "Plaino reads the records a task needs (read-only), in-flight",
      "Plaino drafts the reconciliation, chase, or report",
      "Your approvals queue — you send or post from your own system",
    ],
    stores: [TOKEN_LINE, "The drafts and flags Plaino produces", LEARNS_LINE],
    doesNotStore: [
      "A copy of your ledger or rent roll — Plaino reads what a task needs and leaves it in your books",
      "Any write access to your money — we never initiate a journal entry or transfer",
    ],
  },
  Documents: {
    flow: [
      "The folders or files you point us at",
      "Plaino ingests them into his private, encrypted memory",
      "Plaino drafts work that cites your own documents",
      "Your approvals queue — new files land back where you keep them",
    ],
    stores: [
      TOKEN_LINE,
      "An encrypted, workspace-private copy of the documents you connect as a knowledge source",
      "The drafts Plaino writes",
      LEARNS_LINE,
    ],
    doesNotStore: [
      "Anything you didn't point us at — files outside the folders you connect are never ingested",
      "Sharing access — Plaino files new versions where you keep them; sharing waits for you",
    ],
    note: "Documents are the deliberate exception: the files you choose to connect become part of Plaino's memory so drafts sound like you and cite your own playbooks. That copy is encrypted, scoped to your workspace alone, and hard-deleted when you disconnect or close the workspace. Everything else in your drive stays put.",
  },
  Messaging: {
    flow: [
      "The channels you point us at",
      "Plaino reads them and surfaces what needs you, in-flight",
      "Plaino drafts any reply",
      "Your approvals queue — anything posted waits for your say-so",
    ],
    stores: [TOKEN_LINE, "The drafts Plaino writes", LEARNS_LINE],
    doesNotStore: [
      "A copy of your message history — Plaino reads the channels you choose, in the moment",
    ],
  },
  Payments: {
    flow: [
      "Your payments tool",
      "Plaino reads the transactions and disputes a task needs, in-flight",
      "Plaino surfaces them alongside your books and inbox",
      "Your approvals queue",
    ],
    stores: [TOKEN_LINE, "The summaries and drafts Plaino produces", LEARNS_LINE],
    doesNotStore: [
      "A copy of your transaction history — Plaino reads what a task needs and leaves it in your tool",
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
    stores: [TOKEN_LINE, "The drafts Plaino produces", LEARNS_LINE],
    doesNotStore: [
      "A copy of your full asset library — Plaino works from the templates you connect",
    ],
  },
  Spreadsheets: {
    flow: [
      "The workbooks you connect",
      "Plaino reads the rows a task needs, in-flight",
      "Plaino appends new rows when the work is done",
      "Your workbook — never overwriting cells you keep by hand",
    ],
    stores: [TOKEN_LINE, "The drafts and computed rows Plaino produces", LEARNS_LINE],
    doesNotStore: [
      "A copy of your workbooks — Plaino reads what a task needs, appends, and leaves the rest untouched",
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
