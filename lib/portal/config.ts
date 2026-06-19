/**
 * lib/portal/config.ts
 *
 * Resolution + provisioning of a workspace's PortalConfig (the per-customer
 * branded portal). The public portal surface resolves a customerSlug → config
 * here; the owner side ensures/updates the config. A disabled or missing config
 * is the portal's 404 — no end client ever lands on a half-built portal.
 */

import type { PortalConfig } from "@prisma/client";
import { withSystemContext } from "@/lib/db/rls";

/** Public-facing brand subset handed to the portal shell. Never exposes owner
 *  PII — only the brand the owner chose to show their clients. */
export interface PortalBrand {
  portalConfigId: string;
  slug: string;
  brandName: string;
  brandColor: string;
  brandLogoUrl: string | null;
}

export function toPortalBrand(config: PortalConfig): PortalBrand {
  return {
    portalConfigId: config.id,
    slug: config.slug,
    brandName: config.brandName,
    brandColor: config.brandColor,
    brandLogoUrl: config.brandLogoUrl,
  };
}

/**
 * Resolve an ENABLED portal by its public slug. Returns null when the slug is
 * unknown or the portal is turned off — the caller renders a 404. The
 * workspaceId is returned alongside because every downstream write (the
 * owner-approval queue row, audit) is workspace-scoped.
 */
export async function resolveEnabledPortalBySlug(
  slug: string,
): Promise<{ config: PortalConfig; workspaceId: string } | null> {
  const config = await withSystemContext((tx) =>
    tx.portalConfig.findFirst({ where: { slug, enabled: true } }),
  );
  if (!config) return null;
  return { config, workspaceId: config.workspaceId };
}

/** Owner-side: fetch the workspace's portal config (enabled or not). */
export async function getPortalConfigForWorkspace(
  workspaceId: string,
): Promise<PortalConfig | null> {
  return withSystemContext((tx) =>
    tx.portalConfig.findUnique({ where: { workspaceId } }),
  );
}

export interface UpsertPortalConfigInput {
  workspaceId: string;
  slug: string;
  brandName: string;
  brandColor?: string;
  brandLogoUrl?: string | null;
  enabled?: boolean;
}

/**
 * Owner-side: create or update the workspace's portal config. Slug + brand are
 * the owner's call; `enabled` defaults to false on create so a brand-new portal
 * stays dark until the owner flips it on. Caller MUST have already gated on
 * BROKER_OWNER membership of `workspaceId`.
 */
export async function upsertPortalConfig(
  input: UpsertPortalConfigInput,
): Promise<PortalConfig> {
  const slug = normalizeSlug(input.slug);
  return withSystemContext((tx) =>
    tx.portalConfig.upsert({
      where: { workspaceId: input.workspaceId },
      create: {
        workspaceId: input.workspaceId,
        slug,
        brandName: input.brandName,
        brandColor: input.brandColor ?? "#B65D3A",
        brandLogoUrl: input.brandLogoUrl ?? null,
        enabled: input.enabled ?? false,
      },
      update: {
        slug,
        brandName: input.brandName,
        ...(input.brandColor !== undefined ? { brandColor: input.brandColor } : {}),
        ...(input.brandLogoUrl !== undefined ? { brandLogoUrl: input.brandLogoUrl } : {}),
        ...(input.enabled !== undefined ? { enabled: input.enabled } : {}),
      },
    }),
  );
}

/** Lowercase, trim, and reduce to URL-safe slug characters. */
export function normalizeSlug(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}
