import * as React from "react";
import type { PortalCase, PortalCaseEvent, PortalScanStatus } from "@prisma/client";

const STATUS_LABEL: Record<string, string> = {
  OPEN: "Open",
  IN_PROGRESS: "In progress",
  WAITING_ON_CLIENT: "Waiting on you",
  BLOCKED: "On hold",
  CLOSED: "Closed",
};

export function CaseStatusBadge({ status }: { status: string }) {
  const label = STATUS_LABEL[status] ?? status;
  const waiting = status === "WAITING_ON_CLIENT";
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 text-xs font-medium ${
        waiting ? "bg-clay/10 text-clay" : "bg-paper-deep text-ink-soft"
      }`}
    >
      {label}
    </span>
  );
}

/**
 * Read-only status timeline for one case — the owner publishes events; the
 * client follows along. Most-recent first.
 */
export function StatusTimeline({
  portalCase,
  events,
}: {
  portalCase: PortalCase;
  events: PortalCaseEvent[];
}) {
  return (
    <section>
      <div className="mb-1 flex items-center gap-3">
        <h1 className="font-display text-2xl">{portalCase.title}</h1>
        <CaseStatusBadge status={portalCase.status} />
      </div>
      <p className="mb-6 text-sm text-mute">Reference {portalCase.reference}</p>

      {events.length === 0 ? (
        <p className="text-sm text-mute">
          There aren&apos;t any updates yet. You&apos;ll see progress here as it
          happens.
        </p>
      ) : (
        <ol className="relative border-l border-rule pl-6">
          {events.map((e) => (
            <li key={e.id} className="mb-6 last:mb-0">
              <span
                className="absolute -left-[5px] mt-1.5 h-2.5 w-2.5 "
                style={{ backgroundColor: "var(--portal-accent, #B85540)" }}
                aria-hidden
              />
              <div className="text-sm font-medium text-ink">{e.label}</div>
              {e.detail ? (
                <p className="mt-0.5 text-sm text-ink-soft">{e.detail}</p>
              ) : null}
              <time className="mt-0.5 block text-xs text-mute">
                {formatDate(e.occurredAt)}
              </time>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

export function DocumentList({
  documents,
}: {
  documents: Array<{ id: string; filename: string; scanStatus: PortalScanStatus; blobUrl: string }>;
}) {
  if (documents.length === 0) {
    return <p className="text-sm text-mute">No documents shared yet.</p>;
  }
  return (
    <ul className="divide-y divide-rule border border-rule">
      {documents.map((d) => (
        <li key={d.id} className="flex items-center gap-3 px-4 py-3 text-sm">
          <span className="truncate">{d.filename}</span>
          <span className="ml-auto text-xs text-moss">Ready</span>
        </li>
      ))}
    </ul>
  );
}

function formatDate(d: Date): string {
  return new Date(d).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
