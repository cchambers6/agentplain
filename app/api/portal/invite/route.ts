// POST /api/portal/invite — owner sends a magic-link invite to an end client.
//
// Owner-gated (BROKER_OWNER / OWNER / ADMIN of the workspace, or operator). The
// workspace's portal must exist AND be enabled first (set up via
// /api/portal/setup). Find-or-creates the client, mints a single-use link, and
// emails it. project_no_outbound_architecture: this sends ONE transactional
// invite the owner explicitly requested — no drip, no autonomous follow-up.

import { NextResponse } from "next/server";
import { z } from "zod";
import { resolvePortalOwner } from "@/lib/portal/owner-auth";
import { getPortalConfigForWorkspace, toPortalBrand } from "@/lib/portal/config";
import { inviteClientToPortal } from "@/lib/portal/invite";
import { env } from "@/lib/env";

export const runtime = "nodejs";

const bodySchema = z.object({
  workspaceId: z.string().uuid(),
  email: z.string().email(),
  name: z.string().trim().max(200).optional(),
  replyTo: z.string().email().optional(),
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
      { ok: false, error: "Provide a valid workspaceId and client email." },
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

  const config = await getPortalConfigForWorkspace(parsed.data.workspaceId);
  if (!config || !config.enabled) {
    return NextResponse.json(
      { ok: false, error: "Set up and enable your client portal before inviting clients." },
      { status: 409 },
    );
  }

  const result = await inviteClientToPortal({
    brand: toPortalBrand(config),
    appOrigin: env.appPublicOrigin(),
    email: parsed.data.email,
    name: parsed.data.name ?? null,
    replyTo: parsed.data.replyTo ?? null,
  });

  return NextResponse.json(
    { ok: true, clientId: result.clientId, inviteUrl: result.inviteUrl },
    { status: 200 },
  );
}
