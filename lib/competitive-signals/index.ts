/**
 * lib/competitive-signals/index.ts
 *
 * Public surface + provider selection for the competitive-signal feed.
 * Callers (the cron, future operator panels) import from here; they never
 * construct a concrete provider directly — that keeps the vendor swap behind
 * one seam (feedback_no_silent_vendor_lock).
 *
 * Selection: COMPETITIVE_SIGNAL_PROVIDER=fixture (default) | web.
 *   - fixture → FixtureSignalProvider (network-free, dev/preview/test default)
 *   - web     → WebResearchSignalProvider (Bright Data MCP search port;
 *               fixture-fallback + gap-naming until dispatch is wired)
 */

import { env } from '@/lib/env';
import { FixtureSignalProvider } from './fixture-provider';
import {
  WebResearchSignalProvider,
  type WebResearchSearchPort,
} from './web-research-provider';
import type { CompetitiveSignalProvider } from './types';

export interface GetProviderArgs {
  /** Override selection (tests). Defaults to the env flag. */
  provider?: 'fixture' | 'web';
  /** Live search port to inject into the web provider. When omitted the web
   *  provider falls back to fixtures + names the gap. */
  search?: WebResearchSearchPort;
}

export function getCompetitiveSignalProvider(
  args: GetProviderArgs = {},
): CompetitiveSignalProvider {
  const selection = args.provider ?? env.competitiveSignalProvider();
  if (selection === 'web') {
    return new WebResearchSignalProvider({ search: args.search });
  }
  return new FixtureSignalProvider();
}

export * from './types';
export { FixtureSignalProvider } from './fixture-provider';
export {
  WebResearchSignalProvider,
  type WebResearchSearchPort,
  type WebResearchHit,
} from './web-research-provider';
export {
  buildCompetitiveSignalDigest,
  renderDigestText,
  DEFAULT_FEED_VERTICALS,
  type BuildDigestArgs,
  type BuildDigestResult,
} from './digest';
