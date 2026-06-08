/**
 * lib/integrations/web-search/index.ts
 *
 * Per-call factory for the web-search port. The selector lives here and
 * NOWHERE else (per `feedback_runner_portability.md`): callers ask for a
 * provider and get back an `IWebSearchPort` without branching on impl.
 *
 * Selection (wave-5, theme #11 / ratif #8):
 *   - `WEB_SEARCH_PROVIDER=fixture` (default) → FixtureWebSearchProvider.
 *   - `=tavily` / `=brightdata` WITH the matching key set → live HTTP
 *     provider.
 *   - live provider selected but key missing → FALL BACK to the fixture
 *     adapter (no throw). The research brief reads `isLive` and names the
 *     grounding honestly. This mirrors the LLM provider's heuristic
 *     fallback rather than failing the whole research run on a missing
 *     key — and surfaces the CONNER ACTION (set a key) without a crash.
 */

import { env } from '@/lib/env';
import { FixtureWebSearchProvider } from './fixture-provider';
import { HttpWebSearchProvider } from './http-provider';
import type { IWebSearchPort } from './types';

export function getWebSearchProvider(): IWebSearchPort {
  const provider = env.webSearchProvider();
  if (provider === 'tavily') {
    const key = env.tavilyApiKey();
    if (key) return new HttpWebSearchProvider({ vendor: 'tavily', apiKey: key });
    return new FixtureWebSearchProvider();
  }
  if (provider === 'brightdata') {
    const key = env.brightDataApiKey();
    if (key) {
      return new HttpWebSearchProvider({ vendor: 'brightdata', apiKey: key });
    }
    return new FixtureWebSearchProvider();
  }
  return new FixtureWebSearchProvider();
}

export { FixtureWebSearchProvider, FIXTURE_WEB_CORPUS } from './fixture-provider';
export { HttpWebSearchProvider } from './http-provider';
export type {
  IWebSearchPort,
  WebSearchQuery,
  WebSearchResult,
  WebSearchOutcome,
  WebSearchError,
  WebSearchErrorCode,
} from './types';
