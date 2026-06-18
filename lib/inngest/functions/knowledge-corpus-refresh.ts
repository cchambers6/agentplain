/**
 * Inngest cron: weekly knowledge-corpus refresh.
 *
 * Runs `0 13 * * 0` (Sunday 13:00 UTC ≈ 09:00 ET; we accept DST drift
 * between 08:00 EST and 09:00 EDT, same convention as the other sweeps).
 * Re-runs the GA free-source corpus ingestion (`scripts/corpus-refresh.ts`)
 * so statute / rule / publication changes flow into the substrate:
 *
 *   - unchanged chunk  -> embed skipped, lastSeenAt bumped (zero cost)
 *   - changed chunk    -> re-embedded + replaced
 *   - dropped source   -> supersededAt stamped
 *
 * The refresh itself refuses to write hash vectors into prod pgvector when
 * OPENAI_API_KEY is absent (it falls back to a report-only dry run), so
 * this cron is safe to enable before the embedding key lands — it will
 * simply report "skipped" until then.
 *
 * Per `feedback_cold_start_safe_agents.md`: the refresh reads durable
 * source + stored state on every fire; no cross-tick in-memory cache.
 *
 * Disable without a deploy: set
 *   INNGEST_FN_DISABLE_AGENTPLAIN_KNOWLEDGE_CORPUS_REFRESH=true
 */

import { getLogger, withCronMonitor } from '@/lib/observability';
import { refreshCorpus } from '@/scripts/corpus-refresh';
import { inngest } from '../client';
import { runWithDisableGate } from '../run-with-disable-gate';
import { withInngestErrorReporting } from '../with-error-reporting';

export const KNOWLEDGE_CORPUS_REFRESH_FUNCTION_ID = 'agentplain-knowledge-corpus-refresh';
/** Sunday 13:00 UTC (~09:00 ET). Weekly cadence — statute/rule corpora
 *  change on the order of months, so weekly is generous headroom. */
export const KNOWLEDGE_CORPUS_REFRESH_CRON = '0 13 * * 0';
/** On-demand trigger for dev-console smoke-testing. */
export const KNOWLEDGE_CORPUS_REFRESH_TRIGGER_EVENT =
  'agentplain/knowledge-corpus-refresh.requested';

export interface KnowledgeCorpusRefreshResult {
  ran: boolean;
  skippedReason?: string;
  chunks: number;
  created: number;
  updated: number;
  unchanged: number;
  superseded: number;
  failed: number;
}

export async function runKnowledgeCorpusRefresh(): Promise<KnowledgeCorpusRefreshResult> {
  const result = await refreshCorpus();
  const s = result.stats;
  return {
    ran: result.ran,
    skippedReason: result.skippedReason,
    chunks: s?.chunksProcessed ?? 0,
    created: s?.created ?? 0,
    updated: s?.updated ?? 0,
    unchanged: s?.unchanged ?? 0,
    superseded: s?.superseded ?? 0,
    failed: s?.failed ?? 0,
  };
}

export const knowledgeCorpusRefreshFn = inngest.createFunction(
  {
    id: KNOWLEDGE_CORPUS_REFRESH_FUNCTION_ID,
    name: 'agentplain knowledge corpus refresh (weekly Sun ~09:00 ET)',
    triggers: [
      { cron: KNOWLEDGE_CORPUS_REFRESH_CRON },
      { event: KNOWLEDGE_CORPUS_REFRESH_TRIGGER_EVENT },
    ],
  },
  async () =>
    runWithDisableGate(KNOWLEDGE_CORPUS_REFRESH_FUNCTION_ID, () =>
      withCronMonitor(
        {
          slug: KNOWLEDGE_CORPUS_REFRESH_FUNCTION_ID,
          schedule: KNOWLEDGE_CORPUS_REFRESH_CRON,
          checkinMargin: 15,
          maxRuntime: 15,
        },
        () =>
          withInngestErrorReporting(
            { functionId: KNOWLEDGE_CORPUS_REFRESH_FUNCTION_ID },
            async () => {
              const logger = getLogger().child({
                boundary: 'inngest',
                function_id: KNOWLEDGE_CORPUS_REFRESH_FUNCTION_ID,
              });
              logger.info('knowledge corpus refresh started');
              const out = await runKnowledgeCorpusRefresh();
              logger.info('knowledge corpus refresh finished', {
                ran: out.ran,
                skipped_reason: out.skippedReason ?? null,
                chunks: out.chunks,
                created: out.created,
                updated: out.updated,
                unchanged: out.unchanged,
                superseded: out.superseded,
                failed: out.failed,
              });
              return out;
            },
          ),
      ),
    ),
);
