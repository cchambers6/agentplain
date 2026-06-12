"use client";

import { useState } from "react";
import {
  ApHairlineList,
  ApHairlineRow,
  ApPaperSheet,
  PlainoStatus,
} from "@/components/ui/ap";

// Outcome of a single handoff, derived from the persisted step record.
//   ok      — the step did its job.
//   skipped — the step ran but didn't apply (NOT_APPLICABLE). Benign; not a
//             failure. A reader step that found nothing to read, e.g.
//   failed  — the step errored before finishing. THIS is what used to be
//             invisible: a `${step}.error` handoff rendered identically to a
//             success, so "a failed skill was indistinguishable from a quiet
//             day" (site audit P1-4). It now reads as alert + plain reason.
export type HandoffOutcome = "ok" | "skipped" | "failed";

export interface ActivityRow {
  id: string;
  fromAgent: string;
  toAgent: string;
  handoffType: string;
  occurredAtIso: string;
  relatedSubjectTable: string | null;
  relatedSubjectId: string | null;
  payload: unknown;
  summary: string;
  /** Derived outcome — drives the row's pose, badge, and the issues filter. */
  outcome: HandoffOutcome;
  /** Plain-language reason for a failed/skipped row; null for ok rows. */
  issue: string | null;
  /** Raw downstream code, surfaced (mono) in the detail sheet only. */
  errorCode: string | null;
}

interface ActivityFeedProps {
  rows: ActivityRow[];
  partner: string;
}

export function ActivityFeed({ rows, partner }: ActivityFeedProps) {
  const [openId, setOpenId] = useState<string | null>(null);
  const open = rows.find((r) => r.id === openId) ?? null;

  return (
    <>
      <ApHairlineList aria-label="Activity feed">
        {rows.map((row) => {
          const flagged = /(flag|complian)/i.test(row.handoffType);
          const failed = row.outcome === "failed";
          const skipped = row.outcome === "skipped";
          // Failure wins the pose: a broken step needs attention even if the
          // handoff type also reads as a compliance flag.
          const pose = failed || flagged ? "alert" : "sit";
          return (
            <ApHairlineRow
              key={row.id}
              right={formatTime(row.occurredAtIso)}
            >
              <button
                type="button"
                onClick={() => setOpenId(row.id)}
                className="flex w-full items-start gap-3 rounded-none text-left text-ink-soft transition hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-clay focus-visible:ring-offset-2 focus-visible:ring-offset-paper"
              >
                <PlainoStatus
                  state={pose}
                  size={24}
                  className="mt-0.5 shrink-0"
                />
                <span className="min-w-0 flex-1">
                  <span className="block">
                    <span className="font-mono text-ink">{row.fromAgent}</span>
                    <span className="mx-2 text-mute">→</span>
                    <span className="font-mono text-ink">{row.toAgent}</span>
                    <span className="ml-2 text-mute">· {stepLabel(row.handoffType)}</span>
                    {failed ? (
                      <span className="ml-2 font-mono text-[10px] tracking-eyebrow uppercase text-flag">
                        didn&rsquo;t complete
                      </span>
                    ) : skipped ? (
                      <span className="ml-2 font-mono text-[10px] tracking-eyebrow uppercase text-mute">
                        skipped
                      </span>
                    ) : flagged ? (
                      <span className="ml-2 text-flag" aria-label="flagged">
                        ●
                      </span>
                    ) : null}
                  </span>
                  <span
                    className={`mt-1 block text-[13px] leading-relaxed ${
                      failed ? "text-ink" : "text-mute"
                    }`}
                  >
                    {failed && row.issue ? row.issue : row.summary}
                  </span>
                </span>
              </button>
            </ApHairlineRow>
          );
        })}
      </ApHairlineList>

      <ApPaperSheet
        open={open !== null}
        onClose={() => setOpenId(null)}
        eyebrow={open ? stepLabel(open.handoffType) : "handoff"}
        title={open?.summary ?? "Handoff"}
      >
        {open ? (
          <PayloadDetail row={open} partner={partner} />
        ) : null}
      </ApPaperSheet>
    </>
  );
}

function PayloadDetail({
  row,
  partner,
}: {
  row: ActivityRow;
  partner: string;
}) {
  return (
    <div>
      {row.outcome !== "ok" && row.issue ? (
        <div
          className={`mb-5 border px-4 py-3 text-[14px] leading-relaxed ${
            row.outcome === "failed"
              ? "border-flag/40 bg-flag/5 text-ink"
              : "border-rule bg-paper-deep text-ink-soft"
          }`}
        >
          <p className="font-mono text-[11px] tracking-eyebrow uppercase text-mute">
            {row.outcome === "failed" ? "what went wrong" : "why it skipped"}
          </p>
          <p className="mt-1">{row.issue}</p>
          {row.errorCode ? (
            <p className="mt-2 font-mono text-[11px] text-mute">
              code · {row.errorCode}
            </p>
          ) : null}
          {row.outcome === "failed" ? (
            <p className="mt-2 text-[13px] text-mute">
              Nothing was sent. {partner} stopped here rather than guess — the
              step retries on the next run.
            </p>
          ) : null}
        </div>
      ) : null}

      <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-2 text-[13px]">
        <dt className="font-mono text-[11px] tracking-eyebrow uppercase text-mute">
          when
        </dt>
        <dd className="text-ink-soft">
          {new Date(row.occurredAtIso).toLocaleString()}
        </dd>
        <dt className="font-mono text-[11px] tracking-eyebrow uppercase text-mute">
          outcome
        </dt>
        <dd className="text-ink-soft">{outcomeLabel(row.outcome)}</dd>
        <dt className="font-mono text-[11px] tracking-eyebrow uppercase text-mute">
          from
        </dt>
        <dd className="font-mono text-ink">{row.fromAgent}</dd>
        <dt className="font-mono text-[11px] tracking-eyebrow uppercase text-mute">
          to
        </dt>
        <dd className="font-mono text-ink">{row.toAgent}</dd>
        <dt className="font-mono text-[11px] tracking-eyebrow uppercase text-mute">
          type
        </dt>
        <dd className="text-ink-soft">{stepLabel(row.handoffType)}</dd>
        {row.relatedSubjectTable ? (
          <>
            <dt className="font-mono text-[11px] tracking-eyebrow uppercase text-mute">
              subject
            </dt>
            <dd className="font-mono text-[12px] text-ink-soft">
              {row.relatedSubjectTable}
              {row.relatedSubjectId ? `:${row.relatedSubjectId}` : ""}
            </dd>
          </>
        ) : null}
      </dl>

      <div className="border-t border-rule pt-5">
        <p className="font-mono text-[11px] tracking-eyebrow uppercase text-mute">
          what {partner}&rsquo;s fleet did
        </p>
        <RenderedPayload payload={row.payload} />
      </div>
    </div>
  );
}

function RenderedPayload({ payload }: { payload: unknown }) {
  if (!payload || typeof payload !== "object") {
    return (
      <p className="mt-3 text-[14px] leading-relaxed text-mute">
        No detail attached.
      </p>
    );
  }
  const p = payload as Record<string, unknown>;
  const keyValues: Array<[string, string]> = [];
  for (const [k, v] of Object.entries(p)) {
    if (v == null) continue;
    if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") {
      keyValues.push([k, String(v)]);
    }
  }

  if (keyValues.length === 0) {
    return (
      <p className="mt-3 text-[14px] leading-relaxed text-mute">
        Nothing surfaceable in the payload.
      </p>
    );
  }

  return (
    <dl className="mt-3 grid grid-cols-[max-content_1fr] gap-x-4 gap-y-2 text-[13px]">
      {keyValues.map(([k, v]) => (
        <span key={k} className="contents">
          <dt className="font-mono text-[11px] tracking-eyebrow uppercase text-mute">
            {k}
          </dt>
          <dd className="break-words text-ink-soft">{v}</dd>
        </span>
      ))}
    </dl>
  );
}

// ─── Outcome classification (pure — unit-tested) ────────────────────────────
//
// A handoff row is "failed" when its persisted step record said so:
// `persistSkillRunArtifacts` writes `handoffType = "${step}.error"` and a
// payload `{ ok: false, errorCode }` for a failed step (lib/skills/
// persist-artifacts.ts). NOT_APPLICABLE is the one ok:false code that is a
// benign skip (a step that legitimately didn't apply), so it reads as
// "skipped", not "failed". Everything else is "ok".

const ERROR_REASONS: Record<string, string> = {
  UPSTREAM_GMAIL_ERROR:
    "Couldn’t reach Gmail to finish this. Your connection may need a reconnect.",
  TOKEN_EXPIRED:
    "A connected account needs to be reconnected — its access expired.",
  CREDENTIAL_NOT_FOUND:
    "This step needs a connection that isn’t set up yet.",
  NOT_CONFIGURED:
    "This step needs a connection that isn’t set up yet.",
  UPSTREAM_LLM_ERROR:
    "Plaino couldn’t finish thinking this one through. It retries on the next run.",
  RATE_LIMITED:
    "A connected tool was busy and asked us to slow down. Plaino retries shortly.",
  NETWORK:
    "A connected service didn’t respond in time. Plaino retries on the next run.",
  UPSTREAM_ERROR:
    "A connected service returned an error. Plaino retries on the next run.",
  PARSE_ERROR:
    "Plaino couldn’t read the message cleanly and stopped before guessing.",
  INVALID_INPUT:
    "The incoming message was missing something Plaino needed, so it stopped.",
  PAUSED: "The fleet was paused when this ran, so the step didn’t go ahead.",
};

const DEFAULT_FAILED_REASON =
  "This step didn’t complete. Plaino flagged it instead of failing quietly — it retries on the next run.";

const SKIPPED_REASON =
  "This step didn’t apply to the message, so Plaino moved on.";

export interface ClassifyInput {
  handoffType: string;
  /** From the decrypted handoff payload; defaults to true (legacy ok rows). */
  ok?: boolean;
  errorCode?: string | null;
}

export function classifyOutcome(input: ClassifyInput): {
  outcome: HandoffOutcome;
  issue: string | null;
} {
  const code = (input.errorCode ?? "").toUpperCase();
  const failedByType = /\.error$/i.test(input.handoffType);
  const failedByFlag = input.ok === false;
  if (!failedByType && !failedByFlag) {
    return { outcome: "ok", issue: null };
  }
  // NOT_APPLICABLE is a benign skip, never a failure.
  if (code === "NOT_APPLICABLE") {
    return { outcome: "skipped", issue: SKIPPED_REASON };
  }
  const reason = (code && ERROR_REASONS[code]) || DEFAULT_FAILED_REASON;
  return { outcome: "failed", issue: reason };
}

function outcomeLabel(outcome: HandoffOutcome): string {
  switch (outcome) {
    case "failed":
      return "didn’t complete";
    case "skipped":
      return "skipped — not applicable";
    default:
      return "completed";
  }
}

/** Strip the internal `.error` suffix for display — the badge carries the
 *  failure signal, so the type label stays the human step name. */
function stepLabel(handoffType: string): string {
  return handoffType.replace(/\.error$/i, "");
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}
