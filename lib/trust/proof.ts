/**
 * Social-proof registry — the single source of truth for every trust surface
 * (design-partner logos, testimonials, press mentions, case studies, measured
 * outcomes). The components in `components/trust/` render whatever is here and
 * fall back to an honest empty state when a registry is empty.
 *
 * Admission rules (enforced by `proof.test.ts` and by the types below):
 *   - A partner, testimonial, or case study CANNOT be added without
 *     `permission: true` — written permission from the named business.
 *   - A case study or outcome stat CANNOT be added without `source` — the
 *     internal artifact its numbers were measured from (the workspace's
 *     saved-time ledger export, a signed recap, etc.). `source` is
 *     traceability metadata and is never rendered on a customer surface,
 *     mirroring the `cite` convention in `components/marketing/HomeCards.tsx`.
 *   - Nothing modeled, projected, or "expected" goes in an outcome stat. The
 *     ROI calculator already owns clearly-labeled assumptions; this registry
 *     owns measured results only.
 *
 * Logos and headshots are produced by the creative pipeline or supplied by the
 * partner (per `feedback_creative_assets_use_tools_or_humans.md` — never
 * improvised). `logoSrc`/`headshotSrc` stay optional so a partner can go live
 * as a named text entry before their asset clears.
 */

export interface DesignPartner {
  /** Business name as the partner wants it shown. */
  name: string;
  /** Vertical slug from `lib/verticals` (e.g. "real-estate"). */
  vertical: string;
  /** Path under /public supplied by the partner or the creative pipeline. */
  logoSrc?: string;
  /** Month the partnership went live, e.g. "2026-08". */
  since?: string;
  /** Written permission to show the name/logo. Entries without it don't ship. */
  permission: true;
}

export interface Testimonial {
  /** The customer's words, verbatim. No paraphrase, no composite quotes. */
  quote: string;
  name: string;
  role: string;
  company: string;
  /** Path under /public, supplied by the person quoted. */
  headshotSrc?: string;
  /** Vertical slugs this quote is relevant to; omit for site-wide. */
  verticals?: string[];
  permission: true;
}

export interface PressMention {
  outlet: string;
  /** Title of the article / episode / award. */
  title: string;
  /** Public link to the mention itself. */
  href: string;
  kind: "press" | "podcast" | "award";
  /** e.g. "2026-08". */
  date?: string;
  logoSrc?: string;
}

export interface CaseStudy {
  company: string;
  vertical: string;
  /** Headline measured outcome, e.g. "9.5 hours back per week". */
  outcome: string;
  /** Two-to-three sentence story: the work, the change, the number. */
  summary: string;
  /** Link to the full write-up. */
  href: string;
  logoSrc?: string;
  /** Internal artifact the numbers come from. Never rendered. */
  source: string;
  permission: true;
}

export interface OutcomeStat {
  /** What was measured, e.g. "Hours on lead follow-up per week". */
  metric: string;
  /** Measured state before the fleet, e.g. "11 hrs". */
  before: string;
  /** Measured state after, e.g. "1.5 hrs". */
  after: string;
  /** One sentence of context: whose workspace, over what window. */
  context: string;
  /** Vertical slugs this stat is relevant to; omit for site-wide. */
  verticals?: string[];
  /** Internal artifact the numbers come from. Never rendered. */
  source: string;
}

// ─── Registries — empty until real proof lands ──────────────────────────────
// Populating any of these lights up the corresponding component everywhere
// it is wired. Do not add an entry that fails the admission rules above.

export const DESIGN_PARTNERS: DesignPartner[] = [];

export const TESTIMONIALS: Testimonial[] = [];

export const PRESS_MENTIONS: PressMention[] = [];

export const CASE_STUDIES: CaseStudy[] = [];

export const OUTCOME_STATS: OutcomeStat[] = [];

// ─── Per-vertical selectors ─────────────────────────────────────────────────

export function partnersFor(vertical: string): DesignPartner[] {
  return DESIGN_PARTNERS.filter((p) => p.vertical === vertical);
}

export function testimonialsFor(vertical: string): Testimonial[] {
  return TESTIMONIALS.filter((t) => !t.verticals || t.verticals.includes(vertical));
}

export function caseStudiesFor(vertical: string): CaseStudy[] {
  return CASE_STUDIES.filter((c) => c.vertical === vertical);
}

export function outcomesFor(vertical: string): OutcomeStat[] {
  return OUTCOME_STATS.filter((o) => !o.verticals || o.verticals.includes(vertical));
}

// ─── Empty-state copy ───────────────────────────────────────────────────────
// One place for every trust surface's honest empty state, so the discipline
// test in `proof.test.ts` can hold all of it to the same bar: report what is
// true today, say what changes it, no filler. Kept as data (not JSX) so the
// copy is testable and reusable across surfaces.

export const TRUST_EMPTY_COPY = {
  partners: {
    eyebrow: "Founding design partners",
    reality:
      "This space is reserved for our founding design partners. We're recruiting the first cohort now, starting with Georgia real estate.",
    change:
      "When a partner goes live, their name lands here with their written permission. No borrowed logos, no invented customers.",
    ctaLabel: "Become a founding partner",
  },
  testimonial: {
    eyebrow: "In their words",
    reality:
      "The words here will come from customers, quoted verbatim and with permission, tied to work the fleet actually ran.",
    change: "Until a design partner says it, this section stays quiet.",
  },
  press: {
    eyebrow: "As seen in",
    reality:
      "No coverage to show yet. When agentplain appears in industry press, on a podcast, or in an award list, the mention lands here, linked to the source.",
  },
  caseStudies: {
    eyebrow: "Case studies",
    reality:
      "Case studies publish after a partner's first measured month. Each one is built from that workspace's own saved-time ledger: the jobs the fleet ran, the hours returned, the approvals the owner made.",
    change: "Real numbers or no story.",
  },
  outcomes: {
    eyebrow: "Measured outcomes",
    reality:
      "Before-and-after numbers publish measured, not modeled. The fleet logs every completed job to a saved-time ledger; once a partner clears a full month, their hours-back figure lands here.",
    change:
      "Until then, the only math on this site is the ROI calculator's clearly labeled assumptions.",
  },
} as const;

/** Mailto used by the founding-partner CTA on trust surfaces. */
export const PARTNER_CTA_HREF =
  "mailto:hello@agentplain.com?subject=Founding%20design%20partner";
