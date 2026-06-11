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
 * Wave-10 phase-3b: polls with `?includeDraft=1` so the endpoint
 * returns a `draftPreview` (title + body + meta) for every drafted
 * skill. The customer sees the actual draft body inline — clicking
 * through to /approvals is now optional, not required, to read what
 * Plaino made.
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

interface DraftPreview {
  title: string;
  body: string;
  meta?: Array<{ label: string; value: string }>;
}

interface SkillStatus {
  slug: string;
  name: string;
  status: "pending" | "drafted" | "skipped" | "failed";
  reason?: string;
  queueItemHref?: string;
  /** Wave-10 phase-3b — populated when status='drafted' and the row's
   *  payload decrypts to a known kind. The wizard expands this inline
   *  so the customer reads the draft without clicking through. */
  draftPreview?: DraftPreview;
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
          `/api/onboarding/first-fire-status?workspaceId=${encodeURIComponent(workspaceId)}&includeDraft=1`,
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
  const [expanded, setExpanded] = useState(false);
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
  const hasPreview = skill.status === "drafted" && skill.draftPreview != null;
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
      {skill.status === "failed" ? (
        <p className="mt-1 text-[13px] leading-relaxed text-ink-soft">
          {"We'll cover this on your welcome call — nothing needed from you right now."}
        </p>
      ) : null}
      {skill.status === "skipped" && !skill.reason ? (
        <p className="mt-1 text-[13px] leading-relaxed text-ink-soft">
          {"Not enough context yet — Plaino will pick this up once more workspace data lands."}
        </p>
      ) : null}
      {hasPreview && skill.draftPreview ? (
        <DraftPreviewCard
          preview={skill.draftPreview}
          expanded={expanded}
          onToggle={() => setExpanded((v) => !v)}
        />
      ) : null}
      {skill.queueItemHref ? (
        <div className="mt-3">
          <ApHeritageButton
            variant="secondary"
            withArrow
            href={skill.queueItemHref}
          >
            open in approvals
          </ApHeritageButton>
        </div>
      ) : skill.status === "skipped" || skill.status === "failed" ? (
        <div className="mt-3">
          <ApHeritageButton
            variant="secondary"
            withArrow
            href="approvals"
          >
            open approvals queue
          </ApHeritageButton>
        </div>
      ) : null}
    </li>
  );
}

function DraftPreviewCard({
  preview,
  expanded,
  onToggle,
}: {
  preview: DraftPreview;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="mt-3 border border-rule bg-paper-deep">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-baseline justify-between gap-3 px-3 py-2 text-left hover:bg-paper"
      >
        <p className="font-mono text-[11px] tracking-eyebrow uppercase text-clay">
          {preview.title}
        </p>
        <span className="font-mono text-[10px] tracking-eyebrow uppercase text-ink-soft">
          {expanded ? "collapse" : "read draft"}
        </span>
      </button>
      {expanded ? (
        <div className="border-t border-rule px-3 py-3">
          {preview.meta && preview.meta.length > 0 ? (
            <dl className="mb-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[12px]">
              {preview.meta.map((m) => (
                <div key={m.label} className="contents">
                  <dt className="font-mono text-[10px] tracking-eyebrow uppercase text-ink-soft">
                    {m.label}
                  </dt>
                  <dd className="text-ink">{m.value}</dd>
                </div>
              ))}
            </dl>
          ) : null}
          <pre className="whitespace-pre-wrap break-words font-sans text-[13px] leading-relaxed text-ink">
            {preview.body}
          </pre>
        </div>
      ) : null}
    </div>
  );
}
