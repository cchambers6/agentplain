"use server";

import { redirect } from "next/navigation";
import { requireWorkspaceMember } from "@/lib/auth";
import { withRls, withSystemContext } from "@/lib/db";
import { getMarketplaceEntry } from "@/lib/integrations/marketplace";
import { deleteIntegrationCustomerData } from "@/lib/customer-files";

const formStr = (form: FormData, key: string): string => {
  const v = form.get(key);
  return typeof v === "string" ? v : "";
};

/**
 * Customer-owned disconnect. Three-phase per the data-privacy audit
 * (PR #91 must-close #2):
 *
 *   Phase 1 — broker-owner tx: delete IntegrationCredential row +
 *     write the `integration.disconnected` AuditLog row. WebhookSubscription
 *     + WebhookEvent rows cascade off the credential FK
 *     (`prisma/schema.prisma` lines 620 + 678).
 *
 *   Phase 2 — system tx: delete the workspace's CUSTOMER KnowledgeDocument
 *     + Embedding rows that were ingested via this provider's file source(s).
 *     Scoped PRECISELY: only this workspace + only this provider's source
 *     names. Other context kinds (SKILL / VERTICAL / CROSS_CUSTOMER /
 *     COMPLIANCE) and other integrations' data are untouched. Runs under
 *     `withSystemContext` because the `knowledge_doc_write` / `embedding_write`
 *     RLS policies allow writes only when `is_operator='true'`.
 *
 *   Phase 3 — system tx: append a second AuditLog row recording the
 *     customer-data deletion counts so the trail captures both the
 *     credential revocation AND the data purge it triggered.
 *
 * Per `feedback_integration_acceptance_is_functional.md`: disconnect is a
 * customer-facing action — they signed the consent, they revoke it. The
 * customer sees a confirm modal before this fires (handled in the page).
 */
export async function disconnectIntegrationAction(form: FormData): Promise<void> {
  const workspaceId = formStr(form, "workspaceId");
  const integrationId = formStr(form, "integrationId");
  const credentialId = formStr(form, "credentialId");

  if (!workspaceId || !integrationId || !credentialId) {
    throw new Error("Missing workspaceId, integrationId, or credentialId");
  }

  const entry = getMarketplaceEntry(integrationId);
  if (!entry || entry.providerKey === null) {
    throw new Error(`Unknown integration: ${integrationId}`);
  }

  const member = await requireWorkspaceMember(workspaceId, ["BROKER_OWNER"]);
  const ctx = { userId: member.userId, workspaceId, isOperator: false };

  const credentialIdDeleted = await withRls(ctx, async (tx) => {
    // Read first under the same RLS so we know this credential belongs to
    // this workspace before we delete. This is the second of the three
    // guards (URL param + member role + ownership check) — defense in depth.
    const cred = await tx.integrationCredential.findFirst({
      where: {
        id: credentialId,
        workspaceId,
        provider: entry.providerKey ?? undefined,
      },
      select: { id: true, accountEmail: true, accountId: true },
    });
    if (!cred) {
      throw new Error("Credential not found for this workspace");
    }

    await tx.integrationCredential.delete({ where: { id: cred.id } });

    await tx.auditLog.create({
      data: {
        actorUserId: member.userId,
        workspaceId,
        action: "integration.disconnected",
        targetTable: "IntegrationCredential",
        targetId: cred.id,
        payload: {
          provider: entry.providerKey,
          integrationId,
          accountEmail: cred.accountEmail,
        },
      },
    });
    return cred.id;
  });

  // Phase 2: purge that provider's ingested CUSTOMER docs + embeddings
  // for this workspace. Best-effort — failure here does NOT roll back
  // the credential revoke (that already succeeded above); the audit row
  // below captures the deletion outcome (incl. zero / partial) so the
  // operator can re-run a teardown sweep if needed.
  let deletionSummary: Awaited<ReturnType<typeof deleteIntegrationCustomerData>>;
  try {
    deletionSummary = await deleteIntegrationCustomerData({
      workspaceId,
      providerKey: entry.providerKey,
    });
  } catch (err) {
    deletionSummary = {
      bySource: [],
      embeddingsDeleted: 0,
    };
    await withSystemContext(async (tx) => {
      await tx.auditLog.create({
        data: {
          actorUserId: member.userId,
          workspaceId,
          action: "integration.disconnect_data_deletion.failed",
          targetTable: "IntegrationCredential",
          targetId: credentialIdDeleted,
          payload: {
            provider: entry.providerKey,
            integrationId,
            error: err instanceof Error ? err.message : String(err),
          },
        },
      });
    });
    // Surface the failure to the caller — the customer should see a real
    // error rather than a silent "succeeded" with leftover data.
    throw err;
  }

  await withSystemContext(async (tx) => {
    await tx.auditLog.create({
      data: {
        actorUserId: member.userId,
        workspaceId,
        action: "integration.customer_data_deleted",
        targetTable: "IntegrationCredential",
        targetId: credentialIdDeleted,
        payload: {
          provider: entry.providerKey,
          integrationId,
          embeddingsDeleted: deletionSummary.embeddingsDeleted,
          bySource: deletionSummary.bySource,
        },
      },
    });
  });

  redirect(
    `/app/workspace/${workspaceId}/integrations?disconnected=${encodeURIComponent(
      integrationId,
    )}`,
  );
}
