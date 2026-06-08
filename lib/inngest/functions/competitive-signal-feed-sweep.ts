/**
 * Inngest cron: competitive-signal feed sweep.
 *
 * The BUILDABLE half of Wave-8 (audit pride theme #18). Replaces the dormant
 * quarterly "watch memo" charters with a real, scheduled feed: every Monday it
 * pulls competitive movements (launches, pricing, funding, regulatory shifts)
 * for the verticals agentplain runs a head for, and drafts a sectioned digest
 * the vertical heads (b2b-head-of-realty, etc.) consume — instead of a human
 * writing a memo once a quarter.
 *
 * ── Provider abstraction (feedback_no_silent_vendor_lock + runner-portability) ──
 * The feed runs through `lib/competitive-signals`. Default = the fixture
 * provider (network-free, runs in dev/preview). COMPETITIVE_SIGNAL_PROVIDER=web
 * selects the live Bright Data MCP search port (fixture-fallback + gap-naming
 * until dispatch is wired). The cron does not know which provider it got.
 *
 * ── Fire-gate (the wave's hard rule: every new cron caller calls gateSkillFire) ──
 * The feed is INTERNAL GTM work, not per-customer-workspace work, so there is
 * no customer to pause by default. When COMPETITIVE_SIGNAL_FLEET_WORKSPACE_ID
 * is configured, the cron runs `gateSkillFire` against that internal fleet
 * workspace so a fleet-wide pause / schedule-window halts the feed through the
 * same control surface every other skill caller honors. When it is unset, the
 * gate fails OPEN (allowed) — there is no customer-workspace to gate. A gate
 * read error also fails open so a transient DB blip never silently stops the
 * feed (same posture as scheduler-sweep).
 *
 * ── No outbound + cold-start safe ──
 * The digest is a DRAFT for the vertical heads (project_no_outbound_architecture).
 * The provider is queried fresh every fire (feedback_cold_start_safe_agents) —
 * no in-memory carryover of last week's signals.
 *
 * Disable flag: INNGEST_FN_DISABLE_AGENTPLAIN_COMPETITIVE_SIGNAL_FEED_SWEEP.
 * Default OFF.
 */

import { withSystemContext } from '@/lib/db/rls';
import { env } from '@/lib/env';
import {
  buildCompetitiveSignalDigest,
  getCompetitiveSignalProvider,
  renderDigestText,
  type CompetitiveSignalDigest,
  type CompetitiveSignalProvider,
  COMPETITIVE_SIGNAL_DISCIPLINE,
  COMPETITIVE_SIGNAL_SKILL_SLUG,
} from '@/lib/competitive-signals';
import { gateSkillFire, type FireGateOutcome } from '@/lib/skills/fire-gate';
import { inngest } from '../client';
import { runWithDisableGate } from '../run-with-disable-gate';
import { withInngestErrorReporting } from '../with-error-reporting';
import { getLogger, withCronMonitor } from '@/lib/observability';

export const COMPETITIVE_SIGNAL_FEED_SWEEP_FUNCTION_ID =
  'agentplain-competitive-signal-feed-sweep';
/** Mondays 16:00 UTC — lands before the media platform-performance digest week
 *  so the vertical heads have fresh competitive context for the week's planning. */
export const COMPETITIVE_SIGNAL_FEED_SWEEP_CRON = '0 16 * * MON';
export const COMPETITIVE_SIGNAL_FEED_SWEEP_TRIGGER_EVENT =
  'agentplain/competitive-signal-feed-sweep.requested';

export interface CompetitiveSignalFeedSweepResult {
  status: 'gated' | 'drafted';
  /** True when the fire-gate denied the run (fleet paused / off-window). */
  gated: boolean;
  /** Reason the gate denied, when gated. */
  gateReason?: string;
  providerName: string;
  providerIsLive: boolean;
  totalSignals: number;
  sectionCount: number;
  failures: Array<{ vertical: string; reason: string }>;
}

export interface RunCompetitiveSignalFeedSweepArgs {
  /** Override the provider (tests). Production resolves via the env flag. */
  provider?: CompetitiveSignalProvider;
  /** Fire-gate override. Tests pass a deterministic outcome; production runs
   *  the live gate against the configured fleet workspace (or fails open when
   *  none is configured). */
  gateFire?: () => Promise<FireGateOutcome>;
  /** Sink for the drafted digest. Production logs it (and a future operator
   *  panel reads the structured digest); tests capture it. */
  sink?: (digest: CompetitiveSignalDigest) => Promise<void> | void;
  now?: Date;
}

export async function runCompetitiveSignalFeedSweep(
  args: RunCompetitiveSignalFeedSweepArgs = {},
): Promise<CompetitiveSignalFeedSweepResult> {
  const now = args.now ?? new Date();

  // Fire-gate: every new cron caller runs it. Internal fleet work has no
  // customer workspace, so gate only when a fleet workspace is configured;
  // otherwise (and on any gate read error) fail OPEN.
  const gate = await resolveGate(args, now);
  if (!gate.allowed) {
    return {
      status: 'gated',
      gated: true,
      gateReason: gate.reason,
      providerName: 'none',
      providerIsLive: false,
      totalSignals: 0,
      sectionCount: 0,
      failures: [],
    };
  }

  const provider = args.provider ?? getCompetitiveSignalProvider();
  const { digest, failures } = await buildCompetitiveSignalDigest({
    provider,
    now,
  });

  if (args.sink) {
    await args.sink(digest);
  }

  return {
    status: 'drafted',
    gated: false,
    providerName: digest.providerName,
    providerIsLive: digest.providerIsLive,
    totalSignals: digest.totalSignals,
    sectionCount: digest.sections.length,
    failures: failures.map((f) => ({ vertical: f.vertical, reason: f.reason })),
  };
}

/** Resolve the fire-gate outcome. Honors an injected override first; otherwise
 *  runs the live gate against the configured internal fleet workspace, failing
 *  OPEN when none is configured or the read throws. */
async function resolveGate(
  args: RunCompetitiveSignalFeedSweepArgs,
  now: Date,
): Promise<{ allowed: true } | { allowed: false; reason: string }> {
  if (args.gateFire) {
    const outcome = await args.gateFire();
    return outcome.allowed
      ? { allowed: true }
      : { allowed: false, reason: outcome.detail };
  }

  const fleetWorkspaceId = env.competitiveSignalFleetWorkspaceId();
  if (!fleetWorkspaceId) {
    // No customer-workspace to gate — internal GTM work. Fail open.
    return { allowed: true };
  }

  const outcome = await withSystemContext((tx) =>
    gateSkillFire({
      tx,
      workspaceId: fleetWorkspaceId,
      skillSlug: COMPETITIVE_SIGNAL_SKILL_SLUG,
      disciplineId: COMPETITIVE_SIGNAL_DISCIPLINE,
      now,
    }),
  ).catch((): FireGateOutcome => ({ allowed: true }));

  return outcome.allowed
    ? { allowed: true }
    : { allowed: false, reason: outcome.detail };
}

export const competitiveSignalFeedSweepFn = inngest.createFunction(
  {
    id: COMPETITIVE_SIGNAL_FEED_SWEEP_FUNCTION_ID,
    name: 'agentplain competitive-signal feed sweep',
    triggers: [
      { cron: COMPETITIVE_SIGNAL_FEED_SWEEP_CRON },
      { event: COMPETITIVE_SIGNAL_FEED_SWEEP_TRIGGER_EVENT },
    ],
  },
  async () =>
    runWithDisableGate(COMPETITIVE_SIGNAL_FEED_SWEEP_FUNCTION_ID, () =>
      withCronMonitor(
        {
          slug: COMPETITIVE_SIGNAL_FEED_SWEEP_FUNCTION_ID,
          schedule: COMPETITIVE_SIGNAL_FEED_SWEEP_CRON,
          checkinMargin: 15,
          maxRuntime: 30,
        },
        () =>
          withInngestErrorReporting(
            { functionId: COMPETITIVE_SIGNAL_FEED_SWEEP_FUNCTION_ID },
            async () => {
              const logger = getLogger().child({
                boundary: 'inngest',
                function_id: COMPETITIVE_SIGNAL_FEED_SWEEP_FUNCTION_ID,
              });
              logger.info('competitive-signal feed sweep started');
              const out = await runCompetitiveSignalFeedSweep({
                sink: (digest) => {
                  // Draft sink: the structured digest is the source of truth;
                  // the rendered text rides the log until an operator panel /
                  // approval row reads the digest directly. No outbound.
                  logger.info('competitive-signal digest drafted', {
                    provider: digest.providerName,
                    live: digest.providerIsLive,
                    total_signals: digest.totalSignals,
                    sections: digest.sections.map((s) => ({
                      vertical: s.vertical,
                      head: s.headSlug,
                      signals: s.signals.length,
                    })),
                    digest_text: renderDigestText(digest),
                  });
                },
              });
              logger.info('competitive-signal feed sweep finished', {
                status: out.status,
                gated: out.gated,
                gate_reason: out.gateReason,
                provider: out.providerName,
                live: out.providerIsLive,
                total_signals: out.totalSignals,
                sections: out.sectionCount,
                failed: out.failures.length,
              });
              return out;
            },
          ),
      ),
    ),
);
