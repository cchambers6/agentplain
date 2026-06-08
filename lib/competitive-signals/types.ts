/**
 * lib/competitive-signals/types.ts
 *
 * The competitive-signal feed — the BUILDABLE half of Wave-8 (audit pride
 * theme #18: "real competitive-signal feed for vertical heads instead of
 * quarterly watch memos").
 *
 * The dormant Media / Insights / director charters modeled a stack of
 * quarterly "watch memo" producers — departments we do not staff. The
 * audit's guidance was to DEFER those charters and ship the one real
 * enabler: a scheduled feed that pulls competitive movements (competitor
 * launches, pricing changes, funding, regulatory shifts) for the verticals
 * we actually run, and drafts a digest the vertical heads
 * (`b2b-head-of-realty`, etc.) consume — instead of a human writing a memo
 * once a quarter.
 *
 * ── Architecture (per feedback_no_silent_vendor_lock + feedback_runner_portability) ──
 * Every web-research call lives behind `CompetitiveSignalProvider` in this
 * domain. Two implementations satisfy the two-implementation rule:
 *   - FixtureSignalProvider — deterministic, dev/test/preview default. Runs
 *     with NO network. This is what dev + the test suite exercise.
 *   - WebResearchSignalProvider — the flag-gated live adapter
 *     (COMPETITIVE_SIGNAL_PROVIDER=web). It fronts the connected web-search
 *     /research surface (Bright Data MCP — the same surface the roster's
 *     vertical heads already list as a primaryTool). Until the MCP dispatch
 *     is wired in prod it returns the same fixture shape and NAMES the gap,
 *     exactly like research-on-demand names its web-search gap — honest, not
 *     fabricated.
 *
 * ── No outbound (project_no_outbound_architecture) ──
 * The feed READS public competitive movements and DRAFTS a digest. It buys
 * nothing, sends nothing, and posts nothing. The digest is a proposal a
 * vertical head reviews.
 *
 * ── Cold-start safe (feedback_cold_start_safe_agents) ──
 * The provider is queried fresh on every fire. There is no in-memory cache
 * of "last quarter's memo" — the feed reflects what the provider returns
 * right now.
 */

import type { DisciplineId } from '@/lib/disciplines';

/** A single competitive movement the feed surfaces. */
export type SignalCategory =
  | 'competitor-launch'
  | 'pricing-change'
  | 'funding'
  | 'regulatory'
  | 'market-move'
  | 'partnership';

/** How material the movement is for the vertical head's planning. */
export type SignalSeverity = 'low' | 'medium' | 'high';

export interface CompetitiveSignal {
  /** Stable id for dedupe across fires. Provider-assigned. */
  id: string;
  /** The vertical this signal informs — maps to a `b2b-head-of-*` slug. */
  vertical: VerticalKey;
  category: SignalCategory;
  severity: SignalSeverity;
  /** One-line headline (the movement). */
  headline: string;
  /** Two-to-three sentence summary grounded in the source. */
  summary: string;
  /** Source URL the claim is grounded in. Null only when the provider had
   *  no public source (the digest then flags it as unverified). */
  sourceUrl: string | null;
  /** Source publisher / outlet name. */
  source: string;
  /** ISO date the movement was observed/published. */
  observedAt: string;
}

/** The verticals agentplain actually runs a head for today. Keyed to the
 *  `b2b-head-of-*` roster slugs so the feed and the org chart cannot drift. */
export type VerticalKey = 'realty' | 'insurance' | 'home-services';

/** Slug of the vertical head that consumes a given vertical's signals. */
export const VERTICAL_HEAD_SLUG: Record<VerticalKey, string> = {
  realty: 'b2b-head-of-realty',
  insurance: 'b2b-head-of-insurance',
  'home-services': 'b2b-head-of-home-services',
};

/** The discipline the feed is tagged under for the fire-gate. Competitive
 *  intelligence is research work. */
export const COMPETITIVE_SIGNAL_DISCIPLINE: DisciplineId = 'research';

/** Stable skill slug for the fire-gate + scorecard. */
export const COMPETITIVE_SIGNAL_SKILL_SLUG = 'competitive-signal-feed';

export interface SignalQuery {
  vertical: VerticalKey;
  /** Trailing window the feed asks the provider to cover, in days. */
  lookbackDays: number;
  /** Cap on signals returned per vertical. */
  limit: number;
}

export type SignalProviderResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: { code: SignalErrorCode; message: string } };

export type SignalErrorCode =
  | 'PROVIDER_UNAVAILABLE'
  | 'RATE_LIMITED'
  | 'PARSE_ERROR'
  | 'NOT_CONFIGURED'
  | 'UNKNOWN';

export function signalOk<T>(value: T): { ok: true; value: T } {
  return { ok: true, value };
}

export function signalError(
  code: SignalErrorCode,
  message: string,
): { ok: false; error: { code: SignalErrorCode; message: string } } {
  return { ok: false, error: { code, message } };
}

/**
 * The provider port. Every implementation returns the same `CompetitiveSignal`
 * shape so the digest composer is provider-agnostic. New providers (a
 * different research vendor, a vertical-specific feed) implement this without
 * touching the digest or the cron.
 */
export interface CompetitiveSignalProvider {
  readonly name: string;
  /** True when this provider talks to a live network surface. The digest
   *  uses this to decide whether to NAME the "live web research not wired"
   *  gap — the same honesty seam research-on-demand uses. */
  readonly isLive: boolean;
  fetchSignals(
    query: SignalQuery,
  ): Promise<SignalProviderResult<CompetitiveSignal[]>>;
}

/** One vertical's section of the feed digest. */
export interface VerticalSignalSection {
  vertical: VerticalKey;
  headSlug: string;
  signals: CompetitiveSignal[];
  /** Named gaps for this section (e.g. "live web research not wired"). */
  gaps: string[];
}

/** The full digest the cron drafts for the vertical heads. */
export interface CompetitiveSignalDigest {
  generatedAt: string;
  providerName: string;
  providerIsLive: boolean;
  sections: VerticalSignalSection[];
  /** Total signals across all sections. */
  totalSignals: number;
  /** Feed-level gaps that apply across every section. */
  gaps: string[];
  noOutboundNote: string;
}
