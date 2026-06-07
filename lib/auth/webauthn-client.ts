// Client-side WebAuthn diagnostics. Pure browser helpers — NO server imports,
// safe to pull into "use client" components. Exists so a passkey failure logs
// the exact cause to the console (one-click debugging) instead of only showing
// the user a generic message.

/** True if rpId is usable on `host` per the WebAuthn spec: rpId must equal the
 *  host or be a registrable PARENT of it. (A child like app.agentplain.com is
 *  NOT a valid rpId on the apex agentplain.com.) */
export function rpIdValidForHost(rpId: string, host: string): boolean {
  const bare = host.split(":")[0];
  return bare === rpId || bare.endsWith(`.${rpId}`);
}

/** Pull a readable { name, message } off a rejected credentials.get/create
 *  promise (DOMException) for a console line. */
export function describeWebAuthnError(err: unknown): {
  name: string;
  message: string;
} {
  if (err && typeof err === "object") {
    const e = err as { name?: unknown; message?: unknown };
    return {
      name: typeof e.name === "string" ? e.name : "UnknownError",
      message: typeof e.message === "string" ? e.message : String(err),
    };
  }
  return { name: "UnknownError", message: String(err) };
}

/** Log a precise console error when the served rpId can't work on this origin —
 *  the exact misconfiguration that throws SecurityError on credentials.get().
 *  Returns true when a mismatch was detected. */
export function warnOnRpIdMismatch(rpId: string | undefined): boolean {
  if (!rpId || typeof window === "undefined") return false;
  const host = window.location.hostname;
  if (rpIdValidForHost(rpId, host)) return false;
  // eslint-disable-next-line no-console
  console.error(
    `[passkey] rpId "${rpId}" is not valid on origin "${window.location.origin}". ` +
      `WebAuthn requires rpId to equal the host or be a PARENT domain of it; ` +
      `"${rpId}" is not a parent of "${host}", so navigator.credentials.get() ` +
      `will throw SecurityError. The server should derive rpId from the request ` +
      `host (apex/app collapse to the registrable parent) or RP_ID must be set ` +
      `to a parent of this host.`,
  );
  return true;
}

/** Console line for a ceremony rejection, tagged so it's greppable in logs. */
export function logWebAuthnFailure(stage: "authenticate" | "register", err: unknown): void {
  const { name, message } = describeWebAuthnError(err);
  // eslint-disable-next-line no-console
  console.error(`[passkey] ${stage} failed: ${name} — ${message}`, err);
}
