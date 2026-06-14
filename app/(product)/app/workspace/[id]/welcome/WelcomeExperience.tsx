"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { ApHeritageButton, PlainoStatus } from "@/components/ui/ap";
import type { PlainoStatusState } from "@/components/ui/ap";
import { approveActivationDraftAction } from "./actions";

/**
 * The first-5-min magic moment (client). Plays a short, honest "working"
 * narration — Plaino genuinely read the demo dataset and drafted the reply on
 * the server; this stages the reveal so the customer watches it happen — then
 * shows the real draft with one-click approve and the saved-time payoff.
 *
 * Voice (project_plaino_named_agent): calm, plain, a heritage partner showing
 * their work. Never "Initializing AI agent…".
 *
 * Accessibility: every state is named in text; the PlainoStatus pose is
 * decorative support, not the only signal. The narration respects a user who
 * skips ahead ("show it now").
 */

interface DraftView {
  itemId: string;
  status: string;
  subject: string;
  body: string;
  toName: string;
  toEmail: string;
  recordTitle: string;
  savedMinutes: number;
  promiseHeadline: string;
}

interface Props {
  workspaceId: string;
  partner: string;
  ownerFirstName: string;
  draft: DraftView;
}

interface NarrationStep {
  state: PlainoStatusState;
  text: string;
}

const STEP_MS = 1300;

export function WelcomeExperience({
  workspaceId,
  partner,
  ownerFirstName,
  draft,
}: Props) {
  const alreadyDecided = draft.status !== "PENDING";
  // Phases: working → review → approved. If the draft was already approved
  // (returning visit), jump straight to the payoff.
  const [phase, setPhase] = useState<"working" | "review" | "approved">(
    alreadyDecided ? "approved" : "working",
  );
  const [stepIdx, setStepIdx] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isApproving, startApprove] = useTransition();

  const steps: NarrationStep[] = [
    { state: "scout", text: `${partner} is reading your customer history…` },
    { state: "herd", text: `${partner} is finding the one thing that can’t wait…` },
    { state: "fetch", text: `${partner} is drafting your first reply…` },
  ];

  useEffect(() => {
    if (phase !== "working") return;
    if (stepIdx >= steps.length - 1) {
      const t = setTimeout(() => setPhase("review"), STEP_MS);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setStepIdx((n) => n + 1), STEP_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, stepIdx]);

  function handleApprove() {
    setError(null);
    startApprove(async () => {
      const res = await approveActivationDraftAction(workspaceId, draft.itemId);
      if (res.ok) {
        setPhase("approved");
      } else {
        setError(res.error ?? "Something went wrong. You can approve it from your queue.");
      }
    });
  }

  if (phase === "working") {
    const current = steps[stepIdx];
    return (
      <div className="border border-rule bg-paper p-8">
        <div className="flex items-start gap-4">
          <PlainoStatus state={current.state} size={48} />
          <div>
            <p className="font-mono text-[11px] tracking-eyebrow uppercase text-clay">
              {partner} is working on your first thing right now
            </p>
            <p
              aria-live="polite"
              className="mt-2 font-display text-xl leading-tight text-ink"
            >
              {current.text}
            </p>
          </div>
        </div>
        <ol className="mt-6 space-y-2">
          {steps.map((s, i) => (
            <li
              key={s.text}
              className={`flex items-center gap-2 text-[14px] ${
                i < stepIdx
                  ? "text-moss"
                  : i === stepIdx
                    ? "text-ink"
                    : "text-mute"
              }`}
            >
              <span className="font-mono text-[11px]">
                {i < stepIdx ? "✓" : i === stepIdx ? "·" : " "}
              </span>
              {s.text.replace(`${partner} is `, "")}
            </li>
          ))}
        </ol>
        <button
          type="button"
          onClick={() => setPhase("review")}
          className="mt-6 text-sm text-mute underline-offset-4 hover:text-ink hover:underline"
        >
          show it now
        </button>
      </div>
    );
  }

  if (phase === "approved") {
    return (
      <div className="border border-moss bg-paper p-8">
        <div className="flex items-start gap-4">
          <PlainoStatus state="sit" size={48} />
          <div>
            <p className="font-mono text-[11px] tracking-eyebrow uppercase text-moss">
              first draft approved
            </p>
            <h2 className="mt-2 font-display text-2xl leading-tight text-ink">
              You just saved about {draft.savedMinutes} minutes.
            </h2>
            <p className="mt-3 max-w-prose text-[15px] leading-relaxed text-ink-soft">
              That was sample data so you could see exactly how it works.{" "}
              {partner} does this for your real customers the moment your tools
              connect — every lead, every estimate, every quarter-end, on its
              own cadence. You approve; your own inbox sends.
            </p>
          </div>
        </div>
        <div className="mt-6 flex flex-wrap gap-3">
          <ApHeritageButton
            variant="primary"
            withArrow
            href={`/app/workspace/${workspaceId}/integrations`}
          >
            connect your tools
          </ApHeritageButton>
          <ApHeritageButton
            variant="secondary"
            withArrow
            href={`/app/workspace/${workspaceId}`}
          >
            open your workspace
          </ApHeritageButton>
        </div>
        <p className="mt-5 border-t border-rule pt-4 text-[12px] leading-relaxed text-mute">
          Done with the sample? Clear it any time from{" "}
          <Link
            href={`/app/workspace/${workspaceId}/settings/demo`}
            className="text-ink underline-offset-4 hover:underline"
          >
            settings → demo data
          </Link>
          . It clears itself automatically once your real data starts flowing.
        </p>
      </div>
    );
  }

  // phase === "review"
  const paragraphs = draft.body
    .split(/\n{2,}/)
    .map((s) => s.trim())
    .filter(Boolean);

  return (
    <div className="space-y-5">
      <div className="border border-ink bg-paper p-6">
        <div className="flex items-start gap-4">
          <PlainoStatus state="fetch" size={44} />
          <div>
            <p className="font-mono text-[11px] tracking-eyebrow uppercase text-clay">
              here’s your first draft — ready to approve?
            </p>
            <p className="mt-2 text-[15px] leading-relaxed text-ink">
              {draft.promiseHeadline}. {partner} found the one that couldn’t
              wait — <span className="text-ink">{draft.recordTitle}</span> — and
              wrote the reply for you.
            </p>
          </div>
        </div>

        <div className="mt-5 border border-rule bg-paper-deep">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-rule px-4 py-2">
            <p className="font-mono text-[11px] tracking-eyebrow uppercase text-mute">
              draft reply
            </p>
            <span className="border border-clay px-2 py-0.5 font-mono text-[10px] tracking-eyebrow uppercase text-clay">
              sample data
            </span>
          </div>
          <div className="px-4 py-4">
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[13px]">
              <dt className="font-mono text-[10px] tracking-eyebrow uppercase text-mute">
                to
              </dt>
              <dd className="text-ink">
                {draft.toName}
                {draft.toEmail ? (
                  <span className="text-mute"> · {draft.toEmail}</span>
                ) : null}
              </dd>
              <dt className="font-mono text-[10px] tracking-eyebrow uppercase text-mute">
                subject
              </dt>
              <dd className="text-ink">{draft.subject}</dd>
            </dl>
            <div className="mt-4 space-y-3 border-t border-rule pt-4">
              {paragraphs.map((para, i) => (
                <p key={i} className="text-[14px] leading-relaxed text-ink">
                  {para}
                </p>
              ))}
            </div>
          </div>
        </div>

        {alreadyDecided ? (
          <p className="mt-4 text-[13px] text-moss">
            You already approved this one. It’s in your queue.
          </p>
        ) : (
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleApprove}
              disabled={isApproving}
              className="inline-flex items-center gap-2 border border-ink bg-ink px-4 py-2 font-mono text-[12px] tracking-eyebrow uppercase text-paper hover:bg-ink/90 disabled:opacity-60"
            >
              {isApproving ? "approving…" : "approve this draft"}
            </button>
            <Link
              href={`/app/workspace/${workspaceId}/approvals`}
              className="text-sm text-mute underline-offset-4 hover:text-ink hover:underline"
            >
              not now — open my queue
            </Link>
          </div>
        )}
        {error ? (
          <p className="mt-3 text-[13px] text-flag" role="alert">
            {error}
          </p>
        ) : null}
      </div>

      <p className="text-[12px] leading-relaxed text-mute">
        Nothing leaves agentplain on its own. Approving marks this draft ready;
        your own email is what sends. Hi {ownerFirstName} — this is exactly how
        every piece of {partner}’s work reaches you.
      </p>
    </div>
  );
}
