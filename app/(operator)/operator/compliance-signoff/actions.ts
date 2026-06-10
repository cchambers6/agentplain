"use server";

// pfd-5 — server actions for /operator/compliance-signoff.
//
// Records or revokes the per-vertical counsel sign-off that gates
// rewrite-and-stage. Every flip is:
//   - durable: writes the ComplianceCounselSignoff row (the gate reads it).
//   - reversible: revoke sets revokedAt; re-record clears it.
//   - audited: an AuditLog row carries the actor + before/after.
//
// Per feedback_no_silent_vendor_lock: the artifact ref goes through the
// lib/storage/counsel-artifact.ts seam, not a raw blob call here.
// Per project_no_outbound_architecture: nothing outbound fires — this only
// records sign-off state.

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/server";
import { withSystemContext } from "@/lib/db/rls";
import {
  PrismaCounselSignoffStore,
  isKnownCorpusVertical,
} from "@/lib/agents/sentinel";
import { defaultCounselArtifactStore } from "@/lib/storage/counsel-artifact";

const PATH = "/operator/compliance-signoff";

type ActionResult = { ok: boolean; error?: string };

async function requireOperator() {
  const session = await requireUser();
  if (!session.isOperator) {
    throw new Error("Forbidden — operator only.");
  }
  return session;
}

/**
 * Record (or re-record) a counsel sign-off for a vertical. Validates the
 * artifact ref through the storage seam, upserts the row (clearing any prior
 * revocation), and audit-logs the action.
 */
export async function recordSignoffAction(
  _prev: ActionResult | undefined,
  form: FormData,
): Promise<ActionResult> {
  const session = await requireOperator();

  const verticalSlug = String(form.get("verticalSlug") ?? "").trim();
  const rawArtifactRef = String(form.get("artifactRef") ?? "");
  const note = String(form.get("note") ?? "").trim() || null;

  if (!isKnownCorpusVertical(verticalSlug)) {
    return { ok: false, error: `Unknown vertical "${verticalSlug}".` };
  }

  let artifactRef: string;
  try {
    const stored = await defaultCounselArtifactStore.storeRef(rawArtifactRef);
    artifactRef = stored.ref;
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Invalid artifact reference.",
    };
  }

  const signedAt = new Date();
  const store = new PrismaCounselSignoffStore();

  await store.record({
    verticalSlug,
    signedAt,
    artifactRef,
    signedByEmail: session.email,
    signedByUserId: session.userId,
    note,
  });

  await withSystemContext((tx) =>
    tx.auditLog.create({
      data: {
        actorUserId: session.userId,
        action: "compliance.counsel_signoff.record",
        targetTable: "ComplianceCounselSignoff",
        targetId: verticalSlug,
        payload: {
          verticalSlug,
          signedAt: signedAt.toISOString(),
          artifactRef,
          signedByEmail: session.email,
          note,
        },
      },
    }),
  );

  revalidatePath(PATH);
  return { ok: true };
}

/**
 * Revoke a vertical's sign-off. Sets revokedAt (the gate immediately treats
 * the vertical as unsigned again) and audit-logs it. Reversible — recording a
 * new sign-off clears the revocation.
 */
export async function revokeSignoffAction(
  verticalSlug: string,
): Promise<ActionResult> {
  const session = await requireOperator();
  if (!isKnownCorpusVertical(verticalSlug)) {
    return { ok: false, error: `Unknown vertical "${verticalSlug}".` };
  }

  const store = new PrismaCounselSignoffStore();
  const updated = await store.revoke(verticalSlug, {
    email: session.email,
    userId: session.userId,
  });

  if (!updated) {
    return { ok: false, error: "No sign-off on record for that vertical." };
  }

  await withSystemContext((tx) =>
    tx.auditLog.create({
      data: {
        actorUserId: session.userId,
        action: "compliance.counsel_signoff.revoke",
        targetTable: "ComplianceCounselSignoff",
        targetId: verticalSlug,
        payload: {
          verticalSlug,
          revokedAt: (updated.revokedAt ?? new Date()).toISOString(),
          revokedByEmail: session.email,
        },
      },
    }),
  );

  revalidatePath(PATH);
  return { ok: true };
}
