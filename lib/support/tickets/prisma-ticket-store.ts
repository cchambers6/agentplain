/**
 * lib/support/tickets/prisma-ticket-store.ts
 *
 * Production binding for the TicketStore port. The one place ticket
 * persistence talks to Prisma (feedback_no_silent_vendor_lock).
 *
 * RLS discipline:
 *   - Customer-initiated reads/writes run under the CUSTOMER's RLS context
 *     (withRls{ userId, workspaceId, isOperator:false }) so Postgres RLS is a
 *     hard backstop on workspace isolation, ON TOP OF an explicit workspaceId
 *     filter — a bug in the where-clause still can't leak another workspace.
 *   - Staff/system writes + the operator inbox run under withSystemContext.
 *
 * Customer reads NEVER return `internal = true` messages — that audience
 * split sits on top of RLS (RLS isolates by workspace; `internal` isolates by
 * audience within the workspace).
 */

import type { Prisma } from "@prisma/client";
import { withRls, withSystemContext } from "../../db/rls";
import type {
  AddMessageArgs,
  CreatedTicket,
  NewTicketRecord,
  StaffTicketFilter,
  TicketCategory,
  TicketListRow,
  TicketMessageView,
  TicketPriority,
  TicketStatus,
  TicketStore,
  TicketView,
  TicketViewerContext,
  TicketContextSnapshot,
} from "./types";

const DEFAULT_STAFF_PAGE = 200;

export class PrismaTicketStore implements TicketStore {
  readonly name = "prisma" as const;

  async createTicket(record: NewTicketRecord): Promise<CreatedTicket> {
    // Written under system context: the action layer has already asserted
    // workspace membership; this keeps the WITH CHECK satisfied for the
    // SYSTEM acknowledgement message (which has no customer identity).
    return withSystemContext(async (tx) => {
      const ticket = await tx.supportTicket.create({
        data: {
          workspaceId: record.workspaceId,
          userId: record.userId,
          subject: record.subject,
          category: record.category,
          description: record.description,
          status: record.status,
          priority: record.priority,
          assignedTo: record.assignedTo,
          context: record.context as unknown as Prisma.InputJsonValue,
          firstResponseDueAt: record.firstResponseDueAt,
        },
        select: { id: true, number: true },
      });
      if (record.initialMessages.length > 0) {
        await tx.supportTicketMessage.createMany({
          data: record.initialMessages.map((m) => ({
            ticketId: ticket.id,
            workspaceId: record.workspaceId,
            author: m.author,
            authorUserId: m.authorUserId,
            body: m.body,
            internal: m.internal,
          })),
        });
      }
      return { id: ticket.id, number: ticket.number };
    });
  }

  async addMessage(args: AddMessageArgs): Promise<TicketMessageView> {
    const run = <T>(fn: (tx: Prisma.TransactionClient) => Promise<T>) =>
      args.viewer === "system"
        ? withSystemContext(fn)
        : withRls(
            {
              userId: args.viewer.userId,
              workspaceId: args.workspaceId,
              isOperator: args.viewer.isOperator,
            },
            fn,
          );

    return run(async (tx) => {
      const created = await tx.supportTicketMessage.create({
        data: {
          ticketId: args.ticketId,
          workspaceId: args.workspaceId,
          author: args.author,
          authorUserId: args.authorUserId,
          body: args.body,
          internal: args.internal,
        },
        select: {
          id: true,
          author: true,
          body: true,
          internal: true,
          createdAt: true,
        },
      });

      // Stamp firstRespondedAt on the first non-internal STAFF reply (the SLA
      // clock stops), and apply any requested status advance — same tx.
      const ticketUpdate: Prisma.SupportTicketUpdateInput = {};
      if (args.author === "STAFF" && !args.internal) {
        const t = await tx.supportTicket.findUnique({
          where: { id: args.ticketId },
          select: { firstRespondedAt: true },
        });
        if (t && t.firstRespondedAt === null) {
          ticketUpdate.firstRespondedAt = created.createdAt;
        }
      }
      if (args.advanceStatusTo) {
        ticketUpdate.status = args.advanceStatusTo;
        if (args.advanceStatusTo === "RESOLVED") {
          ticketUpdate.resolvedAt = new Date();
        }
      }
      if (Object.keys(ticketUpdate).length > 0) {
        await tx.supportTicket.update({
          where: { id: args.ticketId },
          data: ticketUpdate,
        });
      }

      return {
        id: created.id,
        author: created.author as TicketMessageView["author"],
        body: created.body,
        internal: created.internal,
        createdAt: created.createdAt,
      };
    });
  }

  async updateTicket(args: {
    ticketId: string;
    status?: TicketStatus;
    priority?: TicketPriority;
    assignedTo?: string | null;
    operatorUserId: string;
    reason?: string;
  }): Promise<void> {
    await withSystemContext(async (tx) => {
      const existing = await tx.supportTicket.findUnique({
        where: { id: args.ticketId },
        select: { workspaceId: true, status: true, resolvedAt: true },
      });
      if (!existing) return;

      const data: Prisma.SupportTicketUpdateInput = {};
      if (args.status !== undefined) {
        data.status = args.status;
        if (args.status === "RESOLVED" && existing.resolvedAt === null) {
          data.resolvedAt = new Date();
        }
        if (args.status !== "RESOLVED" && args.status !== "CLOSED") {
          // Re-opening clears the resolution stamp.
          data.resolvedAt = null;
        }
      }
      if (args.priority !== undefined) data.priority = args.priority;
      if (args.assignedTo !== undefined) data.assignedTo = args.assignedTo;

      await tx.supportTicket.update({ where: { id: args.ticketId }, data });

      await tx.auditLog.create({
        data: {
          actorUserId: args.operatorUserId,
          workspaceId: existing.workspaceId,
          action: "support_ticket.updated",
          targetTable: "SupportTicket",
          targetId: args.ticketId,
          payload: {
            status: args.status ?? null,
            priority: args.priority ?? null,
            assignedTo: args.assignedTo ?? null,
            reason: args.reason ?? null,
          } satisfies Prisma.InputJsonValue,
        },
      });
    });
  }

  async loadTicketForCustomer(
    workspaceId: string,
    ticketId: string,
    viewer: TicketViewerContext,
  ): Promise<TicketView | null> {
    return withRls(
      { userId: viewer.userId, workspaceId, isOperator: viewer.isOperator },
      async (tx) => {
        const row = await tx.supportTicket.findFirst({
          // Both the RLS policy AND this explicit workspaceId guard scope the
          // read — defense in depth.
          where: { id: ticketId, workspaceId },
          select: ticketSelect(false),
        });
        return row ? toTicketView(row) : null;
      },
    );
  }

  async loadTicketForStaff(ticketId: string): Promise<TicketView | null> {
    return withSystemContext(async (tx) => {
      const row = await tx.supportTicket.findUnique({
        where: { id: ticketId },
        select: ticketSelect(true),
      });
      return row ? toTicketView(row) : null;
    });
  }

  async listTicketsForWorkspace(
    workspaceId: string,
    viewer: TicketViewerContext,
  ): Promise<TicketListRow[]> {
    return withRls(
      { userId: viewer.userId, workspaceId, isOperator: viewer.isOperator },
      async (tx) => {
        const rows = await tx.supportTicket.findMany({
          where: { workspaceId },
          orderBy: { createdAt: "desc" },
          select: listSelect(),
        });
        return rows.map(toTicketListRow);
      },
    );
  }

  async listTicketsForStaff(filter: StaffTicketFilter): Promise<TicketListRow[]> {
    return withSystemContext(async (tx) => {
      const where: Prisma.SupportTicketWhereInput = {};
      if (filter.status) where.status = filter.status;
      if (filter.priority) where.priority = filter.priority;
      if (filter.vertical) {
        where.workspace = { vertical: filter.vertical as never };
      }
      const rows = await tx.supportTicket.findMany({
        where,
        orderBy: [{ priority: "asc" }, { createdAt: "desc" }],
        take: filter.limit ?? DEFAULT_STAFF_PAGE,
        select: listSelect(),
      });
      return rows.map(toTicketListRow);
    });
  }
}

// ── select shapes + mappers ───────────────────────────────────────────────

function ticketSelect(includeInternal: boolean) {
  return {
    id: true,
    number: true,
    workspaceId: true,
    subject: true,
    category: true,
    description: true,
    status: true,
    priority: true,
    assignedTo: true,
    context: true,
    firstResponseDueAt: true,
    firstRespondedAt: true,
    createdAt: true,
    updatedAt: true,
    resolvedAt: true,
    openedBy: { select: { email: true } },
    messages: {
      where: includeInternal ? undefined : { internal: false },
      orderBy: { createdAt: "asc" as const },
      select: {
        id: true,
        author: true,
        body: true,
        internal: true,
        createdAt: true,
      },
    },
  } satisfies Prisma.SupportTicketSelect;
}

function listSelect() {
  return {
    id: true,
    number: true,
    workspaceId: true,
    subject: true,
    category: true,
    status: true,
    priority: true,
    assignedTo: true,
    firstResponseDueAt: true,
    firstRespondedAt: true,
    createdAt: true,
    updatedAt: true,
    workspace: { select: { name: true } },
  } satisfies Prisma.SupportTicketSelect;
}

type TicketRow = Prisma.SupportTicketGetPayload<{ select: ReturnType<typeof ticketSelect> }>;
type ListRow = Prisma.SupportTicketGetPayload<{ select: ReturnType<typeof listSelect> }>;

function toTicketView(row: TicketRow): TicketView {
  return {
    id: row.id,
    number: row.number,
    workspaceId: row.workspaceId,
    subject: row.subject,
    category: row.category as TicketCategory,
    description: row.description,
    status: row.status as TicketStatus,
    priority: row.priority as TicketPriority,
    assignedTo: row.assignedTo,
    context: parseContext(row.context),
    firstResponseDueAt: row.firstResponseDueAt,
    firstRespondedAt: row.firstRespondedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    resolvedAt: row.resolvedAt,
    openedByEmail: row.openedBy?.email ?? null,
    messages: row.messages.map((m) => ({
      id: m.id,
      author: m.author as TicketMessageView["author"],
      body: m.body,
      internal: m.internal,
      createdAt: m.createdAt,
    })),
  };
}

function toTicketListRow(row: ListRow): TicketListRow {
  return {
    id: row.id,
    number: row.number,
    workspaceId: row.workspaceId,
    workspaceName: row.workspace?.name ?? null,
    subject: row.subject,
    category: row.category as TicketCategory,
    status: row.status as TicketStatus,
    priority: row.priority as TicketPriority,
    assignedTo: row.assignedTo,
    firstResponseDueAt: row.firstResponseDueAt,
    firstRespondedAt: row.firstRespondedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function parseContext(raw: unknown): TicketContextSnapshot | null {
  if (!raw || typeof raw !== "object") return null;
  const p = raw as Record<string, unknown>;
  // Tolerate the empty-object default + partial snapshots.
  if (!("capturedAt" in p)) return null;
  return {
    vertical: typeof p.vertical === "string" ? p.vertical : null,
    plan: typeof p.plan === "string" ? p.plan : null,
    integrationsConnected: Array.isArray(p.integrationsConnected)
      ? (p.integrationsConnected.filter((x) => typeof x === "string") as string[])
      : [],
    recentQueueItems: Array.isArray(p.recentQueueItems)
      ? (p.recentQueueItems.filter((x) => typeof x === "string") as string[])
      : [],
    plainoState: typeof p.plainoState === "string" ? p.plainoState : null,
    capturedAt: typeof p.capturedAt === "string" ? p.capturedAt : "",
  };
}
