/**
 * lib/portal/clients.ts
 *
 * End-client + case data access for the portal. Owner-side: find-or-create a
 * PortalClient when sending an invite. Client-side (page reads): the cases a
 * signed-in client may see, a single case's status timeline, and a case's
 * CLEAN documents. Every read is scoped by portalConfigId AND, for client
 * surfaces, by the resolved clientId — a client can only ever see their own
 * cases (or unassigned cases in their portal).
 */

import type {
  PortalCase,
  PortalCaseEvent,
  PortalClient,
  PortalDocument,
} from "@prisma/client";
import { withSystemContext } from "@/lib/db/rls";

/** Owner-side: find-or-create the client identity for an invite. */
export async function findOrCreatePortalClient(args: {
  portalConfigId: string;
  email: string;
  name?: string | null;
}): Promise<PortalClient> {
  const email = args.email.trim();
  return withSystemContext(async (tx) => {
    const existing = await tx.portalClient.findUnique({
      where: { portalConfigId_email: { portalConfigId: args.portalConfigId, email } },
    });
    if (existing) {
      // Backfill a name if we learned one and didn't have it.
      if (args.name && !existing.name) {
        return tx.portalClient.update({
          where: { id: existing.id },
          data: { name: args.name },
        });
      }
      return existing;
    }
    return tx.portalClient.create({
      data: { portalConfigId: args.portalConfigId, email, name: args.name ?? null },
    });
  });
}

/** Client-side: the cases this client may see — their own, plus unassigned
 *  cases in their portal (created before invite-linking). */
export async function listClientCases(args: {
  portalConfigId: string;
  clientId: string;
}): Promise<PortalCase[]> {
  return withSystemContext((tx) =>
    tx.portalCase.findMany({
      where: {
        portalConfigId: args.portalConfigId,
        OR: [{ clientId: args.clientId }, { clientId: null }],
      },
      orderBy: { updatedAt: "desc" },
    }),
  );
}

/** Client-side: one case + its status timeline, gated to the client's portal +
 *  ownership. Returns null if the case isn't theirs. */
export async function getClientCase(args: {
  portalConfigId: string;
  clientId: string;
  caseId: string;
}): Promise<{ case: PortalCase; events: PortalCaseEvent[]; documents: PortalDocument[] } | null> {
  return withSystemContext(async (tx) => {
    const found = await tx.portalCase.findFirst({
      where: {
        id: args.caseId,
        portalConfigId: args.portalConfigId,
        OR: [{ clientId: args.clientId }, { clientId: null }],
      },
    });
    if (!found) return null;
    const [events, documents] = await Promise.all([
      tx.portalCaseEvent.findMany({
        where: { caseId: found.id },
        orderBy: { occurredAt: "desc" },
      }),
      // Only CLEAN documents are ever surfaced to a client (fail-closed: a
      // PENDING / INFECTED / ERROR file is never offered for download).
      tx.portalDocument.findMany({
        where: { caseId: found.id, scanStatus: "CLEAN" },
        orderBy: { createdAt: "desc" },
      }),
    ]);
    return { case: found, events, documents };
  });
}

/** Get a client by id within a portal (for chat recipient + display). */
export async function getPortalClient(args: {
  portalConfigId: string;
  clientId: string;
}): Promise<PortalClient | null> {
  return withSystemContext((tx) =>
    tx.portalClient.findFirst({
      where: { id: args.clientId, portalConfigId: args.portalConfigId },
    }),
  );
}
