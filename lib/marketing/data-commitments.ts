/**
 * lib/marketing/data-commitments.ts
 *
 * SINGLE SOURCE OF TRUTH for the data-minimization commitment, reused across
 * every customer-facing surface that reinforces it: the /data page, the home
 * trust pillar, the /about "how we treat your data" section, and the
 * structured-data builders. Pure data — no React — so server code can import
 * it without dragging JSX into its bundle (same pattern as `faq-items.ts`).
 *
 * TRUTH-WAVE DISCIPLINE (load-bearing). Every line here is grounded in what
 * the product ACTUALLY does today, cross-checked against the architecture
 * already in production and described on /privacy + /security + /terms:
 *   - read / read-and-draft OAuth scopes only; never send-on-behalf
 *     (`lib/integrations/marketplace.ts` — no entry requests a send scope)
 *   - AES-256-GCM encryption at rest + per-workspace row-level security
 *     (privacy "Encryption and isolation"; security "Encryption at rest")
 *   - no foundation-model training, no cross-customer pooling, no resale
 *     (privacy "How we use it"; terms "Your data + our use of it")
 *   - export + workspace-closure hard-purge after a grace window
 *     (`/app/workspace/[id]/settings/data` — ExportSection + ClosureSection)
 *
 * We deliberately do NOT claim "zero data stored". We store specific things
 * for specific reasons and we name every one of them (see `WHAT_WE_STORE`).
 * If a future architecture change adds a guarantee (e.g. chat auto-expiry),
 * add it here once it ships — not before.
 *
 * Vendor rule (`feedback_customer_vocab_not_engineer.md` +
 * `project_sbm_wrapper_positioning_2026_06_06.md`): the underlying model
 * vendor is NEVER named on these customer surfaces. "Plaino" / "the fleet"
 * is the actor. The vendor is named only on /privacy (the subprocessor list).
 */

export interface DataCommitment {
  /** Stable key for React lists + anchors. */
  key: string;
  /** Short, plain-language headline — the promise. */
  title: string;
  /** One to two sentences of substantiation, grounded in real architecture. */
  body: string;
}

/**
 * The five commitments that make up the stance. The home pillar renders the
 * first four as a compact grid (no-outbound has its own full section on the
 * homepage); the /data page renders all five.
 */
export const DATA_COMMITMENTS: DataCommitment[] = [
  {
    key: "process-not-hoard",
    title: "We process your data. We don't hoard it.",
    body: "Plaino reads what a task needs through read-only and read-and-draft access, does the work, and hands you a draft. We don't pull a standing copy of your inbox, your CRM, or your drive onto our servers and keep it.",
  },
  {
    key: "minimum-named",
    title: "We store the minimum to do the work — and we name every piece.",
    body: "What we keep: the drafts in your queue, the audit log of what the fleet did, the documents you choose to connect, a sealed copy of your connection token, and your account and settings. All of it encrypted and walled off to your workspace alone.",
  },
  {
    key: "no-train-no-sell",
    title: "We never train on your data, pool it, or sell it.",
    body: "Your inbox, client list, transaction records, and drafts are never used to train a foundation model — ours or anyone's. We don't pool data across customers and we don't resell it. agentplain has no training infrastructure.",
  },
  {
    key: "nothing-leaves",
    title: "Nothing leaves without you.",
    body: "The fleet drafts and proposes; you send from your own email, calendar, and CRM. We never request a send-on-your-behalf scope, so a draft can't go out until your name is on it.",
  },
  {
    key: "yours-to-take",
    title: "It's yours — take it or delete it anytime.",
    body: "Export a full copy of everything we hold for you with one click. Close the workspace and we purge every piece of your data after a short grace window. You don't have to ask, and you don't have to wait.",
  },
];

export interface StoredItem {
  /** What we keep. */
  what: string;
  /** Why we keep it — the legitimate operational reason. */
  why: string;
}

/**
 * Exactly what we store, and why. This is the honest core of the page — the
 * antidote to a vague "we don't store anything" claim that wouldn't be true.
 * Every row maps to a real table/field described on /privacy + /security.
 */
export const WHAT_WE_STORE: StoredItem[] = [
  {
    what: "The drafts in your approval queue",
    why: "So you can review, edit, and send them from your own tools. They're your work product — your IP, your record.",
  },
  {
    what: "An audit log of what the fleet did",
    why: "An append-only handoff log so every read, draft, and decision is traceable. No agent or admin can rewrite it.",
  },
  {
    what: "The documents you choose to connect",
    why: "When you point the fleet at a folder of playbooks or past work, we ingest those files — encrypted, workspace-private — so drafts sound like you and cite your own material.",
  },
  {
    what: "A sealed copy of your connection token",
    why: "Encrypted at rest, so the fleet can keep reading the tools you connected without making you log in on every run. Tokens never leave our infrastructure and are omitted from your export.",
  },
  {
    what: "Your account and settings",
    why: "Your name, business email, billing details, the vertical you picked, and your tone, hours, and skill choices — the configuration that makes the fleet work the way your firm does.",
  },
  {
    what: "Your learned preferences",
    why: "An append-only log of the edits you make to drafts, so the work gets more like you over time. This tunes your workspace only — it never touches a base model.",
  },
];

/**
 * What we deliberately do NOT keep. Each line is the inverse of a thing a DIY
 * stack or a data-hungry vendor would hold.
 */
export const WHAT_WE_DONT_STORE: string[] = [
  "A standing mirror of your inbox — the fleet reads mail on demand and never imports or copies your mailbox.",
  "A copy of your CRM, accounting ledger, or message history — the fleet reads what a task needs, drafts, and writes the decision back to your system.",
  "Files you didn't point us at — only the documents you explicitly connect as a knowledge source are ever ingested.",
  "Your card number — your payment processor holds the payment method; we hold a customer ID and the last four digits.",
  "Anything used to train a model — your data builds nothing but your own drafts.",
];

export interface DataRight {
  title: string;
  body: string;
}

/**
 * The customer's enumerated rights — all backed by in-product affordances
 * (export route, closure cascade, per-connector disconnect) plus an email
 * path for anything broader.
 */
export const DATA_RIGHTS: DataRight[] = [
  {
    title: "Export everything, anytime",
    body: "One click in Account → Your data downloads a full JSON copy of everything we hold for your workspace — documents, drafts, the handoff log, your preferences, and your billing history.",
  },
  {
    title: "Delete everything",
    body: "Close the workspace and we purge every customer-data row after a short grace window. After the window, the deletion is irreversible; only your invoice history and a minimal who-closed-it audit line remain, for tax and compliance.",
  },
  {
    title: "Revoke any connection",
    body: "Disconnect any tool in one tap, or revoke the grant from the provider's own dashboard. The fleet stops reading that source on the next run.",
  },
  {
    title: "Ask for anything broader",
    body: "For a deletion or data-subject request the in-product controls don't cover, email hello@agentplain.com and we'll handle it in writing.",
  },
];

/**
 * The positioning one-liner for the stance. Used as the /data hero subhead and
 * available for reuse. Kept here so the phrasing has one home and can't drift.
 */
export const DATA_STANCE_TAGLINE =
  "Your data stays yours. We process it; we don't hoard it.";
