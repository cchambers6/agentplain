"use client";

import { useEffect, useRef, useState } from "react";
import { ApHeritageButton } from "@/components/ui/ap";

/**
 * Live watch panel for the wave-9 onboarding wizard's "first fire" step.
 *
 * Polls /api/onboarding/first-fire-status for SkillRun rows that landed
 * after `firstFireRequestedAt`. The endpoint returns one row per picked
 * skill — slug, status (pending | drafted | skipped | failed), short
 * reason on skip/fail, and (if the skill wrote a queue item) a
 * deep-link to /approvals.
 *
 * Polls every 5 seconds for up to ~5 minutes (60 ticks). Falls back to
 * "your fleet is running on cron now — check back in 15 min" when the
 * window expires.
 *
 * Per project_no_outbound_architecture.md: this client component reads
 * status only. No mutations.
 *
 * Per project_plaino_named_agent.md: copy reads in the Plaino voice —
 * calm + concrete, never chirpy.
 */

interface SkillStatus {
  slug: string;
  name: string;
  status: "pending" | "drafted" | "skipped" | "failed";
  reason?: string;
  queueItemHref?: string;
}

interface FirstFireStatusResponse {
  picked: SkillStatus[];
  /** True once every picked skill has resolved to a terminal state
   *  (drafted | skipped | failed). The watch panel stops polling. */
  resolved: boolean;
  /** ISO timestamp the wizard requested the first fire. Used as the
   *  "since" boundary for the SkillRun query on the server. */
  requestedAt: string | null;
}

const POLL_INTERVAL_MS = 5_000;
const MAX_POLLS = 60; // ~5 minutes

interface FirstFireWatchProps {
  workspaceId: string;
  initial: FirstFireStatusResponse;
}

export function FirstFireWatch({ workspaceId, initial }: FirstFireWatchProps) {
  const [status, setStatus] = useState<FirstFireStatusResponse>(initial);
  const [pollCount, setPollCount] = useState(0);
  const [timedOut, setTimedOut] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (status.resolved) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }
    if (timedOut) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }
    intervalRef.current = setInterval(async () => {
      setPollCount((n) => {
        if (n + 1 >= MAX_POLLS) {
          setTimedOut(true);
        }
        return n + 1;
      });
      try {
        const res = await fetch(
          `/api/onboarding/first-fire-status?workspaceId=${encodeURIComponent(workspaceId)}`,
          { cache: "no-store" },
        );
        if (!res.ok) return;
        const next = (await res.json()) as FirstFireStatusResponse;
        setStatus(next);
      } catch {
        // Best-effort. The tick counter still advances so we eventually
        // time out gracefully even if the fetch keeps failing.
      }
    }, POLL_INTERVAL_MS);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [workspaceId, status.resolved, timedOut]);

  return (
    <div className="space-y-5">
      <div className="border border-rule bg-paper p-5">
        <p className="font-mono text-[11px] tracking-eyebrow uppercase text-clay">
          {status.resolved
            ? "first fire landed"
            : timedOut
              ? "still working"
              : "fetching that for you"}
        </p>
        <p className="mt-2 text-[15px] leading-relaxed text-ink">
          {status.resolved
            ? "Plaino's fleet drafted everything we picked. Open the dashboard to see what's in your queue."
            : timedOut
              ? "Plaino's fleet is still working. The next scheduled run lands within 15 minutes; open the dashboard and the results will show up there."
              : "Plaino's fleet is running each skill we picked. Results land here as they're ready — typically inside a few minutes."}
        </p>
      </div>

      <ul className="grid gap-px overflow-hidden border border-rule bg-rule">
        {status.picked.length === 0 ? (
          <li className="bg-paper p-4 text-[13px] text-mute">
            No skills picked. You can pick from the marketplace any time.
          </li>
        ) : (
          status.picked.map((s) => <SkillRow key={s.slug} skill={s} />)
        )}
      </ul>
    </div>
  );
}

function SkillRow({ skill }: { skill: SkillStatus }) {
  const accent =
    skill.status === "drafted"
      ? "text-moss"
      : skill.status === "skipped"
        ? "text-mute"
        : skill.status === "failed"
          ? "text-flag"
          : "text-clay";
  const label =
    skill.status === "drafted"
      ? "drafted"
      : skill.status === "skipped"
        ? "skipped"
        : skill.status === "failed"
          ? "failed"
          : "fetching";
  return (
    <li className="bg-paper p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <p className="font-display text-base leading-tight text-ink">
          {skill.name}
        </p>
        <p
          className={`font-mono text-[11px] tracking-eyebrow uppercase ${accent}`}
        >
          {label}
        </p>
      </div>
      {skill.reason ? (
        <p className="mt-1 text-[13px] leading-relaxed text-ink-soft">
          {skill.reason}
        </p>
      ) : null}
      {skill.queueItemHref ? (
        <div className="mt-2">
          <ApHeritageButton
            variant="secondary"
            withArrow
            href={skill.queueItemHref}
          >
            open in approvals
          </ApHeritageButton>
        </div>
      ) : null}
    </li>
  );
}
