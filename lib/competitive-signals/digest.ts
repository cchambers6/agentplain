/**
 * lib/competitive-signals/digest.ts
 *
 * Composes the competitive-signal digest from whatever provider is bound.
 * Provider-agnostic: it queries each vertical, dedupes, and assembles the
 * sectioned digest the vertical heads consume. Pure + injectable so the
 * cron and the tests share one composer.
 *
 * Per project_no_outbound_architecture: the digest is a DRAFT proposal. It
 * names gaps (per feedback_no_guesses_no_estimates) rather than papering over
 * an empty or fixture-backed feed.
 */

import {
  COMPETITIVE_SIGNAL_DISCIPLINE,
  VERTICAL_HEAD_SLUG,
  type CompetitiveSignal,
  type CompetitiveSignalDigest,
  type CompetitiveSignalProvider,
  type SignalProviderResult,
  type VerticalKey,
  type VerticalSignalSection,
} from './types';

const NO_OUTBOUND_NOTE =
  'No outbound. The competitive-signal digest drafts for the vertical heads to '
  + 'review; nothing is bought, sent, or posted. Per project_no_outbound_architecture.md.';

const LIVE_RESEARCH_GAP =
  'Live web research is not dispatched in agentplain\'s runtime yet — this digest '
  + 'is built from the fixture corpus. Wire the Bright Data MCP search port '
  + '(COMPETITIVE_SIGNAL_PROVIDER=web + a search dispatch) to make these signals live. '
  + 'The fixture entries are illustrative samples, not current claims.';

/** Default verticals the feed covers — the ones agentplain runs a head for. */
export const DEFAULT_FEED_VERTICALS: VerticalKey[] = [
  'realty',
  'insurance',
  'home-services',
];

export interface BuildDigestArgs {
  provider: CompetitiveSignalProvider;
  /** Which verticals to pull. Defaults to all three heads. */
  verticals?: VerticalKey[];
  lookbackDays?: number;
  /** Per-vertical signal cap. */
  limitPerVertical?: number;
  now?: Date;
}

export interface BuildDigestResult {
  digest: CompetitiveSignalDigest;
  /** Per-vertical provider failures — one vertical failing does not sink the
   *  whole digest; the section records the failure as a gap. */
  failures: Array<{ vertical: VerticalKey; reason: string }>;
}

export async function buildCompetitiveSignalDigest(
  args: BuildDigestArgs,
): Promise<BuildDigestResult> {
  const verticals = args.verticals ?? DEFAULT_FEED_VERTICALS;
  const lookbackDays = args.lookbackDays ?? 90;
  const limitPerVertical = args.limitPerVertical ?? 8;
  const now = args.now ?? new Date();

  const sections: VerticalSignalSection[] = [];
  const failures: Array<{ vertical: VerticalKey; reason: string }> = [];

  for (const vertical of verticals) {
    const res: SignalProviderResult<CompetitiveSignal[]> =
      await args.provider.fetchSignals({
        vertical,
        lookbackDays,
        limit: limitPerVertical,
      });

    const gaps: string[] = [];
    let signals: CompetitiveSignal[] = [];

    if (!res.ok) {
      failures.push({ vertical, reason: `${res.error.code}: ${res.error.message}` });
      gaps.push(
        `Could not pull ${vertical} signals this run (${res.error.code}). `
        + 'The section is empty rather than guessing.',
      );
    } else {
      signals = dedupeSignals(res.value);
      if (signals.length === 0) {
        gaps.push(
          `No competitive movements found for ${vertical} in the trailing `
          + `${lookbackDays} days. Empty is honest — not a fabricated quiet quarter.`,
        );
      }
    }

    sections.push({
      vertical,
      headSlug: VERTICAL_HEAD_SLUG[vertical],
      signals,
      gaps,
    });
  }

  const feedGaps: string[] = [];
  if (!args.provider.isLive) {
    feedGaps.push(LIVE_RESEARCH_GAP);
  }

  const totalSignals = sections.reduce((n, s) => n + s.signals.length, 0);

  const digest: CompetitiveSignalDigest = {
    generatedAt: now.toISOString(),
    providerName: args.provider.name,
    providerIsLive: args.provider.isLive,
    sections,
    totalSignals,
    gaps: feedGaps,
    noOutboundNote: NO_OUTBOUND_NOTE,
  };

  return { digest, failures };
}

/** Dedupe by signal id (provider-assigned), keeping first occurrence. */
function dedupeSignals(signals: CompetitiveSignal[]): CompetitiveSignal[] {
  const seen = new Set<string>();
  const out: CompetitiveSignal[] = [];
  for (const s of signals) {
    if (seen.has(s.id)) continue;
    seen.add(s.id);
    out.push(s);
  }
  return out;
}

/** Render the digest as a plain-text brief for the operator log / future
 *  approval row. Keeps the structured digest as the source of truth. */
export function renderDigestText(digest: CompetitiveSignalDigest): string {
  const lines: string[] = [];
  lines.push('COMPETITIVE-SIGNAL FEED');
  lines.push(
    `Generated ${digest.generatedAt} · provider=${digest.providerName} · `
    + `live=${digest.providerIsLive} · ${digest.totalSignals} signal(s) · `
    + `discipline=${COMPETITIVE_SIGNAL_DISCIPLINE}`,
  );
  lines.push('');
  for (const section of digest.sections) {
    lines.push(`── ${section.vertical} → ${section.headSlug} ──`);
    if (section.signals.length === 0) {
      lines.push('  (no signals)');
    }
    for (const sig of section.signals) {
      lines.push(`  [${sig.severity.toUpperCase()}] ${sig.category}: ${sig.headline}`);
      lines.push(`    ${sig.summary}`);
      lines.push(`    source: ${sig.source} — ${sig.sourceUrl ?? 'no source url'} (${sig.observedAt})`);
    }
    for (const gap of section.gaps) {
      lines.push(`  gap: ${gap}`);
    }
    lines.push('');
  }
  for (const gap of digest.gaps) {
    lines.push(`feed gap: ${gap}`);
  }
  lines.push(digest.noOutboundNote);
  return lines.join('\n');
}
