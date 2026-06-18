/**
 * lib/portal/server.ts
 *
 * Server-only helpers that bind the public portal request to its config + the
 * signed-in end client. Reads the portal cookie via next/headers and resolves
 * it against the portal named by the slug. Pages use getPortalContext() to
 * decide what to render; requirePortalClient() is the gate for client-only
 * surfaces (status, chat) — it returns null when there's no valid session so
 * the caller can redirect to the portal's "you need your invite link" page.
 *
 * IMPORTANT (project: don't expose owner PII): nothing here returns the owner's
 * User, email, or workspace internals to the client surface — only the public
 * PortalBrand and the end client's own identity.
 */

import { cookies } from "next/headers";
import { resolveEnabledPortalBySlug, toPortalBrand, type PortalBrand } from "./config";
import { resolvePortalSession } from "./identity";
import { getPortalClient } from "./clients";
import { env } from "@/lib/env";

export interface PortalContext {
  brand: PortalBrand;
  /** Workspace that owns this portal — used for owner-scoped writes; never
   *  surfaced to the client. */
  workspaceId: string;
  /** The signed-in end client, or null when no valid session cookie is present. */
  signedIn: { clientId: string; email: string; name: string | null } | null;
}

/** Resolve the portal by slug + (optionally) the signed-in client. Returns null
 *  when the portal doesn't exist or is disabled — the caller renders notFound(). */
export async function getPortalContext(slug: string): Promise<PortalContext | null> {
  const resolved = await resolveEnabledPortalBySlug(slug);
  if (!resolved) return null;
  const brand = toPortalBrand(resolved.config);

  const jar = await cookies();
  const raw = jar.get(env.portalCookieName())?.value;
  if (!raw) return { brand, workspaceId: resolved.workspaceId, signedIn: null };

  const session = await resolvePortalSession({
    portalConfigId: brand.portalConfigId,
    rawToken: raw,
  });
  if (!session) return { brand, workspaceId: resolved.workspaceId, signedIn: null };

  const client = await getPortalClient({
    portalConfigId: brand.portalConfigId,
    clientId: session.clientId,
  });
  if (!client) return { brand, workspaceId: resolved.workspaceId, signedIn: null };

  return {
    brand,
    workspaceId: resolved.workspaceId,
    signedIn: { clientId: client.id, email: client.email, name: client.name },
  };
}
