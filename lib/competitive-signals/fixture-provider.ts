/**
 * lib/competitive-signals/fixture-provider.ts
 *
 * Deterministic, network-free implementation of `CompetitiveSignalProvider`.
 * The dev / test / preview default and the contract-pinning peer of
 * `WebResearchSignalProvider` (the two-implementation rule,
 * feedback_runner_portability).
 *
 * The fixtures are real-shaped competitive movements for the three verticals
 * agentplain runs a head for. They are illustrative SAMPLES, not live claims —
 * the digest labels a fixture-sourced feed as such so no fabricated movement
 * is ever presented as current truth. The point of the fixture is to prove the
 * feed produces correctly-shaped, grounded, deduped signals end-to-end without
 * a credentialed network call.
 *
 * Per feedback_no_guesses_no_estimates: every fixture signal carries a real
 * source URL + outlet so the digest's grounding contract holds even off the
 * fixture path.
 */

import {
  type CompetitiveSignal,
  type CompetitiveSignalProvider,
  type SignalProviderResult,
  type SignalQuery,
  type VerticalKey,
  signalOk,
} from './types';

/**
 * Seed corpus, keyed by vertical. Deterministic; the provider slices by the
 * query's lookback + limit. Dates are recent-relative to the wave date
 * (2026-06-07) so a lookbackDays filter is meaningful in tests.
 */
const FIXTURE_SIGNALS: Record<VerticalKey, CompetitiveSignal[]> = {
  realty: [
    {
      id: 'realty-sig-001',
      vertical: 'realty',
      category: 'competitor-launch',
      severity: 'high',
      headline:
        'kvCORE ships an AI listing-description generator inside the agent CRM',
      summary:
        'The incumbent brokerage CRM added an in-product AI writer for listing copy. '
        + 'It overlaps the Listing Coordinator agent\'s draft surface — a signal the '
        + 'realty head should weigh when positioning the agent suite against bundled CRM AI.',
      sourceUrl: 'https://www.inman.com/category/technology/',
      source: 'Inman',
      observedAt: '2026-06-02',
    },
    {
      id: 'realty-sig-002',
      vertical: 'realty',
      category: 'pricing-change',
      severity: 'medium',
      headline: 'Follow Up Boss raises per-seat pricing for small teams',
      summary:
        'FUB adjusted its team-tier pricing upward. Small independent brokerages '
        + '(our ICP) feel per-seat increases acutely — a TCO talking point for the '
        + 'realty sales narrative.',
      sourceUrl: 'https://followupboss.com/pricing/',
      source: 'Follow Up Boss',
      observedAt: '2026-05-28',
    },
    {
      id: 'realty-sig-003',
      vertical: 'realty',
      category: 'regulatory',
      severity: 'high',
      headline:
        'NAR settlement compliance reminders tighten buyer-agreement disclosure timing',
      summary:
        'Updated guidance narrows when a buyer representation agreement must be in '
        + 'place before a showing. The Compliance Sentinel corpus and the Showing '
        + 'Scheduler agent should reflect the tightened timing.',
      sourceUrl: 'https://www.nar.realtor/the-facts',
      source: 'National Association of REALTORS',
      observedAt: '2026-05-20',
    },
    {
      id: 'realty-sig-004',
      vertical: 'realty',
      category: 'funding',
      severity: 'low',
      headline: 'A brokerage-ops startup raises a seed round for transaction AI',
      summary:
        'An early-stage entrant raised a seed round to build transaction-coordination '
        + 'AI for brokerages. Low immediate threat (pre-product) but worth tracking as '
        + 'the category attracts capital.',
      sourceUrl: 'https://techcrunch.com/category/fintech/',
      source: 'TechCrunch',
      observedAt: '2026-04-15',
    },
  ],
  insurance: [
    {
      id: 'insurance-sig-001',
      vertical: 'insurance',
      category: 'competitor-launch',
      severity: 'medium',
      headline:
        'An AMS vendor adds an AI policy-renewal assistant to its broker dashboard',
      summary:
        'A management-system vendor shipped a renewal-reminder AI inside the broker '
        + 'workflow. Relevant to a future insurance head\'s product positioning when '
        + 'the vertical activates.',
      sourceUrl: 'https://www.insurancejournal.com/news/national/',
      source: 'Insurance Journal',
      observedAt: '2026-05-30',
    },
    {
      id: 'insurance-sig-002',
      vertical: 'insurance',
      category: 'regulatory',
      severity: 'medium',
      headline: 'State DOI updates e-delivery consent rules for policy documents',
      summary:
        'A department of insurance revised electronic-delivery consent requirements. '
        + 'Any insurance compliance corpus would need this before the vertical fires live.',
      sourceUrl: 'https://content.naic.org/',
      source: 'NAIC',
      observedAt: '2026-05-18',
    },
  ],
  'home-services': [
    {
      id: 'home-services-sig-001',
      vertical: 'home-services',
      category: 'competitor-launch',
      severity: 'medium',
      headline: 'ServiceTitan expands its AI dispatch + voice-intake features',
      summary:
        'The dominant trades platform broadened its AI dispatch and call-intake '
        + 'capabilities. The roofing sub-vertical pick competes against this bundle — '
        + 'a signal for the home-services head when activation is greenlit.',
      sourceUrl: 'https://www.servicetitan.com/blog',
      source: 'ServiceTitan',
      observedAt: '2026-06-01',
    },
    {
      id: 'home-services-sig-002',
      vertical: 'home-services',
      category: 'funding',
      severity: 'low',
      headline: 'An AI receptionist startup for home services raises Series A',
      summary:
        'A voice-AI entrant focused on trades intake raised a Series A. Category '
        + 'is heating up; the home-services head should track entrants before activation.',
      sourceUrl: 'https://techcrunch.com/category/startups/',
      source: 'TechCrunch',
      observedAt: '2026-04-22',
    },
  ],
};

export interface FixtureSignalProviderArgs {
  /** Override the seed corpus (tests pin a deterministic set). Defaults to
   *  the built-in fixtures. */
  corpus?: Record<VerticalKey, CompetitiveSignal[]>;
  /** Fixed "now" for the lookback filter. Defaults to the corpus's latest
   *  observedAt so the default fixtures always pass a reasonable lookback. */
  now?: Date;
}

export class FixtureSignalProvider implements CompetitiveSignalProvider {
  readonly name = 'fixture';
  readonly isLive = false;
  private readonly corpus: Record<VerticalKey, CompetitiveSignal[]>;
  private readonly now: Date;

  constructor(args: FixtureSignalProviderArgs = {}) {
    this.corpus = args.corpus ?? FIXTURE_SIGNALS;
    // Default "now" = the wave date so the seed fixtures fall inside a
    // 90-day lookback. Tests inject their own clock.
    this.now = args.now ?? new Date('2026-06-07T00:00:00Z');
  }

  async fetchSignals(
    query: SignalQuery,
  ): Promise<SignalProviderResult<CompetitiveSignal[]>> {
    const all = this.corpus[query.vertical] ?? [];
    const cutoff = new Date(this.now);
    cutoff.setUTCDate(cutoff.getUTCDate() - query.lookbackDays);

    const within = all
      .filter((s) => new Date(s.observedAt) >= cutoff)
      .sort((a, b) => severityRank(b.severity) - severityRank(a.severity)
        || b.observedAt.localeCompare(a.observedAt))
      .slice(0, query.limit);

    return signalOk(within);
  }
}

function severityRank(s: CompetitiveSignal['severity']): number {
  switch (s) {
    case 'high':
      return 3;
    case 'medium':
      return 2;
    case 'low':
      return 1;
    default:
      return 0;
  }
}

/** Exposed for tests + the live provider's fixture fallback. */
export const __fixtureCorpus = FIXTURE_SIGNALS;
