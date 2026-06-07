// Expo push adapter.
//
// Talks to the Expo push service REST endpoint
// (https://exp.host/--/api/v2/push/send). This is the ONLY file in the
// codebase that knows the Expo wire shape — everything else speaks the
// PushProvider interface (lib/push/types).
//
// Expo accepts up to 100 messages per request; we chunk accordingly. The
// response is a parallel array of "tickets", each {status:"ok"|"error",...}.
// A token that comes back with details.error === "DeviceNotRegistered" is
// dead (uninstalled / revoked) — we surface that verbatim so the caller can
// disable the device row.

import { env } from "../env";
import type { PushMessage, PushProvider, PushTicket } from "./types";

const MAX_BATCH = 100;

interface ExpoTicket {
  status?: "ok" | "error";
  id?: string;
  message?: string;
  details?: { error?: string };
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

export class ExpoPushProvider implements PushProvider {
  readonly name = "expo" as const;

  async send(messages: PushMessage[]): Promise<PushTicket[]> {
    if (messages.length === 0) return [];
    const url = env.expoPushUrl();
    const accessToken = env.expoAccessToken();
    const tickets: PushTicket[] = [];

    for (const batch of chunk(messages, MAX_BATCH)) {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        Accept: "application/json",
        "Accept-Encoding": "gzip, deflate",
      };
      if (accessToken) headers["Authorization"] = `Bearer ${accessToken}`;

      let parsed: { data?: ExpoTicket[]; errors?: unknown } | null = null;
      try {
        const res = await fetch(url, {
          method: "POST",
          headers,
          body: JSON.stringify(
            batch.map((m) => ({
              to: m.to,
              title: m.title,
              body: m.body,
              data: m.data ?? {},
              sound: "default",
            })),
          ),
        });
        const json = (await res.json().catch(() => null)) as
          | { data?: ExpoTicket[]; errors?: unknown }
          | null;
        if (res.ok && json) parsed = json;
      } catch {
        parsed = null;
      }

      if (!parsed) {
        // Whole batch failed at the transport level — mark every token in it
        // failed (no error code, so the caller won't disable them; a transient
        // 5xx shouldn't evict a good device).
        for (const m of batch) tickets.push({ token: m.to, ok: false });
        continue;
      }

      const data = parsed.data ?? [];
      batch.forEach((m, i) => {
        const t = data[i];
        if (t && t.status === "ok") {
          tickets.push({ token: m.to, ok: true });
        } else {
          tickets.push({
            token: m.to,
            ok: false,
            error: t?.details?.error,
          });
        }
      });
    }

    return tickets;
  }
}
