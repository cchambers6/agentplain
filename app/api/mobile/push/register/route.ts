// POST /api/mobile/push/register
//
// Registers (upserts) the calling device's Expo push token against the
// bearer's user, so the approval-ready trigger (lib/push/notify) can fan out
// to it. Idempotent on the token — a reinstall re-registers in place.
//
// Auth: the mobile bearer (lib/auth/mobile-session). User-level, not
// workspace-level — a push token belongs to the person's device and follows
// them across workspaces.

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { readMobileSession } from "@/lib/auth";
import { isExpoPushToken, registerPushDevice } from "@/lib/push";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BodySchema = z.object({
  expoPushToken: z.string().trim().min(1).max(256),
  platform: z.enum(["ios", "android"]),
  deviceName: z.string().trim().max(120).optional(),
});

export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = await readMobileSession(req);
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json body" }, { status: 400 });
  }
  const parsed = BodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid device payload" }, { status: 400 });
  }
  if (!isExpoPushToken(parsed.data.expoPushToken)) {
    return NextResponse.json(
      { error: "not a valid Expo push token" },
      { status: 400 },
    );
  }

  const device = await registerPushDevice({
    userId: session.userId,
    expoPushToken: parsed.data.expoPushToken,
    platform: parsed.data.platform,
    deviceName: parsed.data.deviceName ?? null,
  });

  return NextResponse.json({ ok: true, id: device.id });
}
