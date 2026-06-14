/**
 * lib/support/tickets/create.ts
 *
 * The pure orchestrator that turns a customer's "I'm stuck" into a tracked
 * ticket with a number, an SLA, an assignee, and a human who's been paged.
 * This is the heart of the Day-2/3 fix from the Conner-dead simulation.
 *
 * On createSupportTicket it:
 *   1. validates the input (loud field errors, never a silent drop),
 *   2. classifies priority via the L1 escalate-first classifier,
 *   3. computes the first-response SLA deadline,
 *   4. resolves the assignee from the fleet's page-a-human routing
 *      (FLEET_TRUSTED_HUMAN_EMAIL → operator allowlist → baked-in last
 *      resort) so a ticket is NEVER unassigned,
 *   5. persists the ticket + the customer's message + a SYSTEM acknowledgement
 *      atomically through the injected store,
 *   6. pages the assigned staff member (guaranteed-delivery choke point) and
 *      sends the customer their confirmation,
 *   7. surfaces a LOUD signal when staff routing fell to the baked-in
 *      fallback — the support flow promised a human; we record honestly when
 *      no human was actually configured.
 *
 * Per feedback_runner_portability.md the store + notifier are injected. Per
 * feedback_cold_start_safe_agents.md env + clock are read per call. Nothing
 * here imports Prisma / Resend / Inngest.
 */

import { classifyTicketPriority } from "./classify";
import {
  computeFirstResponseDueAt,
  slaWindowLabel,
} from "./sla";
import type {
  CreateTicketInput,
  CreateTicketResult,
  FieldErrors,
  NewTicketMessage,
  TicketCategory,
  TicketContextSnapshot,
  TicketNotifier,
  TicketStore,
} from "./types";
import { TICKET_CATEGORIES } from "./types";
import { resolveTicketAssignee } from "./routing";

const SUBJECT_MAX = 200;
const DESCRIPTION_MAX = 8000;

export interface CreateTicketDeps {
  store: TicketStore;
  notifier: TicketNotifier;
  /** The auto-attached workspace context. Caller resolves it (best-effort)
   *  and passes it in so this orchestrator stays pure + offline-testable. */
  context: TicketContextSnapshot;
  /** Named service partner for the workspace (e.g. "Plaino"). */
  partnerName: string;
  env?: NodeJS.ProcessEnv;
  now?: Date;
}

export async function createSupportTicket(
  input: CreateTicketInput,
  deps: CreateTicketDeps,
): Promise<CreateTicketResult> {
  const now = deps.now ?? new Date();
  const env = deps.env ?? process.env;

  // ── 1. Validate ──────────────────────────────────────────────────────
  const subject = input.subject.trim();
  const description = input.description.trim();
  const fieldErrors: FieldErrors = {};
  if (subject.length === 0) fieldErrors.subject = "Add a short subject line.";
  else if (subject.length > SUBJECT_MAX)
    fieldErrors.subject = `Keep the subject under ${SUBJECT_MAX} characters.`;
  if (description.length === 0)
    fieldErrors.description = "Tell us what's going on so we can help.";
  else if (description.length > DESCRIPTION_MAX)
    fieldErrors.description = `Keep the description under ${DESCRIPTION_MAX} characters.`;
  if (!isValidCategory(input.category))
    fieldErrors.category = "Pick a category.";
  if (Object.keys(fieldErrors).length > 0) {
    return {
      ok: false,
      code: "VALIDATION",
      message: "Please fix the highlighted fields.",
      fieldErrors,
    };
  }

  // ── 2. Classify priority (L1 escalate-first) ─────────────────────────
  const classification = classifyTicketPriority({
    category: input.category,
    subject,
    description,
  });
  const priority = classification.priority;

  // ── 3. SLA deadline ──────────────────────────────────────────────────
  const firstResponseDueAt = computeFirstResponseDueAt(priority, now);
  const windowLabel = slaWindowLabel(priority);

  // ── 4. Assignee (never empty) ────────────────────────────────────────
  const assignment = resolveTicketAssignee(env);
  const assignedTo = assignment.email;

  // ── 5. Persist (ticket + thread) ─────────────────────────────────────
  const initialMessages = buildInitialMessages({
    description,
    userId: input.userId,
    priority,
    windowLabel,
    classification,
  });

  let created;
  try {
    created = await deps.store.createTicket({
      workspaceId: input.workspaceId,
      userId: input.userId,
      subject,
      category: input.category,
      description,
      priority,
      status: "OPEN",
      assignedTo,
      context: deps.context,
      firstResponseDueAt,
      initialMessages,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return {
      ok: false,
      code: "PERSIST_FAILED",
      message: `Could not save the ticket: ${message}`,
    };
  }

  // ── 6. Notify — staff (guaranteed delivery) + customer (best effort) ──
  // The staff page goes through the fleet's single page-a-human choke point,
  // so it can never reach nobody. We await it; a delivery problem there is a
  // loud signal (recorded below), not a silent drop.
  const staffNotified = await deps.notifier.notifyStaffNewTicket({
    ticketId: created.id,
    number: created.number,
    workspaceId: input.workspaceId,
    workspaceName: input.workspaceName,
    subject,
    category: input.category,
    priority,
    description,
    fromEmail: input.fromEmail,
    context: deps.context,
    firstResponseDueAt,
  });

  const customer = await deps.notifier
    .confirmToCustomer({
      toEmail: input.fromEmail,
      number: created.number,
      subject,
      slaWindowLabel: windowLabel,
      partnerName: deps.partnerName,
    })
    .catch(() => ({ delivered: false }));

  return {
    ok: true,
    value: {
      ticketId: created.id,
      number: created.number,
      priority,
      firstResponseDueAt,
      slaWindowLabel: windowLabel,
      assignedTo,
      staffNotified,
      customerConfirmed: customer.delivered,
    },
  };
}

function isValidCategory(value: string): value is TicketCategory {
  return (TICKET_CATEGORIES as readonly string[]).includes(value);
}

/** Build the two initial thread messages: the customer's own description and
 *  a SYSTEM acknowledgement carrying the SLA promise + (when present) the
 *  escalation reason. The SYSTEM line never claims to be a human. */
function buildInitialMessages(args: {
  description: string;
  userId: string | null;
  priority: string;
  windowLabel: string;
  classification: ReturnType<typeof classifyTicketPriority>;
}): NewTicketMessage[] {
  const messages: NewTicketMessage[] = [
    {
      author: "CUSTOMER",
      authorUserId: args.userId,
      body: args.description,
      internal: false,
    },
  ];

  const ackLines = [
    `Thanks — your ticket is open and a member of our team will reply ${args.windowLabel}.`,
  ];
  messages.push({
    author: "SYSTEM",
    authorUserId: null,
    body: ackLines.join("\n"),
    internal: false,
  });

  // An internal SYSTEM note so staff see the auto-classification + escalation
  // reason without it leaking to the customer.
  const note = args.classification.escalation
    ? `Auto-classified ${args.priority} — escalation trigger: ${args.classification.escalation.trigger} (${args.classification.escalation.evidence}).`
    : `Auto-classified ${args.priority} by category.`;
  messages.push({
    author: "SYSTEM",
    authorUserId: null,
    body: note,
    internal: true,
  });

  return messages;
}
