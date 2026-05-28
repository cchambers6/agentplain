/**
 * lib/billing/usage/recorder.ts
 *
 * The seam that turns the LLM provider's per-call usage emission into a
 * durable `LlmUsageRecord` row. Used as a sink callback inside
 * `LoggingLlmProvider`: every successful `complete()` flows usage +
 * meta through `recordUsage(...)`.
 *
 * Workspace resolution rule:
 *   - When `meta.workspaceId` is a UUID we INSERT a row (operator-bypass
 *     RLS context — the cron-style writer pattern).
 *   - When `meta.workspaceId` is absent we SKIP. The absence is
 *     intentional: skill code paths that aren't on a workspace's behalf
 *     (e.g. /custom inquiry form processing) should not pollute any
 *     workspace's billing surface. We never fabricate a workspace tag.
 *
 * Per `feedback_no_silent_vendor_lock`: this file is the Prisma boundary
 * for token billing. The `LoggingLlmProvider` itself stays free of
 * Prisma — it accepts a `UsageRecorder` callback so tests can pin a
 * recording stub without standing up the DB.
 *
 * Per `feedback_cold_start_safe_agents`: recorder is stateless. Every
 * call resolves rates from the model id; nothing is cached between
 * calls. Survives cold starts.
 */

import type { LlmRequestMeta, LlmSourceSurfaceTag, LlmUsage } from '@/lib/llm/types';
import type { LlmSourceSurface } from '@prisma/client';
import { withSystemContext } from '@/lib/db';
import { getLogger } from '@/lib/observability/logger';
import { costMicroCentsForUsage } from './pricing';

export interface RecordUsageInput {
  workspaceId: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
  sourceSurface: LlmSourceSurfaceTag;
}

/** Sink contract — what `LoggingLlmProvider` calls on every successful
 *  completion. The sink decides whether to persist (workspaceId present)
 *  or no-op. Returning a Promise so the wrapper can `await` and surface
 *  failures via the standard logger path. */
export type UsageRecorder = (
  meta: LlmRequestMeta | undefined,
  model: string,
  usage: LlmUsage,
) => Promise<void>;

const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

/** The production recorder — writes one row per call to `LlmUsageRecord`.
 *  Composed into the default provider by `lib/llm/index.ts`.
 *
 *  No-op when:
 *    - `meta` is missing (older callers, server-side init paths).
 *    - `meta.workspaceId` is missing or not a UUID — the surface is the
 *      customer's workspace, never operator scaffolding. */
export const persistUsageRecorder: UsageRecorder = async (meta, model, usage) => {
  const workspaceId = meta?.workspaceId;
  if (!workspaceId || !UUID_RE.test(workspaceId)) {
    return;
  }
  const sourceSurface = resolveSurface(meta?.sourceSurface);
  const input = usage.inputTokens;
  const output = usage.outputTokens;
  const cw = usage.cacheCreationInputTokens ?? 0;
  const cr = usage.cacheReadInputTokens ?? 0;
  const cost = costMicroCentsForUsage(model, input, output, cw, cr);
  try {
    await withSystemContext((tx) =>
      tx.llmUsageRecord.create({
        data: {
          workspaceId,
          model,
          inputTokens: input,
          outputTokens: output,
          cacheCreationTokens: cw,
          cacheReadTokens: cr,
          costMicroCents: cost,
          sourceSurface,
        },
      }),
    );
  } catch (err) {
    // Billing accounting must never take down a customer-facing LLM
    // call. Log + swallow; the row is lost but the user still gets a
    // response. The cron will not double-bill (it operates on existing
    // rows only) and the next call writes a fresh row. The structured
    // log line lets ops alert on persistent failures.
    getLogger().warn('llm_usage_record.write_failed', {
      workspace_id: workspaceId,
      source_surface: sourceSurface,
      model,
      error: err instanceof Error ? err.message : String(err),
    });
  }
};

/** Map the optional `meta.sourceSurface` string to the Prisma enum.
 *  Falls back to `OTHER` when missing or unrecognized so a typo at a
 *  call site never throws — it just lands in OTHER and shows up on the
 *  usage pane as an obvious miscategorization. */
export function resolveSurface(
  tag: LlmSourceSurfaceTag | undefined,
): LlmSourceSurface {
  if (!tag) return 'OTHER';
  const allowed: LlmSourceSurface[] = [
    'PLAINO_CHAT',
    'OFFICE_ADMIN',
    'CATEGORIZE',
    'COORDINATE',
    'SCHEDULE',
    'DRAFT',
    'SUPPORT_HANDLER',
    'INBOX_TRIAGE',
    'FOLLOW_UP_CHASER',
    'PROCESS_DOC_DRAFTER',
    'SCHEDULER_SWEEP',
    'MEMORY_EXTRACT',
    'OTHER',
  ];
  return allowed.includes(tag as LlmSourceSurface)
    ? (tag as LlmSourceSurface)
    : 'OTHER';
}

/** No-op recorder for tests that don't want to assert on usage rows.
 *  Pass to `LoggingLlmProvider` via `{ recorder: noopUsageRecorder }`. */
export const noopUsageRecorder: UsageRecorder = async () => {};

/** Recording stub for unit tests — captures every call into the
 *  provided array so the test can assert on what would have been
 *  persisted. */
export function makeRecordingUsageRecorder(): {
  recorder: UsageRecorder;
  calls: Array<{
    meta: LlmRequestMeta | undefined;
    model: string;
    usage: LlmUsage;
  }>;
} {
  const calls: Array<{
    meta: LlmRequestMeta | undefined;
    model: string;
    usage: LlmUsage;
  }> = [];
  const recorder: UsageRecorder = async (meta, model, usage) => {
    calls.push({ meta, model, usage });
  };
  return { recorder, calls };
}
