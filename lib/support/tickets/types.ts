/**
 * lib/support/tickets/types.ts
 *
 * The contract for the customer-facing support TICKET lifecycle — the
 * thing that closes the Day-2/3 "first broken promise" from the Conner-dead
 * simulation: a trial customer who hits a snag must get a tracked ticket, a
 * real number, an honest SLA, and a human — never a form that vanishes.
 *
 * This module is provider-neutral. Per feedback_runner_portability.md the
 * persistence (TicketStore) and notification (TicketNotifier) are injected
 * ports; the production bindings live in prisma-ticket-store.ts + notify.ts,
 * and tests pass recording fakes. Nothing here imports Prisma, Resend, or
 * Inngest. Per feedback_cold_start_safe_agents.md the orchestrators read
 * durable state on every call and hold no cross-fire memory.
 *
 * The string unions below mirror the Prisma enums 1:1 (SupportTicketStatus
 * etc.). We keep our own unions so the pure core never imports @prisma/client.
 */

export type TicketStatus =
  | "OPEN"
  | "IN_PROGRESS"
  | "WAITING_ON_CUSTOMER"
  | "RESOLVED"
  | "CLOSED";

export type TicketPriority = "P0" | "P1" | "P2" | "P3";

export type TicketCategory =
  | "BILLING"
  | "WORKFLOW"
  | "INTEGRATION"
  | "BUG"
  | "OTHER";

export type TicketMessageAuthor = "CUSTOMER" | "STAFF" | "SYSTEM";

export const TICKET_CATEGORIES: readonly TicketCategory[] = [
  "BILLING",
  "WORKFLOW",
  "INTEGRATION",
  "BUG",
  "OTHER",
];

export const TICKET_STATUSES: readonly TicketStatus[] = [
  "OPEN",
  "IN_PROGRESS",
  "WAITING_ON_CUSTOMER",
  "RESOLVED",
  "CLOSED",
];

export const TICKET_PRIORITIES: readonly TicketPriority[] = [
  "P0",
  "P1",
  "P2",
  "P3",
];

/** A terminal status — no further customer/staff action expected. */
export function isTerminalStatus(status: TicketStatus): boolean {
  return status === "RESOLVED" || status === "CLOSED";
}

/**
 * The point-in-time workspace context auto-attached to a ticket at creation.
 * A snapshot — staff see what the customer's world looked like when they hit
 * the snag, never a re-derived later state. Best-effort: any field that can't
 * be resolved is omitted; context-gathering NEVER blocks ticket creation.
 */
export interface TicketContextSnapshot {
  /** Workspace vertical slug (e.g. "real_estate"). */
  vertical: string | null;
  /** Per-seat plan / tier (e.g. "REGULAR"). */
  plan: string | null;
  /** Provider slugs of currently-connected integrations. */
  integrationsConnected: string[];
  /** Short labels of the last few action-queue items, newest first. */
  recentQueueItems: string[];
  /** One-line description of Plaino's recent state for this workspace. */
  plainoState: string | null;
  /** ISO instant the snapshot was taken. */
  capturedAt: string;
}

/** A thread message as the surfaces render it. */
export interface TicketMessageView {
  id: string;
  author: TicketMessageAuthor;
  body: string;
  internal: boolean;
  createdAt: Date;
}

/** A full ticket as the surfaces render it (customer or staff). */
export interface TicketView {
  id: string;
  number: number;
  workspaceId: string;
  subject: string;
  category: TicketCategory;
  description: string;
  status: TicketStatus;
  priority: TicketPriority;
  assignedTo: string | null;
  context: TicketContextSnapshot | null;
  firstResponseDueAt: Date | null;
  firstRespondedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  resolvedAt: Date | null;
  openedByEmail: string | null;
  messages: TicketMessageView[];
}

/** A compact ticket row for list surfaces (no thread). */
export interface TicketListRow {
  id: string;
  number: number;
  workspaceId: string;
  workspaceName: string | null;
  subject: string;
  category: TicketCategory;
  status: TicketStatus;
  priority: TicketPriority;
  assignedTo: string | null;
  firstResponseDueAt: Date | null;
  firstRespondedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Normalized, validated input to create a ticket. */
export interface CreateTicketInput {
  workspaceId: string;
  /** The member opening the ticket; may be null if since-deleted (the
   *  surfaces always pass a live member). */
  userId: string | null;
  /** The opener's email — the address the confirmation goes to. */
  fromEmail: string;
  fromName: string | null;
  workspaceName: string;
  subject: string;
  category: TicketCategory;
  description: string;
}

/** What the store persists for a new ticket (orchestrator-computed). */
export interface NewTicketRecord {
  workspaceId: string;
  userId: string | null;
  subject: string;
  category: TicketCategory;
  description: string;
  priority: TicketPriority;
  status: TicketStatus;
  assignedTo: string | null;
  context: TicketContextSnapshot;
  firstResponseDueAt: Date;
  /** Initial thread messages written in the same transaction as the ticket:
   *  the customer's description (CUSTOMER) + a SYSTEM acknowledgement. */
  initialMessages: NewTicketMessage[];
}

export interface NewTicketMessage {
  author: TicketMessageAuthor;
  authorUserId: string | null;
  body: string;
  internal: boolean;
}

/** The persisted handle returned after creation. */
export interface CreatedTicket {
  id: string;
  number: number;
}

/** Persistence port. Production binding = PrismaTicketStore. */
export interface TicketStore {
  readonly name: string;
  /** Persist the ticket + its initial messages atomically. */
  createTicket(record: NewTicketRecord): Promise<CreatedTicket>;
  /** Append a message. When `author === 'STAFF'` and not internal, the store
   *  stamps firstRespondedAt (if unset) and may advance status — see impl. */
  addMessage(args: AddMessageArgs): Promise<TicketMessageView>;
  /** Apply a staff lifecycle change (status / priority / assignee). */
  updateTicket(args: UpdateTicketArgs): Promise<void>;
  /** Customer-facing load: messages with `internal = true` are EXCLUDED. */
  loadTicketForCustomer(
    workspaceId: string,
    ticketId: string,
    viewer: TicketViewerContext,
  ): Promise<TicketView | null>;
  /** Staff load (operator context): ALL messages incl. internal notes. */
  loadTicketForStaff(ticketId: string): Promise<TicketView | null>;
  /** Customer-facing list for one workspace. */
  listTicketsForWorkspace(
    workspaceId: string,
    viewer: TicketViewerContext,
  ): Promise<TicketListRow[]>;
  /** Staff list (operator context), optionally filtered. */
  listTicketsForStaff(filter: StaffTicketFilter): Promise<TicketListRow[]>;
}

/** Identifies the signed-in member for RLS context on customer reads. */
export interface TicketViewerContext {
  userId: string;
  isOperator: boolean;
}

export interface AddMessageArgs {
  ticketId: string;
  workspaceId: string;
  author: TicketMessageAuthor;
  authorUserId: string | null;
  body: string;
  internal: boolean;
  /** When set, the store moves the ticket to this status in the same tx
   *  (e.g. a staff reply → WAITING_ON_CUSTOMER, a customer reply → OPEN). */
  advanceStatusTo?: TicketStatus;
  /** RLS context. Operators pass system context; a customer passes their own
   *  viewer context so RLS confirms workspace membership. */
  viewer: TicketViewerContext | "system";
}

export interface UpdateTicketArgs {
  ticketId: string;
  status?: TicketStatus;
  priority?: TicketPriority;
  assignedTo?: string | null;
  /** Operator user id, for the audit row. */
  operatorUserId: string;
  /** Optional note recorded on the audit row. */
  reason?: string;
}

export interface StaffTicketFilter {
  status?: TicketStatus;
  priority?: TicketPriority;
  /** Vertical slug — joins through the workspace. */
  vertical?: string;
  /** Cap the result set. Defaults to a sane page size in the impl. */
  limit?: number;
}

/** Notification port. Production binding = PageHumanTicketNotifier. */
export interface TicketNotifier {
  readonly name: string;
  /**
   * Alert the assigned staff member that a new ticket landed. Routed through
   * the fleet's single page-a-human choke point so it can NEVER reach nobody
   * (Conner-dead P0 #1) — a both-empty operator config still lands in the
   * baked-in last-resort inbox, loudly. Returns delivery + routing detail so
   * the orchestrator can record a loud-fail signal if needed.
   */
  notifyStaffNewTicket(args: StaffNotifyArgs): Promise<StaffNotifyResult>;
  /**
   * Send the customer a "we got ticket #N, expect a response within X"
   * confirmation. Transactional (customer-initiated), not outbound marketing.
   * Best-effort: a confirmation failure never fails ticket creation.
   */
  confirmToCustomer(args: CustomerConfirmArgs): Promise<{ delivered: boolean }>;
}

export interface StaffNotifyArgs {
  ticketId: string;
  number: number;
  workspaceId: string;
  workspaceName: string;
  subject: string;
  category: TicketCategory;
  priority: TicketPriority;
  description: string;
  fromEmail: string;
  context: TicketContextSnapshot;
  /** First-response deadline surfaced to the staff member. */
  firstResponseDueAt: Date;
}

export interface StaffNotifyResult {
  /** True iff the alert email was handed to the provider for ≥1 recipient. */
  delivered: boolean;
  /** Who it was addressed to. */
  recipients: string[];
  /** True when routing fell all the way to the baked-in last-resort inbox
   *  (no operator routing configured at all) — the loudest tier. */
  usedHardcodedFallback: boolean;
  /** True iff the page was persisted as an audit row even if email failed. */
  persisted: boolean;
}

export interface CustomerConfirmArgs {
  toEmail: string;
  number: number;
  subject: string;
  /** The human SLA promise line, e.g. "within 24 hours". */
  slaWindowLabel: string;
  partnerName: string;
}

export type CreateTicketResult =
  | { ok: true; value: CreateTicketSuccess }
  | { ok: false; code: CreateTicketErrorCode; message: string; fieldErrors?: FieldErrors };

export type CreateTicketErrorCode = "VALIDATION" | "PERSIST_FAILED";

export type FieldErrors = Partial<Record<"subject" | "category" | "description", string>>;

export interface CreateTicketSuccess {
  ticketId: string;
  number: number;
  priority: TicketPriority;
  firstResponseDueAt: Date;
  slaWindowLabel: string;
  assignedTo: string | null;
  /** The staff-notify outcome — surfaced so the caller can log loud-fail. */
  staffNotified: StaffNotifyResult;
  /** Whether the customer confirmation went out (best-effort). */
  customerConfirmed: boolean;
}
