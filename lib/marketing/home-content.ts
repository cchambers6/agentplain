/**
 * Homepage content constants — extracted from `app/(marketing)/page.tsx` so
 * the page renderer stays under the 500-line discipline bar and so this
 * content can be re-used (e.g. by future automated tests asserting that
 * pricing bands match the schema source of truth).
 *
 * Per-row sources cited inline. Per `feedback_no_guesses_no_estimates.md`,
 * every concrete claim traces back to the named memory rule.
 */

// Service-partnership tiers (ratified 2026-05-15 — three productized tiers
// under the service-partnership lock; supersedes the 2026-05-12 single-tier
// surfacing while preserving the per-seat ladder as Regular's price shape).
// Regular: standard service partnership, per-seat ladder, our team running
// install + config + reviews on a cadence.
// Partner: named service partner, weekly review cadence, deeper customization,
//          uplift on the per-seat number to fund the dedicated overlay.
// Max:     ad-hoc service partnership for firms with non-standard scope —
//          quoted, not productized; sales-led CTA.
// /custom remains a separate surface for bespoke ENGAGEMENTS (white-label,
// integrations off the roadmap, 100+ seats) — that surface is not a tier.
export const ladderBands = [
  { band: "Solo (1 seat)", price: "$199" },
  { band: "2–9 seats", price: "$179" },
  { band: "10–24 seats", price: "$149" },
  { band: "25–49 seats", price: "$119" },
  { band: "50–99 seats", price: "$99" },
];

// Partner per-seat numbers map to the schema-backed `PLUS` enum in
// `prisma/schema.prisma` (kept since 2026-05-09) — the productized uplift
// covers the named-partner overlay (onboarding, weekly review, customization).
// Customer copy renders this as "Partner" via `tierDisplayName()` — the
// schema name itself is internal-only.
// Source: HISTORICAL block of `project_stripe_both_surfaces.md` —
// $299 solo → $199 at scale.
export const partnerBands = [
  { band: "Solo (1 seat)", price: "$299" },
  { band: "2–9 seats", price: "$269" },
  { band: "10–24 seats", price: "$239" },
  { band: "25–49 seats", price: "$219" },
  { band: "50–99 seats", price: "$199" },
];

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
    body: "Deep in real estate today: the sentinel runs a literal-phrase scan against HUD-prohibited fair-housing copy, with TCPA + RESPA rules counsel-reviewed. The corpora for the other nine verticals are drafted with the regulatory citations in place — explicitly counsel-reference until counsel signs off. We don't assert a regulatory violation the runner can't literally pattern-match.",
  },
];

// "Why pay vs. free?" — names the real alternative plainly and answers the
// objection head-on. LEFT = Claude for Small Business (the real free
// alternative we name explicitly per the 2026-05-15 service-partnership
// positioning lock); RIGHT = agentplain run for you. The "us" side carries a
// moss checkmark as a verified-good signal only — never decorative.
export const chatbotContrast = [
  {
    free: "Waits for you to prompt it.",
    us: "Works overnight, and hands you drafts before you open the laptop.",
  },
  {
    free: "Starts blank every session.",
    us: "Pre-trained on your vertical, with a counsel-reviewed compliance corpus.",
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

// Q6 — proof points. Each item must cite a memory rule or a concrete artifact.
// "Why should anyone believe us?"
export const proof = [
  {
    label: "Eat our own cooking",
    body: "agentplain is built BY a fleet of agents, not a human engineering team. The brokerage running in production today is the working precursor of this model — the pattern is real, not theoretical.",
    cite: "project_agentplain_built_by_agents.md",
  },
  {
    label: "Counsel-reviewed corpus",
    body: "Outside counsel is reviewing the broker-of-record term sheet, GA TCPA + RESPA compliance corpus. When counsel returns we'll name them publicly; until then the corpus is gated, not vapor.",
    cite: "project_counsel_engaged.md",
  },
  {
    label: "ROI math, not vibes",
    body: "Value math anchored at $2,900–$10,600/mo per practitioner against $99–$199/mo per-seat subscription — typical ROI multiple 15x to 110x, every claim traceable to a memory rule.",
    cite: "project_pricing_value_anchor.md",
  },
  {
    label: "Open feedback loop",
    body: "Every agent action is visible in the workspace. Nothing happens behind the curtain — handoffs, drafts, compliance flags, all auditable inside the product.",
    cite: "project_no_outbound_architecture.md",
  },
];
