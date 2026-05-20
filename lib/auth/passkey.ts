// Passkey (WebAuthn) domain logic — persistence + the provider orchestration
// that the four /api/auth/passkey routes are thin wrappers over. Mirrors the
// split in flows.ts: the domain owns DB writes, audit rows, and session
// resolution; the route owns FormData/JSON, cookies, and redirects.
//
// Credentials are User-scoped (see schema comment on WebAuthnCredential).
// Registration runs under the owning user's RLS context; authentication
// lookup-by-credentialId runs under the system/operator context because no
// session exists yet — exactly like magic-link verification.

import type { Prisma } from "@prisma/client";
import { withRls, withSystemContext, type RlsContext } from "../db/rls";
import { getWebAuthnProvider } from "./webauthn";
import type {
  GeneratedOptions,
  StoredCredentialRef,
} from "./webauthn";

const userCtx = (userId: string): RlsContext => ({
  userId,
  workspaceId: null,
  isOperator: false,
});

export interface PasskeySummary {
  id: string;
  label: string | null;
  deviceType: string | null;
  backedUp: boolean;
  createdAt: Date;
  lastUsedAt: Date | null;
}

/** Passkeys for the settings list, newest first. */
export async function listPasskeys(userId: string): Promise<PasskeySummary[]> {
  return withRls(userCtx(userId), (tx) =>
    tx.webAuthnCredential.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        label: true,
        deviceType: true,
        backedUp: true,
        createdAt: true,
        lastUsedAt: true,
      },
    }),
  );
}

/** Build the registration options + persist the challenge cookie upstream. */
export async function buildRegistrationOptions(
  userId: string,
  userName: string,
  userDisplayName: string | null,
): Promise<GeneratedOptions> {
  const existing = await withRls(userCtx(userId), (tx) =>
    tx.webAuthnCredential.findMany({
      where: { userId },
      select: { credentialId: true, transports: true },
    }),
  );
  const existingCredentials: StoredCredentialRef[] = existing.map((c) => ({
    credentialId: c.credentialId,
    transports: c.transports,
  }));
  return getWebAuthnProvider().generateRegistrationOptions({
    userId,
    userName,
    userDisplayName,
    existingCredentials,
  });
}

export type PersistPasskeyResult =
  | { ok: true; id: string }
  | { ok: false; reason: "not_verified" | "duplicate" };

/** Verify a registration response and persist the new credential. */
export async function verifyAndPersistRegistration(input: {
  userId: string;
  responseJSON: unknown;
  expectedChallenge: string;
  label?: string | null;
}): Promise<PersistPasskeyResult> {
  const verified = await getWebAuthnProvider().verifyRegistration({
    responseJSON: input.responseJSON,
    expectedChallenge: input.expectedChallenge,
  });
  if (!verified.verified) return { ok: false, reason: "not_verified" };

  try {
    const id = await withRls(userCtx(input.userId), async (tx) => {
      const row = await tx.webAuthnCredential.create({
        data: {
          userId: input.userId,
          credentialId: verified.credentialId,
          publicKey: verified.publicKey,
          counter: BigInt(verified.counter),
          transports: verified.transports,
          deviceType: verified.deviceType,
          backedUp: verified.backedUp,
          label: input.label?.trim() || defaultLabel(verified.deviceType),
        },
        select: { id: true },
      });
      await tx.auditLog.create({
        data: {
          actorUserId: input.userId,
          action: "passkey.registered",
          targetTable: "WebAuthnCredential",
          targetId: row.id,
          payload: {
            deviceType: verified.deviceType,
            backedUp: verified.backedUp,
          } satisfies Prisma.InputJsonValue,
        },
      });
      return row.id;
    });
    return { ok: true, id };
  } catch (err) {
    // Unique violation on credentialId → this authenticator is already
    // enrolled (for this or another account). Treat as a soft duplicate.
    if (
      err &&
      typeof err === "object" &&
      "code" in err &&
      (err as { code?: string }).code === "P2002"
    ) {
      return { ok: false, reason: "duplicate" };
    }
    throw err;
  }
}

export interface PasskeyAuthResolution {
  userId: string;
  email: string;
  isOperator: boolean;
  defaultWorkspaceId: string | null;
}

/**
 * Verify an authentication assertion and, on success, advance the replay
 * counter and resolve the session identity (mirrors verifyMagicLink's return).
 * Returns null when the credential is unknown or verification fails.
 */
export async function verifyAuthentication(input: {
  responseJSON: unknown;
  expectedChallenge: string;
}): Promise<PasskeyAuthResolution | null> {
  const credentialId = extractCredentialId(input.responseJSON);
  if (!credentialId) return null;

  // No session yet → system context for the credential + user lookup.
  const credential = await withSystemContext((tx) =>
    tx.webAuthnCredential.findUnique({
      where: { credentialId },
      include: { user: true },
    }),
  );
  if (!credential) return null;

  const result = await getWebAuthnProvider().verifyAuthentication({
    responseJSON: input.responseJSON,
    expectedChallenge: input.expectedChallenge,
    credential: {
      credentialId: credential.credentialId,
      publicKey: credential.publicKey,
      counter: credential.counter,
      transports: credential.transports,
    },
  });
  if (!result.verified) return null;

  return withSystemContext(async (tx) => {
    await tx.webAuthnCredential.update({
      where: { id: credential.id },
      data: { counter: BigInt(result.newCounter), lastUsedAt: new Date() },
    });

    const membership = await tx.membership.findFirst({
      where: { userId: credential.userId, role: "BROKER_OWNER", status: "ACTIVE" },
      orderBy: { createdAt: "desc" },
    });

    await tx.auditLog.create({
      data: {
        actorUserId: credential.userId,
        workspaceId: membership?.workspaceId ?? null,
        action: "session.signed_in",
        payload: { via: "passkey" } satisfies Prisma.InputJsonValue,
      },
    });

    return {
      userId: credential.user.id,
      email: credential.user.email,
      isOperator: credential.user.isOperator,
      defaultWorkspaceId: membership?.workspaceId ?? null,
    };
  });
}

/** Remove one of the user's own passkeys. Returns true if a row was deleted. */
export async function removePasskey(
  userId: string,
  id: string,
): Promise<boolean> {
  return withRls(userCtx(userId), async (tx) => {
    const result = await tx.webAuthnCredential.deleteMany({
      where: { id, userId },
    });
    if (result.count > 0) {
      await tx.auditLog.create({
        data: {
          actorUserId: userId,
          action: "passkey.removed",
          targetTable: "WebAuthnCredential",
          targetId: id,
        },
      });
    }
    return result.count > 0;
  });
}

const defaultLabel = (deviceType: string | null): string =>
  deviceType === "multiDevice" ? "Synced passkey" : "This device";

/** Pull the base64url credential id off a browser AuthenticationResponseJSON. */
const extractCredentialId = (responseJSON: unknown): string | null => {
  if (
    responseJSON &&
    typeof responseJSON === "object" &&
    "id" in responseJSON &&
    typeof (responseJSON as { id?: unknown }).id === "string"
  ) {
    return (responseJSON as { id: string }).id;
  }
  return null;
};
