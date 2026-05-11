// VerticalContent — the typed shape that drives every per-vertical landing page.
//
// Two-implementation rule (feedback_runner_portability.md): this is the
// abstraction. Today's only implementation is the `lib/verticals/<slug>/content.ts`
// static modules. A future implementation could be a headless CMS adapter or
// a per-customer override. Route code reads `VerticalContent`, never the
// raw content files.

/**
 * Tier identifier — must match the per-seat ladder defined in
 * `project_stripe_both_surfaces.md` (locked 2026-05-09; pilot SKUs deprecated
 * the same day) and the tier mapping in `project_vertical_tier_mapping.md`.
 *
 * Per-seat ladder (solo → 50–99 seats):
 * - `regular` → agentplain-regular-monthly → $199 → $99 per seat
 * - `plus`    → agentplain-plus-monthly    → $299 → $199 per seat
 * - `max`     → agentplain-max-monthly     → $499 → $299 per seat
 *
 * Month-to-month, first month free, no minimums, no pilot fees.
 * 100+ seats moves to enterprise terms.
 */
export type VerticalTier = "regular" | "plus" | "max";

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
 */
export interface RoiAnchor {
  multiplier: string;
  inputCost: string;
  outputValue: string;
  math: string;
  citation: string;
}

/**
 * Integrations — split into "shipped" and "planned". Per
 * `project_integration_roadmap.md` + `feedback_integration_acceptance_is_functional.md`,
 * NONE are currently shipped (as of 2026-05-11). This shape future-proofs
 * the page so we can move integrations to `shipped` without changing the
 * renderer.
 *
 * `plannedWindow` is shown verbatim ("Q3 2026" etc.) so the page never
 * claims more than the roadmap commits to.
 */
export interface Integration {
  name: string;
  category: string;
  note?: string;
}

export interface IntegrationsSection {
  shipped: Integration[];
  planned: Integration[];
  plannedWindow: string;
}

/**
 * Top-level shape for one vertical's landing page.
 *
 * Renderer contract: every field is required except `jtbdTables[*].draft`
 * (defaults false) and `integration.note`. An empty array is a deliberate
 * statement; null/undefined fields are a content bug.
 */
export interface VerticalContent {
  /** URL slug — must match the directory name under `lib/verticals/`. */
  slug: string;

  /** Human-readable vertical name, used in heading and metadata. */
  name: string;

  /** Tier this vertical is sold at — drives the pricing banner. */
  tier: VerticalTier;

  /** Hero one-liner — short value prop using REPLACE/INTEGRATE/AUGMENT framing. */
  hero: {
    eyebrow: string;
    headline: string;
    valueProp: string;
  };

  /** SEO + Open Graph metadata. */
  metaTitle: string;
  metaDescription: string;

  /** One row per primary role inside the vertical (broker-owner / IC / etc.). */
  jtbdTables: JtbdRoleTable[];

  roi: RoiAnchor;

  claims: ClaimsTriad;

  integrations: IntegrationsSection;
}
