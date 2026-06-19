"use client";

/**
 * components/guarantee/WalkAwayOffer.tsx
 *
 * The Day-7 walk-away surface. Shown only when the fleet didn't clear the
 * guarantee bar by the evaluation day. ONE tap — no confirm dialog, no
 * "are you sure" — honors the promise: full refund, data deleted, no
 * charge. Making it friction-ful would betray the whole point.
 *
 * The button calls the BROKER_OWNER-gated server action (passed in as
 * `onAccept` so this component stays decoupled from the route). The
 * action's executor is idempotent, so a double-tap is safe. On success we
 * show a plain confirmation — the workspace is now closed, so there's
 * nothing more to do here but leave.
 */

import { useState, useTransition } from "react";
import { ApEyebrow, ApPaperCard } from "@/components/ui/ap";

export interface WalkAwayAcceptResult {
  ok: boolean;
  status?: string;
  refundedUsdCents?: number;
  error?: string;
}

export interface WalkAwayOfferProps {
  workspaceId: string;
  partner: string;
  /** Human label of time saved so far (e.g. "1.5 hrs"). */
  savedLabel: string;
  /** Human label of the bar (e.g. "5 hrs"). */
  barLabel: string;
  /** Bound server action. Returns the executor result. */
  onAccept: (input: { workspaceId: string }) => Promise<WalkAwayAcceptResult>;
}

export function WalkAwayOffer({
  workspaceId,
  partner,
  savedLabel,
  barLabel,
  onAccept,
}: WalkAwayOfferProps) {
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState<WalkAwayAcceptResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (done?.ok) {
    const refunded =
      typeof done.refundedUsdCents === "number" && done.refundedUsdCents > 0
        ? `We've refunded $${(done.refundedUsdCents / 100).toFixed(2)} to your card. `
        : "";
    return (
      <ApPaperCard eyebrow="guarantee">
        <h2 className="font-display text-xl text-ink">You&rsquo;re all set.</h2>
        <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">
          {refunded}We&rsquo;ve deleted your workspace data — nothing of yours
          stays on our systems. Thank you for giving {partner} a try.
        </p>
        <p className="mt-4">
          <a
            href="/"
            className="inline-flex items-center gap-2 border border-ink bg-ink px-5 py-2.5 text-sm font-medium text-paper transition hover:bg-ink/90"
          >
            Back to agentplain.com
            <span aria-hidden>→</span>
          </a>
        </p>
      </ApPaperCard>
    );
  }

  return (
    <aside className="border border-flag bg-paper-deep p-6">
      <ApEyebrow>our guarantee</ApEyebrow>
      <h2 className="mt-2 font-display text-2xl leading-tight text-ink">
        We didn&rsquo;t hit the bar.
      </h2>
      <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-ink-soft">
        By day seven, {partner} should have clearly saved you time. So far it
        has saved you {savedLabel} — short of the {barLabel} we hold ourselves
        to. You shouldn&rsquo;t pay for that. Walk away and we&rsquo;ll refund
        you in full and delete your data. One tap, no questions.
      </p>

      {error ? (
        <p className="mt-3 text-[13px] text-flag">
          Something went wrong: {error}. Please try again, or contact support.
        </p>
      ) : null}

      <div className="mt-5 flex flex-wrap items-center gap-4">
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            setError(null);
            startTransition(async () => {
              try {
                const result = await onAccept({ workspaceId });
                if (result.ok) setDone(result);
                else setError(result.error ?? "unknown error");
              } catch (err) {
                setError(err instanceof Error ? err.message : "unknown error");
              }
            });
          }}
          className="inline-flex items-center gap-2 border border-ink bg-ink px-6 py-3 text-sm font-medium text-paper transition hover:bg-ink/90 disabled:opacity-60"
        >
          {pending ? "Closing out…" : "No charge — refund me and delete my data"}
          {!pending ? <span aria-hidden>→</span> : null}
        </button>
        <span className="text-[13px] text-mute">
          Or keep going — connect more tools and give the fleet more to do.
        </span>
      </div>
    </aside>
  );
}
