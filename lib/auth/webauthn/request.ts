// Extract the host + origin a passkey Route Handler is actually serving, from
// the request headers. WebAuthn rpID/expectedOrigin must track the real host
// (apex vs app vs preview vs localhost), so every passkey route resolves its
// config from this — never from a fixed env origin.
//
// Vercel terminates TLS at the edge and forwards the public host/proto in
// x-forwarded-*; we prefer those and fall back to Host for non-proxied dev.

import { headers } from "next/headers";
import type { RequestOriginInfo } from "./config";

export async function requestOriginInfo(): Promise<RequestOriginInfo> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost";
  const proto =
    h.get("x-forwarded-proto") ??
    (host.startsWith("localhost") || host.startsWith("127.0.0.1")
      ? "http"
      : "https");
  return { host, origin: `${proto}://${host}` };
}
