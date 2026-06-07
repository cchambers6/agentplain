"use client";

import {
  browserSupportsWebAuthn,
  startRegistration,
} from "@simplewebauthn/browser";
import { useEffect, useState } from "react";

// One-time prompt to set up a passkey, shown across the workspace to a
// passkey-capable user who has none enrolled. This closes the chicken-and-egg
// gap that made passkeys effectively unreachable: the only enrollment surface
// used to be buried in Settings → Passkeys, so most people never set one up and
// the "sign in with a passkey" option on the sign-in page had nothing to offer.
// Enrolling here means the next visit can skip the email link entirely.
//
// Rendered only when the server confirmed `hasPasskey === false`. We additionally
// gate on browser support and a per-device dismissal so we never nag.

const DISMISS_KEY = "agentplain_passkey_nudge_dismissed";

type Status = "idle" | "working" | "added" | "error";

export function PasskeyEnrollNudge() {
  const [visible, setVisible] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!browserSupportsWebAuthn()) return;
    try {
      if (window.localStorage.getItem(DISMISS_KEY) === "1") return;
    } catch {
      // localStorage blocked (private mode) — still fine to show.
    }
    setVisible(true);
  }, []);

  const dismiss = () => {
    try {
      window.localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* ignore */
    }
    setVisible(false);
  };

  const enroll = async () => {
    setStatus("working");
    setMessage(null);
    try {
      const optionsRes = await fetch("/api/auth/passkey/register/options", {
        method: "POST",
      });
      if (!optionsRes.ok) throw new Error("options");
      const optionsJSON = await optionsRes.json();

      const attestation = await startRegistration({ optionsJSON });

      const verifyRes = await fetch("/api/auth/passkey/register/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ response: attestation }),
      });
      const result = (await verifyRes.json().catch(() => null)) as
        | { ok?: boolean; error?: string }
        | null;

      if (!verifyRes.ok || !result?.ok) {
        setStatus("error");
        setMessage(result?.error ?? "We couldn't add that passkey.");
        return;
      }
      setStatus("added");
      setMessage("Passkey added — next time you can skip the email link.");
      try {
        window.localStorage.setItem(DISMISS_KEY, "1");
      } catch {
        /* ignore */
      }
    } catch (err) {
      const name =
        err && typeof err === "object" && "name" in err
          ? String((err as { name?: unknown }).name)
          : "";
      // User dismissed the OS sheet — quiet reset, leave the nudge up.
      if (name === "NotAllowedError") {
        setStatus("idle");
        return;
      }
      setStatus("error");
      setMessage(
        name === "InvalidStateError"
          ? "This device already has a passkey for your account."
          : "Your browser blocked that passkey. You can still use the email link.",
      );
    }
  };

  if (!visible) return null;

  return (
    <div className="container-wide mt-4">
      <div
        role="region"
        aria-label="Set up a passkey"
        className="flex flex-col gap-3 border border-rule bg-paper-deep p-4 text-[14px] text-ink sm:flex-row sm:items-center sm:justify-between"
      >
        <div className="max-w-2xl">
          <p className="font-medium">
            Skip the email link next time — set up a passkey.
          </p>
          <p className="mt-1 text-ink-soft">
            Use your phone or laptop&rsquo;s fingerprint, face, or screen lock to
            sign in. Nothing to remember, no link to wait for.
          </p>
          {message ? (
            <p
              className={`mt-2 text-[13px] ${
                status === "error" ? "text-flag" : "text-ink-soft"
              }`}
              role="status"
            >
              {message}
            </p>
          ) : null}
        </div>
        {status !== "added" ? (
          <div className="flex shrink-0 items-center gap-4">
            <button
              type="button"
              onClick={enroll}
              disabled={status === "working"}
              className="border border-ink bg-ink px-4 py-2 text-[13px] font-medium text-paper transition hover:opacity-90 disabled:opacity-50"
            >
              {status === "working" ? "waiting for your device…" : "set up a passkey"}
            </button>
            <button
              type="button"
              onClick={dismiss}
              className="text-[13px] text-mute underline-offset-4 hover:text-ink hover:underline"
            >
              not now
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
