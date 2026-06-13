/**
 * components/support/TicketBadges.tsx
 *
 * Pure presentational badges for ticket status + priority, shared by the
 * customer and staff surfaces so the vocabulary reads identically on both
 * sides. Server components (no client JS).
 */

import type { TicketPriority, TicketStatus } from "@/lib/support/tickets";

const STATUS_LABEL: Record<TicketStatus, string> = {
  OPEN: "Open",
  IN_PROGRESS: "In progress",
  WAITING_ON_CUSTOMER: "Waiting on you",
  RESOLVED: "Resolved",
  CLOSED: "Closed",
};

const STATUS_STAFF_LABEL: Record<TicketStatus, string> = {
  OPEN: "Open",
  IN_PROGRESS: "In progress",
  WAITING_ON_CUSTOMER: "Waiting on customer",
  RESOLVED: "Resolved",
  CLOSED: "Closed",
};

// Heritage palette tokens (border + tint) per status.
const STATUS_TONE: Record<TicketStatus, string> = {
  OPEN: "border-clay/40 bg-clay/10 text-ink",
  IN_PROGRESS: "border-rule bg-paper-deep text-ink",
  WAITING_ON_CUSTOMER: "border-rule bg-paper-deep text-ink-soft",
  RESOLVED: "border-moss/40 bg-moss/10 text-ink",
  CLOSED: "border-rule bg-paper-deep text-mute",
};

export function TicketStatusBadge({
  status,
  audience = "customer",
}: {
  status: TicketStatus;
  audience?: "customer" | "staff";
}) {
  const label =
    audience === "staff" ? STATUS_STAFF_LABEL[status] : STATUS_LABEL[status];
  return (
    <span
      className={`inline-flex items-center border px-2 py-0.5 font-mono text-[11px] uppercase tracking-eyebrow ${STATUS_TONE[status]}`}
    >
      {label}
    </span>
  );
}

const PRIORITY_TONE: Record<TicketPriority, string> = {
  P0: "border-flag/50 bg-flag/10 text-flag",
  P1: "border-clay/40 bg-clay/10 text-ink",
  P2: "border-rule bg-paper-deep text-ink-soft",
  P3: "border-rule bg-paper-deep text-mute",
};

export function TicketPriorityBadge({ priority }: { priority: TicketPriority }) {
  return (
    <span
      className={`inline-flex items-center border px-2 py-0.5 font-mono text-[11px] uppercase tracking-eyebrow ${PRIORITY_TONE[priority]}`}
    >
      {priority}
    </span>
  );
}

const CATEGORY_LABEL: Record<string, string> = {
  BILLING: "Billing",
  WORKFLOW: "Workflow",
  INTEGRATION: "Integration",
  BUG: "Bug",
  OTHER: "Other",
};

export function categoryLabel(category: string): string {
  return CATEGORY_LABEL[category] ?? category;
}
