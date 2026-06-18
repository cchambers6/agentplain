// POST /api/portal/setup — owner creates/updates + enables the workspace's
// client portal (slug, brand name, accent color, optional logo, enabled flag).
//
// Owner-gated. This is the single seam that brings a portal into existence — an
// end client can only reach a portal whose config is enabled (lib/portal/config
// #resolveEnabledPortalBySlug 404s otherwise).

import { NextResponse } from "next/server";
import { z } from "zod";
import { resolvePortalOwner } from "@/lib/portal/owner-auth";
import { normalizeSlug, upsertPortalConfig } from "@/lib/portal/config";

export const runtime = "nodejs";

const bodySchema = z.object({
  workspaceId: z.string().uuid(),
  slug: z.string().trim().min(2).max(64),
  brandName: z.string().trim().min(1).max(120),
  brandColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{3,8}$/, "Use a hex color like #1A1A1F")
    .optional(),
  brandLogoUrl: z.string().url().max(2000).optional().nullable(),
  enabled: z.boolean().optional(),
});

export async function POST(req: Request) {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request body." }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." },
      { status: 400 },
    );
  }

  const owner = await resolvePortalOwner(parsed.data.workspaceId);
  if (!owner) {
    return NextResponse.json(
      { ok: false, error: "Not authorized for this workspace." },
      { status: 403 },
    );
  }

  const slug = normalizeSlug(parsed.data.slug);
  if (!slug) {
    return NextResponse.json({ ok: false, error: "Choose a valid portal address." }, { status: 400 });
  }

  try {
    const config = await upsertPortalConfig({
      workspaceId: parsed.data.workspaceId,
      slug,
      brandName: parsed.data.brandName,
      brandColor: parsed.data.brandColor,
      brandLogoUrl: parsed.data.brandLogoUrl ?? undefined,
      enabled: parsed.data.enabled,
    });
    return NextResponse.json(
      { ok: true, portal: { slug: config.slug, enabled: config.enabled } },
      { status: 200 },
    );
  } catch (err) {
    // Most likely a slug collision (unique). Surface it as a 409.
    const message = err instanceof Error ? err.message : String(err);
    if (/unique|P2002/i.test(message)) {
      return NextResponse.json(
        { ok: false, error: "That portal address is taken — choose another." },
        { status: 409 },
      );
    }
    console.error("[portal] setup failed", err);
    return NextResponse.json({ ok: false, error: "Could not save the portal." }, { status: 500 });
  }
}
