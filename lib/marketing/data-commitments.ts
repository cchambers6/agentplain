/**
 * lib/marketing/data-commitments.ts
 *
 * SINGLE SOURCE OF TRUTH for agentplain's data stance, reused across every
 * customer-facing surface: the /data page, the home trust pillar, the /about
 * "how we treat your data" section, and the structured-data builders. Pure
 * data — no React — so server code can import it without dragging JSX in.
 *
 * THE STANCE IS A DUAL COMMITMENT, expressed as TWO BUCKETS (ratified by Conner
 * 2026-06-18). It is NOT "we minimize / we don't store much / data passes
 * through". Plaino's persistent working memory of the customer's business is
 * the product — a service partner that FORGOT the business every day would be
 * useless. So:
 *
 *   BUCKET 1 — WHAT WE STORE (so Plaino is a real partner that gets better):
 *     Plaino's working memory — chat history, your preferences/voice/brand, the
 *     patterns he's learned about how your business runs, your approved drafts,
 *     ongoing per-client/case/property context, the documents you connect as a
 *     knowledge source, plus a sealed copy of your connection tokens and your
 *     account settings. Kept for the LIFE OF YOUR ACCOUNT. Owned by you,
 *     exportable anytime, HARD-DELETED when you close your account.
 *
 *   BUCKET 2 — WHAT WE DON'T STORE (your raw business data stays in your tools):
 *     Copies of your CRM records, emails, and files; your customers'/clients'/
 *     tenants' raw PII. Plaino reads these IN-FLIGHT when he's working and
 *     leaves them where they live — HubSpot, Gmail, your drive.
 *
 * BANNED framings (false, and they'd make Plaino useless): "we don't store
 * anything", "your data flows through, nothing kept", "Plaino forgets after
 * each session", "pass-through, nothing retained".
 *
 * Vendor rule (`feedback_customer_vocab_not_engineer.md` +
 * `project_sbm_wrapper_positioning_2026_06_06.md`): the underlying model vendor
 * is NEVER named on these customer surfaces. "Plaino" is the actor. The vendor
 * is named only on /privacy (the subprocessor list).
 *
 * Grounded in production architecture (AES-256-GCM at rest, per-workspace RLS,
 * read/draft OAuth scopes, no-training tier, knowledge substrate for connected
 * docs, append-only preference + handoff logs, export route + closure cascade).
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
 * The commitments that make up the dual stance. The home pillar renders the
 * first four; the /data page renders all five.
 */
export const DATA_COMMITMENTS: DataCommitment[] = [
  {
    key: "plaino-remembers",
    title: "Plaino remembers how your business works — and gets better at it.",
    body: "He keeps a working memory of your preferences, your voice, the patterns of how your business runs, and your history with each client. That's what makes a service partner improve over time instead of starting cold every morning.",
  },
  {
    key: "raw-data-stays",
    title: "Your raw data stays in your tools.",
    body: "We don't keep copies of your CRM records, your emails, or your files. Plaino reads them in-flight while he's working and leaves them where they live — in HubSpot, Gmail, your drive. He learns the patterns; he doesn't hoard the records.",
  },
  {
    key: "yours-to-keep",
    title: "Everything Plaino has learned about you is yours.",
    body: "His working memory of your business is your property. Export all of it anytime, and it's hard-deleted when you close your account — memory, history, and all.",
  },
  {
    key: "no-train-no-sell",
    title: "We never train on your data, pool it, or sell it.",
    body: "What Plaino learns tunes your workspace alone. Your business never trains a foundation model — ours or anyone's — never mixes with another customer's, and is never sold. agentplain has no training infrastructure.",
  },
  {
    key: "nothing-leaves",
    title: "Nothing leaves without you.",
    body: "Plaino drafts and proposes; you send from your own email, calendar, and CRM. We never request a send-on-your-behalf scope, so nothing goes out until your name is on it.",
  },
];

export interface StoredItem {
  /** What we keep. */
  what: string;
  /** Why we keep it — the partner-makes-this-better reason. */
  why: string;
}

/**
 * BUCKET 1 — what we store, and why. This is the heart of the partnership:
 * Plaino's working memory. Every row maps to a real table/field (chat history,
 * preference log, knowledge substrate, approval rows, per-thread context,
 * encrypted tokens, account config).
 */
export const WHAT_WE_STORE: StoredItem[] = [
  {
    what: "Plaino's chat history with you",
    why: "Kept for the life of your account, so he has continuity and context and never makes you re-explain your business.",
  },
  {
    what: "Your preferences, voice, and brand",
    why: "How you sound, how you work, what you care about — so every draft reads like you wrote it.",
  },
  {
    what: "The patterns Plaino has learned",
    why: "The way your business actually runs, refined every time you correct a draft. This is the part that compounds — a partner that gets better the longer you work together.",
  },
  {
    what: "Your approved drafts",
    why: "So he knows your style and reuses what worked instead of guessing again.",
  },
  {
    what: "Ongoing context per client, case, or property",
    why: "The thread of each relationship, so he picks up where you left off rather than starting from zero.",
  },
  {
    what: "The documents you connect as a knowledge source",
    why: "When you point Plaino at a folder of playbooks or past work, those files are ingested into his private, encrypted memory so he can write in your voice and cite your own material.",
  },
  {
    what: "A sealed, encrypted copy of your connection tokens, and your account settings",
    why: "So Plaino can keep reading the tools you connected without making you log in every run — and so your workspace is configured the way your firm works.",
  },
];

/**
 * BUCKET 2 — what we DON'T store. Your raw business data lives in your tools;
 * Plaino reads it in-flight and leaves it there.
 */
export const WHAT_WE_DONT_STORE: string[] = [
  "Copies of your HubSpot deals, Gmail messages, or CRM records — Plaino reads them in-flight while he's working and leaves them in your tools.",
  "Your customers', clients', or tenants' raw files and PII — those stay in the systems you already use; we don't mirror them onto our servers.",
  "A standing copy of anything Plaino fetches through a connection — he learns the patterns from working with your tools, he doesn't keep the source records.",
  "Your card number — your payment processor holds the payment method; we hold a customer ID and the last four digits.",
  "Anything used to train a model — your business tunes only your own workspace.",
];

export interface DataRight {
  title: string;
  body: string;
}

/**
 * The customer's enumerated rights — all backed by in-product affordances
 * (export route, closure cascade, per-connector disconnect) plus an email path
 * for anything broader. Note the closure cascade deletes Plaino's full memory.
 */
export const DATA_RIGHTS: DataRight[] = [
  {
    title: "Export everything, anytime",
    body: "One click in Account → Your data downloads a full JSON copy of everything we hold — Plaino's memory of your business, your documents, your drafts, the handoff log, your preferences, and your billing history.",
  },
  {
    title: "Hard-deleted when you cancel",
    body: "Close the workspace and we purge everything — Plaino's chat history, his learned patterns, your documents and drafts — after a short grace window. After the window it's irreversible; only your invoice history and a minimal who-closed-it audit line remain, for tax and compliance.",
  },
  {
    title: "Revoke any connection",
    body: "Disconnect any tool in one tap, or revoke the grant from the provider's own dashboard. Plaino stops reading that source on his next run.",
  },
  {
    title: "Ask for anything broader",
    body: "For a deletion or data-subject request the in-product controls don't cover, email hello@agentplain.com and we'll handle it in writing.",
  },
];

/**
 * The positioning one-liner for the stance — the dual commitment. Used as the
 * /data hero subhead and available for reuse so the phrasing has one home.
 */
export const DATA_STANCE_TAGLINE = "Your data is yours. Plaino is your partner.";
