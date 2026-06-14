/**
 * components/support/TicketThread.tsx
 *
 * Renders a ticket's message thread. Used by both the customer ticket page
 * and the staff inbox. Internal notes are styled distinctly and are only ever
 * passed in on the staff side (the customer loader filters them out at the DB
 * layer — this component trusts its input but still labels internal clearly).
 */

import type { TicketMessageView } from "@/lib/support/tickets";

function authorLabel(
  m: TicketMessageView,
  partnerName: string,
): string {
  if (m.author === "CUSTOMER") return "You";
  if (m.author === "SYSTEM") return partnerName;
  return "agentplain team";
}

function formatWhen(d: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(d);
}

export function TicketThread({
  messages,
  partnerName,
  staffView = false,
}: {
  messages: TicketMessageView[];
  partnerName: string;
  staffView?: boolean;
}) {
  if (messages.length === 0) {
    return (
      <p className="text-[14px] text-mute">No messages yet.</p>
    );
  }
  return (
    <ol className="space-y-4">
      {messages.map((m) => {
        const mine = m.author === "CUSTOMER";
        const internal = m.internal;
        return (
          <li
            key={m.id}
            className={[
              "border p-4 text-[14px] leading-relaxed",
              internal
                ? "border-clay/40 bg-clay/5"
                : mine
                  ? "border-rule bg-paper"
                  : "border-rule bg-paper-deep",
            ].join(" ")}
          >
            <div className="mb-1 flex items-center justify-between gap-3">
              <span className="font-mono text-[11px] uppercase tracking-eyebrow text-mute">
                {authorLabel(m, partnerName)}
                {internal && staffView ? " · internal note" : ""}
              </span>
              <time className="font-mono text-[11px] text-mute">
                {formatWhen(m.createdAt)}
              </time>
            </div>
            <p className="whitespace-pre-wrap text-ink">{m.body}</p>
          </li>
        );
      })}
    </ol>
  );
}
