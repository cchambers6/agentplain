// POST /api/mobile/push/test  — operator-only.
//
// Fires a test push to the calling operator's OWN registered devices. Lets
// us verify the end-to-end pipeline (token registration → Expo → device)
// during bring-up + EAS builds without waiting for a real approval to land.
// Operator-gated because it's a diagnostic, not a customer feature.

import { NextResponse, type NextRequest } from "next/server";
import { readMobileSession } from "@/lib/auth";
import {
  getPushProvider,
  listEnabledDevicesForUsers,
  disableDeviceByToken,
} from "@/lib/push";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = await readMobileSession(req);
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!session.isOperator) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const devices = await listEnabledDevicesForUsers([session.userId]);
  if (devices.length === 0) {
    return NextResponse.json(
      { ok: false, error: "no registered devices for this operator" },
      { status: 404 },
    );
  }

  const tickets = await getPushProvider().send(
    devices.map((d) => ({
      to: d.expoPushToken,
      title: "agentplain test",
      body: "Push pipeline is working. Tap to open.",
      data: { type: "test" },
    })),
  );

  await Promise.all(
    tickets
      .filter((t) => !t.ok && t.error === "DeviceNotRegistered")
      .map((t) => disableDeviceByToken(t.token).catch(() => {})),
  );

  return NextResponse.json({
    ok: true,
    sent: tickets.filter((t) => t.ok).length,
    failed: tickets.filter((t) => !t.ok).length,
  });
}
