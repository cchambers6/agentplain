"use server";

import { redirect } from "next/navigation";
import { requireWorkspaceMember } from "@/lib/auth";
import { withRls } from "@/lib/db";
import { getMarketplaceEntry } from "@/lib/integrations/marketplace";

const formStr = (form: FormData, key: string): string => {
  const v = form.get(key);
  return typeof v === "string" ? v : "";
};

/**
 * Customer-owned disconnect. Deletes the IntegrationCredential row and
 * writes an AuditLog entry. The unique constraint on
 * (workspaceId, provider, accountId) means deleting the row removes the
 * one credential the row represents; webhook subscriptions cascade via
 * the schema's onDelete: Cascade.
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

  await withRls(ctx, async (tx) => {
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
  });

  redirect(
    `/app/workspace/${workspaceId}/integrations?disconnected=${encodeURIComponent(
      integrationId,
    )}`,
  );
}
