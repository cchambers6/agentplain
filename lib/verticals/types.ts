// VerticalContent — the typed shape that drives every per-vertical landing page.
//
// Two-implementation rule (feedback_runner_portability.md): this is the
// abstraction. Today's only implementation is the `lib/verticals/<slug>/content.ts`
// static modules. A future implementation could be a headless CMS adapter or
// a per-customer override. Route code reads `VerticalContent`, never the
// raw content files.

/**
 * Tier identifier — must match the per-seat ladder defined in
 * `project_stripe_both_surfaces.md` (2026-05-15 three-tier ratification;
 * supersedes the 2026-05-12 simplified Regular-only model and the
 * 2026-05-09 productized-Max model).
 *
 * Customer-facing display names — see `lib/pricing/tiers.ts` →
 * `tierDisplayName()`. The on-disk enum values stay `regular` / `plus` /
 * `max` for stable identity; copy reads "Partner" wherever `plus` would
 * otherwise leak.
 *
 * Per-seat ladder (solo → 50–99 seats):
 * - `regular` → "Regular" → $199 → $99 per seat (productized)
 * - `plus`    → "Partner" → $299 → $199 per seat (productized; everything in
 *               Regular plus priority support + a quarterly async check-in —
 *               no reserved hours, ratified 2026-06-14)
 * - `max`     → "Max"     → AD-HOC quote-based (no fixed seat price)
 *
 * Month-to-month, 7-day free trial across Regular + Partner (14 days for the
 * CPA + Law verticals), card captured at signup. Max is custom-quoted
 * month-to-month or annual per engagement. 100+ seats moves to enterprise
 * terms via /custom.
 */
export type VerticalTier = "regular" | "plus" | "max";

/**
 * Surface status — distinguishes the ten ratified verticals (with their own
 * compliance corpus, JTBD tables, and integration roadmap) from on-ramp
 * surfaces that share the same service partnership but ship without a
 * vertical-specific compliance corpus.
 *
 * - `live` — one of the ten ratified verticals; full per-vertical scaffolding
 *   (compliance corpus, ratified JTBD tables, vertical-specific integrations).
 *   Counts toward the locked 10 per `feedback_no_new_verticals_finish_locked.md`.
 *   Default when `status` is omitted on a `VerticalContent`.
 * - `on-ramp` — an honest landing surface for businesses outside the ten named
 *   verticals. Same service partnership, lighter scaffolding (generic JTBDs,
 *   common-denominator integrations, no per-vertical compliance corpus).
 *   Does NOT count toward the 10. Reserved for `/general`.
 */
export type VerticalStatus = "live" | "on-ramp";

/**
 * REPLACE / INTEGRATE / AUGMENT — the three-column claims framework.
 * Every vertical page MUST populate all three. A truthful entry is shorter
 * than a vague one; if there's nothing to put in a column, leave the array
 * empty and the renderer collapses it.
 *
 * - REPLACE: work the customer can stop doing entirely
 * - INTEGRATE: customer-system tools agentplain plugs into
 * - AUGMENT: work the customer keeps doing, but with agentplain drafting
 */
export interface ClaimsTriad {
  replace: string[];
  integrate: string[];
  augment: string[];
}

/**
 * A single role within the vertical, plus the recurring jobs that role
 * does today and what agentplain takes over from them.
 *
 * Modeled on `product_spec.md` §3 (the canonical real-estate JTBD table).
 * For verticals where the JTBD table is not yet finalized at Phase 0,
 * the content file sets `draft: true` so the renderer can surface a
 * `[DRAFT — needs vertical-CEO review]` badge in-page. This is intentional
 * per `feedback_no_quick_fixes.md` — we do NOT paper over gaps with
 * confident-sounding placeholders; we surface the gap.
 */
export interface JtbdRow {
  job: string;
  when: string;
  today: string;
  withAgentplain: string;
}

export interface JtbdRoleTable {
  role: string;
  draft?: boolean;
  rows: JtbdRow[];
}

/**
 * The ROI math anchor. Every claim must be substantiable — per
 * `feedback_no_guesses_no_estimates.md`, the citation field is required.
 *
 * `multiplier` is the headline ratio (e.g. "23x"). The math line shows the
 * arithmetic so the reader can audit it. The citation names the memory file
 * that grounds the input numbers.
 *
 * `violationAvoidance` is the second half of the ROI story (added 2026-06-06
 * per Conner's "softer true claim beats an over-inflated one" ruling that
 * also capped the headline band at 50x — see the competitive audit in PR
 * #155). The hours-reclaimed multiplier understates the real value because
 * it ignores the regulatory downside the draft-then-approve loop removes:
 * an auto-execution competitor sends before any human sees the message, so
 * a non-compliant draft becomes a fileable violation; our loop hands every
 * customer-facing draft to a person for approval, so a violating message
 * never leaves the building. This field names the vertical-specific
 * regulation(s), states the statutory/CMP penalty exposure with its source,
 * and explains how the approval gate avoids it. Required — every vertical
 * must name its own regulator, not a generic disclaimer.
 */
export interface RoiAnchor {
  multiplier: string;
  inputCost: string;
  outputValue: string;
  math: string;
  citation: string;
  violationAvoidance: string;
}

/**
 * Integrations — split into three honesty tiers: "shipped", "supported",
 * and "planned". Per `project_integration_roadmap.md` +
 * `feedback_integration_acceptance_is_functional.md`, the bar for each tier
 * is deliberately different so the page never overclaims:
 *
 * - `shipped` — live end-to-end on a customer's real system TODAY: the
 *   adapter is wired AND the connect path is open (OAuth/API-key) AND the
 *   skill drafts from real reads. Today only the connectors marked
 *   `status: 'available'` in `lib/integrations/marketplace.ts` qualify
 *   (Gmail, Outlook/M365, Google Workspace, QuickBooks, Slack, and the
 *   realty CRMs Follow Up Boss + Sierra Interactive).
 *
 * - `supported` — the vendor adapter is BUILT and TESTED behind the
 *   provider port (two-implementation rule), but going live needs a
 *   per-workspace credential and a per-vendor `<VENDOR>_ADAPTER_LIVE` flag
 *   flip (partner-gated OAuth or a pasted API key). This is the honest
 *   middle tier for the wave-1/1b vertical adapters (Buildium, EZLynx,
 *   Encompass, Qualia) — real code, not vaporware, but not "live on your
 *   system" until you connect it. Say "supported"/"ready", never "live".
 *
 * - `planned` — committed-with-window, not yet built. `plannedWindow` is
 *   shown verbatim ("Q3 2026" etc.) so the page never claims more than the
 *   roadmap commits to.
 *
 * The shape future-proofs the page so an integration can move
 * planned → supported → shipped without changing the renderer.
 */
export interface Integration {
  name: string;
  category: string;
  note?: string;
}

export interface IntegrationsSection {
  shipped: Integration[];
  /**
   * Adapter built + tested behind the port, but live calls need a connected
   * credential + the per-vendor `<VENDOR>_ADAPTER_LIVE` flag. Optional for
   * back-compat with content files written before the three-tier split;
   * the renderer treats `undefined` as an empty array.
   */
  supported?: Integration[];
  planned: Integration[];
  plannedWindow: string;
}

/**
 * A single concrete value-loop example — the day-in-the-life scenario the
 * mission rule (`project_agentplain_mission_and_positioning.md`) requires on
 * every vertical landing page: "one concrete example of the value loop."
 *
 * Shape is intentionally compact:
 * - `scenario` — one-line setup describing the moment (timestamp + actor)
 * - `before` — what the practitioner did today, in their own systems
 * - `after`  — what the fleet drafts before the practitioner opens the laptop
 * - `outcome` — the time / money / friction-reduction this delivers
 *
 * Optional today because it was added after the initial 10 content files.
 * Treat as required for new verticals; populate retroactively on the existing
 * 10 in the same PR that introduces this type.
 */
export interface ValueLoopExample {
  scenario: string;
  before: string;
  after: string;
  outcome: string;
}

/**
 * A single FAQ pair for a vertical landing page. Mirrors the `{q, a}` shape
 * the homepage/pricing FAQ uses (`components/faq-items.ts`) and that the
 * `faqPageJsonLd()` builder consumes — defined here (not imported from the
 * component layer) so `lib/` never depends on `components/`.
 *
 * AEO (answer-engine optimization) intent: these are the questions an AI
 * answer engine fields about a vertical — "is there an AI service for {X}?",
 * "how much does it cost?", "does it send things on its own?". Each answer
 * is self-contained and quotable, so an engine can lift one verbatim and have
 * it stand on its own. Every answer is grounded in the vertical's own content
 * (hero, JTBD, tier, integrations) or a ratified memory rule — nothing is
 * invented, per `feedback_no_guesses_no_estimates.md`.
 */
export interface VerticalFaqItem {
  q: string;
  a: string;
}

/**
 * One capability in the vertical's pre-trained fleet, as surfaced in-product
 * on `/app/workspace/[id]/agents`. This is the source of truth for the
 * roster the operator-facing agents page renders — it replaces the static
 * realty-only `FLEET` array that page used to hardcode, so a CPA / law /
 * insurance workspace sees its own fleet.
 *
 * - `slug` — stable agent identifier, used in handoff logs + the per-agent
 *   route (`/agents/[slug]`). MUST match the `fromAgent` / `toAgent` values
 *   the runtime writes to `HandoffLogEntry`, or the activity count reads 0.
 * - `name` — human-readable capability name, brand voice (calm, no hype).
 * - `job` — one-line plain-English description of the single job it owns.
 * - `runtime` — what backs this capability in the product today. `live` means
 *   the V1 inbox loop attributes real work to this agent's slug (so the card
 *   shows real handoff counts once email flows through it). `rooting` means
 *   the capability is declared in the fleet but its runtime is still being
 *   built — the card says so honestly via `rootingNote` instead of implying a
 *   handoff is imminent. Omitting `runtime` keeps the legacy count-only
 *   rendering (used by verticals that have not yet declared bindings).
 * - `owns` — the loop outcomes the persist layer attributes to this agent.
 *   Only meaningful when `runtime === "live"`; the attribution resolver in
 *   `lib/skills/persist-artifacts.ts` writes this slug as the handoff trace
 *   root + the approval `agentSlug` so the contract above actually holds.
 * - `rootingNote` — required when `runtime === "rooting"`: one calm,
 *   service-partner line stating what the capability is waiting on.
 *
 * Grounded in each vertical's JTBD tables — the roster names the agents the
 * `withAgentplain` column already references, so the in-product fleet and the
 * marketing page describe the same capabilities.
 */

/**
 * Loop outcomes the live inbox chain can attribute to a roster agent. This is
 * the bridge between the runner's `SkillRunOutcome` (intent / schedule) and a
 * named capability the customer sees on `/agents`. Keep in sync with
 * `workFromOutcome` in `lib/skills/persist-artifacts.ts`.
 */
export type AgentLoopWork = "buyer-inquiry" | "scheduling" | "compliance-check";

/** Whether a roster capability runs in the live V1 loop or is still rooting. */
export type AgentRuntimeStatus = "live" | "rooting";

export interface AgentRosterEntry {
  slug: string;
  name: string;
  job: string;
  runtime?: AgentRuntimeStatus;
  owns?: AgentLoopWork[];
  /**
   * Catalog slug from `lib/skills/registry.ts` this card is wired to.
   * A second pathway for declaring a card LIVE: instead of (or alongside)
   * owning an inbox-loop work bucket, a card can be live because it has
   * a runnable, catalog-registered, test-gated skill behind it. The agents
   * page surfaces these as "ready — capability tested" until handoff
   * activity accrues.
   *
   * Required validation (enforced in `tests/vertical-roster-bindings.test.ts`):
   *   - `runtime: 'live'` requires at least one of `owns[]` or `boundSkill`.
   *   - When `boundSkill` is set it MUST point to a `SKILL_CATALOG` entry.
   *
   * Per the vertical-depth brief (2026-05-22): NO HOLLOW SHELLS. A bound
   * skill must ship with real logic + a stubbed-fetcher fallback + a
   * passing test or the card stays `rooting`.
   */
  boundSkill?: string;
  rootingNote?: string;
  /**
   * Runtime preconditions a workspace must satisfy before this card is
   * honestly LIVE. Set ONLY on cards whose `runtime === 'live'` AND
   * whose bound skill depends on a per-workspace integration that the
   * customer must connect themselves (e.g. calendar credentials for the
   * chief-of-staff scheduler).
   *
   * - `connectors` — `IntegrationCredential.provider` keys (GOOGLE,
   *   M365, QUICKBOOKS, etc.). The card is LIVE iff at least one of
   *   these has status=ACTIVE for the workspace. When NONE are active,
   *   the agents page degrades the card to "connect to activate" with
   *   the explicit connector list so the customer knows what to wire.
   *
   * Per `reference_product_claims_vs_reality_2026_05_22`: the LIVE
   * badge derives from real state, not from a static roster claim. This
   * field is the seam that lets the roster declare "live IFF
   * connector is wired" without inventing a third runtime status.
   */
  liveRequires?: {
    connectors: string[];
  };
}

/**
 * Top-level shape for one vertical's landing page.
 *
 * Renderer contract: every field is required except `jtbdTables[*].draft`
 * (defaults false), `integration.note`, and `valueLoopExample` (added in a
 * later content pass — present on all 10 active verticals, optional for new
 * additions during their draft phase). An empty array is a deliberate
 * statement; null/undefined fields on required keys are a content bug.
 */
export interface VerticalContent {
  /** URL slug — must match the directory name under `lib/verticals/`. */
  slug: string;

  /** Human-readable vertical name, used in heading and metadata. */
  name: string;

  /** Tier this vertical is sold at — drives the pricing banner. */
  tier: VerticalTier;

  /**
   * Surface status. Omit (defaults to `live`) on the ten ratified verticals.
   * Set to `on-ramp` on the `/general` surface so the registry and the
   * route can distinguish it from a vertical-locked listing — see
   * `lib/verticals/index.ts` for how the two registries are wired.
   */
  status?: VerticalStatus;

  /** Hero one-liner — short value prop using REPLACE/INTEGRATE/AUGMENT framing. */
  hero: {
    eyebrow: string;
    headline: string;
    valueProp: string;
    /**
     * One-line SBM-wrapper subhead, rendered under the value prop. Per
     * `project_sbm_wrapper_positioning_2026_06_06.md` (ratified 2026-06-06):
     * agentplain is the service layer that makes Claude for Small Business
     * usable — never a competitor/replacement/alternative. Format:
     * "[vertical-specific frame] — built on Claude, configured by us."
     * Optional in the type for backward-compat; populated on all ten ratified
     * verticals. Keep complementary; banned framings (instead of / alternative
     * to / replace Claude) must never appear here.
     */
    sbmSubhead?: string;
  };

  /** SEO + Open Graph metadata. */
  metaTitle: string;
  metaDescription: string;

  /** One row per primary role inside the vertical (broker-owner / IC / etc.). */
  jtbdTables: JtbdRoleTable[];

  roi: RoiAnchor;

  claims: ClaimsTriad;

  integrations: IntegrationsSection;

  /**
   * Day-in-the-life value-loop example. Required by
   * `project_agentplain_mission_and_positioning.md` for every customer-facing
   * vertical surface; optional in the type for backward-compat with the
   * initial 10-vertical content drop.
   */
  valueLoopExample?: ValueLoopExample;

  /**
   * Audience noun the vertical hero plugs into the locked mission line:
   *   "We lift up {missionSubject} by doing the work that takes their time
   *   and money away from the people they serve."
   *
   * Per `project_agentplain_mission_and_positioning.md` (2026-05-11 lock),
   * every vertical hero needs the mission line rendered with the vertical-
   * specific noun so the visitor sees themselves on page 1. Examples:
   *   - real-estate     → "realtors and brokerages"
   *   - mortgage        → "mortgage brokers"
   *   - cpa             → "CPAs and tax practices"
   *   - law             → "law firms"
   *
   * Optional in the type for backward-compat; populated on all 10 active
   * verticals in this PR.
   */
  missionSubject?: string;

  /**
   * The vertical's pre-trained fleet — the capabilities the in-product
   * `/app/workspace/[id]/agents` page renders for a workspace in this
   * vertical. Each entry is a single-job capability (see `AgentRosterEntry`).
   *
   * Populated on all ten ratified verticals in this PR. Optional in the type
   * for backward-compat with the `/general` on-ramp surface, which shares the
   * `VerticalContent` shape but has no vertical-specific fleet — the agents
   * page falls back to the real-estate roster when this is absent so the page
   * never renders empty.
   */
  agentRoster?: AgentRosterEntry[];

  /**
   * AEO direct-answer block — a single, self-contained, quotable paragraph
   * answering "What is agentplain for {vertical}?". Rendered prominently near
   * the top of the vertical page under that exact heading, AND emitted as the
   * first entry of the page's FAQPage JSON-LD so an answer engine fielding
   * "is there an AI service for {vertical}?" can lift it verbatim.
   *
   * Must be grounded in the vertical's own `hero.valueProp` / JTBD / tier —
   * no claim that isn't already substantiated elsewhere on the page. Optional
   * for back-compat; populated on all ten ratified verticals + the /general
   * on-ramp. When absent, the page falls back to `hero.valueProp` for the
   * block and omits the direct-answer item from the FAQPage payload.
   */
  directAnswer?: string;

  /**
   * Per-vertical FAQ — 3–4 grounded, quotable Q&A pairs rendered as a
   * disclosure list near the foot of the page and emitted (alongside the
   * `directAnswer`) as the page's FAQPage JSON-LD. Per Google's FAQPage
   * policy the structured data must mirror visible content, so the same
   * items drive both the rendered list and the schema.
   *
   * Optional for back-compat; populated on all ten ratified verticals + the
   * /general on-ramp. When absent, no FAQ section renders and the FAQPage
   * payload carries only the direct-answer item (or is omitted entirely if
   * `directAnswer` is also absent).
   */
  verticalFaq?: VerticalFaqItem[];
}
