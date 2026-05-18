"use client";

import { useState } from "react";
import {
  ApHairlineList,
  ApHairlineRow,
  ApPaperSheet,
} from "@/components/ui/ap";

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
          return (
            <ApHairlineRow
              key={row.id}
              right={formatTime(row.occurredAtIso)}
            >
              <button
                type="button"
                onClick={() => setOpenId(row.id)}
                className="w-full text-left text-ink-soft transition hover:text-ink"
              >
                <span className="block">
                  <span className="font-mono text-ink">{row.fromAgent}</span>
                  <span className="mx-2 text-mute">→</span>
                  <span className="font-mono text-ink">{row.toAgent}</span>
                  <span className="ml-2 text-mute">· {row.handoffType}</span>
                  {flagged ? (
                    <span className="ml-2 text-flag" aria-label="flagged">
                      ●
                    </span>
                  ) : null}
                </span>
                <span className="mt-1 block text-[13px] leading-relaxed text-mute">
                  {row.summary}
                </span>
              </button>
            </ApHairlineRow>
          );
        })}
      </ApHairlineList>

      <ApPaperSheet
        open={open !== null}
        onClose={() => setOpenId(null)}
        eyebrow={open ? open.handoffType : "handoff"}
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
      <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-2 text-[13px]">
        <dt className="font-mono text-[11px] tracking-eyebrow uppercase text-mute">
          when
        </dt>
        <dd className="text-ink-soft">
          {new Date(row.occurredAtIso).toLocaleString()}
        </dd>
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
        <dd className="text-ink-soft">{row.handoffType}</dd>
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

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}
