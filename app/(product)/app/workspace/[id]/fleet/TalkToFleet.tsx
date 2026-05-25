"use client";

import { useRef, useState, useTransition } from "react";
import {
  ApEyebrow,
  ApHeritageButton,
  ApPaperCard,
  PlainoAvatar,
} from "@/components/ui/ap";
import { submitFleetRequestAction } from "./actions";

interface TalkToFleetProps {
  workspaceId: string;
  partner: string;
  recentRequests: Array<{
    id: string;
    body: string;
    submittedAtIso: string;
  }>;
}

const MAX_LEN = 4_000;

/**
 * Talk-to-the-fleet panel — a single text input that lands a real
 * request on the activity log. There is no conversational reply: we are
 * not going to fabricate a fake AI response just to fill the slot. The
 * request appears in the activity stream and Plaino picks it up.
 *
 * Per design language: square corners, hairline borders, no spinner —
 * a calm "filing…" line during submit, then the textarea clears.
 */
export function TalkToFleet({
  workspaceId,
  partner,
  recentRequests,
}: TalkToFleetProps) {
  const [value, setValue] = useState("");
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<"idle" | "filed" | "error">("idle");
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const trimmed = value.trim();
  const overLimit = trimmed.length > MAX_LEN;
  const canSubmit = trimmed.length > 0 && !overLimit && !pending;

  return (
    <ApPaperCard
      eyebrow="talk to your fleet"
      title="Give Plaino a job."
    >
      <p className="flex items-start gap-3 text-[14px] leading-relaxed text-ink-soft">
        <PlainoAvatar size="sm" className="shrink-0" />
        <span>
          {partner} reads new requests on each pass and queues a draft
          for your review — your existing tools still send. No reply
          appears here; the result lands in your activity feed and your
          approvals queue.
        </span>
      </p>

      <form
        ref={formRef}
        className="mt-5"
        action={(form: FormData) => {
          setStatus("idle");
          setErrMsg(null);
          startTransition(async () => {
            try {
              await submitFleetRequestAction(form);
              setValue("");
              formRef.current?.reset();
              setStatus("filed");
            } catch (err) {
              setStatus("error");
              setErrMsg(
                err instanceof Error
                  ? err.message
                  : "Something went wrong filing that request.",
              );
            }
          });
        }}
      >
        <input type="hidden" name="workspaceId" value={workspaceId} />
        <label className="block">
          <span className="mb-2 block font-mono text-[11px] tracking-eyebrow uppercase text-mute">
            your request
          </span>
          <textarea
            name="request"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            rows={5}
            maxLength={MAX_LEN + 100}
            placeholder="Draft a follow-up to the Peachtree buyer — they asked about closing-cost help."
            aria-describedby="talk-to-fleet-help"
            className="block w-full rounded-none border border-rule bg-paper p-3 font-sans text-[15px] leading-relaxed text-ink focus:border-ink focus:outline-none"
          />
        </label>
        <div
          id="talk-to-fleet-help"
          className="mt-2 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 font-mono text-[11px] uppercase tracking-eyebrow text-mute"
        >
          <span>plain English. one job per request.</span>
          <span aria-live="polite">
            {trimmed.length}
            <span aria-hidden> / {MAX_LEN}</span>
          </span>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-4 border-t border-rule pt-4">
          <ApHeritageButton
            variant="primary"
            type="submit"
            withArrow
            disabled={!canSubmit}
          >
            {pending ? "filing…" : "file the request"}
          </ApHeritageButton>

          {status === "filed" ? (
            <p
              role="status"
              aria-live="polite"
              className="font-mono text-[11px] tracking-eyebrow uppercase text-moss"
            >
              filed · added to today&rsquo;s activity
            </p>
          ) : null}
          {status === "error" && errMsg ? (
            <p
              role="status"
              aria-live="polite"
              className="font-mono text-[11px] tracking-eyebrow uppercase text-flag"
            >
              {errMsg}
            </p>
          ) : null}
          {overLimit ? (
            <p className="font-mono text-[11px] tracking-eyebrow uppercase text-flag">
              shorten the request — one job per ticket
            </p>
          ) : null}
        </div>
      </form>

      {recentRequests.length > 0 ? (
        <div className="mt-7 border-t border-rule pt-5">
          <ApEyebrow className="mb-3">recent requests</ApEyebrow>
          <ul className="space-y-3">
            {recentRequests.map((r) => (
              <li key={r.id} className="border-l-2 border-rule pl-3">
                <p className="font-mono text-[10px] tracking-eyebrow uppercase text-mute">
                  {formatRelativeTime(r.submittedAtIso)}
                </p>
                <p className="mt-1 whitespace-pre-wrap text-[13px] leading-relaxed text-ink-soft">
                  {truncate(r.body, 220)}
                </p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </ApPaperCard>
  );
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1).trimEnd()}…`;
}

function formatRelativeTime(iso: string): string {
  const date = new Date(iso);
  const diffMs = Date.now() - date.getTime();
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} d ago`;
  return date.toLocaleDateString();
}
