/**
 * lib/support/tickets/index.ts
 *
 * Public surface of the customer-facing support ticket lifecycle.
 */

export * from "./types";
export { createSupportTicket, type CreateTicketDeps } from "./create";
export { buildTicketContext } from "./context";
export { PrismaTicketStore } from "./prisma-ticket-store";
export { PageHumanTicketNotifier } from "./notify";
export {
  classifyTicketPriority,
  TICKET_BILLING_DISPUTE_THRESHOLD_USD,
  type TicketClassification,
} from "./classify";
export { resolveTicketAssignee, type TicketAssignment } from "./routing";
export {
  DEFAULT_FIRST_RESPONSE_HOURS,
  FIRST_RESPONSE_HOURS_BY_PRIORITY,
  computeFirstResponseDueAt,
  slaWindowLabel,
  firstResponsePromise,
  formatTicketNumber,
  isSlaBreached,
} from "./sla";
