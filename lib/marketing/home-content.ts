/**
 * Homepage content constants — extracted from `app/(marketing)/page.tsx` so
 * the page renderer stays under the 500-line discipline bar and so this
 * content can be re-used (e.g. by future automated tests asserting that
 * pricing bands match the schema source of truth).
 *
 * Per-row sources cited inline. Per `feedback_no_guesses_no_estimates.md`,
 * every concrete claim traces back to the named memory rule.
 */

import { tierLadderBands } from "@/lib/pricing/tiers";

// Service-partnership tiers (ratified 2026-05-15 — three productized tiers
// under the service-partnership lock; supersedes the 2026-05-12 single-tier
// surfacing while preserving the per-seat ladder as Regular's price shape).
// Regular: standard service partnership, per-seat ladder, our team running
//          install + config + managed ops.
// Partner: everything in Regular, plus priority support and a quarterly async
//          check-in with the service team (ratified 2026-06-14 — NO reserved
//          hours / weekly reviews / dedicated named human); a modest per-seat
//          uplift over Regular.
// Max:     ad-hoc service partnership for firms with non-standard scope —
//          quoted, not productized; sales-led CTA.
// /custom remains a separate surface for bespoke ENGAGEMENTS (white-label,
// integrations off the roadmap, 100+ seats) — that surface is not a tier.
//
// Both ladders are DERIVED from the canonical `PER_SEAT_MONTHLY_USD_CENTS`
// via `tierLadderBands()` so they can never drift from the billing source of
// truth (they did before: the Partner 2–9 / 10–24 bands were hand-typed $10
// low). `plus` renders as "Partner" via `tierDisplayName()` at the call site.
export const ladderBands = tierLadderBands("regular");
export const partnerBands = tierLadderBands("plus");

// Q4 — what makes agentplain unique. Five points pulled verbatim from the
// mission rule (Vertical-aware / Control / Integrates / Built BY agents /
// Compliance-first).
export const uniques = [
  {
    label: "Vertical-aware",
    body: "A real-estate agentplain knows MLS workflows, fair-housing copy, broker-of-record rules. A CPA agentplain knows tax-prep deadlines and e-file conventions. Each vertical ships with its own JTBD table and compliance corpus — generic AI tools don't.",
  },
  {
    label: "You stay in control",
    body: "The fleet drafts and proposes; it never auto-sends, never moves money, never makes commitments. Every customer-facing output queues for your review. Your existing CRM and inbox handle every send.",
  },
  {
    label: "Integrates, not replaces",
    body: "Sits on top of the tools you already pay for — your CRM, your inbox, your transaction system, your accounting. No migration. The fleet replaces the manual work that lives between them.",
  },
  {
    label: "Built BY agents",
    body: "The same fleet model we sell builds our own product. The pattern works because we run it on ourselves — a brokerage in production today running ~35 cron-fired agents on daily ops is the working precursor we productized.",
  },
  {
    label: "Compliance-first",
    body: "Deep in real estate today: the sentinel runs a literal-phrase scan against HUD-prohibited fair-housing copy on every customer-facing draft. The corpora for the other nine verticals are drafted with the regulatory citations in place but are loaded as drafts — they don't fire until counsel red-lines them. We don't assert a regulatory violation the runner can't literally pattern-match.",
  },
];

// "Why pay vs. free?" — answers the do-it-yourself objection head-on. LEFT =
// the free/DIY general-purpose AI path (kept vendor-generic per the 2026-06-11
// customer-surface rule — the underlying model is never named on a customer
// surface, and the rendered copy below names no vendor); RIGHT = agentplain
// run for you. The "us" side carries a moss checkmark as a verified-good
// signal only — never decorative.
export const chatbotContrast = [
  {
    free: "Waits for you to prompt it.",
    us: "Works overnight, and hands you drafts before you open the laptop.",
  },
  {
    free: "Starts blank every session.",
    us: "Pre-trained on your vertical, with a compliance corpus drafted around the regulations that govern your work.",
  },
  {
    free: "Gives you text to copy-paste.",
    us: "Lands every draft in your approvals queue — approve, edit, or reject in one click. Nothing leaves until your name is on it.",
  },
  {
    free: "You write the prompts and wire the tools.",
    us: "Your service partner installs, connects, and tunes it for you.",
  },
  {
    free: "No memory of your business.",
    us: "Rooted in your real systems and the way your shop works.",
  },
];

// Q6 — proof points. "Why should anyone believe us?"
// `cite` retained on the type for internal traceability — the customer-facing
// component no longer renders it (was leaking internal memory filenames to
// marketing pages). The string lives here so future-us can trace each claim
// without breaking the type, but it never reaches a customer browser.
export const proof = [
  {
    label: "Eat our own cooking",
    body: "agentplain is built BY a fleet of agents, not a human engineering team. The brokerage running in production today is the working precursor of this model — the pattern is real, not theoretical.",
    cite: "project_agentplain_built_by_agents.md",
  },
  {
    label: "Compliance corpus is real, not vapor",
    body: "The real-estate fair-housing rule (HUD's enumerated trigger phrases) is a literal-match scanner that fires on every customer-facing draft today. The other verticals' rules are drafted with the regulatory citation in place but loaded as drafts — they don't fire until counsel red-lines them, and we say so plainly rather than claim coverage we don't have.",
    cite: "",
  },
  {
    label: "ROI math, not vibes",
    body: "Value math anchored at $2,900–$10,600/mo per practitioner against $99–$199/mo per-seat subscription — typical ROI multiple 15x to 50x per workflow, plus the regulatory violations a draft-then-approve loop keeps from ever sending. Every claim traceable to a memory rule.",
    cite: "project_pricing_value_anchor.md",
  },
  {
    label: "Open feedback loop",
    body: "Every agent action is visible in the workspace. Nothing happens behind the curtain — handoffs, drafts, compliance flags, all auditable inside the product.",
    cite: "project_no_outbound_architecture.md",
  },
];
